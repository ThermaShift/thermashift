import { useState } from 'react';
import { Send, CheckCircle, Mail, MapPin, Link as LinkedinIcon } from 'lucide-react';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', company: '', role: '', phone: '',
    rackCount: '', avgPowerPerRack: '', currentPUE: '',
    coolingType: '', facilityLocation: '',
    biggestChallenge: '', timeline: '', trackingESG: '',
    message: '',
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
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'start' }}>
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

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-8px' }}>About You</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Full Name *</label>
                  <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label>Work Email *</label>
                  <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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
                    <option value="cto">CTO / CIO</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(704) 555-0100" />
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Your Facility</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Facility Location</label>
                  <input value={form.facilityLocation} onChange={(e) => set('facilityLocation', e.target.value)} placeholder="Charlotte, NC" />
                </div>
                <div>
                  <label>Approximate Rack Count</label>
                  <input type="number" value={form.rackCount} onChange={(e) => set('rackCount', e.target.value)} placeholder="200" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Avg Power per Rack (kW)</label>
                  <input type="number" value={form.avgPowerPerRack} onChange={(e) => set('avgPowerPerRack', e.target.value)} placeholder="15" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px', display: 'block' }}>
                    Air-cooled: 5-25kW | GPU: 40-140kW
                  </span>
                </div>
                <div>
                  <label>Current PUE (if known)</label>
                  <input type="number" step="0.01" value={form.currentPUE} onChange={(e) => set('currentPUE', e.target.value)} placeholder="1.5" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px', display: 'block' }}>
                    Industry avg: 1.58 | Best-in-class: 1.1
                  </span>
                </div>
              </div>

              <div>
                <label>Current Cooling Type</label>
                <select value={form.coolingType} onChange={(e) => set('coolingType', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="air-only">Air Cooling Only (CRAC/CRAH)</option>
                  <option value="air-containment">Air + Hot/Cold Aisle Containment</option>
                  <option value="rdhx">Rear-Door Heat Exchangers</option>
                  <option value="d2c">Direct-to-Chip Liquid Cooling</option>
                  <option value="immersion">Immersion Cooling</option>
                  <option value="hybrid">Hybrid (mix of above)</option>
                  <option value="unsure">Not sure</option>
                </select>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Your Priorities</h4>

              <div>
                <label>Biggest Cooling Challenge</label>
                <select value={form.biggestChallenge} onChange={(e) => set('biggestChallenge', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="density">Can't support higher rack densities (AI/GPU workloads)</option>
                  <option value="cost">Cooling energy costs too high</option>
                  <option value="pue">PUE is above target</option>
                  <option value="capacity">Running out of cooling capacity</option>
                  <option value="esg">ESG/sustainability reporting requirements</option>
                  <option value="heat">Interested in waste heat monetization</option>
                  <option value="reliability">Cooling reliability / hotspot concerns</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Timeline for Changes</label>
                  <select value={form.timeline} onChange={(e) => set('timeline', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="immediate">Immediate (0-3 months)</option>
                    <option value="near">Near-term (3-12 months)</option>
                    <option value="planning">Planning phase (12+ months)</option>
                    <option value="exploring">Just exploring options</option>
                  </select>
                </div>
                <div>
                  <label>Tracking ESG Metrics?</label>
                  <select value={form.trackingESG} onChange={(e) => set('trackingESG', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="yes-reporting">Yes, actively reporting</option>
                    <option value="yes-internal">Yes, internal tracking only</option>
                    <option value="starting">Just getting started</option>
                    <option value="no">Not yet</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Anything else we should know?</label>
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
