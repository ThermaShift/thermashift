/**
 * Materialize all 7 demo scenarios in Supabase from server/demo-scenarios.js.
 *
 * Idempotent — wipes prior demo data for each scenario, then re-creates clean.
 * Run on VPS: node server/seed-all-demos.js
 */
import { SCENARIOS } from './demo-scenarios.js';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(t, m, b, q = '') {
  const r = await fetch(`${SUPABASE_URL}/${t}${q}`, {
    method: m,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: b ? JSON.stringify(b) : undefined,
  });
  if (!r.ok) throw new Error(`${m} ${t}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const SAMPLES_PER_DAY = 288;     // every 5 min for 24h
const STEP_MS = 5 * 60 * 1000;

function generateReadings(sensors, sensorIdMap, clientId) {
  const now = Date.now();
  const allRows = [];
  for (const s of sensors) {
    const sensorId = sensorIdMap.get(s.name + '|' + s.siteIndex);
    if (!sensorId) continue;
    let lastVal = s.baseline;
    for (let i = SAMPLES_PER_DAY; i > 0; i--) {
      const ts = new Date(now - i * STEP_MS).toISOString();
      const diurnal = Math.sin((SAMPLES_PER_DAY - i) / SAMPLES_PER_DAY * Math.PI * 2) * s.variance * 0.5;
      const drift = (Math.random() - 0.5) * s.variance * 0.3;
      lastVal += drift;
      lastVal = lastVal * 0.7 + (s.baseline + diurnal) * 0.3;
      let v = +lastVal.toFixed(2);
      if (s.willTrigger && i < 6) v = +(s.baseline + s.variance + 2 + Math.random() * 2).toFixed(2);
      allRows.push({ sensor_id: sensorId, client_id: clientId, recorded_at: ts, value: v, unit: s.unit });
    }
  }
  return allRows;
}

async function purgeScenario(clientId) {
  // Order matters due to FK — children first
  for (const t of [
    'cooling_action_audit',
    'cooling_actions',
    'cooling_action_permissions',
    'monitoring_alert_notifications',
    'monitoring_incidents',
    'monitoring_readings',
    'monitoring_alert_rules',
    'monitoring_sensors',
    'monitoring_sites',
    'advisor_chats',
    'sales_escalations',
    'client_dashboards',
  ]) {
    try { await sb(t, 'DELETE', null, `?client_id=eq.${clientId}`); } catch { /* table may not exist if v6/v7/v8 not run; that's diagnosed elsewhere */ }
  }
}

async function seedScenario(scenario) {
  console.log(`\n━━━━ ${scenario.icon} ${scenario.label}: ${scenario.company} ━━━━`);

  // Find or create client
  let client;
  const existing = await sb('monitoring_clients', 'GET', null, `?api_key=eq.${encodeURIComponent(scenario.apiKey)}&limit=1`);
  if (existing?.[0]) {
    client = existing[0];
    await purgeScenario(client.id);
    console.log(`  → existing client (id=${client.id}) — purged prior demo data`);
  } else {
    const created = await sb('monitoring_clients', 'POST', {
      company: scenario.company,
      primary_contact_name: scenario.contactName,
      primary_contact_email: scenario.contactEmail,
      api_key: scenario.apiKey,
      tier: 'pro',
      timezone: scenario.timezone,
      notes: `${scenario.label} demo · ${scenario.blurb}`,
    });
    client = created[0];
    console.log(`  → created client (id=${client.id})`);
  }

  // Update fields that always need to be current
  await sb('monitoring_clients', 'PATCH', {
    company: scenario.company,
    primary_contact_name: scenario.contactName,
    primary_contact_email: scenario.contactEmail,
    tier: 'pro',
    timezone: scenario.timezone,
    actions_enabled: true,
    action_webhook_url: 'https://example.com/cooling-webhook',
    is_demo: true,
    demo_advisor_response: scenario.advisorResponse,
    demo_chat_disabled_message: `This is a public demo for the ${scenario.label} scenario — interactive AI chat is reserved for paying Pro-tier clients. The conversation above shows what a real ${scenario.company} client interaction looks like in production.\n\nWant this on YOUR data? Email steve@thermashift.net for a 30-min consultation. A real Pro instance can be running on your sensors within 24 hours.`,
    notes: `${scenario.label} demo · ${scenario.blurb}`,
    updated_at: new Date().toISOString(),
  }, `?id=eq.${client.id}`);

  // Sites
  const siteIds = [];
  for (const site of scenario.sites) {
    const [s] = await sb('monitoring_sites', 'POST', { client_id: client.id, ...site });
    siteIds.push(s.id);
  }
  console.log(`  → ${siteIds.length} sites`);

  // Sensors
  const sensorIdMap = new Map();
  for (const sensor of scenario.sensors) {
    const [s] = await sb('monitoring_sensors', 'POST', {
      client_id: client.id,
      site_id: siteIds[sensor.siteIndex],
      external_id: `demo-${client.id}-${sensor.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      vendor: 'monnit',
      name: sensor.name,
      sensor_type: sensor.type,
      unit: sensor.unit,
      location: sensor.location || '',
      zone: sensor.zone || '',
      active: true,
    });
    sensorIdMap.set(sensor.name + '|' + sensor.siteIndex, s.id);
  }
  console.log(`  → ${scenario.sensors.length} sensors`);

  // Readings (24h × every 5min)
  const readings = generateReadings(scenario.sensors, sensorIdMap, client.id);
  for (let i = 0; i < readings.length; i += 200) {
    await sb('monitoring_readings', 'POST', readings.slice(i, i + 200));
  }
  // Update sensor last_reading
  for (const sensor of scenario.sensors) {
    const sid = sensorIdMap.get(sensor.name + '|' + sensor.siteIndex);
    const last = readings.filter(r => r.sensor_id === sid).slice(-1)[0];
    if (last) {
      await sb('monitoring_sensors', 'PATCH',
        { last_reading_at: last.recorded_at, last_reading_value: last.value, updated_at: new Date().toISOString() },
        `?id=eq.${sid}`);
    }
  }
  console.log(`  → ${readings.length} readings`);

  // Alert rule
  const ruleSensorId = sensorIdMap.get(scenario.rule.sensorName + '|' + scenario.rule.siteIndex);
  const [rule] = await sb('monitoring_alert_rules', 'POST', {
    client_id: client.id,
    site_id: siteIds[scenario.rule.siteIndex],
    sensor_id: ruleSensorId,
    name: scenario.rule.name,
    rule_type: scenario.rule.rule_type,
    threshold_value: scenario.rule.threshold_value,
    threshold_window_minutes: scenario.rule.threshold_window_minutes,
    severity: scenario.rule.severity,
    debounce_count: scenario.rule.debounce_count,
    active: true,
    notify_email: true,
    notify_sms: false,
    notify_voice: false,
  });

  // Open incident (if scenario has one)
  let openIncident = null;
  if (scenario.openIncident) {
    const inc = scenario.openIncident;
    const [i] = await sb('monitoring_incidents', 'POST', {
      client_id: client.id,
      alert_rule_id: rule.id,
      sensor_id: sensorIdMap.get(inc.sensorName + '|' + inc.siteIndex),
      site_id: siteIds[inc.siteIndex],
      status: 'open',
      severity: inc.severity,
      opened_at: new Date(Date.now() - inc.minutesAgo * 60 * 1000).toISOString(),
      trigger_value: inc.trigger_value,
      trigger_threshold: inc.trigger_threshold,
      peak_value: inc.peak_value,
      summary: inc.summary,
    });
    openIncident = i;
  }

  // Cooling actions — pending
  const pendingActionIds = [];
  for (const act of scenario.coolingActions.pending || []) {
    const [a] = await sb('cooling_actions', 'POST', {
      client_id: client.id,
      site_id: siteIds[scenario.rule.siteIndex] || null,
      incident_id: openIncident?.id || null,
      action_type: act.action_type,
      target_label: act.target_label,
      parameters: act.parameters,
      reasoning: act.reasoning,
      status: 'proposed',
      requires_permission: true,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    pendingActionIds.push(a.id);
  }

  // Historical manual
  let manualActId = null;
  if (scenario.coolingActions.historicalManual) {
    const m = scenario.coolingActions.historicalManual;
    const t4hAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const [a] = await sb('cooling_actions', 'POST', {
      client_id: client.id,
      site_id: siteIds[scenario.rule.siteIndex] || null,
      action_type: m.action_type,
      target_label: m.target_label,
      parameters: m.params,
      reasoning: m.reasoning,
      status: 'completed',
      requires_permission: true,
      approved_by: scenario.contactEmail,
      approved_at: t4hAgo.toISOString(),
      executed_at: new Date(t4hAgo.getTime() + 2000).toISOString(),
      webhook_status_code: 200,
      webhook_response: '{"ok":true,"applied":true}',
      created_at: new Date(t4hAgo.getTime() - 60000).toISOString(),
    });
    manualActId = a.id;
  }

  // Historical auto
  let autoActId = null;
  if (scenario.coolingActions.historicalAuto) {
    const a = scenario.coolingActions.historicalAuto;
    const t24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [act] = await sb('cooling_actions', 'POST', {
      client_id: client.id,
      site_id: siteIds[scenario.rule.siteIndex] || null,
      action_type: a.action_type,
      target_label: a.target_label,
      parameters: a.params,
      reasoning: a.reasoning,
      status: 'completed',
      requires_permission: false,
      approved_by: 'auto-approval rule',
      approved_at: t24hAgo.toISOString(),
      executed_at: new Date(t24hAgo.getTime() + 1500).toISOString(),
      webhook_status_code: 200,
      webhook_response: '{"ok":true}',
      created_at: new Date(t24hAgo.getTime() - 30000).toISOString(),
    });
    autoActId = act.id;
  }

  // Permission rule
  if (scenario.coolingActions.autoRule) {
    await sb('cooling_action_permissions', 'POST', {
      client_id: client.id,
      site_id: siteIds[scenario.rule.siteIndex] || null,
      action_type: scenario.coolingActions.autoRule.action_type,
      auto_approve: true,
      max_severity: 'critical',
      active: true,
      created_by: scenario.contactEmail,
      notes: 'Auto-approval rule for routine, low-risk action.',
    });
  }

  // Audit entries
  const auditEntries = [];
  if (manualActId) {
    const t = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    auditEntries.push(
      { id: manualActId, type: 'proposed', actor: 'ai', t },
      { id: manualActId, type: 'approved', actor: scenario.contactEmail, t },
      { id: manualActId, type: 'executed', actor: scenario.contactEmail, t, details: { webhook_status: 200 } }
    );
  }
  if (autoActId) {
    const t = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    auditEntries.push(
      { id: autoActId, type: 'proposed', actor: 'ai', t, details: { auto_approved: true } },
      { id: autoActId, type: 'executed', actor: 'auto-approval', t, details: { webhook_status: 200 } }
    );
  }
  for (const id of pendingActionIds) {
    auditEntries.push({ id, type: 'proposed', actor: 'ai', t: new Date().toISOString() });
  }
  for (const e of auditEntries) {
    await sb('cooling_action_audit', 'POST', {
      client_id: client.id, cooling_action_id: e.id, event_type: e.type,
      actor: e.actor, details: e.details || null, created_at: e.t,
    });
  }
  console.log(`  → ${pendingActionIds.length} pending + ${manualActId ? 1 : 0} manual + ${autoActId ? 1 : 0} auto cooling actions, ${auditEntries.length} audit entries`);

  // Advisor chat
  const messages = scenario.chat.messages.map((m, i) => ({
    ...m,
    ts: new Date(Date.now() - (scenario.chat.messages.length - i) * 60 * 1000).toISOString(),
  }));
  await sb('advisor_chats', 'POST', {
    client_id: client.id,
    incident_id: openIncident?.id || null,
    title: scenario.chat.title,
    messages,
    message_count: messages.length,
    last_message_at: messages[messages.length - 1].ts,
  });
  console.log(`  → advisor chat (${messages.length} msgs)`);

  // Sales escalations
  for (const e of scenario.escalations) {
    await sb('sales_escalations', 'POST', {
      client_id: client.id,
      trigger_pattern: e.trigger_pattern,
      related_incident_ids: openIncident ? [openIncident.id] : [],
      recommended_service: e.service,
      estimated_value_low: e.value_low,
      estimated_value_high: e.value_high,
      ai_pitch_summary: e.pitch,
      status: 'pending_client',
    });
  }
  console.log(`  → ${scenario.escalations.length} sales escalations`);

  // Default custom dashboard
  await sb('client_dashboards', 'POST', {
    client_id: client.id,
    name: 'Operations Dashboard',
    is_default: true,
    layout: [
      { i: 'advisor', x: 0, y: 0, w: 12, h: 4 },
      { i: 'incidents', x: 0, y: 4, w: 8, h: 3 },
      { i: 'kpi-open', x: 8, y: 4, w: 4, h: 2 },
      { i: 'kpi-sites', x: 8, y: 6, w: 2, h: 1 },
      { i: 'kpi-sensors', x: 10, y: 6, w: 2, h: 1 },
      { i: 'sites', x: 0, y: 7, w: 12, h: 6 },
      { i: 'cooling-actions', x: 0, y: 13, w: 12, h: 4 },
    ],
    widgets: [
      { id: 'advisor', type: 'ai_advisor', title: 'AI Cooling Advisor' },
      { id: 'incidents', type: 'incident_list', title: 'Open Incidents' },
      { id: 'kpi-open', type: 'kpi_card', title: 'Open Incidents', props: { metric: 'open_incidents' } },
      { id: 'kpi-sites', type: 'kpi_card', title: 'Sites', props: { metric: 'site_count' } },
      { id: 'kpi-sensors', type: 'kpi_card', title: 'Sensors', props: { metric: 'sensor_count' } },
      { id: 'sites', type: 'sites_overview', title: 'Sites' },
      { id: 'cooling-actions', type: 'cooling_actions', title: 'AI Cooling Actions' },
    ],
  });
  console.log(`  → custom dashboard`);

  console.log(`  ✓ ${scenario.label} ready: https://thermashift.net/saas?key=${scenario.apiKey}`);
}

async function main() {
  console.log(`\n🎬 Seeding ${SCENARIOS.length} demo scenarios...\n`);
  for (const scenario of SCENARIOS) {
    try {
      await seedScenario(scenario);
    } catch (e) {
      console.error(`✗ Failed to seed ${scenario.label}:`, e.message);
    }
  }
  console.log(`\n\n✅ Done. ${SCENARIOS.length} demos available.\n`);
  console.log(`Demo Library URL (admin only): https://thermashift.net/admin/demos\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
