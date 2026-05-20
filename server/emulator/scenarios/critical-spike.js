/**
 * Scenario s-2: Sudden critical temperature spike.
 *
 * Inject a sequence of normal readings (~72°F) then a single jump to 95°F.
 * Expected behavior:
 *   - Critical incident opens immediately (debounce=1 on critical rule).
 *   - AI advisor should propose either:
 *     (a) request_chiller_stage_up — bring more capacity online, OR
 *     (b) request_human_intervention — if the reading is implausibly extreme.
 *   - AI should NOT propose set_crac_fan_speed alone — fans can't recover 23°F.
 *   - Action severity routing: critical alerts bypass quiet hours, fire all
 *     enabled notification channels.
 */

import { injectBatch, spikeSequence } from '../inject.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(table, method, body, q = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

async function findClient(prefix) {
  const rows = await sb('monitoring_clients', 'GET', null, `?company=like.${encodeURIComponent(prefix + '%')}&limit=1`);
  return rows?.[0];
}

export async function run({ log = console.log, waitForEvaluatorMs = 90_000 } = {}) {
  log('=== Scenario s-2: critical temp spike ===');
  const client = await findClient('TEST_A');
  if (!client) return { pass: false, name: 's-2', reason: 'TEST_A not seeded' };

  const series = spikeSequence({ baseline: 72, spike: 95, normalCount: 3, intervalMinutes: 1 });
  log(`Injecting baseline + spike to 95°F + baseline`);
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series, log,
  });

  log(`Waiting ${waitForEvaluatorMs / 1000}s for evaluator + AI...`);
  await new Promise(res => setTimeout(res, waitForEvaluatorMs));

  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?client_id=eq.${client.id}&severity=eq.critical&order=opened_at.desc&limit=5`);
  if (!incidents?.length) return { pass: false, name: 's-2', reason: 'no critical incident opened despite 95°F reading' };
  const inc = incidents[0];
  log(`  ✓ critical incident ${inc.id} opened (peak_value=${inc.peak_value})`);

  // Verify notification audit (at least one notification attempted for the critical)
  const notifs = await sb('monitoring_alert_notifications', 'GET', null,
    `?incident_id=eq.${inc.id}&limit=10`);
  if (!notifs?.length) return { pass: false, name: 's-2', reason: 'critical incident opened but no notifications logged' };
  log(`  ✓ ${notifs.length} notification(s) logged`);

  // AI proposal check
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&order=created_at.desc&limit=5`);
  const aiAction = actions?.[0];
  if (!aiAction) return { pass: false, name: 's-2', reason: 'AI did not propose any action for the critical incident' };

  const acceptable = ['request_chiller_stage_up', 'request_human_intervention'];
  if (!acceptable.includes(aiAction.action_type)) {
    return {
      pass: false, name: 's-2',
      reason: `AI proposed ${aiAction.action_type} for 23°F spike — expected ${acceptable.join(' or ')}`,
      action: aiAction,
    };
  }
  log(`  ✓ AI proposed ${aiAction.action_type} (acceptable for critical)`);

  return {
    pass: true, name: 's-2',
    details: {
      critical_incident_id: inc.id, peak_value: inc.peak_value,
      notifications_logged: notifs.length,
      ai_action_type: aiAction.action_type,
      ai_action_status: aiAction.status,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => {
    console.log(`\n${r.pass ? '✓ PASS' : '✗ FAIL'} — ${r.name}${r.reason ? ': ' + r.reason : ''}`);
    if (r.details) console.log('Details:', JSON.stringify(r.details, null, 2));
    if (r.action) console.log('Action:', JSON.stringify(r.action, null, 2));
    process.exit(r.pass ? 0 : 1);
  });
}
