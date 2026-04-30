/**
 * ThermaShift Monitoring SaaS — Phase 2
 * Sensor webhook ingestion + alert rule evaluator (state machine).
 *
 * Routes registered in chat-proxy.js:
 *   POST   /webhook/sensor/:vendor?key=<client_api_key>
 *   POST   /api/monitoring/clients          (admin)
 *   POST   /api/monitoring/sites            (admin)
 *   POST   /api/monitoring/sensors          (admin)
 *   POST   /api/monitoring/alert-rules      (admin)
 *   POST   /api/monitoring/readings/manual  (admin — for testing)
 *   GET    /api/monitoring/clients/:id/overview  (admin)
 *   GET    /api/monitoring/incidents        (admin)
 *
 * Cron: evaluateAlertRules() runs every 60 seconds (registered in chat-proxy.js).
 */

import crypto from 'crypto';
import { notifyIncident } from './monitoring-notify.js';

// ═══════════════════════════════════════════════════════════
// VENDOR ADAPTERS — translate webhook payloads to canonical readings
// ═══════════════════════════════════════════════════════════

/**
 * Each adapter returns an array of { external_id, value, unit, recorded_at }.
 * Webhooks may carry one or many readings.
 */
const VENDOR_PARSERS = {
  // Monnit gateway POSTs JSON like:
  // { "gatewayMessage": { "sensorMessages": [{ "sensorID": "...", "dataValue": "72.4",
  //   "messageDate": "2026-04-29T20:00:00", "dataType": "temperature" }] } }
  monnit(payload) {
    const messages = payload?.gatewayMessage?.sensorMessages
      || (Array.isArray(payload?.sensorMessages) ? payload.sensorMessages : [payload]);
    const out = [];
    for (const m of messages) {
      const externalId = m.sensorID || m.sensor_id || m.sensorId;
      const value = parseFloat(m.dataValue ?? m.value);
      if (!externalId || isNaN(value)) continue;
      out.push({
        external_id: String(externalId),
        value,
        unit: m.dataType === 'humidity' ? '%' : (m.unit || '°F'),
        recorded_at: m.messageDate || m.date || new Date().toISOString(),
      });
    }
    return out;
  },

  // SensorPush API webhook (or compatible) — flat or array.
  // { "device_id": "abc", "temperature": 72.4, "humidity": 45, "observed_at": "..." }
  sensorpush(payload) {
    const items = Array.isArray(payload) ? payload : [payload];
    const out = [];
    for (const m of items) {
      const externalId = m.device_id || m.deviceId || m.id;
      if (!externalId) continue;
      // SensorPush typically reports both temp and humidity per device.
      // We split into two synthetic external_ids: <id>:temp and <id>:humidity.
      const ts = m.observed_at || m.time || new Date().toISOString();
      if (m.temperature != null) {
        out.push({ external_id: `${externalId}:temp`, value: parseFloat(m.temperature), unit: '°F', recorded_at: ts });
      }
      if (m.humidity != null) {
        out.push({ external_id: `${externalId}:humidity`, value: parseFloat(m.humidity), unit: '%', recorded_at: ts });
      }
    }
    return out;
  },

  // Disruptive Technologies webhook event:
  // { "event": { "targetName": "projects/.../devices/...", "eventType": "temperature",
  //   "data": { "temperature": { "value": 22.5, "updateTime": "..." } } } }
  disruptive(payload) {
    const ev = payload?.event || payload;
    const target = ev?.targetName || ev?.deviceId;
    const externalId = target ? target.split('/').pop() : null;
    const data = ev?.data || {};
    const out = [];
    if (data.temperature?.value != null) {
      out.push({
        external_id: externalId,
        value: data.temperature.value,
        unit: '°C',
        recorded_at: data.temperature.updateTime || ev.updateTime || new Date().toISOString(),
      });
    }
    if (data.humidity?.value != null) {
      out.push({
        external_id: `${externalId}:humidity`,
        value: data.humidity.value,
        unit: '%',
        recorded_at: data.humidity.updateTime || ev.updateTime || new Date().toISOString(),
      });
    }
    return out.filter(r => r.external_id && !isNaN(r.value));
  },

  // Generic adapter — for custom integrations / testing.
  // Body: { "external_id": "rack-12-temp", "value": 78.5, "unit": "°F", "recorded_at": "..." }
  // Or array of same.
  generic(payload) {
    const items = Array.isArray(payload) ? payload : [payload];
    return items.map(m => ({
      external_id: m.external_id,
      value: parseFloat(m.value),
      unit: m.unit || '',
      recorded_at: m.recorded_at || new Date().toISOString(),
    })).filter(r => r.external_id && !isNaN(r.value));
  },
};

