/**
 * Per-Client Saved Dashboard Layouts — Phase 7B
 *
 * Stores drag-and-drop dashboard configurations as JSON in client_dashboards.
 * Layout is react-grid-layout format. Widgets is an array of widget configs
 * (type, props). Each client can save multiple dashboards and mark one default.
 */

const DEFAULT_DASHBOARD = {
  layout: [
    { i: 'advisor', x: 0, y: 0, w: 12, h: 4 },
    { i: 'open-incidents', x: 0, y: 4, w: 12, h: 3 },
    { i: 'sites-grid', x: 0, y: 7, w: 12, h: 6 },
  ],
  widgets: [
    { id: 'advisor', type: 'ai_advisor', title: 'AI Cooling Advisor' },
    { id: 'open-incidents', type: 'incident_list', title: 'Open Incidents', filter: 'open' },
    { id: 'sites-grid', type: 'sites_overview', title: 'Sites' },
  ],
};

export async function listDashboards(sb, clientId) {
  return await sb('client_dashboards', 'GET', null,
    `?client_id=eq.${clientId}&order=is_default.desc,created_at.asc`);
}

export async function getDefaultDashboard(sb, clientId) {
  const rows = await sb('client_dashboards', 'GET', null,
    `?client_id=eq.${clientId}&is_default=eq.true&limit=1`);
  if (rows?.[0]) return rows[0];
  // Auto-create the default if none exists
  return await createDashboard(sb, clientId, {
    name: 'Default', is_default: true,
    layout: DEFAULT_DASHBOARD.layout, widgets: DEFAULT_DASHBOARD.widgets,
  });
}

export async function getDashboard(sb, clientId, id) {
  const rows = await sb('client_dashboards', 'GET', null,
    `?id=eq.${id}&client_id=eq.${clientId}&limit=1`);
  return rows?.[0] || null;
}

export async function createDashboard(sb, clientId, { name, is_default, layout, widgets, shared_with }) {
  if (is_default) {
    // Demote any existing default
    await sb('client_dashboards', 'PATCH',
      { is_default: false, updated_at: new Date().toISOString() },
      `?client_id=eq.${clientId}&is_default=eq.true`);
  }
  const [created] = await sb('client_dashboards', 'POST', {
    client_id: clientId,
    name: name || 'Untitled',
    is_default: !!is_default,
    layout: layout || DEFAULT_DASHBOARD.layout,
    widgets: widgets || DEFAULT_DASHBOARD.widgets,
    shared_with: shared_with || null,
  });
  return created;
}

export async function updateDashboard(sb, clientId, id, patch) {
  const own = await sb('client_dashboards', 'GET', null, `?id=eq.${id}&client_id=eq.${clientId}&limit=1`);
  if (!own?.[0]) throw new Error('dashboard_not_found');

  if (patch.is_default) {
    await sb('client_dashboards', 'PATCH',
      { is_default: false, updated_at: new Date().toISOString() },
      `?client_id=eq.${clientId}&is_default=eq.true&id=neq.${id}`);
  }

  const updated = await sb('client_dashboards', 'PATCH',
    { ...patch, updated_at: new Date().toISOString() }, `?id=eq.${id}`);
  return updated?.[0];
}

export async function deleteDashboard(sb, clientId, id) {
  const own = await sb('client_dashboards', 'GET', null, `?id=eq.${id}&client_id=eq.${clientId}&limit=1`);
  if (!own?.[0]) throw new Error('dashboard_not_found');
  if (own[0].is_default) throw new Error('cannot_delete_default');
  await sb('client_dashboards', 'DELETE', null, `?id=eq.${id}`);
  return { ok: true };
}

// ─── Widget catalog (frontend uses this to render available widgets) ───
export const WIDGET_CATALOG = [
  { type: 'ai_advisor', label: 'AI Cooling Advisor', description: 'Claude-powered analysis & upsell', defaultSize: { w: 12, h: 4 }, proOnly: false },
  { type: 'incident_list', label: 'Incident List', description: 'Open or recent incidents', defaultSize: { w: 12, h: 3 }, proOnly: false },
  { type: 'sites_overview', label: 'Sites Overview', description: 'All sites with sensor status', defaultSize: { w: 12, h: 6 }, proOnly: false },
  { type: 'sensor_chart', label: 'Sensor Chart', description: 'Time-series of one sensor', defaultSize: { w: 6, h: 4 }, proOnly: false, configurable: ['sensor_id', 'hours'] },
  { type: 'sensor_gauge', label: 'Sensor Gauge', description: 'Current value with threshold ring', defaultSize: { w: 3, h: 3 }, proOnly: false, configurable: ['sensor_id'] },
  { type: 'kpi_card', label: 'KPI Card', description: 'Single metric (open incidents, PUE, avg temp)', defaultSize: { w: 3, h: 2 }, proOnly: false, configurable: ['metric'] },
  { type: 'cooling_actions', label: 'Cooling Actions', description: 'Pending AI proposals + history', defaultSize: { w: 12, h: 4 }, proOnly: true },
  { type: 'rules_table', label: 'Alert Rules Table', description: 'Active rules and their triggers', defaultSize: { w: 6, h: 4 }, proOnly: false },
  { type: 'sales_escalations', label: 'AI Recommendations', description: 'Service upsell suggestions', defaultSize: { w: 6, h: 3 }, proOnly: true },
];
