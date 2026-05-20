# ThermaShift SaaS Test Emulator

Injects fake sensor readings into the SaaS platform to test:
- Webhook ingestion paths (per-vendor adapters)
- Alert rule evaluator (trigger/recover state machine)
- Notification delivery (email/SMS/voice/webhook)
- AI cooling-action proposals + permission flow
- Multi-tenant isolation
- Onboarding flow end-to-end

## Layout

```
server/emulator/
├── README.md                       # this file
├── seed.js                         # create TEST_ clients/sites/sensors/rules
├── teardown.js                     # destroy all TEST_ data
├── run-scenarios.js                # run all scenarios, report pass/fail
├── inject.js                       # low-level webhook POSTer (used by scenarios)
├── mock-customer-control.js        # fake customer endpoint for action webhooks
├── vendors/
│   ├── monnit.js                   # generate Monnit-shaped payloads
│   ├── sensorpush.js               # SensorPush-shaped
│   ├── disruptive.js               # Disruptive-shaped (HMAC signed)
│   └── generic.js                  # generic adapter shape
├── scenarios/
│   ├── happy-path.js               # gradual temp drift, no alert
│   ├── gradual-temp-rise.js        # s-1: trigger fan-speed increase
│   ├── critical-spike.js           # s-2: sudden jump → chiller stage-up
│   ├── recovery.js                 # s-4: temps return to normal
│   ├── conflicting-sensors.js      # s-5: two sensors disagree
│   ├── sensor-offline.js           # s-6: stops reporting mid-incident
│   ├── oscillating.js              # s-7: temp swings around threshold
│   ├── quiet-hours-critical.js     # s-8: critical bypasses quiet hours
│   ├── no-permission-rules.js      # s-9: action proposed, not auto-approved
│   ├── auto-approve-bounded.js     # s-10/s-11: parameter constraints work
│   ├── multi-sensor-incident.js    # s-12: coordinated response
│   └── tenant-isolation.js         # multi-client cross-contamination check
└── README.md
```

## Running

The emulator can run from anywhere with HTTPS access to `thermashift.net`,
but the canonical way is on the VPS:

```bash
ssh root@192.3.136.48
cd /var/www/thermashift/server/emulator

# Create test data
node seed.js

# Start the mock customer control endpoint (action webhook target)
node mock-customer-control.js &       # listens on port 4099

# Run all scenarios
node run-scenarios.js                  # runs everything, asserts, reports

# OR run one scenario
node scenarios/critical-spike.js

# Cleanup
node teardown.js
```

For local dev (Windows/Mac), point at the prod URL:

```bash
export THERMASHIFT_BASE_URL=https://thermashift.net
node run-scenarios.js
```

## Test client naming convention

All emulator-created records are prefixed `TEST_` (company name) and use
api_keys like `tsk_test_<scenario>_<uuid>`. The `teardown.js` script does:

```sql
DELETE FROM monitoring_clients WHERE company LIKE 'TEST_%';
```

`ON DELETE CASCADE` handles sites/sensors/readings/incidents/actions cleanup.

## Adding a new scenario

1. Drop a new file under `scenarios/<name>.js`
2. Export `async function run({ sb, baseUrl, log })` that:
   - Looks up its test client by name (created by `seed.js`)
   - Calls `inject(...)` from `../inject.js` to POST fake readings
   - Optionally pokes `/api/monitoring/evaluate-now` to short-circuit the cron
   - Reads back from Supabase to verify expected state
   - Returns `{ pass: boolean, name, details }`
3. Register it in `run-scenarios.js` so it runs as part of the suite

## What the runner asserts

Every scenario must assert at minimum:
- Reading landed in `monitoring_readings` (correct value, unit, timestamp)
- If the scenario expects an alert: incident opened with correct severity
- If the scenario expects an AI action: row in `cooling_actions` with correct
  `action_type`, `parameters` within expected range, `status` matching the
  permission rule
- Audit trail (`monitoring_alert_notifications` + `cooling_action_audit`) is
  complete — one row per state transition
- Tenant isolation: query as test client A returns ONLY test client A's data
