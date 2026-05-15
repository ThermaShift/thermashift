/**
 * ThermaShift AI Cooling Advisor — Phase 4B
 *
 * Takes monitoring context (sensor readings, open incidents, site info) and
 * generates actionable analysis + tactical recommendations + a smart upsell
 * tied to one of ThermaShift's 4 services. Uses Claude Sonnet for quality.
 *
 * Endpoint: POST /api/monitoring/client/advisor
 *   { context: 'incident' | 'overview', incident_id?: number }
 *
 * Response:
 *   { headline, analysis, recommendations: [...], upsell: {...}, cached: bool }
 *
 * Cached in-memory for 30 minutes to keep API spend under control.
 */

// Read at call time — chat-proxy.js calls dotenv.config() AFTER imports resolve.
const apiKey = () => process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map(); // key -> { data, expiresAt }

const SYSTEM_PROMPT = `You are ThermaShift's AI Cooling Advisor — a senior data center cooling engineer reviewing a real-time monitoring report.

Your client pays $99-599/month for ThermaShift's monitoring service. Your job is to give them:
1. A clear, confident analysis of what's happening (or what's healthy)
2. 2-3 specific tactical recommendations they can act on
3. Identify which of ThermaShift's 4 services would create real value — and quantify it

THERMASHIFT'S 4 SERVICES (always tie a recommendation back to one of these when relevant):

1. **Liquid Cooling Design & Install** (internal tag: `LCaaS`) — ONE-TIME project. Thermal assessment, CFD modeling, equipment procurement, installation, commissioning. Equipment paid 100% upfront, client owns it day one. Labor billed 30/40/30. NOT a subscription. Best fit when sustained temps >80°F or AI/GPU density planned. $50K-$500K. Ongoing monitoring optionally via our SaaS tiers.

2. **Waste Heat Recovery & Monetization** — Capture and monetize wasted heat from servers (greenhouses, district heating, algae cultivation). Generates $100K-$1M/year incremental revenue from heat that currently vents to atmosphere. Best fit when sustained CRAC return temps >75°F across multiple sites.

3. **Thermal Intelligence Platform expansion** — Add more sensors, predictive ML, capacity planning. $99-599/mo recurring. Best fit when client has <10 sensors per site or no humidity/airflow coverage.

4. **ESG/Sustainability Consulting** — Compliance docs, carbon accounting, Section 179D tax deductions ($1.88/sq ft, expires June 30 2026), Duke Energy efficiency rebates. $5K-$50K projects. Best fit when client mentions ESG, sustainability, or capital efficiency.

RULES:
- Be specific. Reference actual data points (sensor names, values, deltas) from the context provided.
- Be confident. Don't hedge with "might" or "could possibly" — say what's happening and what to do.
- If everything looks healthy, still give 1-2 proactive recommendations and a soft upsell.
- Quantify dollar value when you can. "$200K/year savings" beats "significant savings."
- If recommending an upsell, name the specific service and why their data supports it.
- ALWAYS output valid JSON only. No preamble. No markdown code fences.

OUTPUT SHAPE (return this JSON exactly):
{
  "headline": "1-line plain-language summary",
  "analysis": "2-3 sentences explaining what the data shows and why it matters",
  "recommendations": [
    { "action": "concrete thing to do", "urgency": "today|this week|this month", "expected_impact": "what changes if they do it" }
  ],
  "upsell": {
    "service": "LCaaS|Waste Heat Recovery|Platform Expansion|ESG Consulting|null",
    "why": "1 sentence tying the data to the service",
    "estimated_value": "$X-$Y" or null,
    "cta": "Schedule a free 30-min consultation"
  }
}`;

