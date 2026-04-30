/**
 * Seeds a demo monitoring client with realistic-looking data so Steve can
 * show prospects a live SaaS dashboard. Run on VPS: node server/seed-demo-monitoring.js
 *
 * Outputs the magic-link URL Steve can share for demos.
 */
import crypto from 'crypto';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(table, method, body, query = '') {
  const res = await fetch(`${SUPABASE_URL}/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('🌱 Seeding demo monitoring data…\n');

  // Wipe any prior demo data so this is idempotent
  const existing = await sb('monitoring_clients', 'GET', null, '?company=eq.ThermaShift Demo Co&limit=1');
  if (existing?.[0]) {
    console.log(`  Removing prior demo (client id=${existing[0].id})…`);
    const cid = existing[0].id;
    for (const t of ['monitoring_alert_notifications', 'monitoring_incidents',
                      'monitoring_readings', 'monitoring_alert_rules',
                      'monitoring_sensors', 'monitoring_sites']) {
      await sb(t, 'DELETE', null, `?client_id=eq.${cid}`);
    }
    await sb('monitoring_clients', 'DELETE', null, `?id=eq.${cid}`);
  }

  // 1. Demo client
  const apiKey = 'tsk_demo_' + crypto.randomBytes(16).toString('hex');
  const [client] = await sb('monitoring_clients', 'POST', {
    company: 'ThermaShift Demo Co',
    primary_contact_name: 'Demo Operator',
    primary_contact_email: 'demo@thermashift.net',
    primary_contact_phone: '+17866056239',
    api_key: apiKey,
    tier: 'guard',
    timezone: 'America/New_York',
    notes: 'Public demo dataset — safe to show to prospects',
  });
  console.log(`✓ Client: ${client.company} (id=${client.id})`);

  // 2. Two sites
  const [siteCharlotte] = await sb('monitoring_sites', 'POST', {
    client_id: client.id, name: 'Charlotte Tier-III Colo',
    address: '1500 University City Blvd', city: 'Charlotte', state: 'NC',
    facility_type: 'colocation', square_footage: 32000, rack_count: 120,
  });
  const [siteTriangle] = await sb('monitoring_sites', 'POST', {
    client_id: client.id, name: 'Research Triangle Edge',
    address: '4500 Innovation Dr', city: 'Cary', state: 'NC',
    facility_type: 'edge', square_footage: 8500, rack_count: 24,
  });
  console.log(`✓ Sites: ${siteCharlotte.name}, ${siteTriangle.name}`);

  // 3. Sensors — realistic mix of temp/humidity/power across sites
  const sensorSpecs = [
    // Charlotte hot aisle temps (these will be the alerting ones)
    { site: siteCharlotte, name: 'Hot Aisle 3 — Rack 12', sensor_type: 'temperature', unit: '°F', location: 'Cold Aisle A', zone: 'A-3', baseline: 78, variance: 4 },
    { site: siteCharlotte, name: 'Hot Aisle 3 — Rack 18', sensor_type: 'temperature', unit: '°F', location: 'Cold Aisle A', zone: 'A-3', baseline: 82, variance: 6, willTrigger: true },
    { site: siteCharlotte, name: 'Hot Aisle 5 — Rack 04', sensor_type: 'temperature', unit: '°F', location: 'Cold Aisle B', zone: 'B-5', baseline: 76, variance: 3 },
    { site: siteCharlotte, name: 'CRAC 2 Supply', sensor_type: 'temperature', unit: '°F', location: 'Mech room', zone: 'CRAC', baseline: 62, variance: 2 },
    { site: siteCharlotte, name: 'CRAC 2 Return', sensor_type: 'temperature', unit: '°F', location: 'Mech room', zone: 'CRAC', baseline: 78, variance: 3 },
    { site: siteCharlotte, name: 'Cold Aisle A Humidity', sensor_type: 'humidity', unit: '%', location: 'Cold Aisle A', zone: 'A-3', baseline: 45, variance: 5 },
    { site: siteCharlotte, name: 'Hot Aisle B Humidity', sensor_type: 'humidity', unit: '%', location: 'Hot Aisle B', zone: 'B-5', baseline: 42, variance: 4 },
    { site: siteCharlotte, name: 'PDU 2A Power', sensor_type: 'power', unit: 'kW', location: 'PDU room', zone: 'PDU', baseline: 18.4, variance: 1.5 },
    // Triangle (smaller site)
    { site: siteTriangle, name: 'Edge Rack Temp', sensor_type: 'temperature', unit: '°F', location: 'Server closet', zone: 'edge', baseline: 74, variance: 2 },
    { site: siteTriangle, name: 'Edge Humidity', sensor_type: 'humidity', unit: '%', location: 'Server closet', zone: 'edge', baseline: 48, variance: 3 },
    { site: siteTriangle, name: 'Edge UPS Battery Temp', sensor_type: 'temperature', unit: '°F', location: 'UPS bank', zone: 'edge', baseline: 82, variance: 2 },
    { site: siteTriangle, name: 'Edge PDU Power', sensor_type: 'power', unit: 'kW', location: 'PDU', zone: 'edge', baseline: 4.2, variance: 0.4 },
  ];

  const sensors = [];
  for (const spec of sensorSpecs) {
    const [s] = await sb('monitoring_sensors', 'POST', {
      client_id: client.id, site_id: spec.site.id,
      external_id: `demo-${spec.site.id}-${spec.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      vendor: 'monnit', name: spec.name, sensor_type: spec.sensor_type, unit: spec.unit,
      location: spec.location, zone: spec.zone, active: true,
    });
    sensors.push({ ...s, _spec: spec });
  }
  console.log(`✓ Sensors: ${sensors.length}`);

  // 4. Generate 24 hours of readings (one per 5 min = 288 per sensor)
  console.log('  Generating 24h of readings (this takes ~30s)…');
  const now = Date.now();
  const SAMPLES = 288; // every 5 min for 24h
  const STEP = 5 * 60 * 1000;

  for (const s of sensors) {
    const baseline = s._spec.baseline;
    const variance = s._spec.variance;
    const readings = [];
    let lastVal = baseline;
    for (let i = SAMPLES; i > 0; i--) {
      const ts = new Date(now - i * STEP).toISOString();
      // Random walk toward baseline + diurnal effect
      const diurnal = Math.sin((SAMPLES - i) / SAMPLES * Math.PI * 2) * variance * 0.5;
      const drift = (Math.random() - 0.5) * variance * 0.3;
      lastVal += drift;
      lastVal = lastVal * 0.7 + (baseline + diurnal) * 0.3;
      let v = +lastVal.toFixed(1);
      // For the "willTrigger" sensor, push up the last 30 min
      if (s._spec.willTrigger && i < 6) v = 87 + Math.random() * 2;
      readings.push({ sensor_id: s.id, client_id: client.id, recorded_at: ts, value: v, unit: s.unit });
    }
    // Bulk insert in chunks of 100 (Supabase REST allows arrays)
    for (let i = 0; i < readings.length; i += 100) {
      await sb('monitoring_readings', 'POST', readings.slice(i, i + 100));
    }
    // Update last_reading on the sensor
    const last = readings[readings.length - 1];
    await sb('monitoring_sensors', 'PATCH',
      { last_reading_at: last.recorded_at, last_reading_value: last.value, updated_at: new Date().toISOString() },
      `?id=eq.${s.id}`);
  }
  console.log('  ✓ Readings inserted');

  // 5. Alert rules — one critical "above 85°F" on the hot aisle, plus a humidity rule
  const triggeringSensor = sensors.find(s => s._spec.willTrigger);
  const humiditySensor = sensors.find(s => s.sensor_type === 'humidity' && s.site_id === siteCharlotte.id);

  const [criticalRule] = await sb('monitoring_alert_rules', 'POST', {
    client_id: client.id, site_id: siteCharlotte.id, sensor_id: triggeringSensor.id,
    name: 'Hot aisle critical (>85°F)',
    rule_type: 'above', threshold_value: 85, threshold_window_minutes: 10,
    severity: 'critical', debounce_count: 2, active: true,
    notify_email: true, notify_sms: true,
  });
  await sb('monitoring_alert_rules', 'POST', {
    client_id: client.id, site_id: siteCharlotte.id, sensor_id: humiditySensor.id,
    name: 'Cold aisle humidity below 30%',
    rule_type: 'below', threshold_value: 30, threshold_window_minutes: 15,
    severity: 'warning', debounce_count: 3, active: true,
    notify_email: true,
  });
  console.log('✓ Rules: 2');

  // 6. Currently-open incident on the triggering sensor
  const [openIncident] = await sb('monitoring_incidents', 'POST', {
    client_id: client.id, alert_rule_id: criticalRule.id,
    sensor_id: triggeringSensor.id, site_id: siteCharlotte.id,
    status: 'open', severity: 'critical',
    opened_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    trigger_value: 87.4, trigger_threshold: 85, peak_value: 88.9,
    summary: 'Hot aisle critical (>85°F): saw 87.4°F sustained',
  });

  // 7. Three historical resolved incidents for context
  for (let i = 1; i <= 3; i++) {
    const opened = new Date(Date.now() - i * 36 * 60 * 60 * 1000);
    const resolved = new Date(opened.getTime() + (15 + Math.random() * 90) * 60 * 1000);
    await sb('monitoring_incidents', 'POST', {
      client_id: client.id, alert_rule_id: criticalRule.id,
      sensor_id: triggeringSensor.id, site_id: siteCharlotte.id,
      status: 'resolved', severity: i === 1 ? 'critical' : 'warning',
      opened_at: opened.toISOString(), resolved_at: resolved.toISOString(),
      duration_seconds: Math.floor((resolved - opened) / 1000),
      trigger_value: 86 + Math.random() * 3, trigger_threshold: 85,
      peak_value: 87 + Math.random() * 4,
      summary: `Hot aisle critical: peak ${(87 + Math.random() * 4).toFixed(1)}°F`,
    });
  }
  console.log(`✓ Incidents: 1 open, 3 resolved`);

  console.log(`\n🚀 Demo ready!`);
  console.log(`\n  Magic-link URL (share this for prospect demos):`);
  console.log(`  https://thermashift.net/saas?key=${apiKey}`);
  console.log(`\n  API key:    ${apiKey}`);
  console.log(`  Client ID:  ${client.id}`);
  console.log(`  Sensors:    ${sensors.length}`);
  console.log(`  Open incident: ${openIncident.id} (${openIncident.summary})`);
}

main().catch(e => { console.error(e); process.exit(1); });