// ═══════════════════════════════════════════════════════════
// INGESTION
// ═══════════════════════════════════════════════════════════

/**
 * Authenticate a webhook by client api_key. Returns the client record or null.
 */
export async function authenticateClient(sb, apiKey) {
  if (!apiKey) return null;
  const rows = await sb('monitoring_clients', 'GET', null,
    `?api_key=eq.${encodeURIComponent(apiKey)}&status=eq.active&limit=1`);
  return rows?.[0] || null;
}

/**
 * Process a webhook for the given vendor. Authenticates, parses, and ingests
 * each reading. Returns { ingested, skipped, errors }.
 */
export async function processSensorWebhook(sb, vendor, payload, apiKey) {
  const client = await authenticateClient(sb, apiKey);
  if (!client) return { error: 'invalid_client_key', status: 401 };

  const parser = VENDOR_PARSERS[vendor];
  if (!parser) return { error: 'unknown_vendor', status: 400 };

  let readings;
  try { readings = parser(payload); }
  catch (e) { return { error: 'parse_failed: ' + e.message, status: 400 }; }
  if (!readings.length) return { ingested: 0, skipped: 0, errors: ['no_readings_in_payload'] };

  let ingested = 0, skipped = 0;
  const errors = [];

  for (const r of readings) {
    try {
      // Lookup sensor by external_id within this client
      const sensors = await sb('monitoring_sensors', 'GET', null,
        `?external_id=eq.${encodeURIComponent(r.external_id)}&client_id=eq.${client.id}&limit=1`);
      const sensor = sensors?.[0];
      if (!sensor) { skipped++; errors.push(`unknown_sensor:${r.external_id}`); continue; }
      if (!sensor.active) { skipped++; continue; }

      // Insert reading
      await sb('monitoring_readings', 'POST', {
        sensor_id: sensor.id,
        client_id: client.id,
        recorded_at: r.recorded_at,
        value: r.value,
        unit: r.unit || sensor.unit || '',
        raw_payload: payload,
      });

      // Update sensor's last_reading
      await sb('monitoring_sensors', 'PATCH', {
        last_reading_at: r.recorded_at,
        last_reading_value: r.value,
        updated_at: new Date().toISOString(),
      }, `?id=eq.${sensor.id}`);

      ingested++;
    } catch (e) { errors.push(`ingest_error:${r.external_id}:${e.message}`); }
  }
  return { ingested, skipped, errors, client_id: client.id };
}

// ═══════════════════════════════════════════════════════════
// ALERT EVALUATOR — state machine
// ═══════════════════════════════════════════════════════════

/**
 * Evaluate one rule against the latest readings for its sensor.
 * Returns 'trigger' | 'recover' | 'noop'.
 *
 * - 'trigger': condition is met across the last `debounce_count` readings.
 * - 'recover': last reading is no longer in violation (single-sample recovery for now).
 * - 'noop': no state change.
 */
// Phase 7C: time-of-day check (returns true if rule is currently within its active window)
function inActiveWindow(rule, tz = 'America/New_York') {
  if (rule.active_hour_start == null && rule.active_hour_end == null && !rule.active_days_of_week?.length) return true;
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false, weekday: 'short' });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[parts.find(p => p.type === 'weekday').value];

  if (rule.active_days_of_week?.length && !rule.active_days_of_week.includes(day)) return false;
  if (rule.active_hour_start != null && rule.active_hour_end != null) {
    const s = rule.active_hour_start, e = rule.active_hour_end;
    if (s <= e) return hour >= s && hour < e;
    return hour >= s || hour < e; // wraps midnight
  }
  return true;
}

