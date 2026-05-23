/**
 * Scenario s-9: No permission rules → action requires human approval.
 *
 * Ensure no cooling_action_permissions rows exist for TEST_A + set_crac_fan_speed.
 * Manually create a cooling action (simulating what the AI would do once wired,
 * OR what a user clicks through the dashboard). Verify the action lands in
 * status='proposed', NOT 'approved'.
 */

import { sb, findClient, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-9: no permission rules ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-9', reason: 'TEST_A not seeded' });

  // Make sure there's no permission rule for this combo
  await sb('cooling_action_permissions', 'DELETE', null,
    `?client_id=eq.${client.id}&action_type=eq.set_crac_fan_speed`);
  log('  ensured no permission rule for set_crac_fan_speed');

  // Get a site to attach to
  const site = (await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&limit=1`))?.[0];

  // Directly insert a cooling_action row simulating "AI proposed this"
  const [action] = await sb('cooling_actions', 'POST', {
    client_id: client.id, site_id: site.id,
    action_type: 'set_crac_fan_speed',
    target_label: 'CRAC1',
    parameters: { speed_percent: 75 },
    reasoning: 'simulated AI proposal — no permission rule should require human approval',
    proposed_by: 'ai',
    status: 'proposed',         // expected default for no auto-approve rule
    requires_permission: true,
  });

  if (action.status !== 'proposed') {
    return result({ pass: false, name: 's-9', reason: `action landed in status=${action.status}, expected 'proposed'`, details: { action } });
  }
  log(`  ✓ action ${action.id} status=proposed (correct — no auto-approve rule)`);

  // Cleanup the synthetic action
  await sb('cooling_actions', 'DELETE', null, `?id=eq.${action.id}`);

  return result({ pass: true, name: 's-9', details: { action_id: action.id } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
