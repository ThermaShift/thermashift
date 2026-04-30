/**
 * Seeds sample cooling actions on the demo client (ThermaShift Demo Co)
 * so /saas?key=... shows realistic AI proposals in the Cooling AI tab.
 * Run AFTER supabase-migration-v6-cooling-actions.sql.
 *
 * Usage on VPS: node server/seed-cooling-actions.js
 */
const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(t, m, b, q = '') {
  const r = await fetch(`${SUPABASE_URL}/${t}${q}`, {
    method: m,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: b ? JSON.stringify(b) : undefined,
  });
  if (!r.ok) throw new Error(`${m} ${t}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  // Find the demo client + ensure tier is pro
  const clients = await sb('monitoring_clients', 'GET', null, '?company=eq.ThermaShift Demo Co&limit=1');
  const client = clients?.[0];
  if (!client) {
    console.log('Demo client not found. Run server/seed-demo-monitoring.js first.');
    process.exit(1);
  }
  await sb('monitoring_clients', 'PATCH',
    { tier: 'pro', updated_at: new Date().toISOString() }, `?id=eq.${client.id}`);
  console.log(`✓ Demo client (id=${client.id}) tier set to 'pro'`);

  // Wipe prior cooling actions for this demo so we re-seed fresh
  await sb('cooling_action_audit', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('cooling_actions', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('cooling_action_permissions', 'DELETE', null, `?client_id=eq.${client.id}`);

  // Find a site + open incident if any
  const sites = await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&limit=2`);
  const charlotte = sites?.[0];
  const incidents = await sb('monitoring_incidents', 'GET', null, `?client_id=eq.${client.id}&status=eq.open&limit=1`);
  const openIncident = incidents?.[0];

  // Two pending proposals (require permission)
  const [pending1] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    incident_id: openIncident?.id || null,
    action_type: 'set_crac_fan_speed',
    target_label: 'CRAC 2 (Charlotte Tier-III)',
    parameters: { target_label: 'CRAC 2', speed_percent: 95 },
    reasoning: 'Hot Aisle 3 Rack 18 sustained 87-89°F over the last 30 min while CRAC 2 is currently at 78% fan speed. Increasing to 95% should drop hot-aisle temps 4-6°F based on similar incidents in your facility.',
    status: 'proposed',
    requires_permission: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  const [pending2] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'set_chilled_water_setpoint',
    target_label: 'Plant chilled water supply',
    parameters: { target_label: 'CW Supply', setpoint_f: 44 },
    reasoning: 'Chilled water supply temp is at 46°F. Lowering to 44°F adds ~12% cooling capacity to the plant during peak load. ROI: ~$200/day in avoided emergency mechanical cooling vs ~$60/day extra chiller energy.',
    status: 'proposed',
    requires_permission: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // One completed action (history) — successful
  const [completed1] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'set_pump_vfd_speed',
    target_label: 'Primary CHW pump #1',
    parameters: { target_label: 'CHW Pump 1', speed_percent: 78 },
    reasoning: 'Increase pump VFD from 65% to 78% to match thermal load. Estimated +9% chilled water flow.',
    status: 'completed',
    requires_permission: true,
    approved_by: 'demo@thermashift.net',
    approved_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 4 * 60 * 60 * 1000 + 2000).toISOString(),
    webhook_status_code: 200,
    webhook_response: '{"ok":true,"applied":true,"before":{"speed_percent":65},"after":{"speed_percent":78}}',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000 - 60000).toISOString(),
  });

  // One auto-approved completed (rule matched)
  const [autoApproved] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'enable_economizer',
    target_label: 'Outside-air dampers',
    parameters: { target_label: 'CRAH zone B' },
    reasoning: 'Outside air dropped to 52°F. Free cooling viable. Auto-approved per Pump-VFD rule.',
    status: 'completed',
    requires_permission: false,
    approved_by: 'auto-approval rule',
    approved_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + 1500).toISOString(),
    webhook_status_code: 200,
    webhook_response: '{"ok":true,"economizer":"enabled"}',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 - 30000).toISOString(),
  });

  // One auto-approval permission rule (showcasing the feature)
  await sb('cooling_action_permissions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'enable_economizer',
    auto_approve: true,
    max_severity: 'critical',
    parameter_constraints: null,
    active: true,
    created_by: 'demo@thermashift.net',
    notes: 'Free cooling is always safe and saves money — auto-approve.',
  });

  // Audit entries for the completed actions
  const auditRows = [
    { action_id: completed1.id, event_type: 'proposed', actor: 'ai', t: completed1.created_at },
    { action_id: completed1.id, event_type: 'approved', actor: 'demo@thermashift.net', t: completed1.approved_at },
    { action_id: completed1.id, event_type: 'executed', actor: 'demo@thermashift.net', t: completed1.executed_at,
      details: { webhook_status: 200 } },
    { action_id: autoApproved.id, event_type: 'proposed', actor: 'ai', t: autoApproved.created_at,
      details: { auto_approved: true } },
    { action_id: autoApproved.id, event_type: 'executed', actor: 'auto-approval', t: autoApproved.executed_at,
      details: { webhook_status: 200 } },
    { action_id: pending1.id, event_type: 'proposed', actor: 'ai', t: pending1.created_at },
    { action_id: pending2.id, event_type: 'proposed', actor: 'ai', t: pending2.created_at },
  ];
  for (const r of auditRows) {
    await sb('cooling_action_audit', 'POST', {
      client_id: client.id,
      cooling_action_id: r.action_id,
      event_type: r.event_type,
      actor: r.actor,
      details: r.details || null,
      created_at: r.t,
    });
  }

  console.log('✓ Seeded:');
  console.log(`  - 2 pending proposals (set_crac_fan_speed, set_chilled_water_setpoint)`);
  console.log(`  - 1 completed action (set_pump_vfd_speed, manually approved)`);
  console.log(`  - 1 completed action (enable_economizer, auto-approved by rule)`);
  console.log(`  - 1 auto-approval rule (economizer always allowed)`);
  console.log(`  - ${auditRows.length} audit log entries`);
  console.log('\nVisit https://thermashift.net/saas?key=tsk_demo_9f42e3c62de1be877830fa37dab0f3f2 → Cooling AI tab');
}

main().catch(e => { console.error(e); process.exit(1); });
