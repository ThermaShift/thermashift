/**
 * Scenario s-12: Multi-sensor incident — coordinated response.
 *
 * Inject simultaneous violations on multiple sensors in the same site:
 *   - CRAC1 supply at 86°F (critical, threshold=85)
 *   - CRAC1 return at 92°F (high)
 *   - humidity at 80% (high, threshold=75)
 *
 * Expected: AI proposes ONE coordinated action for the site (likely
 * request_chiller_stage_up — the critical-grade response), NOT three
 * independent actions for the three sensors.
 */

import { injectReading } from '../inject.js';
import { sb, findClient, evaluateNow, sleep, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-12: multi-sensor incident ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-12', reason: 'TEST_A not seeded' });

  log('Inject CRAC1 supply = 86°F (critical)');
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_crac1_supply', value: 86, unit: '°F' });
  log('Inject CRAC1 return = 92°F');
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_crac1_return', value: 92, unit: '°F' });
  log('Inject Zone humidity = 80%');
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_zone1_humidity', value: 80, unit: '%' });

  await evaluateNow(log);
  await sleep(3000);

  // Count incidents currently open in the Charlotte site
  const site = (await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&name=like.${encodeURIComponent('TEST_A — Charlotte%')}&limit=1`))?.[0];
  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?client_id=eq.${client.id}&site_id=eq.${site.id}&status=eq.open&order=opened_at.desc&limit=10`);
  log(`  ${incidents?.length || 0} open incident(s) at Charlotte site`);

  // AI actions in the last 2 minutes
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&created_at=gte.${since}&order=created_at.asc&limit=20`);

  const count = actions?.length || 0;
  log(`  AI proposed ${count} action(s) in the last 2 minutes`);
  if (count === 0) {
    return result({ pass: false, name: 's-12',
      reason: 'no AI action proposed (advisor auto-action not wired — plan §b)',
      expectedFailUntilAiWired: true });
  }
  if (count > 2) {
    return result({ pass: false, name: 's-12',
      reason: `AI proposed ${count} actions for multi-sensor incident — should coordinate into 1-2`,
      details: { actions: actions.map(a => ({ id: a.id, action_type: a.action_type })) } });
  }
  return result({ pass: true, name: 's-12',
    details: { open_incidents: incidents?.length || 0, ai_actions: count, action_types: actions.map(a => a.action_type) } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
