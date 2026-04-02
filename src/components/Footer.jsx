import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '48px 0 32px',
      background: 'var(--gradient-end)',
    }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              Therma<span style={{ color: 'var(--accent)' }}>Shift</span>
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Cooling Intelligence. Environmental Impact.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Services</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Liquid Cooling-as-a-Service</Link>
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Waste Heat Recovery</Link>
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Thermal Intelligence Platform</Link>
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ESG Consulting</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Tools</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link to="/calculator" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ROI Calculator</Link>
              <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Dashboard Demo</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link to="/contact" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Get a Free Audit</Link>
              <a href="https://linkedin.com/company/thermashift" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>LinkedIn</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            &copy; {new Date().getFullYear()} ThermaShift. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            US-based | Serving data centers worldwide
          </p>
        </div>
      </div>
    </footer>
  );
}
