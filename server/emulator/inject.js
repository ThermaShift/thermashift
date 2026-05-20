/**
 * Low-level injection helper — POSTs a single reading (or batch) to the
 * production webhook endpoint. Used by all scenario files.
 *
 * Each scenario file imports `injectReading(...)` and `injectBatch(...)`
 * and chains them together to build a temperature trajectory.
 */

const BASE_URL = process.env.THERMASHIFT_BASE_URL || 'https://thermashift.net';

/**
 * Build a vendor-shaped payload for the given canonical reading.
 * Lets us test all 4 vendor adapters with the same scenario logic.
 */
function buildPayload(vendor, { externalId, value, unit, recordedAt }) {
  const ts = recordedAt || new Date().toISOString();
  switch (vendor) {
    case 'monnit':
      return {
        gatewayMessage: {
          sensorMessages: [{
            sensorID: externalId,
            dataValue: String(value),
            dataType: unit === '%' ? 'humidity' : 'temperature',
            messageDate: ts,
          }],
        },
      };
    case 'sensorpush':
      // SensorPush: one device reports both temp + humidity per push.
      // Pass humidity via a separate call with `unit='%'`.
      if (unit === '%') return { device_id: externalId.replace(/:humidity$/, ''), humidity: value, observed_at: ts };
      return { device_id: externalId.replace(/:temp$/, ''), temperature: value, observed_at: ts };
    case 'disruptive':
      return {
        event: {
          targetName: `projects/test/devices/${externalId}`,
          eventType: unit === '%' ? 'humidity' : 'temperature',
          data: unit === '%'
            ? { humidity: { value, updateTime: ts } }
            : { temperature: { value, updateTime: ts } },
        },
      };
    case 'generic':
    default:
      return { external_id: externalId, value, unit, recorded_at: ts };
  }
}

/**
 * POST a single reading. Returns `{ status, body }`.
 */
export async function injectReading({ vendor = 'generic', apiKey, externalId, value, unit, recordedAt, baseUrl = BASE_URL }) {
  if (!apiKey) throw new Error('apiKey required');
  if (!externalId) throw new Error('externalId required');
  const payload = buildPayload(vendor, { externalId, value, unit: unit || '°F', recordedAt });
  const url = `${baseUrl}/webhook/sensor/${vendor}?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  return { status: r.status, body: parsed };
}

/**
 * Inject a sequence of readings with a wait between each.
 * `series` is `[{ value, recordedAt? }, ...]`. The wait gives the alert
 * evaluator cron a chance to see each reading before the next arrives,
 * which matters for debounce_count logic.
 */
export async function injectBatch({ vendor = 'generic', apiKey, externalId, unit, series, waitMs = 0, baseUrl = BASE_URL, log = console.log }) {
  const results = [];
  for (const r of series) {
    const out = await injectReading({ vendor, apiKey, externalId, unit, value: r.value, recordedAt: r.recordedAt, baseUrl });
    log(`  → injected ${externalId}=${r.value}${unit || ''} status=${out.status}`);
    results.push(out);
    if (waitMs > 0) await new Promise(res => setTimeout(res, waitMs));
  }
  return results;
}

/**
 * Generate a linear trajectory from `from` to `to` over `steps`. Useful
 * for "gradual temp rise" / "recovery" scenarios.
 */
export function trajectory({ from, to, steps, intervalMinutes = 1 }) {
  const out = [];
  const startTime = Date.now() - (steps * intervalMinutes * 60 * 1000);
  for (let i = 0; i < steps; i++) {
    const value = from + ((to - from) * (i / Math.max(1, steps - 1)));
    out.push({
      value: Number(value.toFixed(2)),
      recordedAt: new Date(startTime + (i * intervalMinutes * 60 * 1000)).toISOString(),
    });
  }
  return out;
}

/**
 * Generate a single spike: N normal readings, then one outlier, then back to normal.
 */
export function spikeSequence({ baseline = 72, spike = 95, normalCount = 3, intervalMinutes = 1 }) {
  const startTime = Date.now() - ((normalCount * 2 + 1) * intervalMinutes * 60 * 1000);
  const series = [];
  for (let i = 0; i < normalCount; i++) {
    series.push({ value: baseline + (Math.random() * 0.6 - 0.3), recordedAt: new Date(startTime + i * intervalMinutes * 60 * 1000).toISOString() });
  }
  series.push({ value: spike, recordedAt: new Date(startTime + normalCount * intervalMinutes * 60 * 1000).toISOString() });
  for (let i = 0; i < normalCount; i++) {
    series.push({ value: baseline + (Math.random() * 0.6 - 0.3), recordedAt: new Date(startTime + (normalCount + 1 + i) * intervalMinutes * 60 * 1000).toISOString() });
  }
  return series;
}

/**
 * Generate oscillating values around a threshold (for "noisy near threshold"
 * scenarios that should NOT trigger rapid-fire alerts).
 */
export function oscillateAroundThreshold({ threshold, amplitude = 1.5, count = 20, intervalMinutes = 1 }) {
  const startTime = Date.now() - (count * intervalMinutes * 60 * 1000);
  return Array.from({ length: count }, (_, i) => ({
    value: Number((threshold + Math.sin(i * 0.7) * amplitude).toFixed(2)),
    recordedAt: new Date(startTime + i * intervalMinutes * 60 * 1000).toISOString(),
  }));
}
