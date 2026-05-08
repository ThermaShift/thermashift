import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, Users, Phone, FileText, DollarSign, Mail,
  TrendingUp, ExternalLink, ArrowRight,
} from 'lucide-react';

// ─── Internal admin sales pipeline ─────────────────────────
// This dashboard is for STEVE ONLY. It shows real CRM data — leads,
// audits, proposals, invoices, conversion. Never share this URL with
// a prospect. The demo for prospects lives at /saas?key=tsk_demo_...

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

function tierColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#06b6d4';
  return '#94a3b8';
}
function tierLabel(score) {
  if (score >= 75) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 25) return 'COOL';
  return 'COLD';
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const load = async () => {
    try {
      const adminPw = sessionStorage.getItem('ts_admin_pw') || '';
      const headers = { 'x-admin-token': adminPw };
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/activity', { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (activityRes.ok) setActivity(await activityRes.json());
      setLastUpdate(new Date());
    } catch { /* ok */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ paddingTop: '72px', background: 'var(--gradient-end)', minHeight: '100vh' }}>
      <section style={{ padding: '24px 0' }}>
        <div className="container">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <TrendingUp size={22} style={{ color: '#00a3e0' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sales Pipeline</h1>
                <span style={{
                  padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
                }}>INTERNAL — DO NOT SHARE</span>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Your CRM data — leads, audits, proposals, revenue · Updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={load} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                <RefreshCw size={16} /> Refresh
              </button>
              <a href="/saas?key=tsk_demo_9f42e3c62de1be877830fa37dab0f3f2" target="_blank" rel="noopener noreferrer"
                className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                <ExternalLink size={16} /> Open Demo Dashboard
              </a>
            </div>
          </div>

          {/* Quick navigation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
            <Link to="/closer" style={navTileStyle('#863bff')}>
              <span style={{ fontSize: '0.7rem', color: '#863bff', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>✨ AI Closer</span>
              <span style={{ fontSize: '0.85rem' }}>Approve AI replies →</span>
            </Link>
            <Link to="/tracker" style={navTileStyle()}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>CRM</span>
              <span style={{ fontSize: '0.85rem' }}>Tracker →</span>
            </Link>
            <Link to="/proposal" style={navTileStyle()}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Sales</span>
              <span style={{ fontSize: '0.85rem' }}>Proposal generator →</span>
            </Link>
            <Link to="/contracts" style={navTileStyle()}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Legal</span>
              <span style={{ fontSize: '0.85rem' }}>Contracts →</span>
            </Link>
            <Link to="/content" style={navTileStyle()}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Marketing</span>
              <span style={{ fontSize: '0.85rem' }}>LinkedIn content →</span>
            </Link>
          </div>

          {loading && <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading sales pipeline…</div>}

          {!loading && !stats && (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <AlertTriangle size={28} style={{ color: '#ef4444', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600 }}>Could not load sales pipeline data.</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Check that you're logged in as admin.</div>
            </div>
          )}

          {stats && (
            <>
              {/* Top metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                <MetricCard icon={Users} label="Total Leads" value={stats.total_leads} color="#00a3e0" sub={`${stats.new_leads_week} this week`} />
                <MetricCard icon={AlertTriangle} label="Hot Leads" value={stats.hot_leads} color="#ef4444" sub={`${stats.warm_leads} warm`} />
                <MetricCard icon={FileText} label="Audits Done" value={stats.audits_completed} color="#10b981" sub={`${stats.audits_pending} pending`} />
                <MetricCard icon={DollarSign} label="Savings Found" value={`$${Math.round((stats.total_savings_identified || 0) / 1000)}K`} color="#10b981" />
                <MetricCard icon={Mail} label="Proposals" value={stats.proposals_sent} color="#f59e0b" sub={`$${Math.round((stats.total_pipeline_value || 0) / 1000)}K pipeline`} />
                <MetricCard icon={Phone} label="Voice Calls" value={stats.total_calls || 0} color="#8b5cf6" sub={`${stats.total_call_minutes || 0} min total`} />
              </div>

              {/* Recent activity */}
              {activity.length > 0 ? (
                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-dim)' }}>Recent activity</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                    {activity.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
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
                          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
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
              ) : (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={28} style={{ color: 'var(--text-dim)', marginBottom: '10px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No activity yet.</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                    Activity will appear here as leads come in, audits complete, and proposals send.
                  </div>
                  <Link to="/closer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '14px', color: '#863bff', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                    Check the AI Closer for inbound replies <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function navTileStyle(accent) {
  return {
    display: 'flex', flexDirection: 'column', gap: '4px',
    padding: '12px 14px', background: 'var(--surface)',
    borderRadius: '8px', border: `1px solid ${accent ? accent + '40' : 'var(--border)'}`,
    color: 'var(--text)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
  };
}
