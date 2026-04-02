import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, Thermometer, Droplets, Zap, Leaf, AlertTriangle,
  Server, Wind, RefreshCw, Gauge, Bell, LogOut,
  Brain, TrendingUp, TrendingDown, ShieldAlert, Wrench, ArrowUpRight,
} from 'lucide-react';
import { useClientAuth } from '../components/ClientAuth';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function fetchClientData(facilityId) {
  try {
    const url = `${SUPABASE_URL}/sensor_readings?facility_id=eq.${encodeURIComponent(facilityId)}&order=created_at.desc&limit=500`;
    const resp = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!rows || rows.length === 0) return null;

    const rackMap = {};
    rows.forEach(r => { if (!rackMap[r.rack_name]) rackMap[r.rack_name] = r; });

    const racks = Object.values(rackMap).map(r => ({
      name: r.rack_name,
      power: r.power_kw || 0,
      inletTemp: r.inlet_temp_c || 22,
      outletTemp: r.outlet_temp_c || 35,
      isHotspot: (r.outlet_temp_c || 35) > 45,
      coolingType: r.cooling_type || 'Air',
      hostname: r.hostname,
      lastSeen: r.created_at,
    }));

    const uniqueTimes = [];
    const seen = new Set();
    rows.forEach(r => {
      const hour = new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!seen.has(hour) && uniqueTimes.length < 24) {
        seen.add(hour);
        const sameTime = rows.filter(row => new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) === hour);
        const avgPower = sameTime.reduce((s, row) => s + (row.power_kw || 0), 0);
        const avgOutlet = sameTime.reduce((s, row) => s + (row.outlet_temp_c || 30), 0) / sameTime.length;
        const avgInlet = sameTime.reduce((s, row) => s + (row.inlet_temp_c || 22), 0) / sameTime.length;
        uniqueTimes.push({
          time: hour,
          totalITPower: +avgPower.toFixed(2),
          totalFacilityPower: +(avgPower * 1.5).toFixed(2),
          pue: 1.5,
          avgInletTemp: +avgInlet.toFixed(1),
          avgOutletTemp: +avgOutlet.toFixed(1),
          carbonEmissions: +(avgPower * 1.5 * 0.42 / 1000).toFixed(3),
        });
      }
    });

    const totalITPower = racks.reduce((s, r) => s + r.power, 0);
    const avgOutletTemp = racks.length > 0 ? +(racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length).toFixed(1) : 0;
    const hotspots = racks.filter(r => r.isHotspot);
    const totalFacility = totalITPower * 1.5;

    return {
      metrics: {
        pue: '1.50',
        totalITPower: +totalITPower.toFixed(2),
        coolingPower: +((totalFacility - totalITPower)).toFixed(2),
        avgOutletTemp,
        hotspots: hotspots.length,
        annualCarbonTonnes: +((totalFacility * 8760 * 0.42) / 1000000).toFixed(1),
        wasteHeatRecoverable: +(totalITPower * 0.95 * 0.6).toFixed(0),
      },
      racks,
      timeSeries: uniqueTimes.reverse(),
      hotspots,
      lastReading: rows[0]?.created_at,
      totalReadings: rows.length,
    };
  } catch {
    return null;
  }
}

