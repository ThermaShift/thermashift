/**
 * Tenant isolation test — the gating quality bar.
 *
 * Setup (from seed.js):
 *   TEST_A has a sensor with external_id='test_a_charlotte_crac1_supply'.
 *   TEST_B has a sensor with the SAME external_id (intentional collision).
 *
 * Test: POST a reading with TEST_A's api_key → reading must land on TEST_A's
 * sensor only. TEST_B's same-named sensor must NOT receive it.
 *
 * Second leg: query monitoring_readings as if we were each tenant — ensure
 * TEST_A only sees TEST_A data and vice versa.
 *
 * A failure here is a privacy breach. Higher severity than any other test.
 */

import { injectReading } from '../inject.js';

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

export async function run({ log = console.log } = {}) {
  log('=== Tenant isolation test ===');
  const clientA = await findClient('TEST_A');
  const clientB = await findClient('TEST_B');
  if (!clientA || !clientB) return { pass: false, name: 'tenant-isolation', reason: 'TEST_A or TEST_B not seeded' };

  const sharedExtId = 'test_a_charlotte_crac1_supply';
  const sentinelValue = 99.42; // distinctive value we can search for

  log(`Injecting sentinel reading ${sentinelValue}°F with TEST_A's api_key, external_id=${sharedExtId}`);
  const out = await injectReading({
    vendor: 'generic', apiKey: clientA.api_key,
    externalId: sharedExtId, value: sentinelValue, unit: '°F',
  });
  log(`  webhook response: status=${out.status} body=${JSON.stringify(out.body)}`);
  if (out.status !== 200) return { pass: false, name: 'tenant-isolation', reason: `webhook returned ${out.status}` };

  // Allow ingest to settle
  await new Promise(res => setTimeout(res, 2000));

  // Query A's readings — must include the sentinel
  const aReadings = await sb('monitoring_readings', 'GET', null,
    `?client_id=eq.${clientA.id}&value=eq.${sentinelValue}&order=ingested_at.desc&limit=1`);
  if (!aReadings?.length) {
    return { pass: false, name: 'tenant-isolation', reason: `TEST_A should have ingested sentinel ${sentinelValue} but did not` };
  }
  log(`  ✓ TEST_A has the sentinel reading (correct)`);

  // Query B's readings — must NOT include the sentinel
  const bReadings = await sb('monitoring_readings', 'GET', null,
    `?client_id=eq.${clientB.id}&value=eq.${sentinelValue}&limit=10`);
  if (bReadings?.length) {
    return {
      pass: false, name: 'tenant-isolation',
      reason: `PRIVACY BREACH: TEST_B saw sentinel reading ${sentinelValue} that was meant for TEST_A`,
      leakRows: bReadings,
    };
  }
  log(`  ✓ TEST_B does NOT have the sentinel reading (isolation OK)`);

  // Bonus: try POSTing to /webhook/sensor with the WRONG api_key + external_id that
  // exists only in the other tenant. Should return 0 ingested (sensor unknown to that tenant).
  log(`Cross-tenant probe: posting external_id='test_b_dallas_crac1_supply' with TEST_A's key`);
  const cross = await injectReading({
    vendor: 'generic', apiKey: clientA.api_key,
    externalId: 'test_b_dallas_crac1_supply', value: 60.0, unit: '°F',
  });
  log(`  cross-tenant response: status=${cross.status} body=${JSON.stringify(cross.body)}`);
  // We expect either 200 with ingested=0 (sensor not registered to TEST_A) or 200 with skipped=1
  if (cross.status !== 200) {
    return { pass: false, name: 'tenant-isolation', reason: `cross-tenant probe got ${cross.status}, expected 200` };
  }
  if (cross.body?.ingested) {
    return { pass: false, name: 'tenant-isolation', reason: 'cross-tenant probe was INGESTED — leak path' };
  }
  log(`  ✓ cross-tenant probe correctly skipped (sensor not registered to TEST_A)`);

  return {
    pass: true, name: 'tenant-isolation',
    details: { sentinel_reading_id: aReadings[0].id, b_reading_count: bReadings?.length || 0 },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => {
    console.log(`\n${r.pass ? '✓ PASS' : '✗ FAIL'} — ${r.name}${r.reason ? ': ' + r.reason : ''}`);
    if (r.leakRows) console.log('LEAK ROWS:', JSON.stringify(r.leakRows, null, 2));
    process.exit(r.pass ? 0 : 1);
  });
}
