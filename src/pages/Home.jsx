import { Link } from 'react-router-dom';
import { Thermometer, Leaf, BarChart3, FileCheck, ArrowRight, Zap, Droplets, Server, TrendingDown } from 'lucide-react';

const stats = [
  { value: '40%', label: 'of DC energy goes to cooling', icon: Zap },
  { value: '3,000x', label: 'liquid vs air thermal efficiency', icon: Droplets },
  { value: '140kW', label: 'heat per Blackwell Ultra rack', icon: Server },
  { value: '39%', label: 'TCO reduction with immersion', icon: TrendingDown },
];

const services = [
  {
    icon: Thermometer,
    title: 'Liquid Cooling-as-a-Service',
    desc: 'Subscription-based design, installation, and management of rear-door heat exchangers, direct-to-chip, and immersion cooling systems. No capital outlay for your facility.',
    tag: 'LCaaS',
  },
  {
    icon: Leaf,
    title: 'Waste Heat Recovery & Monetization',
    desc: 'Turn your thermal waste into revenue. We broker heat sales to greenhouses, district heating networks, and algae carbon capture systems.',
    tag: 'Revenue from Heat',
  },
  {
    icon: BarChart3,
    title: 'Thermal Intelligence Platform',
    desc: 'Real-time monitoring dashboard: rack thermal loads, PUE/WUE/carbon reporting, hotspot prediction, and efficiency optimization.',
    tag: 'SaaS',
  },
  {
    icon: FileCheck,
    title: 'ESG & Environmental Consulting',
    desc: 'Environmental impact assessments, heat reuse feasibility studies, water audits, PUE certification prep, and regulatory compliance guidance.',
    tag: 'Consulting',
  },
];

const problems = [
  'Your air-cooled facility can\'t handle AI rack densities above 25kW',
  'You\'re venting millions in waste heat into the atmosphere every year',
  'ESG regulations are tightening — Germany mandates heat reuse by 2026',
  'Your PUE is stuck above 1.4 and clients are asking questions',
  'You need liquid cooling but don\'t have in-house thermal engineering',
];

export default function Home() {
  return (
    <main style={{ paddingTop: '72px' }}>
      {/* Hero */}
      <section style={{
        padding: '100px 0 80px',
        background: 'radial-gradient(ellipse at 30% 0%, rgba(6,182,212,0.08) 0%, transparent 60%)',
      }}>
        <div className="container">
          <div style={{ maxWidth: '720px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'var(--accent-glow)',
              borderRadius: '100px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: '24px',
              border: '1px solid rgba(6,182,212,0.2)',
            }}>
              <Zap size={14} /> Data Center Cooling & Sustainability
            </div>
            <h1 style={{
              fontSize: '3.5rem',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: '24px',
            }}>
              Cooling Intelligence.<br />
              <span style={{ color: 'var(--accent)' }}>Environmental Impact.</span>
            </h1>
            <p style={{
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              marginBottom: '40px',
              maxWidth: '560px',
            }}>
              We help AI data centers cool their systems efficiently, safely, and sustainably — while converting waste heat from a liability into a community and environmental asset.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link to="/contact" className="btn btn-primary">
                Get a Free Thermal Audit <ArrowRight size={18} />
              </Link>
              <Link to="/calculator" className="btn btn-outline">
                Try the ROI Calculator
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0',
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: '32px 24px',
              textAlign: 'center',
              borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <s.icon size={20} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Sound familiar?</h2>
          <p className="section-subtitle">
            AI workloads are generating unprecedented heat. Most facilities aren't ready.
          </p>
          <div style={{ display: 'grid', gap: '12px', maxWidth: '700px' }}>
            {problems.map((p, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px 20px',
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  minWidth: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--danger)',
                  fontWeight: 700,
                }}>!</div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section" id="services" style={{ background: 'var(--gradient-end)' }}>
        <div className="container">
          <h2 className="section-title">What we do</h2>
          <p className="section-subtitle">
            Four integrated service lines — from cooling design to carbon capture.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            {services.map((s, i) => (
              <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'var(--accent-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <s.icon size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}>{s.tag}</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>{s.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, flex: 1 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market context */}
      <section className="section">
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'center' }}>
          <div>
            <h2 className="section-title">The market is moving fast</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '24px' }}>
              The global data center cooling market will reach <strong style={{ color: 'var(--text)' }}>$25.12 billion by 2031</strong> at 15% CAGR.
              Liquid cooling specifically is projected to grow from $2B to <strong style={{ color: 'var(--text)' }}>$18B+ by 2030</strong> at 27% CAGR.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '32px' }}>
              McKinsey estimates <strong style={{ color: 'var(--text)' }}>$5.2 trillion</strong> in AI data center infrastructure by 2030 —
              25% of that ($1.3 trillion) goes to cooling and power.
            </p>
            <Link to="/contact" className="btn btn-primary">
              Talk to Us <ArrowRight size={18} />
            </Link>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            {[
              { val: '$25.12B', label: 'DC Cooling Market by 2031' },
              { val: '27%', label: 'Liquid Cooling CAGR' },
              { val: '$1.3T', label: 'Cooling & Power Investment by 2030' },
              { val: '70%', label: 'Outages from Power/Cooling Failures' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '28px 20px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '4px' }}>{item.val}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 0',
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
        borderTop: '1px solid var(--border)',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '16px' }}>
            Ready to future-proof your cooling infrastructure?
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
            Get a free 30-minute cooling efficiency review. No obligation. No sales pitch. Just data.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/contact" className="btn btn-primary">
              Schedule a Free Review <ArrowRight size={18} />
            </Link>
            <Link to="/calculator" className="btn btn-outline">
              See Your ROI First
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