function analyzeFacility(racks, metrics) {
  const recommendations = [];
  if (racks.length === 0) return { score: 0, grade: '—', recommendations: [] };

  const alertThreshold = 45;
  const avgPower = racks.reduce((s, r) => s + r.power, 0) / racks.length;
  const avgOutlet = racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length;
  const hotspots = racks.filter(r => r.outletTemp > alertThreshold);
  const warningRacks = racks.filter(r => r.outletTemp > alertThreshold - 5 && r.outletTemp <= alertThreshold);
  const highDensity = racks.filter(r => r.power > avgPower * 1.3);
  const deltaTs = racks.map(r => r.outletTemp - r.inletTemp);
  const maxDeltaT = Math.max(...deltaTs);
  const currentPUE = parseFloat(metrics.pue) || 1.5;

  let score = 100;
  score -= hotspots.length * 12;
  score -= warningRacks.length * 5;
  score -= Math.max(0, (currentPUE - 1.2) * 30);
  score -= Math.max(0, (avgOutlet - 38) * 3);
  score -= Math.max(0, (maxDeltaT - 25) * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  if (hotspots.length > 0) {
    recommendations.push({
      severity: 'critical', icon: ShieldAlert,
      title: `${hotspots.length} rack${hotspots.length > 1 ? 's' : ''} above ${alertThreshold}°C`,
      detail: `Racks ${hotspots.map(r => r.name).join(', ')} require immediate cooling intervention.`,
      action: 'Increase airflow to affected zones or consider liquid cooling for high-density racks.',
    });
  }
  if (warningRacks.length > 0) {
    recommendations.push({
      severity: 'warning', icon: TrendingUp,
      title: `${warningRacks.length} rack${warningRacks.length > 1 ? 's' : ''} approaching threshold`,
      detail: `Racks ${warningRacks.map(r => `${r.name} (${r.outletTemp}°C)`).join(', ')} are within 5°C of the alert threshold.`,
      action: 'Redistribute workloads or upgrade cooling before next load increase.',
    });
  }
  const airCooledHigh = highDensity.filter(r => r.coolingType === 'Air' || r.coolingType === 'air');
  if (airCooledHigh.length > 0) {
    recommendations.push({
      severity: 'warning', icon: Wrench,
      title: `${airCooledHigh.length} high-density rack${airCooledHigh.length > 1 ? 's' : ''} on air cooling`,
      detail: `Racks ${airCooledHigh.map(r => `${r.name} (${r.power}kW)`).join(', ')} exceed average density but rely on air cooling.`,
      action: 'Consider rear-door heat exchangers or direct-to-chip liquid cooling for these racks.',
    });
  }
  const tempStdDev = Math.sqrt(racks.reduce((s, r) => s + Math.pow(r.outletTemp - avgOutlet, 2), 0) / racks.length);
  if (tempStdDev > 5) {
    recommendations.push({
      severity: 'info', icon: ArrowUpRight,
      title: 'Thermal imbalance detected',
      detail: `Temperature spread of ${(Math.max(...racks.map(r => r.outletTemp)) - Math.min(...racks.map(r => r.outletTemp))).toFixed(1)}°C across facility.`,
      action: 'Rebalance airflow distribution for more uniform cooling.',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'success', icon: TrendingDown,
      title: 'Facility thermal performance is optimal',
      detail: `All ${racks.length} racks within safe temperature ranges.`,
      action: 'Continue monitoring. Consider waste heat recovery for additional revenue.',
    });
  }
  return { score, grade, recommendations };
}

function MetricCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'var(--text)' }}>{value}</span>
            {unit && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{unit}</span>}
          </div>
          {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>}
        </div>
        <Icon size={18} style={{ color: color || 'var(--accent)' }} />
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px' }}>
      {racks.map((rack) => (
        <div key={rack.name} style={{
          padding: '10px 6px', borderRadius: '6px',
          background: `${getColor(rack.outletTemp)}15`, border: `1px solid ${getColor(rack.outletTemp)}40`,
          textAlign: 'center',
        }} title={`${rack.name}: ${rack.power}kW | ${rack.outletTemp}°C`}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{rack.name}</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: getColor(rack.outletTemp) }}>{rack.outletTemp}°</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>{rack.power}kW</div>
          {rack.isHotspot && <AlertTriangle size={10} style={{ color: '#ef4444', marginTop: '2px' }} />}
        </div>
      ))}
    </div>
  );
}

const chartTooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem' };
const tickStyle = { fill: 'var(--text-dim)', fontSize: 9 };

