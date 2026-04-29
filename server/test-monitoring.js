// End-to-end test of Phase 2 monitoring SaaS:
// client → site → sensor → rule → webhook ingest → state machine → incident
// Run on VPS: node server/test-monitoring.js
import crypto from 'crypto';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

async function sb(table, method, body, query = '') {
  const res = await fetch(`${SUPABASE_URL}/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('  ', ...a);

async function main() {
  const tag = `e2e-${Date.now()}`;
  console.log(`\n▶ End-to-end monitoring test (tag=${tag})\n`);

  // 1. Create test client with api_key
  const apiKey = 'tsk_e2e_' + crypto.randomBytes(8).toString('hex');
  const [client] = await sb('monitoring_clients', 'POST', {
    company: `${tag} Test Co`,
    primary_contact_email: `${tag}@test.thermashift.net`,
    api_key: apiKey,
    tier: 'guard',
    notes: 'Phase 2 E2E test',
  });
  log(`✓ client id=${client.id} api_key=${apiKey}`);

  // 2. Create site
  const [site] = await sb('monitoring_sites', 'POST', {
    client_id: client.id,
    name: `${tag} Charlotte DC`,
    city: 'Charlotte', state: 'NC',
    facility_type: 'colocation',
    rack_count: 50,
  });
  log(`✓ site id=${site.id}`);

  // 3. Create sensor (external_id='RACK-12-TEMP')
  const externalId = `${tag}-rack12-temp`;
  const [sensor] = await sb('monitoring_sensors', 'POST', {
    client_id: client.id,
    site_id: site.id,
    external_id: externalId,
    vendor: 'generic',
    name: 'Rack 12 Hot Aisle Temp',
    sensor_type: 'temperature',
    unit: '°F',
    location: 'Cold aisle 3, Rack 12',
    active: true,
  });
  log(`✓ sensor id=${sensor.id} external_id=${externalId}`);

  // 4. Create alert rule: temperature > 80°F sustained 2 readings → critical
  const [rule] = await sb('monitoring_alert_rules', 'POST', {
    client_id: client.id,
    site_id: site.id,
    sensor_id: sensor.id,
    name: 'Hot aisle over 80°F',
    rule_type: 'above',
    threshold_value: 80,
    threshold_window_minutes: 10,
    severity: 'critical',
    debounce_count: 2,
    active: true,
    notify_email: true,
  });
  log(`✓ rule id=${rule.id} ABOVE 80°F debounce=2`);

  // 5. Send a SAFE reading (75°F) — should NOT trigger
  console.log('\n— Phase A: ingest SAFE reading (75°F) —');
  const safeRes = await fetch(`${APP_URL}/webhook/sensor/generic?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_id: externalId, value: 75, unit: '°F' }),
  });
  log(`webhook: ${safeRes.status}`, await safeRes.json());

  // 6. Send TWO HOT readings (85, 86) — should trigger after debounce
  console.log('\n— Phase B: ingest HOT readings (85, 86) —');
  for (const v of [85, 86]) {
    const r = await fetch(`${APP_URL}/webhook/sensor/generic?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ external_id: externalId, value: v, unit: '°F' }),
    });
    log(`  webhook ${v}°F: ${r.status}`, await r.json());
  }

  // 7. Wait for alert eval cron to fire (it runs every 60s)
  console.log('\n— Waiting 75s for alert evaluator cron —');
  await sleep(75 * 1000);

  // 8. Check incidents
  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?alert_rule_id=eq.${rule.id}&order=opened_at.desc`);
  log(`incidents found: ${incidents.length}`);
  for (const i of incidents) {
    log(`  incident id=${i.id} status=${i.status} severity=${i.severity} trigger=${i.trigger_value} peak=${i.peak_value}`);
  }

  if (!incidents.length) {
    console.log('\n✗ TEST FAILED — no incident was created. Check pm2 logs for "Alert eval".');
    return;
  }
  if (incidents[0].status !== 'open') {
    console.log(`\n✗ TEST FAILED — incident status is "${incidents[0].status}", expected "open".`);
    return;
  }
  log('✓ incident opened');

  // 9. Send RECOVERY reading (72°F) — should resolve incident
  console.log('\n— Phase C: ingest RECOVERY reading (72°F) —');
  const recRes = await fetch(`${APP_URL}/webhook/sensor/generic?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_id: externalId, value: 72, unit: '°F' }),
  });
  log(`webhook: ${recRes.status}`, await recRes.json());

  // 10. Wait for next cron eval
  console.log('\n— Waiting 75s for recovery —');
  await sleep(75 * 1000);

  const after = await sb('monitoring_incidents', 'GET', null,
    `?id=eq.${incidents[0].id}&limit=1`);
  log(`incident state: status=${after[0].status} resolved_at=${after[0].resolved_at} duration=${after[0].duration_seconds}s`);

  if (after[0].status !== 'resolved') {
    console.log(`\n✗ RECOVERY FAILED — status is "${after[0].status}".`);
    return;
  }

  console.log('\n✅ ALL PHASES PASSED — ingest, trigger, recover.\n');
  console.log(`Cleanup query (run if you want to drop the test data):`);
  console.log(`  DELETE FROM monitoring_incidents WHERE alert_rule_id = ${rule.id};`);
  console.log(`  DELETE FROM monitoring_readings WHERE sensor_id = ${sensor.id};`);
  console.log(`  DELETE FROM monitoring_alert_rules WHERE id = ${rule.id};`);
  console.log(`  DELETE FROM monitoring_sensors WHERE id = ${sensor.id};`);
  console.log(`  DELETE FROM monitoring_sites WHERE id = ${site.id};`);
  console.log(`  DELETE FROM monitoring_clients WHERE id = ${client.id};`);
}

main().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
