# ThermaShift SaaS — Test Runbook

How to actually run the emulator + scenarios that ship in `server/emulator/`.

---

## When can I test?

**Now.** Everything in this folder runs against your existing production VPS
(`192.3.136.48` / `thermashift.net`). No new infrastructure needed.

The test harness creates `TEST_*` clients in your live Supabase, exercises
the platform end-to-end, and cleans up after itself. Real outreach data,
real client data, real BrandJet data — all untouched.

---

## Prerequisites — one-time setup

1. **SSH access to the VPS** (you have this already)
2. **Node 18+** on the VPS (already installed for chat-proxy)
3. **Admin password** in env to skip the 60s cron wait (optional but recommended):
   ```bash
   export ADMIN_PASSWORD='<your admin password>'
   export THERMASHIFT_ADMIN_PASSWORD='<same>'
   ```
   Without this, every scenario adds ~65s to wait for the alert evaluator cron. With it, scenarios complete in 5-15 seconds each.

---

## Step-by-step

### 1. SSH in and pull the latest

```bash
ssh root@192.3.136.48
cd /var/www/thermashift
git pull origin main
```

### 2. Seed the test clients

```bash
cd /var/www/thermashift/server/emulator
node seed.js
```

Output: API keys for TEST_A and TEST_B, plus dashboard URLs. **Save the TEST_A api_key** — you'll want to visit `https://thermashift.net/saas?key=<TEST_A_api_key>` in a browser to watch the dashboard light up as scenarios run.

Re-running `seed.js` is idempotent — won't duplicate.

### 3. Start the mock customer control endpoint (for action webhook tests)

In a second SSH window OR as a PM2 process:

```bash
# Foreground (simple, blocks the window):
cd /var/www/thermashift/server/emulator
node mock-customer-control.js

# Or as a managed PM2 process:
pm2 start mock-customer-control.js --name mock-customer-control
pm2 logs mock-customer-control     # watch incoming action webhooks
```

Listens on `http://localhost:4099`. Two endpoints:
- `POST /control?response=200|500|timeout|garbage` — receives action webhooks
- `GET /log` — see what it's received
- `GET /log/clear` — clear the log

### 4. Run the scenarios

```bash
cd /var/www/thermashift/server/emulator

# Run everything (~5-10 minutes with admin password set, ~25 min without)
node run-scenarios.js

# Or run a subset
node run-scenarios.js --only s-1,s-2,iso

# Or run one in isolation
node scenarios/critical-spike.js
```

### 5. Inspect what happened

```bash
# What's in the mock customer control log?
curl http://localhost:4099/log | jq

# What incidents are currently open?
curl -s 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1/monitoring_incidents?status=eq.open&select=*&order=opened_at.desc&limit=20' \
  -H "apikey: $SUPABASE_ANON_KEY" | jq

# Visit the TEST_A dashboard in your browser
# (the URL was printed by seed.js)
open https://thermashift.net/saas?key=<TEST_A_api_key>
```

### 6. Clean up

```bash
node teardown.js
```

Deletes all `TEST_*` clients via `ON DELETE CASCADE`. Safe to re-run.

---

## What you'll see in the summary

Three result types per scenario:

| Marker | Meaning |
|---|---|
| `✓` | **Pass** — platform behaved as designed |
| `✗` | **Real failure** — actual bug, investigate |
| `⊘` | **Expected fail** — needs the advisor→proposeAction wiring (see plan §b). Not a bug, just a known gap |

The script exits 0 if no real failures (✗), 1 if any. Expected-fail (⊘) does not block.

---

## What's actually testable TODAY vs needs wiring

### TESTABLE TODAY (should all pass ✓ on first run):

- **s-1 partial** — warning incident opens. AI proposal assertion will be ⊘.
- **s-2 partial** — critical incident opens, notifications fire. AI proposal will be ⊘.
- **s-4** — incident open→resolved transition. (AI escalation check uses absence-of evidence, so this can pass even without the AI wiring.)
- **s-6** — missing-data alert opens and recovers.
- **s-8** — quiet hours suppress warnings, critical bypasses (depends on notification audit logging being complete).
- **s-9** — no permission rule → action stays `proposed`.
- **s-10** — permission rule within bounds → auto-approve fires, webhook hits mock.
- **s-11** — permission rule with constraint exceeded → falls back to `proposed`.
- **iso** — **the gating quality bar**. Tenant isolation must pass. Privacy breach if not.

### REQUIRES advisor→proposeAction wiring (expected ⊘ today):

- **s-3** — economizer choice (needs AI to propose)
- **s-5** — conflicting-sensors human-intervention (needs AI judgment)
- **s-7** — oscillation dedup (needs AI to issue any proposals at all)
- **s-12** — multi-sensor coordination (needs AI to coordinate vs spam)

These will pass once the AI advisor is wired to call `proposeAction` when it identifies an actionable incident. That's a separate Phase 7-ish piece of work — see SAAS-TESTING-PLAN.md §b for the finding and the two design options (tool-use in advisor-chat vs. dedicated AI proposer service watching incidents).

---

## When something fails

1. **Check the dashboard** at `/saas?key=<TEST_A_api_key>` — does it match what the scenario expected?
2. **Check Supabase** — query `monitoring_incidents`, `monitoring_alert_notifications`, `cooling_actions`, `cooling_action_audit` directly.
3. **Check PM2 logs** — `pm2 logs chat-proxy` shows what the alert evaluator + notification dispatch actually did.
4. **Re-run with one scenario** — `node scenarios/<name>.js` shows full output for that scenario including the raw `details` block.

---

## Onboarding a real customer (the runbook this validates)

Once the scenarios pass, the customer-facing onboarding looks like this:

```
1. SALES CLOSE
   → You collect: company name, primary contact, billing email, tier
                  (Watch / Guard / Pro / Enterprise), timezone

2. ADMIN CREATE CLIENT
   POST /api/monitoring/clients  (admin auth)
   → returns api_key

3. ADMIN ADDS SITE(S)
   POST /api/monitoring/sites
   → name, address, square footage, rack count

4. ADMIN ADDS SENSORS
   POST /api/monitoring/sensors
   → external_id (the customer's vendor-assigned ID),
     vendor (monnit|sensorpush|disruptive|generic),
     sensor_type, unit

5. CUSTOMER CONFIGURES INTEGRATION
   Customer points their gateway / BMS / script at:
     POST https://thermashift.net/webhook/sensor/<vendor>?key=<api_key>
   First reading should appear in dashboard within seconds.

6. CUSTOMER CREATES ALERT RULES
   Via /saas dashboard "Rules" tab
   → choose sensor, threshold/missing/delta, severity, notify channels

7. (PRO TIER) CUSTOMER CONFIGURES ACTION WEBHOOK
   PATCH /api/monitoring/clients/:id
   → action_webhook_url, action_webhook_secret
   This is where AI cooling actions get dispatched. Without it, actions
   are recorded but not executed.

8. (PRO TIER) CUSTOMER SETS PERMISSION RULES
   Via dashboard or POST /api/monitoring/client/cooling-permissions
   → per-action auto-approve + parameter_constraints

9. LIVE
   Customer's dashboard at /saas?key=<their_api_key>
```

Every one of these steps has a scenario exercising it. If they all pass green, onboarding is real.
