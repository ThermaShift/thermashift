/**
 * Full ThermaShift end-to-end test suite. Runs against the live VPS via
 * thermashift.net (or APP_URL override). Tests every major feature and
 * reports pass/fail at the end.
 *
 * Usage on VPS: node server/test-full-suite.js
 * Optional flags: --quick (skip slow waits), --no-cleanup (keep test data)
 */
import 'dotenv/config';
import crypto from 'crypto';

const APP_URL = process.env.APP_URL || 'https://thermashift.net';
const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // optional — admin tests skip without it

const QUICK = process.argv.includes('--quick');
const NO_CLEANUP = process.argv.includes('--no-cleanup');

const results = [];
function pass(name, detail) { results.push({ name, status: 'PASS', detail }); console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name, err) { results.push({ name, status: 'FAIL', detail: String(err).slice(0, 300) }); console.log(`  ✗ ${name} — ${err}`); }
function skip(name, reason) { results.push({ name, status: 'SKIP', detail: reason }); console.log(`  ⊘ ${name} — ${reason}`); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sb(table, method, body, query = '') {
  const r = await fetch(`${SUPABASE_URL}/${table}${query}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const tag = `tst${Date.now().toString(36)}`;
let testClientId, testApiKey, testSiteId, testSensorId, testRuleId;

// ════════════════════════════════════════════════════════════
// SECTION 1 — Public endpoints
// ════════════════════════════════════════════════════════════
async function testHttp() {
  console.log('\n[1] HTTP / SSL / public routes');

  for (const path of ['/', '/saas', '/admin', '/contact', '/calculator']) {
    try {
      const r = await fetch(`${APP_URL}${path}`, { redirect: 'manual' });
      if (r.status >= 200 && r.status < 400) pass(`GET ${path}`, `HTTP ${r.status}`);
      else fail(`GET ${path}`, `HTTP ${r.status}`);
    } catch (e) { fail(`GET ${path}`, e.message); }
  }

  // SSL
  try {
    const r = await fetch(`${APP_URL}/`);
    if (r.url.startsWith('https://')) pass('SSL active', r.url);
    else fail('SSL active', `URL is ${r.url}`);
  } catch (e) { fail('SSL active', e.message); }

  // HTTP→HTTPS redirect
  try {
    const r = await fetch(`http://thermashift.net/`, { redirect: 'manual' });
    if ([301, 302, 308].includes(r.status)) pass('HTTP→HTTPS redirect', `HTTP ${r.status}`);
    else fail('HTTP→HTTPS redirect', `HTTP ${r.status}`);
  } catch (e) { fail('HTTP→HTTPS redirect', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 2 — Chat API (Claude streaming)
// ════════════════════════════════════════════════════════════
async function testChatApi() {
  console.log('\n[2] Chat API');

  try {
    const r = await fetch(`${APP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello, in 5 words' }] }),
    });
    if (!r.ok) return fail('POST /api/chat returns 200', `HTTP ${r.status}`);
    pass('POST /api/chat returns 200');

    const text = await r.text();
    if (text.includes('message_start') || text.includes('content_block')) pass('Claude streaming events received');
    else fail('Claude streaming events received', 'no streaming markers in response');
  } catch (e) { fail('chat API', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 3 — Public lead/audit endpoints
// ════════════════════════════════════════════════════════════
async function testLeadEndpoints() {
  console.log('\n[3] Lead / audit / proposal endpoints');

  try {
    const r = await fetch(`${APP_URL}/api/leads/lookup/test-${tag}@example.com`);
    const data = await r.json();
    if (r.ok && 'found' in data) pass('GET /api/leads/lookup/:email', `found=${data.found}`);
    else fail('GET /api/leads/lookup/:email', `HTTP ${r.status}`);
  } catch (e) { fail('GET /api/leads/lookup/:email', e.message); }

  try {
    const r = await fetch(`${APP_URL}/api/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${tag}@test.thermashift.net`, name: 'Test Lead', company: 'Test Co' }),
    });
    if (r.ok) pass('POST /api/leads creates record');
    else fail('POST /api/leads creates record', `HTTP ${r.status}`);
  } catch (e) { fail('POST /api/leads', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 4 — Monitoring SaaS — full client lifecycle via api_key
// ════════════════════════════════════════════════════════════
async function testMonitoringSaaS() {
  console.log('\n[4] Monitoring SaaS — full lifecycle');

  // Create client + site + sensor + rule directly via Supabase
  try {
    testApiKey = 'tsk_test_' + crypto.randomBytes(8).toString('hex');
    const [client] = await sb('monitoring_clients', 'POST', {
      company: `${tag} TestCo`, primary_contact_email: `${tag}@test.thermashift.net`,
      api_key: testApiKey, tier: 'pro', primary_contact_name: 'Test',
    });
    testClientId = client.id;
    pass('Create monitoring client', `id=${client.id} tier=${client.tier}`);
  } catch (e) { return fail('Create monitoring client', e.message); }

  try {
    const [site] = await sb('monitoring_sites', 'POST', {
      client_id: testClientId, name: `${tag} Test Site`, city: 'Charlotte', state: 'NC', rack_count: 10,
    });
    testSiteId = site.id;
    pass('Create monitoring site', `id=${site.id}`);
  } catch (e) { fail('Create monitoring site', e.message); }

  try {
    const [sensor] = await sb('monitoring_sensors', 'POST', {
      client_id: testClientId, site_id: testSiteId,
      external_id: `${tag}-sensor-temp`, vendor: 'generic',
      name: 'Test Hot Aisle', sensor_type: 'temperature', unit: '°F', active: true,
    });
    testSensorId = sensor.id;
    pass('Create monitoring sensor', `id=${sensor.id}`);
  } catch (e) { fail('Create monitoring sensor', e.message); }

  try {
    const [rule] = await sb('monitoring_alert_rules', 'POST', {
      client_id: testClientId, site_id: testSiteId, sensor_id: testSensorId,
      name: 'Test rule >80°F', rule_type: 'above', threshold_value: 80,
      threshold_window_minutes: 10, severity: 'critical', debounce_count: 2,
      active: true, notify_email: false, notify_sms: false, notify_voice: false,
    });
    testRuleId = rule.id;
    pass('Create alert rule', `id=${rule.id}`);
  } catch (e) { fail('Create alert rule', e.message); }

  // ─── Client API endpoints (api_key auth) ─────────────────
  const clientHeaders = { Authorization: `Bearer ${testApiKey}` };

  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/me`, { headers: clientHeaders });
    const data = await r.json();
    if (r.ok && data.id === testClientId) pass('GET /me with api_key auth');
    else fail('GET /me with api_key auth', `HTTP ${r.status}`);
  } catch (e) { fail('GET /me', e.message); }

  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/me`, { headers: { Authorization: 'Bearer invalid_key_xxx' } });
    if (r.status === 403) pass('Invalid api_key rejected (403)');
    else fail('Invalid api_key rejected', `HTTP ${r.status}`);
  } catch (e) { fail('invalid key test', e.message); }

  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/me`);
    if (r.status === 401) pass('Missing api_key rejected (401)');
    else fail('Missing api_key rejected', `HTTP ${r.status}`);
  } catch (e) { fail('missing key test', e.message); }

  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/overview`, { headers: clientHeaders });
    const data = await r.json();
    if (r.ok && data.sites?.length >= 1 && data.sensors?.length >= 1) pass('GET /overview returns sites + sensors');
    else fail('GET /overview', JSON.stringify(data).slice(0, 100));
  } catch (e) { fail('GET /overview', e.message); }

  // Webhook ingestion — generic
  try {
    const r = await fetch(`${APP_URL}/webhook/sensor/generic?key=${testApiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ external_id: `${tag}-sensor-temp`, value: 75, unit: '°F' }),
    });
    const data = await r.json();
    if (r.ok && data.ingested === 1) pass('Generic webhook ingestion');
    else fail('Generic webhook ingestion', JSON.stringify(data).slice(0, 100));
  } catch (e) { fail('webhook', e.message); }

  // Vendor adapter sanity (just hit each endpoint, doesn't have to ingest since external_id won't match)
  for (const vendor of ['monnit', 'sensorpush', 'disruptive']) {
    try {
      const r = await fetch(`${APP_URL}/webhook/sensor/${vendor}?key=${testApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (r.ok || data.errors) pass(`${vendor} webhook adapter accepts payload`, `HTTP ${r.status}`);
      else fail(`${vendor} webhook adapter`, `HTTP ${r.status}`);
    } catch (e) { fail(`${vendor} webhook`, e.message); }
  }

  // Ingest 2 hot readings to trigger the alert
  try {
    for (const v of [85, 86]) {
      await fetch(`${APP_URL}/webhook/sensor/generic?key=${testApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_id: `${tag}-sensor-temp`, value: v, unit: '°F' }),
      });
    }
    pass('Ingest 2 triggering readings');
  } catch (e) { fail('triggering readings', e.message); }

  // Wait for alert evaluator cron (60s)
  if (!QUICK) {
    console.log('   waiting 75s for alert evaluator cron…');
    await sleep(75 * 1000);

    try {
      const incidents = await sb('monitoring_incidents', 'GET', null,
        `?alert_rule_id=eq.${testRuleId}&order=opened_at.desc&limit=1`);
      if (incidents?.[0]?.status === 'open') pass('Alert eval cron opened incident', `id=${incidents[0].id}`);
      else fail('Alert eval cron opened incident', `status=${incidents?.[0]?.status || 'none'}`);
    } catch (e) { fail('check incident', e.message); }
  } else { skip('Alert eval cron incident (slow)', '--quick'); }

  // Sensor readings endpoint
  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/sensors/${testSensorId}/readings?hours=1`, { headers: clientHeaders });
    const data = await r.json();
    if (r.ok && Array.isArray(data.readings)) pass('GET /sensors/:id/readings');
    else fail('GET /sensors/:id/readings', JSON.stringify(data).slice(0, 100));
  } catch (e) { fail('readings endpoint', e.message); }

  // Incidents
  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/incidents`, { headers: clientHeaders });
    if (r.ok) pass('GET /incidents');
    else fail('GET /incidents', `HTTP ${r.status}`);
  } catch (e) { fail('incidents endpoint', e.message); }

  // Rules CRUD
  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/rules`, { headers: clientHeaders });
    const data = await r.json();
    if (r.ok && data.find(rule => rule.id === testRuleId)) pass('GET /rules');
    else fail('GET /rules', JSON.stringify(data).slice(0, 100));
  } catch (e) { fail('rules', e.message); }

  // Cross-client isolation — test that one client cannot see another's sensors
  try {
    const otherKey = 'tsk_other_' + crypto.randomBytes(8).toString('hex');
    const [otherClient] = await sb('monitoring_clients', 'POST', {
      company: `${tag} OtherCo`, primary_contact_email: `${tag}-other@test.thermashift.net`,
      api_key: otherKey, tier: 'watch',
    });
    const r = await fetch(`${APP_URL}/api/monitoring/client/sensors/${testSensorId}/readings?hours=1`, {
      headers: { Authorization: `Bearer ${otherKey}` },
    });
    if (r.status === 404) pass('Cross-client sensor access blocked (404)');
    else fail('Cross-client isolation', `HTTP ${r.status}`);
    // cleanup
    await sb('monitoring_clients', 'DELETE', null, `?id=eq.${otherClient.id}`);
  } catch (e) { fail('cross-client isolation', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 5 — AI Cooling Advisor
// ════════════════════════════════════════════════════════════
async function testAdvisor() {
  console.log('\n[5] AI Cooling Advisor');

  if (!testApiKey) return skip('Advisor', 'monitoring SaaS setup failed');
  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/advisor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'overview' }),
    });
    const data = await r.json();
    if (r.ok && data.headline && data.recommendations?.length) pass('Advisor returns structured advice', `${data.recommendations.length} recs`);
    else fail('Advisor', JSON.stringify(data).slice(0, 200));
  } catch (e) { fail('advisor', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 6 — AI Sales Closer
// ════════════════════════════════════════════════════════════
async function testCloser() {
  console.log('\n[6] AI Sales Closer');

  // Direct ai-closer module test
  try {
    const { generateReply } = await import('./ai-closer.js');
    const fakeProspect = {
      first_name: 'Test', last_name: 'User', email: `${tag}@test.thermashift.net`,
      company: 'TestCorp', title: 'Director', talking_point: 'TEST',
    };
    const draft = await generateReply(fakeProspect, [
      { direction: 'outbound', body: 'cold email', created_at: new Date().toISOString() },
      { direction: 'inbound', body: 'Sure, free Friday 2pm. +1 555 123 4567', received_at: new Date().toISOString() },
    ]);
    if (draft.reply_text && draft.tool_calls.find(t => t.name === 'schedule_outbound_call')) {
      pass('Closer: schedule_outbound_call invoked + reply text present');
    } else { fail('Closer: schedule_outbound_call', `text=${!!draft.reply_text} tools=${draft.tool_calls.map(t => t.name).join(',')}`); }
  } catch (e) { fail('Closer schedule scenario', e.message); }

  try {
    const { generateReply } = await import('./ai-closer.js');
    const draft = await generateReply(
      { first_name: 'Test', email: `${tag}-2@x.com`, company: 'X' },
      [
        { direction: 'outbound', body: 'cold email', created_at: new Date().toISOString() },
        { direction: 'inbound', body: 'Are you a real person or AI?', received_at: new Date().toISOString() },
      ]
    );
    if (draft.reply_text && /automation|automated|reading replies personally|AI/i.test(draft.reply_text)) {
      pass('Closer: truthful AI disclosure');
    } else { fail('Closer truthful disclosure', draft.reply_text?.slice(0, 100)); }
  } catch (e) { fail('Closer disclosure scenario', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 7 — Outreach pipeline
// ════════════════════════════════════════════════════════════
async function testOutreach() {
  console.log('\n[7] Outreach pipeline');

  try {
    const counts = await sb('outreach_emails', 'GET', null, '?select=status&limit=1000');
    const sent = counts.filter(e => e.status === 'sent').length;
    const pending = counts.filter(e => e.status === 'pending').length;
    if (sent > 0) pass('Outreach emails sent', `${sent} sent, ${pending} pending`);
    else fail('Outreach emails sent', `0 sent (cron may not be running)`);
  } catch (e) { fail('outreach status', e.message); }

  try {
    const prospects = await sb('outreach_prospects', 'GET', null, '?select=status&limit=1000');
    if (prospects.length > 0) pass('Prospects loaded', `${prospects.length} total`);
    else fail('Prospects loaded', '0');
  } catch (e) { fail('prospects', e.message); }

  // Test Resend webhook signature rejection
  try {
    const r = await fetch(`${APP_URL}/api/webhooks/resend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.opened', data: { email_id: 'fake' } }),
    });
    if (r.status === 401) pass('Resend webhook rejects unsigned (401)');
    else fail('Resend webhook signature check', `HTTP ${r.status}`);
  } catch (e) { fail('Resend webhook', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 8 — Cron jobs alive
// ════════════════════════════════════════════════════════════
async function testCronsAlive() {
  console.log('\n[8] Cron jobs');
  // Indirect: check uptime via PM2 visible from app — we can't directly check crons from outside,
  // but we can verify that the app process responded to a recent fetch (covered in section 1).
  // Also check that scheduled_calls placement runs (no due calls = noop, but at least no error).
  try {
    const r = await fetch(`${APP_URL}/api/monitoring/client/me`, { headers: { Authorization: `Bearer ${testApiKey}` } });
    if (r.ok) pass('App process alive (proxy responding)');
    else fail('App process alive', `HTTP ${r.status}`);
  } catch (e) { fail('proxy alive', e.message); }
}

// ════════════════════════════════════════════════════════════
// SECTION 9 — Phase 6 schema
// ════════════════════════════════════════════════════════════
async function testPhase6Schema() {
  console.log('\n[9] Phase 6 schema (AI closer tables)');

  for (const t of ['prospect_messages', 'scheduled_calls']) {
    try {
      const r = await fetch(`${SUPABASE_URL}/${t}?select=id&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (r.ok) pass(`${t} table accessible`);
      else fail(`${t} table accessible`, `HTTP ${r.status}`);
    } catch (e) { fail(`${t} table`, e.message); }
  }
}

// ════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════
async function cleanup() {
  if (NO_CLEANUP) return console.log('\n(skipping cleanup)');
  console.log('\n[cleanup]');
  try {
    await sb('outreach_prospects', 'DELETE', null, `?email=like.${tag}*`);
    await sb('leads', 'DELETE', null, `?email=like.${tag}*`);
    if (testClientId) {
      await sb('monitoring_alert_notifications', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_incidents', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_readings', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_alert_rules', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_sensors', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_sites', 'DELETE', null, `?client_id=eq.${testClientId}`);
      await sb('monitoring_clients', 'DELETE', null, `?id=eq.${testClientId}`);
    }
    pass('Cleanup');
  } catch (e) { fail('cleanup', e.message); }
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║  ThermaShift Full Test Suite                           ║`);
  console.log(`║  Target: ${APP_URL.padEnd(45)}║`);
  console.log(`║  Tag: ${tag.padEnd(48)}║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);

  await testHttp();
  await testChatApi();
  await testLeadEndpoints();
  await testMonitoringSaaS();
  await testAdvisor();
  await testCloser();
  await testOutreach();
  await testCronsAlive();
  await testPhase6Schema();
  await cleanup();

  // Report
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const skips = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTS                                                ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`  Passed:  ${passes}`);
  console.log(`  Failed:  ${fails}`);
  console.log(`  Skipped: ${skips}`);
  console.log(`  Total:   ${results.length}\n`);

  if (fails > 0) {
    console.log(`  ❌ FAILURES:`);
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`     - ${r.name}: ${r.detail}`));
  }
  if (fails === 0) console.log(`  ✅ ALL CHECKS PASSED\n`);

  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
