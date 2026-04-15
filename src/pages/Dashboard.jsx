import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, Thermometer, Droplets, Zap, Leaf, AlertTriangle,
  Server, Wind, TrendingDown, RefreshCw, Gauge, Users, Phone,
  FileText, DollarSign, Mail, TrendingUp,
} from 'lucide-react';
import { generateRackData, generateTimeSeriesData, generateFacilityMetrics } from '../data/simulatedSensors';

function MetricCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: color || 'var(--text)' }}>{value}</span>
            {unit && <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{unit}</span>}
          </div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
        </div>
        <Icon size={20} style={{ color: color || 'var(--accent)' }} />
      </div>
    </div>
  );
}

function RackHeatMap({ racks }) {
  const getColor = (temp) => {
    if (temp > 45) return '#ef4444';
    if (temp > 40) return '#f59e0b';
    if (temp > 35) return '#06b6d4';
    return '#10b981';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
      {racks.map((rack) => (
        <div
          key={rack.name}
          style={{
            padding: '12px 8px',
            borderRadius: '8px',
            background: `${getColor(rack.outletTemp)}15`,
            border: `1px solid ${getColor(rack.outletTemp)}40`,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title={`${rack.name}: ${rack.power}kW | ${rack.outletTemp}°C | ${rack.coolingType}`}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>{rack.name}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: getColor(rack.outletTemp) }}>{rack.outletTemp}°</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>{rack.power}kW</div>
          {rack.isHotspot && (
            <AlertTriangle size={12} style={{ color: '#ef4444', marginTop: '4px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SalesPipeline() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const adminPw = sessionStorage.getItem('ts_admin_pw') || '';
        const headers = { 'x-admin-token': adminPw };
        const [statsRes, activityRes] = await Promise.all([
          fetch('/api/admin/stats', { headers }),
          fetch('/api/admin/activity', { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (activityRes.ok) setActivity(await activityRes.json());
      } catch { /* ok */ }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading sales pipeline...</div>;
  if (!stats) return null;

  const tierColor = (score) => {
    if (score >= 75) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 25) return '#06b6d4';
    return '#94a3b8';
  };

  const tierLabel = (score) => {
    if (score >= 75) return 'HOT';
    if (score >= 50) return 'WARM';
    if (score >= 25) return 'COOL';
    return 'COLD';
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <TrendingUp size={20} style={{ color: '#00a3e0' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Sales Pipeline</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <MetricCard icon={Users} label="Total Leads" value={stats.total_leads} color="#00a3e0" sub={`${stats.new_leads_week} this week`} />
        <MetricCard icon={AlertTriangle} label="Hot Leads" value={stats.hot_leads} color="#ef4444" sub={`${stats.warm_leads} warm`} />
        <MetricCard icon={FileText} label="Audits Done" value={stats.audits_completed} color="#10b981" sub={`${stats.audits_pending} pending`} />
        <MetricCard icon={DollarSign} label="Savings Found" value={`$${Math.round(stats.total_savings_identified / 1000)}K`} color="#10b981" />
        <MetricCard icon={Mail} label="Proposals" value={stats.proposals_sent} color="#f59e0b" sub={`$${Math.round(stats.total_pipeline_value / 1000)}K pipeline`} />
        <MetricCard icon={Phone} label="Voice Calls" value={stats.total_calls} color="#8b5cf6" sub={`${stats.total_call_minutes} min total`} />
      </div>

      {activity.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-dim)' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {activity.slice(0, 10).map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
                    textTransform: 'uppercase',
                    background: item.type === 'lead' ? 'rgba(0,163,224,0.15)' :
                                item.type === 'audit' ? 'rgba(16,185,129,0.15)' :
                                item.type === 'proposal' ? 'rgba(245,158,11,0.15)' :
                                'rgba(139,92,246,0.15)',
                    color: item.type === 'lead' ? '#00a3e0' :
                           item.type === 'audit' ? '#10b981' :
                           item.type === 'proposal' ? '#f59e0b' : '#8b5cf6',
                  }}>{item.type}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                    {item.type === 'lead' && `${item.data.name || item.data.email} — ${item.data.company || 'No company'}`}
                    {item.type === 'audit' && `Review for ${item.data.lead_email} — ${item.data.status}`}
                    {item.type === 'proposal' && `$${(item.data.total_value || 0).toLocaleString()} proposal — ${item.data.status}`}
                    {item.type === 'call' && `Call ${item.data.lead_phone || 'unknown'} — ${Math.round((item.data.duration_seconds || 0) / 60)}min`}
                  </span>
                  {item.type === 'lead' && item.data.lead_score > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800,
                      background: `${tierColor(item.data.lead_score)}20`,
                      color: tierColor(item.data.lead_score),
                    }}>{tierLabel(item.data.lead_score)} {item.data.lead_score}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(item.time).toLocaleDateString()} {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(generateFacilityMetrics());
  const [racks, setRacks] = useState(generateRackData());
  const [timeSeries, setTimeSeries] = useState(generateTimeSeriesData(24));
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refresh = () => {
    setMetrics(generateFacilityMetrics());
    setRacks(generateRackData());
    setTimeSeries(generateTimeSeriesData(24));
    setLastUpdate(new Date());
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  const hotspots = racks.filter(r => r.isHotspot);

  return (
    <main style={{ paddingTop: '72px', background: 'var(--gradient-end)', minHeight: '100vh' }}>
      <section style={{ padding: '24px 0' }}>
        <div className="container">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Activity size={22} style={{ color: 'var(--accent)' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Thermal Intelligence Dashboard</h1>
                <span style={{
                  padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
                  background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)',
                }}>DEMO</span>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Demo Facility — Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <button onClick={refresh} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {/* Sales Pipeline */}
          <SalesPipeline />

          {/* Top metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <MetricCard icon={Gauge} label="PUE" value={metrics.pue} color="var(--accent)" sub="Target: 1.10" />
            <MetricCard icon={Droplets} label="WUE" value={metrics.wue} unit="L/kWh" color="var(--accent)" sub="Water Usage Effectiveness" />
            <MetricCard icon={Zap} label="IT Power" value={metrics.totalITPower} unit="kW" color="var(--warning)" />
            <MetricCard icon={Wind} label="Cooling Load" value={metrics.coolingPower} unit="kW" color="var(--accent)" />
            <MetricCard icon={Thermometer} label="Avg Outlet" value={metrics.avgOutletTemp} unit="°C" color={metrics.avgOutletTemp > 40 ? 'var(--danger)' : 'var(--success)'} />
            <MetricCard icon={AlertTriangle} label="Hotspots" value={hotspots.length} color={hotspots.length > 0 ? 'var(--danger)' : 'var(--success)'} sub={hotspots.length > 0 ? 'Action required' : 'All clear'} />
            <MetricCard icon={Leaf} label="Carbon" value={metrics.annualCarbonTonnes} unit="kt/yr" color="var(--success)" />
            <MetricCard icon={Server} label="Uptime" value={metrics.uptime} unit="%" color="var(--success)" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px' }}>PUE Trend (24h)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval={4} />
                  <YAxis domain={[1.0, 1.4]} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                  <Line type="monotone" dataKey="pue" stroke="#06b6d4" strokeWidth={2} dot={false} name="PUE" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px' }}>Power Load (24h)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                  <Area type="monotone" dataKey="totalFacilityPower" fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth={2} name="Total Power (kW)" />
                  <Area type="monotone" dataKey="totalITPower" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={2} name="IT Power (kW)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Temperature + carbon charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px' }}>Temperature (24h)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                  <Line type="monotone" dataKey="avgInletTemp" stroke="#10b981" strokeWidth={2} dot={false} name="Inlet °C" />
                  <Line type="monotone" dataKey="avgOutletTemp" stroke="#ef4444" strokeWidth={2} dot={false} name="Outlet °C" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px' }}>Carbon Emissions (24h)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                  <Area type="monotone" dataKey="carbonEmissions" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" strokeWidth={2} name="CO₂ (tonnes/h)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rack heat map */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Rack Thermal Map</h3>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.7rem' }}>
                <span><span style={{ color: '#10b981' }}>{'\u25CF'}</span> {'<35°C'}</span>
                <span><span style={{ color: '#06b6d4' }}>{'\u25CF'}</span> 35-40°C</span>
                <span><span style={{ color: '#f59e0b' }}>{'\u25CF'}</span> 40-45°C</span>
                <span><span style={{ color: '#ef4444' }}>{'\u25CF'}</span> {'>45°C'}</span>
              </div>
            </div>
            <RackHeatMap racks={racks} />
          </div>

          {/* Alerts */}
          {hotspots.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> Active Hotspot Alerts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {hotspots.map((r) => (
                  <div key={r.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 16px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Rack {r.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {r.outletTemp}°C | {r.power}kW | {r.coolingType.toUpperCase()}
                    </span>
                    <span style={{
                      padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem',
                      fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)',
                    }}>HIGH TEMP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waste heat opportunity */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--surface) 100%)',
            borderColor: 'rgba(16,185,129,0.2)',
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Leaf size={16} style={{ color: 'var(--success)' }} /> Waste Heat Recovery Opportunity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Recoverable Thermal Output</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{metrics.wasteHeatRecoverable} kW</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Estimated Annual Revenue</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                  ${(metrics.wasteHeatRecoverable * 8760 * 0.03 / 1000).toFixed(0)}K
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Heat Output Temperature</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>{metrics.avgOutletTemp}°C</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Suitable For</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>District Heating, Greenhouses, Algae Bioreactors</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
