/**
 * Scenario s-10: Auto-approve within bounds.
 *
 * Create a permission rule: auto-approve set_crac_fan_speed up to 90%.
 * Run proposeAction with speed_percent=75 — should auto-approve, fire the
 * mock customer webhook, and end up status='completed' (or 'failed' if
 * webhook unreachable).
 *
 * REQUIRES: mock-customer-control.js running on localhost:4099, and
 * TEST_A's action_webhook_url set to it (seed.js does this by default).
 */

import { sb, findClient, sleep, result } from './_common.js';
import { proposeAction } from '../../cooling-actions.js';

// Build a sb wrapper that the cooling-actions module expects (same signature
// as server/chat-proxy.js sb function)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
async function sbInline(table, method, body, q = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-10: auto-approve within bounds ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-10', reason: 'TEST_A not seeded' });
  if (!client.actions_enabled || !client.action_webhook_url) {
    return result({ pass: false, name: 's-10', reason: 'TEST_A actions_enabled or action_webhook_url not set — re-run seed.js' });
  }

  // Set up auto-approve permission rule: up to 90% fan speed
  await sb('cooling_action_permissions', 'DELETE', null, `?client_id=eq.${client.id}&action_type=eq.set_crac_fan_speed`);
  const [perm] = await sb('cooling_action_permissions', 'POST', {
    client_id: client.id, action_type: 'set_crac_fan_speed',
    active: true, auto_approve: true,
    parameter_constraints: { speed_percent: 90 },
  });
  log(`  permission rule ${perm.id} created (auto-approve up to 90%)`);

  const site = (await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&limit=1`))?.[0];

  // Propose 75% — within constraint
  let action;
  try {
    action = await proposeAction(sbInline, {
      client_id: client.id, site_id: site.id,
      action_type: 'set_crac_fan_speed',
      target_label: 'CRAC1',
      parameters: { speed_percent: 75 },
      reasoning: 's-10 test: within auto-approve bound',
      proposed_by: 'ai',
    });
  } catch (e) {
    return result({ pass: false, name: 's-10', reason: `proposeAction threw: ${e.message}` });
  }

  // Give executeAction time to fire and webhook to respond
  await sleep(3000);

  const fresh = (await sb('cooling_actions', 'GET', null, `?id=eq.${action.id}&limit=1`))?.[0];
  if (!fresh) return result({ pass: false, name: 's-10', reason: 'action disappeared' });

  log(`  action ${fresh.id} status=${fresh.status}`);
  if (!['approved', 'completed', 'failed'].includes(fresh.status)) {
    return result({ pass: false, name: 's-10', reason: `expected approved/completed/failed, got ${fresh.status}` });
  }
  if (!fresh.approved_at) {
    return result({ pass: false, name: 's-10', reason: 'approved_at not set — auto-approval did not fire' });
  }
  log(`  ✓ auto-approved at ${fresh.approved_at} by ${fresh.approved_by}`);

  // Cleanup
  await sb('cooling_action_permissions', 'DELETE', null, `?id=eq.${perm.id}`);

  return result({ pass: true, name: 's-10', details: { action_id: fresh.id, final_status: fresh.status, approved_by: fresh.approved_by } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
