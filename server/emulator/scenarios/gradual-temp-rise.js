/**
 * Scenario s-1: Gradual temperature rise.
 *
 * Inject readings from 75°F → 80°F over 5 readings (1-min intervals).
 * Expected behavior:
 *   - At reading 4 (78°F), the "Charlotte CRAC1 warning" rule (threshold=78, debounce=2)
 *     should NOT yet fire (only one violation in a row).
 *   - At reading 5 (80°F), debounce=2 satisfied → warning incident opens.
 *   - AI advisor SHOULD propose set_crac_fan_speed (target_label≈"CRAC1",
 *     parameters.speed_percent > current). Not chiller stage-up (overkill).
 *   - No critical incident (85°F threshold not breached).
 *
 * Note: this scenario validates the alert evaluator + AI advisor as a system.
 * It does NOT itself produce an AI action — the AI proposal happens in the
 * advisor runtime as a side effect of the incident opening. We poll
 * cooling_actions to verify.
 */

import { injectBatch, trajectory } from '../inject.js';

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

async function findClient(companyPrefix) {
  const rows = await sb('monitoring_clients', 'GET', null, `?company=like.${encodeURIComponent(companyPrefix + '%')}&limit=1`);
  return rows?.[0];
}

export async function run({ log = console.log, waitForEvaluatorMs = 90_000 } = {}) {
  log('=== Scenario s-1: gradual temp rise ===');
  const client = await findClient('TEST_A');
  if (!client) return { pass: false, name: 's-1', reason: 'TEST_A client not seeded — run seed.js first' };

  const series = trajectory({ from: 75, to: 80, steps: 5, intervalMinutes: 1 });
  log(`Injecting ${series.length} readings 75°F → 80°F at 1-min intervals`);
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series, log,
  });

  log(`Waiting ${waitForEvaluatorMs / 1000}s for alert evaluator + AI advisor...`);
  await new Promise(res => setTimeout(res, waitForEvaluatorMs));

  // Verify: incident opened for the warning rule
  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?client_id=eq.${client.id}&status=eq.open&order=opened_at.desc&limit=5`);
  const warningIncident = (incidents || []).find(i => i.severity === 'warning');
  if (!warningIncident) return { pass: false, name: 's-1', reason: 'expected warning incident, none opened' };
  log(`  ✓ warning incident ${warningIncident.id} opened`);

  // Critical should NOT have fired (85°F threshold)
  const criticalIncident = (incidents || []).find(i => i.severity === 'critical');
  if (criticalIncident) return { pass: false, name: 's-1', reason: 'unexpected critical incident — should not breach 85°F' };
  log(`  ✓ no critical incident (correct — 80°F < 85°F threshold)`);

  // Look for an AI proposal
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&order=created_at.desc&limit=5`);
  if (!actions?.length) {
    return { pass: false, name: 's-1', reason: 'no AI action proposal recorded (advisor may not be wired to propose, or test ran too fast)' };
  }
  const fanAction = actions.find(a => a.action_type === 'set_crac_fan_speed');
  const overkillAction = actions.find(a => a.action_type === 'request_chiller_stage_up');
  if (overkillAction) {
    return { pass: false, name: 's-1', reason: 'AI proposed chiller stage-up for a warning-level temp drift (overkill)', actions };
  }
  if (!fanAction) {
    return { pass: false, name: 's-1', reason: `AI did not propose set_crac_fan_speed; proposed: ${actions.map(a => a.action_type).join(',')}`, actions };
  }
  const speed = fanAction.parameters?.speed_percent;
  if (typeof speed !== 'number' || speed <= 0 || speed > 100) {
    return { pass: false, name: 's-1', reason: `set_crac_fan_speed has invalid speed_percent=${speed}` };
  }
  log(`  ✓ AI proposed set_crac_fan_speed with speed_percent=${speed}`);

  return {
    pass: true, name: 's-1',
    details: {
      warning_incident_id: warningIncident.id,
      ai_action_id: fanAction.id,
      ai_action_status: fanAction.status,
      ai_proposed_speed_percent: speed,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => {
    console.log(`\n${r.pass ? '✓ PASS' : '✗ FAIL'} — ${r.name}${r.reason ? ': ' + r.reason : ''}`);
    if (r.details) console.log('Details:', JSON.stringify(r.details, null, 2));
    process.exit(r.pass ? 0 : 1);
  });
}
