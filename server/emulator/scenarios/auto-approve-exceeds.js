/**
 * Scenario s-11: Auto-approve exceeds bounds → falls back to human approval.
 *
 * Same setup as s-10 but propose speed_percent=95 — exceeds the 90%
 * parameter_constraint. Expected: action lands status='proposed' (not
 * auto-approved), requires_permission=true, awaits human click.
 */

import { sb, findClient, sleep, result } from './_common.js';
import { proposeAction } from '../../cooling-actions.js';

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
  log('=== Scenario s-11: auto-approve exceeds bounds ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-11', reason: 'TEST_A not seeded' });

  // Set up the same auto-approve rule with 90% ceiling
  await sb('cooling_action_permissions', 'DELETE', null, `?client_id=eq.${client.id}&action_type=eq.set_crac_fan_speed`);
  const [perm] = await sb('cooling_action_permissions', 'POST', {
    client_id: client.id, action_type: 'set_crac_fan_speed',
    active: true, auto_approve: true,
    parameter_constraints: { speed_percent: 90 },
  });
  log(`  permission rule ${perm.id} created (auto-approve up to 90%)`);

  const site = (await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&limit=1`))?.[0];

  // Propose 95% — exceeds constraint
  const action = await proposeAction(sbInline, {
    client_id: client.id, site_id: site.id,
    action_type: 'set_crac_fan_speed',
    target_label: 'CRAC1',
    parameters: { speed_percent: 95 },
    reasoning: 's-11 test: exceeds auto-approve bound',
    proposed_by: 'ai',
  });

  await sleep(1000);
  const fresh = (await sb('cooling_actions', 'GET', null, `?id=eq.${action.id}&limit=1`))?.[0];

  if (fresh.status !== 'proposed') {
    return result({ pass: false, name: 's-11',
      reason: `expected status=proposed for over-cap action, got ${fresh.status}`,
      details: { action: fresh } });
  }
  if (fresh.approved_at) {
    return result({ pass: false, name: 's-11', reason: 'over-cap action was approved — constraint bypass!' });
  }
  log(`  ✓ over-cap action correctly held at status=proposed`);

  // Cleanup
  await sb('cooling_actions', 'DELETE', null, `?id=eq.${fresh.id}`);
  await sb('cooling_action_permissions', 'DELETE', null, `?id=eq.${perm.id}`);

  return result({ pass: true, name: 's-11', details: { action_id: fresh.id, status: fresh.status } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