export default function ClientPortal() {
  const { client, logout } = useClientAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const refresh = useCallback(async () => {
    const result = await fetchClientData(client.facility_id);
    if (result) {
      setData(result);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [client.facility_id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return (
      <main style={{ paddingTop: '72px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>Loading your facility data...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
        <section style={{ padding: '24px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Welcome, {client.client_name}</h1>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{client.facility_id}</p>
              </div>
              <button onClick={logout} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <LogOut size={16} /> Sign Out
              </button>
            </div>
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Server size={48} style={{ color: 'var(--text-dim)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>No Data Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Your monitoring agent hasn't sent any data yet. Make sure the agent is installed and running with your facility ID: <code>{client.facility_id}</code>
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const { metrics, racks, timeSeries, hotspots } = data;
  const analysis = analyzeFacility(racks, metrics);
  const sevColors = {
    critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#ef4444', label: 'CRITICAL' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: 'WARNING' },
    info: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)', color: '#06b6d4', label: 'OPTIMIZE' },
    success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10b981', label: 'OPTIMAL' },
  };
  const gradeColors = { A: '#10b981', B: '#06b6d4', C: '#f59e0b', D: '#f97316', F: '#ef4444' };

  return (
    <main style={{ paddingTop: '72px', background: 'var(--gradient-end)', minHeight: '100vh' }}>
      <section style={{ padding: '24px 0' }}>
        <div className="container">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Activity size={22} style={{ color: 'var(--accent)' }} />
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{client.client_name}</h1>
                <span style={{
                  padding: '2px 8px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700,
                  background: 'rgba(16,185,129,0.15)', color: 'var(--success)',
                }}>LIVE</span>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                {client.facility_id} — {racks.length} rack{racks.length !== 1 ? 's' : ''} monitored — Updated: {lastUpdate?.toLocaleTimeString() || '—'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={refresh} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={logout} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <MetricCard icon={Gauge} label="PUE" value={metrics.pue} color="var(--accent)" />
            <MetricCard icon={Zap} label="IT Power" value={metrics.totalITPower} unit="kW" color="var(--warning)" />
            <MetricCard icon={Wind} label="Cooling" value={metrics.coolingPower} unit="kW" color="var(--accent)" />
            <MetricCard icon={Thermometer} label="Avg Outlet" value={metrics.avgOutletTemp} unit="°C" color={metrics.avgOutletTemp > 40 ? 'var(--danger)' : 'var(--success)'} />
            <MetricCard icon={AlertTriangle} label="Hotspots" value={metrics.hotspots} color={metrics.hotspots > 0 ? 'var(--danger)' : 'var(--success)'} />
            <MetricCard icon={Leaf} label="Carbon" value={metrics.annualCarbonTonnes} unit="kt/yr" color="var(--success)" />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Power Load</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={tickStyle} interval={4} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="totalFacilityPower" fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth={2} name="Total (kW)" />
                  <Area type="monotone" dataKey="totalITPower" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={2} name="IT (kW)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Temperature</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={tickStyle} interval={4} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="avgInletTemp" stroke="#10b981" strokeWidth={2} dot={false} name="Inlet °C" />
                  <Line type="monotone" dataKey="avgOutletTemp" stroke="#ef4444" strokeWidth={2} dot={false} name="Outlet °C" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rack Heat Map */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Rack Thermal Map ({racks.length} racks)</h3>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.65rem' }}>
                <span><span style={{ color: '#10b981' }}>{'\u25CF'}</span> {'<35°C'}</span>
                <span><span style={{ color: '#06b6d4' }}>{'\u25CF'}</span> 35-40°C</span>
                <span><span style={{ color: '#f59e0b' }}>{'\u25CF'}</span> 40-45°C</span>
                <span><span style={{ color: '#ef4444' }}>{'\u25CF'}</span> {'>45°C'}</span>
              </div>
            </div>
            <RackHeatMap racks={racks} />
          </div>

          {/* AI Recommendations */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, var(--surface) 100%)', borderColor: 'rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={16} style={{ color: '#8b5cf6' }} /> AI Thermal Intelligence
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Health</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: gradeColors[analysis.grade] || 'var(--text)' }}>{analysis.score}/100</div>
                </div>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: `${gradeColors[analysis.grade] || '#64748b'}20`,
                  border: `2px solid ${gradeColors[analysis.grade] || '#64748b'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', fontWeight: 900, color: gradeColors[analysis.grade] || 'var(--text)',
                }}>{analysis.grade}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analysis.recommendations.map((rec, i) => {
                const sev = sevColors[rec.severity] || sevColors.info;
                return (
                  <div key={i} style={{ padding: '16px', borderRadius: '8px', background: sev.bg, border: `1px solid ${sev.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <rec.icon size={16} style={{ color: sev.color }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: sev.color, textTransform: 'uppercase' }}>{sev.label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{rec.title}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '8px' }}>{rec.detail}</p>
                    <div style={{ fontSize: '0.8rem', color: sev.color, fontWeight: 600, padding: '8px 12px', background: `${sev.color}10`, borderRadius: '6px', borderLeft: `3px solid ${sev.color}` }}>
                      Recommended: {rec.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hotspot Alerts */}
          {hotspots.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bell size={14} /> Active Alerts ({hotspots.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {hotspots.map((r) => (
                  <div key={r.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: '6px',
                    border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.85rem', flexWrap: 'wrap', gap: '8px',
                  }}>
                    <span style={{ fontWeight: 600 }}>Rack {r.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{r.outletTemp}°C | {r.power}kW</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            Powered by <strong>Therma<span style={{ color: 'var(--accent)' }}>Shift</span></strong> Thermal Intelligence Platform
          </div>
        </div>
      </section>
    </main>
  );
}