async function callClaude(userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    (await import('./anthropic-alert.js')).notifyIfCreditError('monitoring_advisor', res.status, errText).catch(() => {});
    throw new Error(`Anthropic API: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  // Extract JSON even if model adds stray text
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Advisor returned non-JSON response');
  return JSON.parse(m[0]);
}

// ─── Context builders ───────────────────────────────────────

function summariseSensor(s, recentReadings) {
  const vals = recentReadings.map(r => Number(r.value)).filter(v => !isNaN(v));
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const latest = vals[vals.length - 1];
  return {
    name: s.name, location: s.location || '', zone: s.zone || '',
    type: s.sensor_type, unit: s.unit || '',
    latest, avg: +avg.toFixed(1), min, max,
    samples: vals.length,
  };
}

async function buildIncidentContext(sb, clientId, incidentId) {
  const incidents = await sb('monitoring_incidents', 'GET', null, `?id=eq.${incidentId}&client_id=eq.${clientId}&limit=1`);
  const incident = incidents?.[0];
  if (!incident) throw new Error('incident_not_found');

  const [sensors, sites, rules] = await Promise.all([
    incident.sensor_id ? sb('monitoring_sensors', 'GET', null, `?id=eq.${incident.sensor_id}&limit=1`) : Promise.resolve([]),
    incident.site_id ? sb('monitoring_sites', 'GET', null, `?id=eq.${incident.site_id}&limit=1`) : Promise.resolve([]),
    incident.alert_rule_id ? sb('monitoring_alert_rules', 'GET', null, `?id=eq.${incident.alert_rule_id}&limit=1`) : Promise.resolve([]),
  ]);
  const sensor = sensors?.[0];
  const site = sites?.[0];
  const rule = rules?.[0];

  // Last 24h of readings on this sensor
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const readings = sensor ? await sb('monitoring_readings', 'GET', null,
    `?sensor_id=eq.${sensor.id}&recorded_at=gte.${since}&order=recorded_at.asc&limit=500`) : [];
  const summary = sensor ? summariseSensor(sensor, readings || []) : null;

  return { incident, sensor, site, rule, sensorSummary: summary };
}

async function buildOverviewContext(sb, clientId) {
  const [client, sites, sensors, openIncidents, recentResolved] = await Promise.all([
    sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`),
    sb('monitoring_sites', 'GET', null, `?client_id=eq.${clientId}`),
    sb('monitoring_sensors', 'GET', null, `?client_id=eq.${clientId}`),
    sb('monitoring_incidents', 'GET', null, `?client_id=eq.${clientId}&status=in.(open,acknowledged)&order=opened_at.desc`),
    sb('monitoring_incidents', 'GET', null, `?client_id=eq.${clientId}&status=eq.resolved&order=opened_at.desc&limit=10`),
  ]);

  // Summarize each sensor with last 6 hours of data (lighter than full 24h)
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const sensorSummaries = [];
  for (const s of sensors || []) {
    const r = await sb('monitoring_readings', 'GET', null,
      `?sensor_id=eq.${s.id}&recorded_at=gte.${since}&order=recorded_at.asc&limit=200`);
    const sum = summariseSensor(s, r || []);
    if (sum) sensorSummaries.push(sum);
  }

  return { client: client?.[0], sites, sensorSummaries, openIncidents, recentResolved };
}

// ─── Public API ─────────────────────────────────────────────

