import { useEffect, useState, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Plus, Save, Trash2, Settings, Sparkles, Activity, AlertTriangle,
  Building, Thermometer, BarChart3, Lightbulb, Gauge,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const ROW_H = 60;
const COLS = 12;

// ─── Widget renderers ──────────────────────────────────────

function Widget({ widget, apiKey, sensors, sites, openIncidents, fetchReadings, onSettings }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        <span>{widget.title || widget.type}</span>
        <div style={{ flex: 1 }} />
        {onSettings && <button onClick={(e) => { e.stopPropagation(); onSettings(widget); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}><Settings size={12} /></button>}
      </div>
      <div style={{ flex: 1, padding: 10, overflow: 'auto' }}>
        {renderWidgetBody(widget, { apiKey, sensors, sites, openIncidents, fetchReadings })}
      </div>
    </div>
  );
}

function renderWidgetBody(widget, ctx) {
  const { type, props = {} } = widget;
  const { apiKey, sensors = [], sites = [], openIncidents = [], fetchReadings } = ctx;

  switch (type) {
    case 'ai_advisor':
      return <AdvisorWidgetBody apiKey={apiKey} />;

    case 'incident_list': {
      const list = openIncidents.slice(0, 8);
      if (!list.length) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No open incidents 🟢</div>;
      return list.map(i => (
        <div key={i.id} style={{
          padding: '6px 8px', marginBottom: 4, borderRadius: 4,
          background: 'rgba(239,68,68,0.06)', borderLeft: '2px solid #ef4444',
          fontSize: '0.82rem',
        }}>
          <strong>{i.severity}</strong> · {i.summary}
        </div>
      ));
    }

    case 'sites_overview':
      return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {sites.map(s => (
          <div key={s.id} style={{ padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building size={14} />
              <strong style={{ fontSize: '0.88rem' }}>{s.name}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {sensors.filter(x => x.site_id === s.id).length} sensors
              {s.city ? ` · ${s.city}${s.state ? ', ' + s.state : ''}` : ''}
            </div>
          </div>
        ))}
      </div>;

    case 'sensor_chart':
      return <SensorChartMini sensorId={props.sensor_id} hours={props.hours || 24} fetchReadings={fetchReadings} />;

    case 'sensor_gauge': {
      const sensor = sensors.find(s => s.id === props.sensor_id);
      if (!sensor) return <div style={{ color: 'var(--text-muted)' }}>Pick a sensor in settings</div>;
      const v = sensor.last_reading_value;
      return <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sensor.name}</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 4 }}>{v ?? '—'} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sensor.unit}</span></div>
      </div>;
    }

    case 'kpi_card': {
      const metric = props.metric || 'open_incidents';
      let value = 0, label = '';
      if (metric === 'open_incidents') { value = openIncidents.length; label = 'Open incidents'; }
      else if (metric === 'site_count') { value = sites.length; label = 'Sites'; }
      else if (metric === 'sensor_count') { value = sensors.length; label = 'Sensors'; }
      return <div style={{ textAlign: 'center', paddingTop: 6 }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#863bff' }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
      </div>;
    }

    case 'cooling_actions':
      return <CoolingActionsWidgetBody apiKey={apiKey} />;

    case 'rules_table':
      return <RulesWidgetBody apiKey={apiKey} sensors={sensors} sites={sites} />;

    case 'sales_escalations':
      return <EscalationsWidgetBody apiKey={apiKey} />;

    default:
      return <div style={{ color: 'var(--text-muted)' }}>Unknown widget: {type}</div>;
  }
}

// ─── Live data widget bodies ───────────────────────────────

