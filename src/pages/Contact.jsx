import { useState } from 'react';
import { Send, CheckCircle, Mail, MapPin, Link as LinkedinIcon } from 'lucide-react';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', company: '', role: '', rackCount: '', message: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production, this would send to a backend or email service
    console.log('Form submitted:', form);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main style={{ paddingTop: '72px' }}>
        <section style={{ padding: '120px 0', textAlign: 'center' }}>
          <div className="container">
            <CheckCircle size={64} style={{ color: 'var(--success)', marginBottom: '24px' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>Thank you!</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto' }}>
              We'll review your information and reach out within 24 hours to schedule your free cooling efficiency review.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={{ paddingTop: '72px' }}>
      <section style={{ padding: '60px 0 80px' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }}>
          <div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '16px' }}>
              Get a Free Cooling<br />Efficiency Review
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '40px' }}>
              30 minutes. No obligation. We'll assess your facility's cooling efficiency and identify opportunities for savings, sustainability improvements, and waste heat monetization.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'var(--accent-glow)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Mail size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Email</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>info@thermashift.com</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'var(--accent-glow)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Location</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Harrisburg, NC — Serving Charlotte, Research Triangle, and Northern Virginia</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'var(--accent-glow)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <LinkedinIcon size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>LinkedIn</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Follow ThermaShift for industry insights</div>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '40px', padding: '24px', background: 'var(--surface)',
              borderRadius: '12px', border: '1px solid var(--border)',
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>What you'll get:</h4>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 2, paddingLeft: '20px' }}>
                <li>Assessment of your current cooling efficiency (PUE baseline)</li>
                <li>Liquid cooling transition options for your rack density</li>
                <li>Waste heat monetization potential estimate</li>
                <li>ESG and regulatory compliance gap analysis</li>
                <li>Recommended next steps — no obligation</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="card" style={{ padding: '36px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '24px' }}>Request your free review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label>Full Name *</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Steve Betancur" />
              </div>
              <div>
                <label>Work Email *</label>
                <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" />
              </div>
              <div>
                <label>Company *</label>
                <input required value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Flexential" />
              </div>
              <div>
                <label>Your Role</label>
                <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="facilities">Director of Facilities</option>
                  <option value="engineering">VP of Engineering</option>
                  <option value="operations">Director of DC Operations</option>
                  <option value="sustainability">Chief Sustainability Officer</option>
                  <option value="cto">CTO</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label>Approximate Rack Count</label>
                <input type="number" value={form.rackCount} onChange={(e) => set('rackCount', e.target.value)} placeholder="50" />
              </div>
              <div>
                <label>Anything specific you'd like us to assess?</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="We're looking to support 80kW racks in our Charlotte facility..."
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Send size={18} /> Request Free Review
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                No spam. No sales pressure. Just a conversation about your cooling infrastructure.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
