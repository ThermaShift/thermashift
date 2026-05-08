/**
 * Full Pro-tier demo seeder for ThermaShift Demo Co.
 *
 * Run AFTER both supabase-migration-v6-cooling-actions.sql AND
 * supabase-migration-v7-advanced-features.sql have been applied.
 *
 * Sets up:
 *  - Demo client at Pro tier with action_webhook_url + actions_enabled
 *  - 2 pending cooling action proposals + 2 historical (1 manual approve + 1 auto)
 *  - 1 auto-approval permission rule (economizer)
 *  - Audit trail entries
 *  - 1 sample advisor chat with multi-turn conversation
 *  - 2 sample sales escalations (LCaaS upsell + Waste Heat upsell)
 *  - 1 custom dashboard layout
 *
 * Run on VPS: node server/seed-full-demo.js
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
  console.log('\n🎬 Seeding full Pro-tier demo for ThermaShift Demo Co...\n');

  // 1. Find + upgrade demo client to Pro
  const clients = await sb('monitoring_clients', 'GET', null, '?company=eq.ThermaShift Demo Co&limit=1');
  const client = clients?.[0];
  if (!client) {
    console.log('❌ Demo client not found. Run server/seed-demo-monitoring.js first.');
    process.exit(1);
  }
  await sb('monitoring_clients', 'PATCH', {
    tier: 'pro',
    actions_enabled: true,
    action_webhook_url: 'https://example.com/cooling-webhook',
    primary_contact_name: 'Demo Operator',
    updated_at: new Date().toISOString(),
  }, `?id=eq.${client.id}`);
  console.log(`✓ Demo client (id=${client.id}) → tier=pro, actions_enabled=true`);

  // 2. Wipe + reseed cooling actions
  await sb('cooling_action_audit', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('cooling_actions', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('cooling_action_permissions', 'DELETE', null, `?client_id=eq.${client.id}`);

  const sites = await sb('monitoring_sites', 'GET', null, `?client_id=eq.${client.id}&limit=2`);
  const charlotte = sites?.[0];
  const incidents = await sb('monitoring_incidents', 'GET', null, `?client_id=eq.${client.id}&status=eq.open&limit=1`);
  const openIncident = incidents?.[0];

  // Pending action 1: CRAC fan speed
  const [pending1] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    incident_id: openIncident?.id || null,
    action_type: 'set_crac_fan_speed',
    target_label: 'CRAC 2 (Charlotte Tier-III)',
    parameters: { target_label: 'CRAC 2', speed_percent: 95 },
    reasoning: 'Hot Aisle 3 Rack 18 sustained 87-89°F over the last 30 min while CRAC 2 is currently at 78% fan speed. Increasing to 95% should drop hot-aisle temps 4-6°F based on similar incidents in your facility. Estimated additional energy: $18/day. Risk if no action: GPU thermal throttling within 60 min.',
    status: 'proposed',
    requires_permission: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // Pending action 2: lower chilled water setpoint
  const [pending2] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'set_chilled_water_setpoint',
    target_label: 'Plant chilled water supply',
    parameters: { target_label: 'CW Supply', setpoint_f: 44 },
    reasoning: 'Chilled water supply temp is at 46°F. Lowering to 44°F adds ~12% cooling capacity to the plant during peak load. ROI: ~$200/day in avoided emergency mechanical cooling vs ~$60/day extra chiller energy. Net benefit: $140/day.',
    status: 'proposed',
    requires_permission: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // Completed action — manual approve
  const t4hAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
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
    approved_at: t4hAgo.toISOString(),
    executed_at: new Date(t4hAgo.getTime() + 2000).toISOString(),
    webhook_status_code: 200,
    webhook_response: '{"ok":true,"applied":true,"before":{"speed_percent":65},"after":{"speed_percent":78}}',
    created_at: new Date(t4hAgo.getTime() - 60000).toISOString(),
  });

  // Completed action — auto-approved
  const t24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [autoApproved] = await sb('cooling_actions', 'POST', {
    client_id: client.id,
    site_id: charlotte?.id || null,
    action_type: 'enable_economizer',
    target_label: 'Outside-air dampers',
    parameters: { target_label: 'CRAH zone B' },
    reasoning: 'Outside air dropped to 52°F. Free cooling viable. Auto-approved per economizer rule.',
    status: 'completed',
    requires_permission: false,
    approved_by: 'auto-approval rule',
    approved_at: t24hAgo.toISOString(),
    executed_at: new Date(t24hAgo.getTime() + 1500).toISOString(),
    webhook_status_code: 200,
    webhook_response: '{"ok":true,"economizer":"enabled"}',
    created_at: new Date(t24hAgo.getTime() - 30000).toISOString(),
  });

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

  // Audit entries
  for (const r of [
    { id: completed1.id, type: 'proposed', actor: 'ai', t: completed1.created_at },
    { id: completed1.id, type: 'approved', actor: 'demo@thermashift.net', t: completed1.approved_at },
    { id: completed1.id, type: 'executed', actor: 'demo@thermashift.net', t: completed1.executed_at, details: { webhook_status: 200 } },
    { id: autoApproved.id, type: 'proposed', actor: 'ai', t: autoApproved.created_at, details: { auto_approved: true } },
    { id: autoApproved.id, type: 'executed', actor: 'auto-approval', t: autoApproved.executed_at, details: { webhook_status: 200 } },
    { id: pending1.id, type: 'proposed', actor: 'ai', t: pending1.created_at },
    { id: pending2.id, type: 'proposed', actor: 'ai', t: pending2.created_at },
  ]) {
    await sb('cooling_action_audit', 'POST', {
      client_id: client.id, cooling_action_id: r.id,
      event_type: r.type, actor: r.actor, details: r.details || null,
      created_at: r.t,
    });
  }
  console.log('✓ Cooling actions: 2 pending + 2 completed + 1 permission rule + 7 audit entries');

  // 3. Wipe + reseed advisor chats
  await sb('advisor_chats', 'DELETE', null, `?client_id=eq.${client.id}`);
  const chatMessages = [
    { role: 'user', content: 'Why does Hot Aisle 3 Rack 18 keep spiking? It happens 2-3 times a week.', ts: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    { role: 'assistant', content: "Looking at 30 days of data on Rack 18, the pattern is clear: spikes correlate strongly with afternoon GPU workload bursts (2-5pm EST), and CRAC 2 fan speed lags behind by 8-12 minutes. Three things going on:\n\n1. **CRAC 2 control loop is too slow.** It only reacts when temps are already 84°F+. By the time it ramps, you're already at 87°F.\n\n2. **Hot aisle return path is partially blocked.** Comparing Rack 12 (77°F avg) vs Rack 18 (82°F avg) suggests airflow constraint, not cooling capacity.\n\n3. **Workload stacking.** Rack 18 has 3 GPU servers vs Rack 12's 1. This is a power density problem, not a cooling problem.\n\nRecommend: I can propose a fan speed pre-action when GPU utilization predicts a spike. Want me to set that up?", ts: new Date(Date.now() - 29 * 60 * 1000).toISOString() },
    { role: 'user', content: "Yes set it up. Also — what's the long-term fix?", ts: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
    { role: 'assistant', content: "Setting up predictive fan ramp now. For long-term:\n\nThe physical fix is liquid cooling on Rack 18 specifically — it's a high-density GPU rack that's outgrown air cooling. ThermaShift's LCaaS would do a rear-door heat exchanger retrofit on that rack alone, $40-60K, eliminates the hotspot permanently and reduces CRAC 2 load by ~15%.\n\nROI math: at $200/incident downtime risk × 14 incidents/30 days = $2,800/month exposure. Project pays back in 14-21 months even before energy savings.\n\nWant me to flag that as a Recommendation in your dashboard? Steve will reach out to scope it.", ts: new Date(Date.now() - 24 * 60 * 1000).toISOString() },
    { role: 'user', content: 'Yes, flag it.', ts: new Date(Date.now() - 23 * 60 * 1000).toISOString() },
    { role: 'assistant', content: "Done. You'll see it under Recommendations. Steve gets a notification at admin@thermashift.net and will reach out within 24 hours to scope a quote.", ts: new Date(Date.now() - 23 * 60 * 1000 + 30000).toISOString() },
  ];
  await sb('advisor_chats', 'POST', {
    client_id: client.id,
    incident_id: openIncident?.id || null,
    title: 'Rack 18 hotspot pattern analysis',
    messages: chatMessages,
    message_count: chatMessages.length,
    last_message_at: chatMessages[chatMessages.length - 1].ts,
  });
  console.log('✓ Advisor chat: 1 multi-turn conversation (6 messages) with LCaaS upsell pitch');

  // 4. Wipe + reseed sales escalations
  await sb('sales_escalations', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('sales_escalations', 'POST', {
    client_id: client.id,
    trigger_pattern: 'rule_1: 14 critical incidents in 30 days on Hot Aisle 3 Rack 18',
    related_incident_ids: openIncident ? [openIncident.id] : [],
    recommended_service: 'LCaaS',
    estimated_value_low: 40000,
    estimated_value_high: 60000,
    ai_pitch_summary: "Rack 18 has triggered 14 critical hot-aisle alerts in the last 30 days — recurring pattern suggests power density has outgrown air cooling. ThermaShift's Liquid Cooling-as-a-Service can deploy a rear-door heat exchanger ($40-60K project) that eliminates this hotspot permanently and reduces CRAC 2 load by ~15%. ROI: 14-21 months on incident risk alone. Worth a 15-min scoping call?",
    status: 'pending_client',
  });
  await sb('sales_escalations', 'POST', {
    client_id: client.id,
    trigger_pattern: 'sustained CRAC return temps >75°F across both sites for 60+ days',
    related_incident_ids: [],
    recommended_service: 'Waste Heat Recovery',
    estimated_value_low: 200000,
    estimated_value_high: 500000,
    ai_pitch_summary: "Your Charlotte facility runs CRAC return temps at 78°F average — that's 3.4M BTU/hr of recoverable heat being vented. ThermaShift's Waste Heat Recovery service could capture this and route it to a district heating partner or commercial greenhouse, generating $200-500K/year in incremental revenue. Setup is $50-300K project. Want a feasibility assessment?",
    status: 'pending_client',
  });
  console.log('✓ Sales escalations: 2 AI-suggested upsells (LCaaS $40-60K + Waste Heat $200-500K)');

  // 5. Wipe + create default dashboard layout
  await sb('client_dashboards', 'DELETE', null, `?client_id=eq.${client.id}`);
  await sb('client_dashboards', 'POST', {
    client_id: client.id,
    name: 'Operations Dashboard',
    is_default: true,
    layout: [
      { i: 'advisor', x: 0, y: 0, w: 12, h: 4 },
      { i: 'incidents', x: 0, y: 4, w: 8, h: 3 },
      { i: 'kpi-open', x: 8, y: 4, w: 4, h: 2 },
      { i: 'kpi-sites', x: 8, y: 6, w: 2, h: 1 },
      { i: 'kpi-sensors', x: 10, y: 6, w: 2, h: 1 },
      { i: 'sites', x: 0, y: 7, w: 12, h: 6 },
      { i: 'cooling-actions', x: 0, y: 13, w: 12, h: 4 },
    ],
    widgets: [
      { id: 'advisor', type: 'ai_advisor', title: 'AI Cooling Advisor' },
      { id: 'incidents', type: 'incident_list', title: 'Open Incidents' },
      { id: 'kpi-open', type: 'kpi_card', title: 'Open Incidents', props: { metric: 'open_incidents' } },
      { id: 'kpi-sites', type: 'kpi_card', title: 'Sites', props: { metric: 'site_count' } },
      { id: 'kpi-sensors', type: 'kpi_card', title: 'Sensors', props: { metric: 'sensor_count' } },
      { id: 'sites', type: 'sites_overview', title: 'Sites' },
      { id: 'cooling-actions', type: 'cooling_actions', title: 'AI Cooling Actions' },
    ],
  });
  console.log('✓ Custom dashboard layout: 7 widgets pre-arranged for Pro demo');

  console.log('\n🎬 DEMO READY!');
  console.log(`\n  Visit: https://thermashift.net/saas?key=${client.api_key}`);
  console.log('\n  All 8 tabs should now show realistic Pro-tier content:');
  console.log('  - Overview        → AI Advisor card auto-loads with recommendations');
  console.log('  - Custom Dashboard → Drag-and-drop with 7 pre-arranged widgets');
  console.log('  - Incidents       → Open + recent resolved incidents');
  console.log('  - Rules           → 2 alert rules');
  console.log('  - Cooling AI      → 2 pending actions + 2 historical + 1 permission rule + audit log');
  console.log('  - Chat with AI    → Sample multi-turn conversation about Rack 18 hotspot');
  console.log('  - Recommendations → 2 AI upsells (LCaaS + Waste Heat Recovery)');
  console.log('  - Billing         → Tier=Pro card highlighted, upgrade buttons for Enterprise');
}

main().catch(e => { console.error(e); process.exit(1); });