// Phase 7C: evaluate a single sub-condition (a chunk of a composite rule)
function evalSingleCondition(cond, readings) {
  if (!readings.length) return cond.rule_type === 'missing';
  const latest = readings[0];
  const v = Number(latest.value);
  switch (cond.rule_type || 'above') {
    case 'above': return v > Number(cond.threshold_value);
    case 'below': return v < Number(cond.threshold_value);
    case 'delta': {
      const oldest = readings[readings.length - 1];
      return Math.abs(v - Number(oldest.value)) > Number(cond.delta_value);
    }
    case 'missing': return false; // handled above
    default: return false;
  }
}

function evaluateRule(rule, readings, hasOpenIncident, getReadingsForSensor) {
  // Phase 7C: time-of-day gate. Outside active window: never trigger; if open incident, can still recover.
  if (!inActiveWindow(rule)) {
    if (!hasOpenIncident) return 'noop';
    // outside window with open incident — keep it open until normal recover logic decides
  }

  // Phase 7C: composite rule (multiple conditions across same or related sensors)
  if (rule.composite_logic && Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    const subResults = [];
    for (const cond of rule.conditions) {
      let r;
      if (cond.sensor_id && cond.sensor_id !== rule.sensor_id && getReadingsForSensor) {
        r = getReadingsForSensor(cond.sensor_id) || [];
      } else {
        r = readings;
      }
      subResults.push(evalSingleCondition(cond, r));
    }
    const triggered = rule.composite_logic === 'OR'
      ? subResults.some(Boolean) : subResults.every(Boolean);
    if (triggered && !hasOpenIncident) return 'trigger';
    if (!triggered && hasOpenIncident) return 'recover';
    return 'noop';
  }

  // Original simple rule path
  if (!readings.length) {
    if (rule.rule_type === 'missing' && rule.missing_after_minutes) {
      return hasOpenIncident ? 'noop' : 'trigger';
    }
    return 'noop';
  }

  const latest = readings[0];
  const isTriggering = (r) => {
    switch (rule.rule_type) {
      case 'above':   return Number(r.value) > Number(rule.threshold_value);
      case 'below':   return Number(r.value) < Number(rule.threshold_value);
      case 'delta': {
        const oldest = readings[readings.length - 1];
        return Math.abs(Number(latest.value) - Number(oldest.value)) > Number(rule.delta_value);
      }
      default: return false;
    }
  };

  const allTriggering = readings.slice(0, rule.debounce_count || 2).every(isTriggering);
  const latestTriggering = isTriggering(latest);

  if (allTriggering && !hasOpenIncident) return 'trigger';
  if (!latestTriggering && hasOpenIncident) return 'recover';
  return 'noop';
}

/**
 * Run alert evaluation across all active rules.
 * Called by 60-second cron.
 */