function AdvisorWidgetBody({ apiKey }) {
  const [advice, setAdvice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancel = false;
    fetch('/api/monitoring/client/advisor', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'overview' }),
    })
      .then(r => r.json())
      .then(d => { if (!cancel) (d.error ? setError(d.error) : setAdvice(d)); })
      .catch(e => !cancel && setError(String(e)));
    return () => { cancel = true; };
  }, [apiKey]);

  if (error) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
    <Sparkles size={14} style={{ verticalAlign: 'middle', color: '#863bff' }} /> AI Advisor temporarily unavailable.
  </div>;
  if (!advice) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
    <Sparkles size={14} style={{ verticalAlign: 'middle', color: '#863bff' }} /> Loading AI analysis…
  </div>;

  const recs = Array.isArray(advice.recommendations) ? advice.recommendations.slice(0, 3) : [];
  return (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Sparkles size={14} style={{ color: '#863bff' }} />
        <strong style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5, color: '#863bff' }}>AI Cooling Advisor</strong>
      </div>
      {advice.headline && <div style={{ fontWeight: 700, marginBottom: 6 }}>{advice.headline}</div>}
      {advice.analysis && <div style={{ color: 'var(--text-muted)', marginBottom: recs.length ? 8 : 0 }}>{advice.analysis}</div>}
      {recs.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {recs.map((r, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <strong>{r.action}</strong>
              {r.expected_impact && <span style={{ color: 'var(--text-muted)' }}> — {r.expected_impact}</span>}
            </li>
          ))}
        </ul>
      )}
      {advice.upsell?.service && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 4, background: 'rgba(134,59,255,0.08)', border: '1px solid rgba(134,59,255,0.2)', fontSize: '0.78rem' }}>
          <strong style={{ color: '#863bff' }}>{advice.upsell.service}</strong>
          {advice.upsell.estimated_value && <span style={{ color: 'var(--text-muted)' }}> · {advice.upsell.estimated_value}</span>}
        </div>
      )}
    </div>
  );
}

function CoolingActionsWidgetBody({ apiKey }) {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancel = false;
    fetch('/api/monitoring/client/cooling-actions?status=proposed', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then(r => r.json())
      .then(d => { if (!cancel) (d?.error ? setError(d.error) : setActions(Array.isArray(d) ? d : [])); })
      .catch(e => !cancel && setError(String(e)));
    return () => { cancel = true; };
  }, [apiKey]);

  if (error === 'tier_upgrade_required') return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
    <Sparkles size={14} style={{ verticalAlign: 'middle', color: '#863bff' }} /> Cooling actions require Pro tier.
  </div>;
  if (error) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Cooling actions unavailable.</div>;
  if (!actions) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!actions.length) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No pending cooling actions 🟢</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {actions.slice(0, 5).map(a => (
        <div key={a.id} style={{
          padding: '6px 10px', borderRadius: 4,
          background: 'rgba(134,59,255,0.06)', borderLeft: '2px solid #863bff',
          fontSize: '0.82rem',
        }}>
          <div><strong>{a.action_type}</strong> → {a.target_label}</div>
          {a.reasoning && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>{a.reasoning}</div>}
        </div>
      ))}
    </div>
  );
}

