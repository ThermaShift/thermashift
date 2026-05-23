/**
 * Scenario s-3: Economizer-eligible drift.
 *
 * Inject internal supply temp rising slowly (76°F) WHILE outside-air temp
 * stays low (52°F) — the textbook case for switching to free cooling.
 *
 * Expected AI behavior: propose enable_economizer rather than mechanical
 * cooling actions (set_crac_fan_speed, set_chilled_water_setpoint). This
 * tests whether the AI considers outside-air conditions in its reasoning.
 *
 * Note: TEST_A doesn't have an "outside air" sensor by default. The
 * scenario adds one if missing, then injects readings on both sensors.
 */

import { injectBatch, trajectory, injectReading } from '../inject.js';
import { sb, findClient, findSensor, evaluateNow, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-3: economizer trigger ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-3', reason: 'TEST_A not seeded' });

  const charlotteSite = (await sb('monitoring_sites', 'GET', null,
    `?client_id=eq.${client.id}&name=like.${encodeURIComponent('TEST_A — Charlotte%')}&limit=1`))?.[0];
  if (!charlotteSite) return result({ pass: false, name: 's-3', reason: 'Charlotte site missing' });

  // Ensure an outside-air sensor exists for this site
  let oaSensor = await findSensor(client.id, 'test_a_charlotte_outside_air');
  if (!oaSensor) {
    [oaSensor] = await sb('monitoring_sensors', 'POST', {
      client_id: client.id, site_id: charlotteSite.id,
      external_id: 'test_a_charlotte_outside_air',
      name: 'Charlotte outside air', sensor_type: 'temperature', unit: '°F',
      vendor: 'generic', active: true,
    });
    log(`  created outside-air sensor id=${oaSensor.id}`);
  }

  // Inject outside-air at 52°F (low — economizer eligible) for 5 min
  log(`Injecting outside-air = 52°F`);
  await injectReading({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_outside_air', value: 52, unit: '°F',
  });

  // Inject internal supply temp drifting up 75 → 78 (just touching warning threshold)
  const series = trajectory({ from: 75, to: 79, steps: 4, intervalMinutes: 1 });
  log(`Injecting internal supply temp 75°F → 79°F`);
  await injectBatch({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_charlotte_crac1_supply', unit: '°F',
    series, log,
  });

  await evaluateNow(log);

  // Verify incident may or may not open (depending on exact thresholds + debounce); the
  // important assertion is about the AI proposal preferring economizer over fan/setpoint.
  const actions = await sb('cooling_actions', 'GET', null,
    `?client_id=eq.${client.id}&proposed_by=eq.ai&order=created_at.desc&limit=5`);

  if (!actions?.length) {
    return result({
      pass: false, name: 's-3',
      reason: 'no AI proposal — advisor not auto-creating actions today (see SAAS-TESTING-PLAN.md §b finding)',
      expectedFailUntilAiWired: true,
    });
  }
  const latest = actions[0];
  if (latest.action_type === 'enable_economizer') {
    return result({ pass: true, name: 's-3', details: { action_id: latest.id, action_type: latest.action_type } });
  }
  return result({
    pass: false, name: 's-3',
    reason: `AI proposed ${latest.action_type} — expected enable_economizer (free cooling eligible with OA=52°F)`,
    details: { proposed: latest.action_type, parameters: latest.parameters },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
