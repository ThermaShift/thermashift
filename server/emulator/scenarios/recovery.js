/**
 * Scenario s-4: Recovery after intervention.
 *
 * Continuation of s-1: after the warning incident has been open, inject
 * readings normalizing back to 72°F. Expected:
 *   - Incident transitions from open → resolved.
 *   - AI does NOT propose further escalating actions.
 *   - Optionally: AI proposes an "unwind" action (set_crac_fan_speed back
 *     to the original setpoint). This is a stretch goal — pass if no
 *     new escalation, gold if explicit unwind.
 */

import { injectBatch, trajectory } from '../inject.js';
import { sb, findClient, evaluateNow, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-4: recovery ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-4', reason: 'TEST_A not seeded' });

  // First trigger a warning incident
  log('Step 1: trigger warning incident with rise 75°→80°');
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series: trajectory({ from: 75, to: 80, steps: 4, intervalMinutes: 1 }), log,
  });
  await evaluateNow(log);

  const openBefore = await sb('monitoring_incidents', 'GET', null,
    `?client_id=eq.${client.id}&status=eq.open&order=opened_at.desc&limit=1`);
  if (!openBefore?.length) {
    return result({ pass: false, name: 's-4', reason: 'no warning incident opened to recover from' });
  }
  const incidentId = openBefore[0].id;
  log(`  warning incident ${incidentId} open`);

  // Now inject recovery readings 80°→72°
  log('Step 2: inject recovery 80°→72°');
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series: trajectory({ from: 80, to: 72, steps: 4, intervalMinutes: 1 }), log,
  });
  await evaluateNow(log);

  const incidentAfter = (await sb('monitoring_incidents', 'GET', null, `?id=eq.${incidentId}&limit=1`))?.[0];
  if (!incidentAfter) return result({ pass: false, name: 's-4', reason: 'incident disappeared' });

  if (incidentAfter.status !== 'resolved') {
    return result({ pass: false, name: 's-4',
      reason: `incident still ${incidentAfter.status} after recovery readings — recover transition broken`,
      details: { incident: incidentAfter } });
  }
  log(`  ✓ incident transitioned to resolved`);

  // Verify no new critical/escalating actions proposed during recovery
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&created_at=gte.${incidentAfter.opened_at}&order=created_at.desc&limit=10`);
  const escalating = (actions || []).filter(a => a.action_type === 'request_chiller_stage_up' || a.action_type === 'request_human_intervention');
  if (escalating.length) {
    return result({ pass: false, name: 's-4',
      reason: 'AI proposed escalating action(s) during recovery period',
      details: { escalating } });
  }
  log(`  ✓ no escalating actions during recovery`);

  return result({ pass: true, name: 's-4', details: { incident_id: incidentId, final_status: incidentAfter.status, total_actions: actions?.length || 0 } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
