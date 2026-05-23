/**
 * Scenario s-7: Oscillating around threshold (no rapid-fire actions).
 *
 * Inject readings that swing 79-81°F (threshold is 78). The warning
 * condition is technically met intermittently. AI should propose at most
 * ONE corrective action, not one per oscillation.
 *
 * This tests rate limiting / dedup on the AI proposal side.
 */

import { injectBatch, oscillateAroundThreshold } from '../inject.js';
import { sb, findClient, evaluateNow, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-7: oscillating around threshold ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-7', reason: 'TEST_A not seeded' });

  const series = oscillateAroundThreshold({ threshold: 80, amplitude: 1.5, count: 20, intervalMinutes: 1 });
  log(`Injecting 20 oscillating readings around 80°F (threshold 78°F)`);
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series, log,
  });

  await evaluateNow(log);

  // Find how many AI actions got proposed in this window
  const sinceTs = series[0].recordedAt;
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&created_at=gte.${sinceTs}&order=created_at.asc&limit=20`);

  const count = actions?.length || 0;
  log(`  AI proposed ${count} action(s) during oscillation window`);
  if (count > 2) {
    return result({ pass: false, name: 's-7',
      reason: `AI proposed ${count} actions in oscillation window — should be at most 1-2 (dedup/rate-limit broken)`,
      details: { actions: actions.map(a => ({ id: a.id, action_type: a.action_type, created_at: a.created_at })) } });
  }
  if (count === 0) {
    return result({ pass: false, name: 's-7',
      reason: 'no AI action proposed (advisor auto-action not wired — plan §b)',
      expectedFailUntilAiWired: true });
  }
  return result({ pass: true, name: 's-7', details: { proposed_count: count } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
