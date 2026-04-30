import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Activity, Thermometer, Droplets, Zap, AlertTriangle, Server,
  RefreshCw, Building, Clock, CheckCircle, XCircle, ArrowLeft, Bell,
  Sparkles, Plus, Edit3, Trash2, Save, MessageSquare, Send, TrendingUp,
  CreditCard, LayoutDashboard,
} from 'lucide-react';
import CustomDashboard from './CustomDashboard';

// ─── Visual helpers ─────────────────────────────────────────

const SEVERITY_COLOR = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

function statusFor(sensor, openIncidents) {
  const open = openIncidents.find(i => i.sensor_id === sensor.id);
  if (open) return { label: open.severity, color: SEVERITY_COLOR[open.severity] || '#f59e0b' };
  return { label: 'ok', color: '#10b981' };
}

function sensorIcon(t) {
  if (t === 'temperature') return <Thermometer size={18} />;
  if (t === 'humidity') return <Droplets size={18} />;
  if (t === 'power') return <Zap size={18} />;
  return <Activity size={18} />;
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── API client ─────────────────────────────────────────────

function api(apiKey) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  return {
    me: () => fetch('/api/monitoring/client/me', { headers }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
    overview: () => fetch('/api/monitoring/client/overview', { headers }).then(r => r.json()),
    readings: (sensorId, hours = 24) => fetch(`/api/monitoring/client/sensors/${sensorId}/readings?hours=${hours}`, { headers }).then(r => r.json()),
    incidents: (status) => fetch(`/api/monitoring/client/incidents${status ? `?status=${status}` : ''}`, { headers }).then(r => r.json()),
    rules: () => fetch('/api/monitoring/client/rules', { headers }).then(r => r.json()),
    createRule: (rule) => fetch('/api/monitoring/client/rules', { method: 'POST', headers, body: JSON.stringify(rule) }).then(r => r.json()),
    updateRule: (id, patch) => fetch(`/api/monitoring/client/rules/${id}`, { method: 'PATCH', headers, body: JSON.stringify(patch) }).then(r => r.json()),
    deleteRule: (id) => fetch(`/api/monitoring/client/rules/${id}`, { method: 'DELETE', headers }).then(r => r.json()),
    ackIncident: (id) => fetch(`/api/monitoring/client/incidents/${id}/ack`, { method: 'POST', headers, body: '{}' }).then(r => r.json()),
    advisor: (context, incidentId) => fetch('/api/monitoring/client/advisor', { method: 'POST', headers, body: JSON.stringify({ context, incident_id: incidentId }) }).then(r => r.json()),
    actionCatalog: () => fetch('/api/monitoring/client/action-catalog', { headers }).then(r => r.json()),
    coolingActions: (status) => fetch(`/api/monitoring/client/cooling-actions${status ? '?status=' + status : ''}`, { headers }).then(r => r.json()),
    approveAction: (id) => fetch(`/api/monitoring/client/cooling-actions/${id}/approve`, { method: 'POST', headers, body: '{}' }).then(r => r.json()),
    rejectAction: (id, reason) => fetch(`/api/monitoring/client/cooling-actions/${id}/reject`, { method: 'POST', headers, body: JSON.stringify({ reason }) }).then(r => r.json()),
    coolingPermissions: () => fetch('/api/monitoring/client/cooling-permissions', { headers }).then(r => r.json()),
    coolingAudit: () => fetch('/api/monitoring/client/cooling-audit', { headers }).then(r => r.json()),
    coolingConfig: (config) => fetch('/api/monitoring/client/cooling-config', { method: 'PATCH', headers, body: JSON.stringify(config) }).then(r => r.json()),
  };
}

// ─── Pages ──────────────────────────────────────────────────

function KeyPrompt({ onSubmit }) {
  const [val, setVal] = useState('');
  return (
    <main style={{ paddingTop: '120px', minHeight: '70vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Activity size={42} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.6rem', marginTop: 12 }}>ThermaShift Monitor</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Enter your client API key to access your dashboard</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(val.trim()); }} className="card" style={{ padding: 24 }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>API Key</label>
          <input value={val} onChange={e => setVal(e.target.value)} placeholder="tsk_…" required style={{ marginTop: 6, marginBottom: 16 }} />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Open Dashboard</button>
        </form>
      </div>
    </main>
  );
}

function StatusBadge({ status }) {
  const colors = {
    open: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    acknowledged: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
    resolved: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981' },
    critical: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
    info: { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6' },
    ok: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981' },
  };
  const c = colors[status] || colors.info;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      background: c.bg, color: c.fg, border: `1px solid ${c.fg}40`,
    }}>{status}</span>
  );
}