export async function evaluateAlertRules(sb) {
  const rules = await sb('monitoring_alert_rules', 'GET', null, '?active=eq.true&limit=1000');
  if (!rules?.length) return { evaluated: 0, triggered: 0, recovered: 0 };

  let triggered = 0, recovered = 0;

  for (const rule of rules) {
    try {
      // Get latest readings for this sensor within the eval window
      const windowMin = Math.max(rule.threshold_window_minutes || 5, 1);
      const windowAgo = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
      const readings = await sb('monitoring_readings', 'GET', null,
        `?sensor_id=eq.${rule.sensor_id}&recorded_at=gte.${windowAgo}&order=recorded_at.desc&limit=20`);

      // Find existing open incident for this rule
      const open = await sb('monitoring_incidents', 'GET', null,
        `?alert_rule_id=eq.${rule.id}&status=in.(open,acknowledged)&order=opened_at.desc&limit=1`);
      const openIncident = open?.[0];

      // Phase 7C: provide a readings fetcher for cross-sensor composite conditions
      const readingsCache = new Map();
      readingsCache.set(rule.sensor_id, readings || []);
      const getReadingsForSensor = (sid) => {
        if (readingsCache.has(sid)) return readingsCache.get(sid);
        return null;
      };
      // Pre-fetch readings for related sensors if composite
      if (rule.composite_logic && Array.isArray(rule.conditions)) {
        for (const cond of rule.conditions) {
          if (cond.sensor_id && cond.sensor_id !== rule.sensor_id && !readingsCache.has(cond.sensor_id)) {
            const r = await sb('monitoring_readings', 'GET', null,
              `?sensor_id=eq.${cond.sensor_id}&recorded_at=gte.${windowAgo}&order=recorded_at.desc&limit=20`);
            readingsCache.set(cond.sensor_id, r || []);
          }
        }
      }
      const verdict = evaluateRule(rule, readings || [], !!openIncident, getReadingsForSensor);

      if (verdict === 'trigger') {
        const triggerValue = readings?.[0]?.value ?? null;
        const created = await sb('monitoring_incidents', 'POST', {
          client_id: rule.client_id,
          alert_rule_id: rule.id,
          sensor_id: rule.sensor_id,
          site_id: rule.site_id,
          status: 'open',
          severity: rule.severity || 'warning',
          opened_at: new Date().toISOString(),
          trigger_value: triggerValue,
          trigger_threshold: rule.threshold_value,
          peak_value: triggerValue,
          summary: `${rule.name}: ${rule.rule_type} ${rule.threshold_value} (saw ${triggerValue})`,
        });
        triggered++;
        // Phase 3: dispatch notifications (don't await — fire-and-forget so the cron stays fast)
        const newIncident = created?.[0];
        if (newIncident) {
          dispatchNotificationsAsync(sb, newIncident, rule, 'triggered');
        }
      } else if (verdict === 'recover' && openIncident) {
        const opened = new Date(openIncident.opened_at).getTime();
        const duration = Math.floor((Date.now() - opened) / 1000);
        const resolved = await sb('monitoring_incidents', 'PATCH', {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          duration_seconds: duration,
          updated_at: new Date().toISOString(),
        }, `?id=eq.${openIncident.id}`);
        recovered++;
        const updated = resolved?.[0] || { ...openIncident, status: 'resolved', duration_seconds: duration };
        dispatchNotificationsAsync(sb, updated, rule, 'recovered');
      } else if (verdict === 'noop' && openIncident && readings?.[0]) {
        // Track peak value while incident is still open
        const v = Number(readings[0].value);
        const peak = Number(openIncident.peak_value);
        const morExtreme = (rule.rule_type === 'above' && v > peak)
                       || (rule.rule_type === 'below' && v < peak);
        if (morExtreme) {
          await sb('monitoring_incidents', 'PATCH',
            { peak_value: v, updated_at: new Date().toISOString() },
            `?id=eq.${openIncident.id}`);
        }
      }
    } catch (e) {
      console.error(`Alert eval error rule=${rule.id}:`, e.message);
    }
  }
  return { evaluated: rules.length, triggered, recovered };
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATION DISPATCH (Phase 3) — fire and forget
// ═══════════════════════════════════════════════════════════

/**
 * Resolve sensor/site/client for an incident, then call notifyIncident.
 * Runs async — alert eval cron does not block on notifications.
 */
function dispatchNotificationsAsync(sb, incident, rule, eventType) {
  (async () => {
    try {
      const [sensors, sites, clients] = await Promise.all([
        sb('monitoring_sensors', 'GET', null, `?id=eq.${incident.sensor_id}&limit=1`),
        incident.site_id ? sb('monitoring_sites', 'GET', null, `?id=eq.${incident.site_id}&limit=1`) : Promise.resolve([]),
        sb('monitoring_clients', 'GET', null, `?id=eq.${incident.client_id}&limit=1`),
      ]);
      const sensor = sensors?.[0];
      const site = sites?.[0];
      const client = clients?.[0];
      const results = await notifyIncident(sb, incident, rule, sensor, site, client, eventType);
      const sent = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok && r.status !== 'suppressed_quiet_hours').length;
      if (sent || failed) {
        console.log(`Incident #${incident.id} ${eventType}: notified via ${results.map(r => r.channel + (r.ok ? '✓' : '✗')).join(', ')}`);
      }
    } catch (e) {
      console.error(`Notification dispatch failed for incident=${incident.id}:`, e.message);
    }
  })();
}

// ═══════════════════════════════════════════════════════════
// HELPERS for admin endpoints
// ═══════════════════════════════════════════════════════════

export function generateApiKey() {
  return 'tsk_' + crypto.randomBytes(24).toString('hex');
}