function EscalationsWidgetBody({ apiKey }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancel = false;
    fetch('/api/monitoring/client/escalations', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then(r => r.json())
      .then(d => { if (!cancel) (d?.error ? setError(d.error) : setList(Array.isArray(d) ? d : [])); })
      .catch(e => !cancel && setError(String(e)));
    return () => { cancel = true; };
  }, [apiKey]);

  if (error === 'tier_upgrade_required') return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Recommendations require Pro tier.</div>;
  if (error) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Recommendations unavailable.</div>;
  if (!list) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!list.length) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No recommendations yet.</div>;

  const fmtRange = (lo, hi) => {
    const f = (n) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${Math.round(n/1000)}K`;
    if (lo && hi) return `${f(lo)}–${f(hi)}`;
    return lo ? f(lo) : (hi ? f(hi) : '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.slice(0, 4).map(e => (
        <div key={e.id} style={{
          padding: '6px 10px', borderRadius: 4,
          background: 'rgba(16,185,129,0.06)', borderLeft: '2px solid #10b981',
          fontSize: '0.82rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <strong>{e.recommended_service}</strong>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRange(e.estimated_value_low, e.estimated_value_high)}</span>
          </div>
          {e.ai_pitch_summary && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>{e.ai_pitch_summary}</div>}
        </div>
      ))}
    </div>
  );
}

function RulesWidgetBody({ apiKey, sensors, sites }) {
  const [rules, setRules] = useState(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancel = false;
    fetch('/api/monitoring/client/rules', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then(r => r.json())
      .then(d => { if (!cancel) setRules(Array.isArray(d) ? d : []); })
      .catch(() => !cancel && setRules([]));
    return () => { cancel = true; };
  }, [apiKey]);

  if (!rules) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!rules.length) return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No alert rules configured.</div>;

  const sensorById = Object.fromEntries(sensors.map(s => [s.id, s]));
  const siteById = Object.fromEntries(sites.map(s => [s.id, s]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rules.slice(0, 6).map(r => {
        const sensor = sensorById[r.sensor_id];
        const site = siteById[r.site_id];
        const sevColor = r.severity === 'critical' ? '#ef4444' : (r.severity === 'warning' ? '#f59e0b' : '#94a3b8');
        return (
          <div key={r.id} style={{ padding: '4px 8px', fontSize: '0.82rem', borderLeft: `2px solid ${sevColor}`, background: 'rgba(255,255,255,0.02)' }}>
            <strong>{r.name}</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {sensor?.name || `sensor ${r.sensor_id}`}{site ? ` · ${site.name}` : ''} · {r.rule_type} {r.threshold_value}
              {r.active === false && <span style={{ color: '#94a3b8', marginLeft: 6 }}>(disabled)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SensorChartMini({ sensorId, hours, fetchReadings }) {
  const [readings, setReadings] = useState(null);
  useEffect(() => {
    if (!sensorId) return;
    fetchReadings(sensorId, hours).then(d => setReadings(d.readings || []));
  }, [sensorId, hours, fetchReadings]);
  if (!sensorId) return <div style={{ color: 'var(--text-muted)' }}>Pick a sensor in settings</div>;
  if (!readings) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  const data = readings.map(r => ({ t: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), v: Number(r.value) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="t" stroke="#94a3b8" fontSize={10} />
        <YAxis stroke="#94a3b8" fontSize={10} />
        <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4 }} />
        <Line type="monotone" dataKey="v" stroke="#863bff" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Main custom dashboard component ───────────────────────

export default function CustomDashboard({ apiKey, sensors, sites, openIncidents, fetchReadings, api: apiObj }) {
  const [dashboard, setDashboard] = useState(null);
  const [editing, setEditing] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const reload = useCallback(async () => {
    const d = await fetch('/api/monitoring/client/dashboards/default', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then(r => r.json());
    setDashboard(d);
    const cat = await fetch('/api/monitoring/client/widget-catalog', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then(r => r.json());
    setCatalog(cat || []);
  }, [apiKey]);

  useEffect(() => { reload(); }, [reload]);

  if (!dashboard) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading dashboard…</div>;

  const onLayoutChange = async (newLayout) => {
    if (!editing) return;
    setDashboard(d => ({ ...d, layout: newLayout }));
  };

  const saveLayout = async () => {
    await fetch(`/api/monitoring/client/dashboards/${dashboard.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: dashboard.layout, widgets: dashboard.widgets }),
    });
    setEditing(false);
  };

  const addWidget = (widgetType) => {
    const wcat = catalog.find(c => c.type === widgetType);
    const id = `w_${Date.now()}`;
    const newWidget = { id, type: widgetType, title: wcat.label };
    const newLayoutItem = {
      i: id, x: 0, y: Infinity, // place at bottom
      w: wcat.defaultSize?.w || 6, h: wcat.defaultSize?.h || 3,
    };
    setDashboard(d => ({
      ...d,
      widgets: [...(d.widgets || []), newWidget],
      layout: [...(d.layout || []), newLayoutItem],
    }));
    setShowAdd(false);
  };

  const removeWidget = (id) => {
    setDashboard(d => ({
      ...d,
      widgets: (d.widgets || []).filter(w => w.id !== id),
      layout: (d.layout || []).filter(l => l.i !== id),
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{dashboard.name}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {editing ? 'Drag, resize, or remove widgets — then Save' : 'Click Edit to customize'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => setShowAdd(!showAdd)} className="btn"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                <Plus size={14} /> Add widget
              </button>
              <button onClick={saveLayout} className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                <Save size={14} /> Save
              </button>
              <button onClick={() => { reload(); setEditing(false); }} className="btn"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              <Settings size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 12, marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {catalog.map(c => (
            <button key={c.type} onClick={() => addWidget(c.type)}
              style={{
                padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
              }}>
              <strong style={{ fontSize: '0.85rem' }}>{c.label}</strong>
              {c.proOnly && <span style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px', background: 'rgba(134,59,255,0.15)', color: '#863bff', borderRadius: 8 }}>PRO</span>}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{c.description}</div>
            </button>
          ))}
        </div>
      )}

      <GridLayout
        className="layout"
        layout={dashboard.layout || []}
        cols={COLS}
        rowHeight={ROW_H}
        width={1100}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        margin={[10, 10]}
      >
        {(dashboard.widgets || []).map(w => (
          <div key={w.id} style={{
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, position: 'relative', overflow: 'hidden',
          }}>
            {editing && (
              <button onClick={() => removeWidget(w.id)}
                style={{
                  position: 'absolute', top: 4, right: 4, zIndex: 10,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', padding: 2, borderRadius: 4, cursor: 'pointer',
                }}>
                <Trash2 size={12} />
              </button>
            )}
            <Widget widget={w} apiKey={apiKey} sensors={sensors} sites={sites} openIncidents={openIncidents} fetchReadings={fetchReadings} />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