function SensorChart({ apiKey, sensor, onBack }) {
  const [data, setData] = useState(null);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    api(apiKey).readings(sensor.id, hours).then(r => setData(r.readings || []));
  }, [apiKey, sensor.id, hours]);

  if (!data) return <div style={{ padding: 40 }}>Loading chart…</div>;

  const chartData = data.map(r => ({
    t: new Date(r.recorded_at).getTime(),
    label: new Date(r.recorded_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: Number(r.value),
  }));

  const min = Math.min(...chartData.map(d => d.value));
  const max = Math.max(...chartData.map(d => d.value));
  const avg = chartData.reduce((s, d) => s + d.value, 0) / chartData.length;

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} className="btn" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{sensorIcon(sensor.sensor_type)} {sensor.name}</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sensor.location} · {sensor.zone}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[6, 24, 72, 168].map(h => (
            <button key={h} onClick={() => setHours(h)} className="btn"
              style={{ padding: '4px 10px', fontSize: '0.75rem', background: hours === h ? 'var(--accent)' : undefined, color: hours === h ? 'white' : undefined }}>
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Latest" value={`${chartData[chartData.length - 1]?.value ?? '—'} ${sensor.unit}`} />
        <Stat label="Avg" value={`${avg.toFixed(1)} ${sensor.unit}`} />
        <Stat label={`Range`} value={`${min.toFixed(1)} – ${max.toFixed(1)} ${sensor.unit}`} />
      </div>

      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} interval="preserveStartEnd" />
            <YAxis stroke="#94a3b8" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            <Line type="monotone" dataKey="value" stroke="#863bff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: 12, borderRadius: 8 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function IncidentRow({ incident, onAck }) {
  const sev = incident.severity || 'warning';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '120px 1fr 120px 100px',
      gap: 12, padding: '12px 16px', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: incident.status === 'open' ? 'rgba(239,68,68,0.04)' : 'transparent',
    }}>
      <StatusBadge status={incident.status === 'resolved' ? 'resolved' : sev} />
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{incident.summary}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Trigger: {incident.trigger_value} · Peak: {incident.peak_value || incident.trigger_value}
          {incident.duration_seconds ? ` · Duration: ${fmtDuration(incident.duration_seconds)}` : ''}
        </div>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtRelative(incident.opened_at)}</div>
      <div style={{ textAlign: 'right' }}>
        {incident.status === 'open' && (
          <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onAck(incident.id)}>
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

function Overview({ apiKey, data, onSelectSensor, onAckIncident }) {
  const { client, sites, sensors, openIncidents } = data;

  const sensorsBySite = {};
  for (const s of sensors) {
    sensorsBySite[s.site_id] = sensorsBySite[s.site_id] || [];
    sensorsBySite[s.site_id].push(s);
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent)', letterSpacing: 1, fontWeight: 700 }}>THERMASHIFT MONITOR</div>
          <h1 style={{ fontSize: '1.7rem', margin: '4px 0 0' }}>{client.company}</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tier: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{client.tier}</strong> ·
            {' '}{sites.length} site{sites.length !== 1 ? 's' : ''} ·
            {' '}{sensors.length} sensor{sensors.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Stat label="Open Incidents" value={openIncidents.length} />
        </div>
      </div>

      {/* Open incidents */}
      {openIncidents.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 24, border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} style={{ color: '#ef4444' }} />
            <strong style={{ color: '#ef4444' }}>{openIncidents.length} OPEN INCIDENT{openIncidents.length !== 1 ? 'S' : ''}</strong>
          </div>
          {openIncidents.map(i => <IncidentRow key={i.id} incident={i} onAck={onAckIncident} />)}
        </div>
      )}

      {/* Sites */}
      {sites.map(site => (
        <div key={site.id} className="card" style={{ padding: 0, marginBottom: 24 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Building size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{site.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {site.city}, {site.state} · {site.facility_type} · {site.rack_count} racks
              </div>
            </div>
          </div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {(sensorsBySite[site.id] || []).map(s => {
              const status = statusFor(s, openIncidents);
              return (
                <button key={s.id} onClick={() => onSelectSensor(s)} className="card"
                  style={{
                    padding: 14, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${status.color}30`,
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: status.color }}>
                      {sensorIcon(s.sensor_type)}
                      <strong style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{s.name}</strong>
                    </div>
                    <StatusBadge status={status.label} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {s.location} {s.zone ? `· ${s.zone}` : ''}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                      {s.last_reading_value ?? '—'}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>{s.unit}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {fmtRelative(s.last_reading_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function IncidentsTab({ apiKey }) {
  const [incidents, setIncidents] = useState(null);
  useEffect(() => { api(apiKey).incidents().then(setIncidents); }, [apiKey]);
  if (!incidents) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!incidents.length) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
    <CheckCircle size={32} style={{ color: '#10b981', marginBottom: 12 }} />
    <div>No incidents recorded.</div>
  </div>;
  return (
    <div className="card" style={{ padding: 0 }}>
      {incidents.map(i => <IncidentRow key={i.id} incident={i} onAck={() => {}} />)}
    </div>
  );
}

// ─── AI Advisor ─────────────────────────────────────────────

function AdvisorPanel({ apiKey, context, incidentId, autoLoad = true, compact = false }) {
  const collapseKey = `ts_advisor_collapsed_${context}`;
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem(collapseKey) === '1');

  const setCollapsedPersisted = (v) => {
    setCollapsed(v);
    if (v) sessionStorage.setItem(collapseKey, '1');
    else sessionStorage.removeItem(collapseKey);
  };

  const generate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api(apiKey).advisor(context, incidentId);
      if (r.error) setError(r.error);
      else setAdvice(r);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [apiKey, context, incidentId]);

  useEffect(() => { if (autoLoad && !collapsed) generate(); }, [autoLoad, generate, collapsed]);

  if (collapsed) {
    return (
      <button onClick={() => setCollapsedPersisted(false)}
        style={{
          width: '100%', marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(134,59,255,0.08), rgba(0,163,224,0.06))',
          border: '1px solid rgba(134,59,255,0.25)', color: 'var(--text)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
        }}>
        <Sparkles size={14} style={{ color: '#863bff' }} />
        Show AI Cooling Advisor
      </button>
    );
  }

  const cardBg = 'linear-gradient(135deg, rgba(134,59,255,0.08), rgba(0,163,224,0.06))';
  const border = '1px solid rgba(134,59,255,0.25)';

  if (!advice && !loading && !error) {
    return (
      <div className="card" style={{ padding: compact ? 14 : 20, marginBottom: 20, background: cardBg, border }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} style={{ color: '#863bff' }} />
            <strong>AI Cooling Advisor</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {context === 'incident' ? 'Analyze this incident' : 'Get recommendations for your sites'}
            </span>
          </div>
          <button className="btn btn-primary" onClick={generate} style={{ fontSize: '0.85rem' }}>
            <Sparkles size={14} /> Generate
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="card" style={{ padding: 20, marginBottom: 20, background: cardBg, border, textAlign: 'center' }}>
      <Sparkles size={20} style={{ color: '#863bff', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>AI advisor analyzing your data…</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ padding: 14, marginBottom: 20, border: '1px solid rgba(239,68,68,0.3)' }}>
      <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>Advisor error: {error}</div>
      <button className="btn" onClick={generate} style={{ marginTop: 8, fontSize: '0.8rem' }}>Retry</button>
    </div>
  );

  const upsellLabels = {
    'LCaaS': { label: 'Liquid Cooling-as-a-Service', icon: '❄️', color: '#0ea5e9' },
    'Waste Heat Recovery': { label: 'Waste Heat Recovery', icon: '♨️', color: '#f97316' },
    'Platform Expansion': { label: 'Platform Expansion', icon: '📡', color: '#863bff' },
    'ESG Consulting': { label: 'ESG Consulting', icon: '🌱', color: '#10b981' },
  };
  const u = advice.upsell;
  const upsellMeta = u && u.service ? upsellLabels[u.service] : null;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20, background: cardBg, border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Sparkles size={18} style={{ color: '#863bff' }} />
        <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, color: '#863bff' }}>
          AI Cooling Advisor
        </strong>
        {advice.cached && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>cached</span>}
        <div style={{ flex: 1 }} />
        <button onClick={generate} className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={() => setCollapsedPersisted(true)}
          title="Hide AI advisor (you can show it again anytime)"
          className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
          ✕ Hide
        </button>
      </div>

      <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.4 }}>{advice.headline}</h3>
      <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>{advice.analysis}</p>

      {advice.recommendations?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Recommended actions</div>
          {advice.recommendations.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6,
            }}>
              <div style={{
                padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.5, alignSelf: 'start',
                background: r.urgency === 'today' ? 'rgba(239,68,68,0.15)' : r.urgency === 'this week' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                color: r.urgency === 'today' ? '#ef4444' : r.urgency === 'this week' ? '#f59e0b' : '#3b82f6',
              }}>{r.urgency}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{r.action}</div>
                {r.expected_impact && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>↳ {r.expected_impact}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {upsellMeta && (
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${upsellMeta.color}40`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '1.2rem' }}>{upsellMeta.icon}</span>
            <strong style={{ color: upsellMeta.color }}>{upsellMeta.label}</strong>
            {u.estimated_value && (
              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>
                {u.estimated_value}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>{u.why}</p>
          <a href="https://thermashift.net/contact" target="_blank" rel="noopener" className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', textDecoration: 'none' }}>
            {u.cta || 'Schedule a free consultation'} →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Rule editor ────────────────────────────────────────────

const RULE_TYPES = [
  { value: 'above', label: 'Above threshold' },
  { value: 'below', label: 'Below threshold' },
  { value: 'delta', label: 'Sudden change (delta)' },
  { value: 'missing', label: 'Sensor offline (no readings)' },
];
const SEVERITIES = ['warning', 'critical', 'info'];

function RuleForm({ apiKey, sensors, sites, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || {
    name: '', sensor_id: sensors[0]?.id || '', site_id: '',
    rule_type: 'above', threshold_value: '', threshold_window_minutes: 5,
    delta_value: '', missing_after_minutes: 30,
    severity: 'warning', debounce_count: 2, active: true,
    notify_email: true, notify_sms: false, notify_voice: false, notify_webhook_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      // sensor_id + site_id from the chosen sensor
      const sensor = sensors.find(s => String(s.id) === String(form.sensor_id));
      if (sensor) payload.site_id = sensor.site_id;
      // Numeric fields
      ['threshold_value', 'threshold_window_minutes', 'delta_value', 'missing_after_minutes', 'debounce_count']
        .forEach(k => { if (payload[k] === '' || payload[k] == null) delete payload[k]; else payload[k] = Number(payload[k]); });

      const result = initial?.id
        ? await api(apiKey).updateRule(initial.id, payload)
        : await api(apiKey).createRule(payload);
      if (result?.error) { setError(result.error); }
      else { onSaved(); onClose(); }
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{initial ? 'Edit rule' : 'New alert rule'}</h3>
          <button className="btn" onClick={onClose} style={{ padding: '4px 8px' }}><XCircle size={16} /></button>
        </div>

        <Field label="Name">
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Hot aisle over 80°F" />
        </Field>
        <Field label="Sensor">
          <select value={form.sensor_id} onChange={e => set('sensor_id', e.target.value)}>
            <option value="">Choose…</option>
            {sensors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
        </Field>
        <Field label="Rule type">
          <select value={form.rule_type} onChange={e => set('rule_type', e.target.value)}>
            {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {(form.rule_type === 'above' || form.rule_type === 'below') && (
          <Field label="Threshold value">
            <input type="number" step="0.1" value={form.threshold_value} onChange={e => set('threshold_value', e.target.value)} placeholder="e.g. 80" />
          </Field>
        )}
        {form.rule_type === 'delta' && (
          <Field label="Delta value (change over window)">
            <input type="number" step="0.1" value={form.delta_value} onChange={e => set('delta_value', e.target.value)} placeholder="e.g. 5" />
          </Field>
        )}
        {form.rule_type === 'missing' && (
          <Field label="Missing after (minutes)">
            <input type="number" value={form.missing_after_minutes} onChange={e => set('missing_after_minutes', e.target.value)} />
          </Field>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Window (min)">
            <input type="number" value={form.threshold_window_minutes} onChange={e => set('threshold_window_minutes', e.target.value)} />
          </Field>
          <Field label="Debounce (consecutive)">
            <input type="number" value={form.debounce_count} onChange={e => set('debounce_count', e.target.value)} />
          </Field>
        </div>
        <Field label="Severity">
          <select value={form.severity} onChange={e => set('severity', e.target.value)}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '12px 0' }}>
          <Toggle label="Email" checked={form.notify_email} onChange={v => set('notify_email', v)} />
          <Toggle label="SMS" checked={form.notify_sms} onChange={v => set('notify_sms', v)} />
          <Toggle label="Voice call" checked={form.notify_voice} onChange={v => set('notify_voice', v)} />
          <Toggle label="Active" checked={form.active} onChange={v => set('active', v)} />
        </div>
        <Field label="Webhook URL (optional)">
          <input value={form.notify_webhook_url || ''} onChange={e => set('notify_webhook_url', e.target.value)} placeholder="https://hooks.slack.com/…" />
        </Field>

        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            <Save size={14} /> {saving ? 'Saving…' : (initial ? 'Update rule' : 'Create rule')}
          </button>
          <button onClick={onClose} className="btn">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function RulesTab({ apiKey, sensors, sites }) {
  const [rules, setRules] = useState(null);
  const [editing, setEditing] = useState(null); // {} = new, rule = edit, null = closed

  const load = useCallback(() => api(apiKey).rules().then(setRules), [apiKey]);
  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!confirm('Delete this rule?')) return;
    await api(apiKey).deleteRule(id);
    load();
  };

  if (!rules) return <div style={{ padding: 40 }}>Loading rules…</div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{rules.length} rule{rules.length !== 1 ? 's' : ''}</div>
        <button className="btn btn-primary" onClick={() => setEditing({})} style={{ fontSize: '0.85rem' }}>
          <Plus size={14} /> New rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No alert rules yet. Click "New rule" above to add your first one.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rules.map(r => {
            const sensor = sensors.find(s => s.id === r.sensor_id);
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong>{r.name}</strong>
                    <StatusBadge status={r.severity} />
                    {!r.active && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>(inactive)</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {sensor?.name || 'sensor #' + r.sensor_id} · {r.rule_type}
                    {r.threshold_value != null ? ` ${r.threshold_value} ${sensor?.unit || ''}` : ''}
                    {' '}· debounce {r.debounce_count} ·
                    {' '}{[r.notify_email && 'email', r.notify_sms && 'sms', r.notify_voice && 'voice'].filter(Boolean).join(', ') || 'no notifications'}
                  </div>
                </div>
                <button className="btn" onClick={() => setEditing(r)} style={{ padding: '4px 8px' }}><Edit3 size={14} /></button>
                <button className="btn" onClick={() => remove(r.id)} style={{ padding: '4px 8px', color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <RuleForm apiKey={apiKey} sensors={sensors} sites={sites}
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={load} />
      )}
    </>
  );
}

// ─── Cooling AI Tab (Pro tier) ──────────────────────────────

function UpgradeCard({ feature, currentTier, requiredTier = 'pro' }) {
  return (
    <div className="card" style={{
      padding: 28, textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(134,59,255,0.08), rgba(0,163,224,0.06))',
      border: '1px solid rgba(134,59,255,0.25)',
    }}>
      <Sparkles size={36} style={{ color: '#863bff', marginBottom: 12 }} />
      <h3 style={{ margin: '0 0 8px' }}>{feature} — Pro tier</h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 18px', fontSize: '0.92rem' }}>
        You're on <strong style={{ textTransform: 'capitalize' }}>{currentTier}</strong>. Upgrade to <strong>Pro ($599/mo)</strong> to let AI propose and take action on your cooling infrastructure — fan speeds, chilled water setpoints, pump VFDs, RDHX flow — with full audit logging and permission rules.
      </p>
      <a href="https://thermashift.net/contact" target="_blank" rel="noopener" className="btn btn-primary"
        style={{ padding: '8px 18px', fontSize: '0.9rem', display: 'inline-flex', textDecoration: 'none' }}>
        Upgrade to Pro →
      </a>
    </div>
  );
}

function CoolingActionCard({ action, catalog, onApprove, onReject }) {
  const meta = catalog?.[action.action_type] || { label: action.action_type, description: '' };
  const statusColors = {
    proposed: { bg: 'rgba(245,158,11,0.1)', fg: '#f59e0b' },
    approved: { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' },
    completed: { bg: 'rgba(16,185,129,0.1)', fg: '#10b981' },
    failed: { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
    rejected: { bg: 'rgba(148,163,184,0.1)', fg: '#94a3b8' },
    expired: { bg: 'rgba(148,163,184,0.1)', fg: '#94a3b8' },
  };
  const sc = statusColors[action.status] || statusColors.proposed;

  return (
    <div style={{
      background: 'var(--surface, #0f172a)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', color: '#863bff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ✨ AI proposed
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.02rem', marginTop: 2 }}>
            {meta.label}
            {action.target_label && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {action.target_label}</span>}
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.5,
          background: sc.bg, color: sc.fg, border: `1px solid ${sc.fg}40`,
        }}>{action.status}</span>
      </div>

      {Object.keys(action.parameters || {}).length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8,
          background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6, marginBottom: 10,
        }}>
          {Object.entries(action.parameters).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 2 }}>{String(v)}</div>
            </div>
          ))}
        </div>
      )}

      {action.reasoning && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12, fontStyle: 'italic' }}>
          {action.reasoning}
        </div>
      )}

      {action.status === 'proposed' && action.requires_permission && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onApprove(action.id)}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: '#10b981', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}>
            ✓ Approve & Execute
          </button>
          <button onClick={() => onReject(action.id, prompt('Reason for rejecting?') || '')}
            style={{
              padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            }}>
            ✗ Reject
          </button>
        </div>
      )}

      {action.executed_at && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Executed {new Date(action.executed_at).toLocaleString()} · HTTP {action.webhook_status_code || '—'}
          {action.approved_by && ` · Approved by ${action.approved_by}`}
        </div>
      )}
      {action.rejected_at && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Rejected {new Date(action.rejected_at).toLocaleString()} by {action.rejected_by} — {action.rejection_reason}
        </div>
      )}
    </div>
  );
}

function CoolingAITab({ apiKey, clientTier }) {
  const [actions, setActions] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [config, setConfig] = useState(null);
  const [editConfig, setEditConfig] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [actionsEnabled, setActionsEnabled] = useState(false);

  const isPro = clientTier === 'pro' || clientTier === 'enterprise';

  const reload = useCallback(async () => {
    if (!isPro) return;
    const [a, c] = await Promise.all([
      api(apiKey).coolingActions(),
      api(apiKey).actionCatalog(),
    ]);
    setActions(Array.isArray(a) ? a : []);
    setCatalog(c || {});
  }, [apiKey, isPro]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!isPro) return;
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload, isPro]);

  if (!isPro) {
    return <UpgradeCard feature="AI Cooling Actions" currentTier={clientTier} />;
  }

  if (!actions) return <div style={{ padding: 40 }}>Loading…</div>;

  const proposed = actions.filter(a => a.status === 'proposed');
  const recent = actions.filter(a => a.status !== 'proposed').slice(0, 20);

  const handleApprove = async (id) => {
    if (!confirm('Approve and execute this action now?')) return;
    await api(apiKey).approveAction(id);
    reload();
  };
  const handleReject = async (id, reason) => {
    await api(apiKey).rejectAction(id, reason);
    reload();
  };

  const saveConfig = async () => {
    await api(apiKey).coolingConfig({
      action_webhook_url: webhookUrl,
      action_webhook_secret: webhookSecret,
      actions_enabled: actionsEnabled,
    });
    setEditConfig(false);
    alert('Saved. Cooling actions will now POST to your webhook when approved.');
  };

  return (
    <>
      {/* Pending actions */}
      <div className="card" style={{
        padding: 18, marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(134,59,255,0.06), transparent)',
        border: '1px solid rgba(134,59,255,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            <Sparkles size={16} style={{ color: '#863bff', verticalAlign: 'middle' }} /> AI Cooling Actions
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{proposed.length} pending</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          AI proposes specific cooling adjustments based on incident patterns. Approve to execute via your webhook, or set auto-approval rules below.
        </p>
      </div>

      {proposed.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24 }}>
          No pending action proposals. AI proposes actions when incidents match patterns it can act on.
        </div>
      ) : (
        proposed.map(a => (
          <CoolingActionCard key={a.id} action={a} catalog={catalog}
            onApprove={handleApprove} onReject={handleReject} />
        ))
      )}

      {/* Webhook config */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Webhook configuration</strong>
          <button className="btn" onClick={() => setEditConfig(!editConfig)} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
            {editConfig ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editConfig ? (
          <>
            <Field label="Webhook URL (your BMS or DCIM API endpoint)">
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-bms.example.com/api/cooling-action" />
            </Field>
            <Field label="HMAC signing secret (we sign every payload with this)">
              <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="(leave blank to keep existing)" />
            </Field>
            <Toggle label="Actions enabled (master switch)" checked={actionsEnabled} onChange={setActionsEnabled} />
            <button onClick={saveConfig} className="btn btn-primary" style={{ marginTop: 12 }}>Save</button>
          </>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Configure your BMS/DCIM webhook URL so approved AI actions can be dispatched. We sign every payload with your secret so you can verify it came from us.
          </p>
        )}
      </div>

      {/* Action history */}
      <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Recent actions ({recent.length})
      </h4>
      {recent.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: 14 }}>None yet.</div>
      ) : (
        recent.map(a => (
          <CoolingActionCard key={a.id} action={a} catalog={catalog}
            onApprove={handleApprove} onReject={handleReject} />
        ))
      )}
    </>
  );
}

