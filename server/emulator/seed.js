/**
 * Seed test clients, sites, sensors, and alert rules for the emulator.
 * Idempotent — re-running won't duplicate (looks up by company prefix TEST_).
 *
 * Creates:
 *   TEST_A: 2 sites, 6 sensors, 4 alert rules, action_webhook to mock
 *   TEST_B: 1 site, 2 sensors, 1 alert rule — used for tenant isolation tests
 */

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const MOCK_CONTROL_URL = process.env.MOCK_CONTROL_URL || 'http://localhost:4099/control';

async function sb(table, method, body, q = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function findOrCreate(table, queryParams, payload) {
  const existing = await sb(table, 'GET', null, `?${queryParams}&limit=1`);
  if (existing?.length) return existing[0];
  const created = await sb(table, 'POST', payload);
  return created[0];
}

function genApiKey(label) {
  return `tsk_test_${label}_${crypto.randomBytes(8).toString('hex')}`;
}

const SEED = {
  TEST_A: {
    company: 'TEST_A — Behavior Suite',
    api_key: genApiKey('a'),
    actions_enabled: true,
    action_webhook_url: MOCK_CONTROL_URL,
    action_webhook_secret: 'test-secret-A',
    sites: [
      {
        name: 'TEST_A — Charlotte DC',
        city: 'Charlotte',
        state: 'NC',
        sensors: [
          { external_id: 'test_a_charlotte_crac1_supply', name: 'CRAC1 supply temp', sensor_type: 'temperature', unit: '°F' },
          { external_id: 'test_a_charlotte_crac1_return', name: 'CRAC1 return temp', sensor_type: 'temperature', unit: '°F' },
          { external_id: 'test_a_charlotte_zone1_humidity', name: 'Zone 1 humidity', sensor_type: 'humidity', unit: '%' },
        ],
      },
      {
        name: 'TEST_A — Atlanta DC',
        city: 'Atlanta',
        state: 'GA',
        sensors: [
          { external_id: 'test_a_atlanta_crac1_supply', name: 'ATL CRAC1 supply', sensor_type: 'temperature', unit: '°F' },
          { external_id: 'test_a_atlanta_crac2_supply', name: 'ATL CRAC2 supply', sensor_type: 'temperature', unit: '°F' },
          { external_id: 'test_a_atlanta_leak_zone1', name: 'ATL Zone 1 leak', sensor_type: 'leak', unit: '' },
        ],
      },
    ],
    alert_rules: [
      // On CHARLOTTE CRAC1 supply temp: warning at 78°F, critical at 85°F.
      // Used by gradual-temp-rise and critical-spike scenarios.
      { sensor_ref: 'test_a_charlotte_crac1_supply', name: 'Charlotte CRAC1 warning', rule_type: 'above', threshold_value: 78, debounce_count: 2, severity: 'warning', notify_email: true },
      { sensor_ref: 'test_a_charlotte_crac1_supply', name: 'Charlotte CRAC1 critical', rule_type: 'above', threshold_value: 85, debounce_count: 1, severity: 'critical', notify_email: true },
      // On ATLANTA: missing-data alert for sensor-offline scenario.
      { sensor_ref: 'test_a_atlanta_crac1_supply', name: 'ATL CRAC1 offline', rule_type: 'missing', missing_after_minutes: 15, severity: 'warning', notify_email: true },
      // On humidity: high-humidity warning for happy-path / no-trigger validation.
      { sensor_ref: 'test_a_charlotte_zone1_humidity', name: 'Charlotte humidity warn', rule_type: 'above', threshold_value: 75, debounce_count: 2, severity: 'warning', notify_email: true },
    ],
  },
  TEST_B: {
    company: 'TEST_B — Isolation Suite',
    api_key: genApiKey('b'),
    actions_enabled: false,
    sites: [
      {
        name: 'TEST_B — Dallas DC',
        city: 'Dallas',
        state: 'TX',
        sensors: [
          // INTENTIONAL collision: same external_id as TEST_A. Tests that
          // webhooks scope by client api_key, not just external_id.
          { external_id: 'test_a_charlotte_crac1_supply', name: 'TEST_B Dallas same-external-id', sensor_type: 'temperature', unit: '°F' },
          { external_id: 'test_b_dallas_crac1_supply', name: 'TEST_B Dallas CRAC1', sensor_type: 'temperature', unit: '°F' },
        ],
      },
    ],
    alert_rules: [
      { sensor_ref: 'test_b_dallas_crac1_supply', name: 'Dallas warning', rule_type: 'above', threshold_value: 78, debounce_count: 2, severity: 'warning', notify_email: true },
    ],
  },
};

async function seedTenant(key, spec) {
  console.log(`\n=== Seeding ${key} ===`);
  const client = await findOrCreate(
    'monitoring_clients',
    `company=eq.${encodeURIComponent(spec.company)}`,
    {
      company: spec.company,
      primary_contact_email: 'noreply+test@thermashift.net',
      status: 'active',
      tier: 'pro',
      api_key: spec.api_key,
      timezone: 'America/New_York',
      actions_enabled: spec.actions_enabled,
      action_webhook_url: spec.action_webhook_url || null,
      action_webhook_secret: spec.action_webhook_secret || null,
    },
  );
  console.log(`  client id=${client.id} api_key=${client.api_key}`);

  const sensorMap = {};
  for (const siteSpec of spec.sites) {
    const site = await findOrCreate(
      'monitoring_sites',
      `client_id=eq.${client.id}&name=eq.${encodeURIComponent(siteSpec.name)}`,
      {
        client_id: client.id, name: siteSpec.name,
        city: siteSpec.city, state: siteSpec.state, facility_type: 'data_center',
      },
    );
    console.log(`  site ${site.id} "${site.name}"`);
    for (const sensorSpec of siteSpec.sensors) {
      const sensor = await findOrCreate(
        'monitoring_sensors',
        `client_id=eq.${client.id}&external_id=eq.${encodeURIComponent(sensorSpec.external_id)}`,
        {
          client_id: client.id, site_id: site.id,
          external_id: sensorSpec.external_id,
          name: sensorSpec.name,
          sensor_type: sensorSpec.sensor_type,
          unit: sensorSpec.unit,
          vendor: 'generic',
          active: true,
        },
      );
      sensorMap[sensorSpec.external_id] = sensor;
      console.log(`    sensor ${sensor.id} ${sensor.name}`);
    }
  }

  for (const ruleSpec of spec.alert_rules || []) {
    const sensor = sensorMap[ruleSpec.sensor_ref];
    if (!sensor) { console.warn(`    !! no sensor for rule ref ${ruleSpec.sensor_ref}`); continue; }
    await findOrCreate(
      'monitoring_alert_rules',
      `client_id=eq.${client.id}&sensor_id=eq.${sensor.id}&name=eq.${encodeURIComponent(ruleSpec.name)}`,
      {
        client_id: client.id, sensor_id: sensor.id, site_id: sensor.site_id,
        name: ruleSpec.name,
        rule_type: ruleSpec.rule_type,
        threshold_value: ruleSpec.threshold_value || null,
        debounce_count: ruleSpec.debounce_count || 2,
        missing_after_minutes: ruleSpec.missing_after_minutes || null,
        severity: ruleSpec.severity,
        active: true,
        notify_email: !!ruleSpec.notify_email,
        notify_sms: !!ruleSpec.notify_sms,
      },
    );
    console.log(`    rule "${ruleSpec.name}" (${ruleSpec.rule_type} ${ruleSpec.threshold_value || ''})`);
  }

  return { client, sensorMap };
}

async function main() {
  console.log('=== ThermaShift emulator seed ===');
  console.log(`Supabase: ${SUPABASE_URL}`);
  const results = {};
  for (const [key, spec] of Object.entries(SEED)) {
    results[key] = await seedTenant(key, spec);
  }
  console.log('\n=== DONE ===');
  console.log('API keys (for inject scripts / dashboard URLs):');
  for (const [key, r] of Object.entries(results)) {
    console.log(`  ${key}: ${r.client.api_key}`);
    console.log(`    dashboard: ${process.env.THERMASHIFT_BASE_URL || 'https://thermashift.net'}/saas?key=${r.client.api_key}`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