export async function generateAdvice(sb, clientId, opts = {}) {
  const { context = 'overview', incident_id } = opts;
  const cacheKey = `${clientId}:${context}:${incident_id || ''}`;

  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return { ...hit.data, cached: true };

  // Demo mode: if the client is flagged is_demo, return the pre-baked response
  // without calling Claude. Saves API spend on prospect demos and gives
  // tightly-scripted control of the narrative for sales calls.
  const clientRows = await sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`);
  const clientRow = clientRows?.[0];
  if (clientRow?.is_demo && clientRow?.demo_advisor_response) {
    const baked = clientRow.demo_advisor_response;
    cache.set(cacheKey, { data: baked, expiresAt: Date.now() + CACHE_TTL_MS });
    return { ...baked, cached: false, demo_mode: true };
  }

  let prompt;
  if (context === 'incident' && incident_id) {
    const ctx = await buildIncidentContext(sb, clientId, incident_id);
    prompt = `INCIDENT REPORT — please analyze and advise.

CLIENT: ${(await sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`))?.[0]?.company || 'unknown'}
SITE: ${ctx.site?.name || 'n/a'}${ctx.site?.city ? ` (${ctx.site.city}, ${ctx.site.state})` : ''}
RACK COUNT: ${ctx.site?.rack_count || 'unknown'}
FACILITY TYPE: ${ctx.site?.facility_type || 'unknown'}

SENSOR: ${ctx.sensor?.name} (${ctx.sensor?.sensor_type}, ${ctx.sensor?.unit})
LOCATION: ${ctx.sensor?.location || 'n/a'} / ${ctx.sensor?.zone || 'n/a'}

RULE: "${ctx.rule?.name}" — ${ctx.rule?.rule_type} ${ctx.rule?.threshold_value} ${ctx.sensor?.unit}

INCIDENT:
  status:        ${ctx.incident.status}
  severity:      ${ctx.incident.severity}
  opened:        ${ctx.incident.opened_at}
  trigger value: ${ctx.incident.trigger_value} ${ctx.sensor?.unit}
  threshold:     ${ctx.incident.trigger_threshold} ${ctx.sensor?.unit}
  peak value:    ${ctx.incident.peak_value || ctx.incident.trigger_value} ${ctx.sensor?.unit}
  duration so far: ${ctx.incident.duration_seconds ? Math.floor(ctx.incident.duration_seconds / 60) + 'min' : 'still open'}

LAST 24H ON THIS SENSOR (n=${ctx.sensorSummary?.samples}):
  latest: ${ctx.sensorSummary?.latest} ${ctx.sensor?.unit}
  avg:    ${ctx.sensorSummary?.avg} ${ctx.sensor?.unit}
  range:  ${ctx.sensorSummary?.min} – ${ctx.sensorSummary?.max} ${ctx.sensor?.unit}

Analyze the incident, recommend actions, and identify which ThermaShift service maps to this situation.`;
  } else {
    const ctx = await buildOverviewContext(sb, clientId);
    const sensorLines = ctx.sensorSummaries.slice(0, 20).map(s =>
      `  ${s.name} (${s.type}, ${s.zone || s.location || 'unzoned'}): latest ${s.latest}${s.unit}, avg ${s.avg}${s.unit}, range ${s.min}-${s.max}${s.unit}`).join('\n');
    const incidentLines = (ctx.openIncidents || []).map(i => `  OPEN: ${i.summary} (${i.severity}, ${i.peak_value}${i.trigger_threshold ? '/' + i.trigger_threshold : ''})`).join('\n');
    const recentLines = (ctx.recentResolved || []).slice(0, 5).map(i => `  RESOLVED: ${i.summary}`).join('\n');

    prompt = `OVERVIEW REPORT — please analyze and advise.

CLIENT: ${ctx.client?.company || 'unknown'} (tier: ${ctx.client?.tier || 'unknown'})
SITES: ${ctx.sites?.length || 0}
${(ctx.sites || []).map(s => `  ${s.name} — ${s.city || ''} ${s.state || ''} — ${s.facility_type || ''} — ${s.rack_count || '?'} racks`).join('\n')}

SENSORS LAST 6H (${ctx.sensorSummaries.length}):
${sensorLines || '  (no recent data)'}

INCIDENTS:
${incidentLines || '  no open incidents'}
${recentLines ? '\nRECENT RESOLVED:\n' + recentLines : ''}

Give a strategic advisory: what is healthy, what's drifting, what tactical actions to take, and which ThermaShift service would create the most value for this client right now.`;
  }

  const advice = await callClaude(prompt);
  cache.set(cacheKey, { data: advice, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...advice, cached: false };
}
