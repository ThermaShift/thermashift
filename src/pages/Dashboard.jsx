import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, Thermometer, Droplets, Zap, Leaf, AlertTriangle,
  Server, Wind, TrendingDown, RefreshCw, Gauge,
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
