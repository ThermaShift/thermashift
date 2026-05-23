/**
 * Scenario s-6: Sensor goes silent mid-incident.
 *
 * Inject ATL CRAC1 supply readings, then stop. The missing-data alert rule
 * (missing_after_minutes=15) should eventually trigger. After more time,
 * resumed readings should resolve the incident.
 *
 * Today's evaluator runs every 60s. To avoid a 15-min real wait, this
 * scenario fast-forwards by inserting a reading with a recorded_at
 * timestamp deep in the past, then verifies the evaluator opens the
 * missing-data incident on its next run.
 */

import { injectReading } from '../inject.js';
import { sb, findClient, findSensor, evaluateNow, sleep, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-6: sensor offline ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-6', reason: 'TEST_A not seeded' });

  // Insert a single reading 20 minutes in the past — older than the 15-min
  // missing_after_minutes threshold.
  const past = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  log(`Inject historical reading at ${past} (20 min ago)`);
  await injectReading({
    vendor: 'generic', apiKey: client.api_key,
    externalId: 'test_a_atlanta_crac1_supply', value: 73, unit: '°F',
    recordedAt: past,
  });

  // Patch the sensor's last_reading_at to the same past time so the evaluator
  // sees it as truly offline (the webhook would have set it to now, defeating
  // the test).
  const sensor = await findSensor(client.id, 'test_a_atlanta_crac1_supply');
  await sb('monitoring_sensors', 'PATCH',
    { last_reading_at: past, updated_at: new Date().toISOString() },
    `?id=eq.${sensor.id}`);
  log(`  patched sensor.last_reading_at = ${past}`);

  await evaluateNow(log);

  // Verify missing-data incident opened
  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?client_id=eq.${client.id}&sensor_id=eq.${sensor.id}&status=eq.open&order=opened_at.desc&limit=5`);
  if (!incidents?.length) {
    return result({ pass: false, name: 's-6', reason: 'no missing-data incident opened — evaluator may not check missing rules' });
  }
  log(`  ✓ missing-data incident ${incidents[0].id} opened`);

  // Recovery — inject a fresh reading
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_atlanta_crac1_supply', value: 74, unit: '°F' });
  await sleep(2000);
  await evaluateNow(log);

  const after = (await sb('monitoring_incidents', 'GET', null, `?id=eq.${incidents[0].id}&limit=1`))?.[0];
  if (after?.status !== 'resolved') {
    return result({ pass: false, name: 's-6', reason: `missing-data incident not resolved after fresh reading (status=${after?.status})` });
  }
  log(`  ✓ incident resolved after sensor came back`);

  return result({ pass: true, name: 's-6', details: { incident_id: incidents[0].id } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