// ─── AI Advisor multi-turn chat (Phase 7F) ─────────────────

function AdvisorChat({ apiKey, clientTier, incidentId }) {
  const [chats, setChats] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const isPro = clientTier === 'pro' || clientTier === 'enterprise';

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const reload = useCallback(async () => {
    if (!isPro) return;
    const list = await fetch('/api/monitoring/client/advisor/chats', { headers }).then(r => r.json());
    setChats(Array.isArray(list) ? list : []);
  }, [apiKey, isPro]);

  useEffect(() => { reload(); }, [reload]);

  const startNew = async () => {
    const r = await fetch('/api/monitoring/client/advisor/chats', {
      method: 'POST', headers,
      body: JSON.stringify({ incident_id: incidentId, title: incidentId ? `Incident #${incidentId}` : 'New chat' }),
    }).then(r => r.json());
    setActiveChat(r);
    setMessages(r.messages || []);
    reload();
  };

  const openChat = async (id) => {
    const r = await fetch(`/api/monitoring/client/advisor/chats/${id}`, { headers }).then(r => r.json());
    setActiveChat(r);
    setMessages(r.messages || []);
  };

  const send = async () => {
    if (!activeChat || !input.trim()) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: 'user', content: userMsg, ts: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    try {
      const r = await fetch(`/api/monitoring/client/advisor/chats/${activeChat.id}/msg`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: userMsg }),
      }).then(r => r.json());
      if (r?.reply) setMessages(m => [...m, { role: 'assistant', content: r.reply, ts: new Date().toISOString() }]);
      else if (r?.error) setMessages(m => [...m, { role: 'assistant', content: `[error: ${r.error}]`, ts: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  if (!isPro) return <UpgradeCard feature="Multi-Turn Advisor Chat" currentTier={clientTier} />;

  if (!chats) return <div style={{ padding: 30 }}>Loading…</div>;

  if (!activeChat) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Conversations with the AI Advisor</h3>
          <button onClick={startNew} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            <Plus size={14} /> New chat
          </button>
        </div>
        {chats.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            No conversations yet. Click "New chat" to start asking the AI Advisor anything about your environment.
          </div>
        ) : chats.map(c => (
          <div key={c.id} onClick={() => openChat(c.id)} className="card"
            style={{ padding: 12, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{c.title}</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {c.message_count} messages · {fmtRelative(c.updated_at)}
              </span>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setActiveChat(null)} className="btn" style={{ padding: '4px 10px' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <h3 style={{ margin: 0, flex: 1, fontSize: '1rem' }}>{activeChat.title}</h3>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 10, maxHeight: 500, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Ask about a sensor, an incident, your cooling efficiency, or anything else. The AI has context for your environment.
          </div>
        ) : messages.map((m, i) => (
          <div key={i} style={{
            padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            background: m.role === 'user' ? 'transparent' : 'rgba(134,59,255,0.04)',
          }}>
            <div style={{ fontSize: '0.7rem', color: m.role === 'user' ? 'var(--text-muted)' : '#863bff', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {m.role === 'user' ? 'You' : '✨ AI Advisor'}
            </div>
            <div style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}
        {sending && (
          <div style={{ padding: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Sparkles size={14} style={{ verticalAlign: 'middle', color: '#863bff' }} /> AI is thinking…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask the advisor anything…"
          style={{ flex: 1 }} />
        <button onClick={send} disabled={sending || !input.trim()} className="btn btn-primary"
          style={{ padding: '8px 14px' }}>
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  );
}

// ─── Sales escalations tab (Phase 7G) ───────────────────────

function EscalationsTab({ apiKey, clientTier }) {
  const [items, setItems] = useState(null);
  const isPro = clientTier === 'pro' || clientTier === 'enterprise';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const reload = useCallback(async () => {
    if (!isPro) return;
    const r = await fetch('/api/monitoring/client/escalations', { headers }).then(r => r.json());
    setItems(Array.isArray(r) ? r : []);
  }, [apiKey, isPro]);

  useEffect(() => { reload(); }, [reload]);

  const decide = async (id, decision) => {
    if (decision === 'yes' && !confirm("Send to Steve for a quote? He'll reach out within 24 hours.")) return;
    await fetch(`/api/monitoring/client/escalations/${id}/decide`, {
      method: 'POST', headers, body: JSON.stringify({ decision }),
    });
    reload();
  };

  if (!isPro) return <UpgradeCard feature="AI Sales Recommendations" currentTier={clientTier} />;
  if (!items) return <div style={{ padding: 30 }}>Loading…</div>;
  if (items.length === 0) return (
    <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
      <TrendingUp size={28} style={{ color: '#10b981', marginBottom: 10 }} />
      <div>No active recommendations. AI scans your data every 6 hours for upsell-worthy patterns.</div>
    </div>
  );

  return items.map(e => (
    <div key={e.id} className="card" style={{ padding: 16, marginBottom: 12, border: '1px solid rgba(134,59,255,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Sparkles size={16} style={{ color: '#863bff' }} />
        <strong>{e.recommended_service}</strong>
        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
          ${e.estimated_value_low?.toLocaleString()} – ${e.estimated_value_high?.toLocaleString()}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtRelative(e.created_at)}</span>
      </div>
      <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginTop: 4, marginBottom: 10 }}>{e.ai_pitch_summary}</p>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>Pattern: {e.trigger_pattern}</div>
      {e.status === 'pending_client' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => decide(e.id, 'yes')} className="btn btn-primary" style={{ padding: '8px 14px' }}>
            ✓ Yes — send me a quote
          </button>
          <button onClick={() => decide(e.id, 'no')} className="btn" style={{ padding: '8px 14px' }}>
            Not now
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', color: e.status === 'sent_to_steve' ? '#10b981' : 'var(--text-muted)' }}>
          {e.status === 'sent_to_steve' ? '✓ Sent to Steve. Expect a reply within 24 hours.' : 'Declined.'}
        </div>
      )}
    </div>
  ));
}

// ─── Billing tab (Phase 5) ─────────────────────────────────

function BillingTab({ apiKey, client }) {
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const checkout = async (tier) => {
    setLoading(true);
    try {
      const r = await fetch('/api/billing/create-checkout', {
        method: 'POST', headers,
        body: JSON.stringify({ tier }),
      }).then(r => r.json());
      if (r.url) window.location.href = r.url;
      else alert(r.error || 'Could not start checkout');
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const portal = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/billing/portal-session', {
        method: 'POST', headers, body: '{}',
      }).then(r => r.json());
      if (r.url) window.location.href = r.url;
      else alert(r.error || 'Portal not available');
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const tiers = [
    { id: 'watch', name: 'Watch', price: 99, features: ['Email alerts', '3 sites', '30-day history', 'BYO sensors'] },
    { id: 'guard', name: 'Guard', price: 299, features: ['Watch +', 'SMS + voice alerts', 'AI Cooling Advisor', '10 sites', '1-yr history'] },
    { id: 'pro', name: 'Pro', price: 599, features: ['Guard +', 'AI auto-action', 'Custom dashboards', 'Audit log', 'Conversational AI', 'Unlimited sites'] },
  ];

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current plan</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, textTransform: 'capitalize' }}>{client.tier}</div>
        {client.subscription_status && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Status: <strong>{client.subscription_status}</strong>
            {client.current_period_end && ` · Renews ${new Date(client.current_period_end).toLocaleDateString()}`}
          </div>
        )}
        {client.stripe_customer_id && (
          <button onClick={portal} disabled={loading} className="btn" style={{ marginTop: 10, fontSize: '0.85rem' }}>
            <CreditCard size={14} /> Manage in Stripe Portal
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {tiers.map(t => {
          const isCurrent = client.tier === t.id;
          return (
            <div key={t.id} className="card" style={{
              padding: 18, border: isCurrent ? '2px solid #863bff' : '1px solid rgba(255,255,255,0.08)',
            }}>
              <strong style={{ fontSize: '1.05rem' }}>{t.name}</strong>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 6 }}>${t.price}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/mo</span></div>
              <ul style={{ fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--text-muted)', marginTop: 10, paddingLeft: 16 }}>
                {t.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {!isCurrent && (
                <button onClick={() => checkout(t.id)} disabled={loading}
                  className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: '0.9rem' }}>
                  {client.tier && t.id !== client.tier ? 'Switch to ' + t.name : 'Subscribe'}
                </button>
              )}
              {isCurrent && (
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.78rem', color: '#863bff', fontWeight: 700 }}>Your current plan</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 14 }}>
        Need Enterprise (white-label, SLA, SOC 2)? <a href="https://thermashift.net/contact" style={{ color: '#0ea5e9' }}>Contact sales</a>.
      </div>
    </>
  );
}

// ─── Main page ──────────────────────────────────────────────

export default function Saas() {
  const [params, setParams] = useSearchParams();
  const [apiKey, setApiKey] = useState(() => params.get('key') || sessionStorage.getItem('ts_saas_key') || '');
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);

  // Save key to session and clean URL
  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem('ts_saas_key', apiKey);
      if (params.get('key')) {
        params.delete('key');
        setParams(params, { replace: true });
      }
    }
  }, [apiKey, params, setParams]);

  const reload = useCallback(() => {
    if (!apiKey) return;
    setError(null);
    api(apiKey).overview().then(d => {
      if (d?.error) setError(d.error);
      else setData(d);
    }).catch(e => setError(String(e)));
  }, [apiKey]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!apiKey) return;
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [apiKey, reload]);

  if (!apiKey) return <KeyPrompt onSubmit={k => setApiKey(k)} />;

  if (error) return (
    <main style={{ paddingTop: 120, textAlign: 'center', minHeight: '60vh' }}>
      <XCircle size={42} style={{ color: '#ef4444' }} />
      <h2>Could not load dashboard</h2>
      <p style={{ color: 'var(--text-muted)' }}>{error}</p>
      <button className="btn" onClick={() => { sessionStorage.removeItem('ts_saas_key'); setApiKey(''); }}>Try a different key</button>
    </main>
  );

  if (!data) return <main style={{ paddingTop: 120, textAlign: 'center' }}>Loading…</main>;

  const ackIncident = async (id) => {
    await api(apiKey).ackIncident(id);
    reload();
  };

  return (
    <main style={{ paddingTop: 92, paddingBottom: 60, maxWidth: 1200, margin: '0 auto', padding: '92px 24px 60px' }}>
      {selectedSensor ? (
        <SensorChart apiKey={apiKey} sensor={selectedSensor} onBack={() => setSelectedSensor(null)} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'custom', label: 'Custom Dashboard' },
              { key: 'incidents', label: 'Incidents' },
              { key: 'rules', label: 'Rules' },
              { key: 'cooling-ai', label: 'Cooling AI', proOnly: true },
              { key: 'chat', label: 'Chat with AI', proOnly: true },
              { key: 'escalations', label: 'Recommendations', proOnly: true },
              { key: 'billing', label: 'Billing' },
            ].map(t => {
              const isPro = data.client.tier === 'pro' || data.client.tier === 'enterprise';
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                    color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  {t.label}
                  {t.proOnly && !isPro && <span style={{ fontSize: '0.65rem', padding: '1px 5px', background: 'rgba(134,59,255,0.15)', color: '#863bff', borderRadius: 8 }}>PRO</span>}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={reload}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {tab === 'overview' && (
            <>
              <AdvisorPanel apiKey={apiKey} context="overview" autoLoad={true} />
              <Overview apiKey={apiKey} data={data} onSelectSensor={setSelectedSensor} onAckIncident={ackIncident} />
            </>
          )}
          {tab === 'incidents' && <IncidentsTab apiKey={apiKey} />}
          {tab === 'rules' && <RulesTab apiKey={apiKey} sensors={data.sensors} sites={data.sites} />}
          {tab === 'cooling-ai' && <CoolingAITab apiKey={apiKey} clientTier={data.client.tier} />}
          {tab === 'custom' && (
            <CustomDashboard
              apiKey={apiKey}
              sensors={data.sensors}
              sites={data.sites}
              openIncidents={data.openIncidents}
              fetchReadings={(sid, hours) => api(apiKey).readings(sid, hours)}
            />
          )}
          {tab === 'chat' && <AdvisorChat apiKey={apiKey} clientTier={data.client.tier} />}
          {tab === 'escalations' && <EscalationsTab apiKey={apiKey} clientTier={data.client.tier} />}
          {tab === 'billing' && <BillingTab apiKey={apiKey} client={data.client} />}
        </>
      )}
    </main>
  );
}
