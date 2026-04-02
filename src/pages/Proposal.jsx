import { useState } from 'react';
import { FileText, Download, Building, Calendar, DollarSign, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';

const SERVICE_TIERS = {
  esg: {
    name: 'ESG Consulting Report',
    description: 'Environmental impact assessment, ESG compliance gap analysis, heat reuse feasibility study, and regulatory guidance report.',
    basePrice: 7500,
    timeline: '2-3 weeks',
    milestones: [
      { name: 'Project Kickoff', percent: 50, deliverable: 'Signed SOW, discovery call, data collection' },
      { name: 'Report Delivery', percent: 50, deliverable: 'Branded PDF report + 1-hour walkthrough presentation' },
    ],
  },
  assessment: {
    name: 'Cooling Assessment & Design',
    description: 'On-site thermal audit, PUE validation, infrared imaging, cooling system design, equipment specification, and transition roadmap.',
    basePrice: 25000,
    timeline: '4-6 weeks',
    milestones: [
      { name: 'Project Kickoff', percent: 40, deliverable: 'Signed SOW, project plan, site access coordination' },
      { name: 'Site Assessment Complete', percent: 20, deliverable: 'On-site audit report, thermal imaging, PUE measurements' },
      { name: 'Engineering Design Delivery', percent: 25, deliverable: 'Cooling system design, equipment specs, layout drawings' },
      { name: 'Final Presentation', percent: 15, deliverable: 'Client presentation, recommendations, Q&A session' },
    ],
  },
  lcaas: {
    name: 'Liquid Cooling-as-a-Service (Full Implementation)',
    description: 'End-to-end cooling transition: engineering design, equipment procurement, installation, commissioning, and ongoing monitoring setup.',
    basePrice: 200000,
    timeline: '12-20 weeks',
    milestones: [
      { name: 'Contract Signed', percent: 20, deliverable: 'SOW execution, project plan, engineering kickoff' },
      { name: 'Design Approved', percent: 15, deliverable: 'Final engineering design, client sign-off' },
      { name: 'Equipment Ordered', percent: 30, deliverable: 'Purchase orders placed, delivery schedule confirmed' },
      { name: 'Installation 50%', percent: 15, deliverable: 'Piping, connections, infrastructure at midpoint' },
      { name: 'Commissioning', percent: 15, deliverable: 'System tested, PUE validated, performance benchmarks met' },
      { name: 'Handoff & Close', percent: 5, deliverable: 'Documentation, monitoring setup, 30-day retention release' },
    ],
  },
};

function generateProposal(data) {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;
  const tier = SERVICE_TIERS[data.serviceTier];
  const totalPrice = data.customPrice || tier.basePrice;

  const cyan = [6, 182, 212];
  const dark = [15, 23, 42];
  const gray = [148, 163, 184];

  // Header
  doc.setFillColor(...dark);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('ThermaShift', margin, 22);
  doc.setFontSize(10);
  doc.setTextColor(...cyan);
  doc.text('Cooling Intelligence. Environmental Impact.', margin, 30);
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('thermashift.net | info@thermashift.net', margin, 38);

  y = 55;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...dark);
  doc.text('Statement of Work & Proposal', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text(`Prepared for: ${data.clientName} | ${data.facilityLocation}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Proposal Valid For: 30 Days`, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 10;

  // Section 1: Service Overview
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('1. Service Overview', margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.text(tier.name, margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const descSplit = doc.splitTextToSize(tier.description, 170);
  doc.text(descSplit, margin, y);
  y += descSplit.length * 5 + 8;

  // Section 2: Client Facility Details
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('2. Client Facility Details', margin, y);
  y += 8;
  doc.setFontSize(9);

  const details = [
    ['Client', data.clientName],
    ['Facility Location', data.facilityLocation],
    ['Rack Count', data.rackCount],
    ['Avg Power per Rack', `${data.avgPowerPerRack} kW`],
    ['Current PUE', data.currentPUE],
    ['Current Cooling Type', data.currentCoolingType],
    ['Primary Contact', data.contactName],
    ['Contact Email', data.contactEmail],
  ].filter(([, val]) => val);

  details.forEach(([label, value]) => {
    doc.setTextColor(...gray);
    doc.text(label, margin + 4, y);
    doc.setTextColor(...dark);
    doc.text(String(value), 100, y);
    y += 5.5;
  });
  y += 8;

  // Section 3: Scope of Work
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('3. Scope of Work', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  if (data.scopeItems) {
    const items = data.scopeItems.split('\n').filter(s => s.trim());
    items.forEach((item, i) => {
      const split = doc.splitTextToSize(`${i + 1}. ${item.trim()}`, 165);
      doc.text(split, margin + 4, y);
      y += split.length * 5 + 3;
    });
  } else {
    const defaultScope = doc.splitTextToSize('Scope to be defined during project kickoff based on facility assessment findings.', 170);
    doc.text(defaultScope, margin + 4, y);
    y += defaultScope.length * 5 + 3;
  }
  y += 6;

  // Section 4: Timeline
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('4. Timeline', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Estimated Duration: ${data.customTimeline || tier.timeline}`, margin + 4, y);
  y += 5;
  doc.text(`Proposed Start Date: ${data.startDate || 'Upon SOW execution and deposit receipt'}`, margin + 4, y);
  y += 12;

  // New page for financials
  doc.addPage();
  y = margin;

  // Section 5: Investment & Payment Schedule
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('5. Investment & Payment Schedule', margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(...cyan);
  doc.text(`Total Investment: $${totalPrice.toLocaleString()}`, margin + 4, y);
  y += 10;

  doc.setFontSize(9);
  // Milestone table header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y - 4, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('Milestone', margin + 4, y);
  doc.text('Payment', 100, y);
  doc.text('Amount', 130, y);
  doc.text('Deliverable', 155, y);
  y += 8;

  doc.setFont(undefined, 'normal');
  tier.milestones.forEach((m, i) => {
    const amount = Math.round(totalPrice * m.percent / 100);
    const bgColor = i % 2 === 0 ? [22, 33, 50] : [15, 23, 42];
    doc.setFillColor(...bgColor);
    doc.rect(margin, y - 4, 170, 7, 'F');

    doc.setTextColor(...gray);
    doc.text(m.name, margin + 4, y);
    doc.text(`${m.percent}%`, 100, y);
    doc.setTextColor(255, 255, 255);
    doc.text(`$${amount.toLocaleString()}`, 130, y);

    const delivSplit = doc.splitTextToSize(m.deliverable, 45);
    doc.setTextColor(...gray);
    doc.text(delivSplit[0], 155, y);
    y += 7;
    if (delivSplit.length > 1) {
      doc.text(delivSplit.slice(1).join(' '), 155, y);
      y += 5;
    }
  });
  y += 10;

  // Section 6: Terms & Conditions
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('6. Terms & Conditions', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const terms = [
    'Payment Terms: Invoices are due Net-15 from date of invoice. Work will not proceed to the next milestone until the current milestone payment is received.',
    'Change Orders: Any changes to the scope of work will be documented in a formal Change Order and may result in adjusted timeline and pricing.',
    'Confidentiality: All facility data, reports, and deliverables are confidential and will not be shared with third parties without written consent.',
    'Cancellation: Either party may cancel with 14 days written notice. Client is responsible for payment of all completed milestones and work-in-progress.',
    'Warranty: ThermaShift warrants that all work will be performed in a professional manner consistent with industry standards.',
    `This proposal is valid for 30 days from ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
  ];

  terms.forEach(term => {
    const split = doc.splitTextToSize(`• ${term}`, 165);
    doc.text(split, margin + 4, y);
    y += split.length * 5 + 3;
  });
  y += 10;

  // Signature block
  if (y > 240) { doc.addPage(); y = margin; }

  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('7. Acceptance', margin, y);
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('By signing below, both parties agree to the terms outlined in this Statement of Work.', margin, y);
  y += 12;

  // Client signature
  doc.setTextColor(...dark);
  doc.setFont(undefined, 'bold');
  doc.text('Client:', margin, y);
  doc.setFont(undefined, 'normal');
  y += 8;
  doc.setDrawColor(...gray);
  doc.line(margin, y, 90, y);
  doc.setTextColor(...gray);
  doc.text('Signature', margin, y + 4);
  doc.line(100, y, 190, y);
  doc.text('Date', 100, y + 4);
  y += 12;
  doc.line(margin, y, 90, y);
  doc.text('Printed Name & Title', margin, y + 4);
  y += 16;

  // ThermaShift signature
  doc.setTextColor(...dark);
  doc.setFont(undefined, 'bold');
  doc.text('ThermaShift:', margin, y);
  doc.setFont(undefined, 'normal');
  y += 8;
  doc.line(margin, y, 90, y);
  doc.setTextColor(...gray);
  doc.text('Signature', margin, y + 4);
  doc.line(100, y, 190, y);
  doc.text('Date', 100, y + 4);
  y += 12;
  doc.line(margin, y, 90, y);
  doc.text('Steve Betancur, Founder', margin, y + 4);

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text(`ThermaShift Proposal — ${data.clientName} — Page ${i} of ${pageCount}`, margin, 287);
  }

  return doc;
}

export default function Proposal() {
  const [form, setForm] = useState({
    clientName: '',
    facilityLocation: '',
    contactName: '',
    contactEmail: '',
    rackCount: '',
    avgPowerPerRack: '',
    currentPUE: '',
    currentCoolingType: '',
    serviceTier: 'esg',
    customPrice: '',
    customTimeline: '',
    startDate: '',
    scopeItems: '',
  });
  const [generated, setGenerated] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const tier = SERVICE_TIERS[form.serviceTier];
  const totalPrice = parseInt(form.customPrice) || tier.basePrice;

  const handleGenerate = () => {
    if (!form.clientName.trim()) {
      alert('Please enter the client name.');
      return;
    }
    const doc = generateProposal({ ...form, customPrice: totalPrice });
    const safeName = form.clientName.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_') || 'Client';
    doc.save(`ThermaShift_Proposal_${safeName}.pdf`);
    setGenerated(true);
  };

  return (
    <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
      <section style={{ padding: '60px 0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <ClipboardList size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Proposal & SOW Generator</h1>
            <span style={{
              padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
              background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)',
            }}>INTERNAL</span>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>
            Generate a branded Statement of Work with milestone-based payment schedule. PDF includes scope, timeline, pricing, terms, and signature blocks.
          </p>

          <div className="card" style={{ padding: '36px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-8px' }}>Service Selection</h4>

              <div>
                <label>Service Tier</label>
                <select value={form.serviceTier} onChange={(e) => set('serviceTier', e.target.value)}>
                  <option value="esg">ESG Consulting Report ($7,500)</option>
                  <option value="assessment">Cooling Assessment & Design ($25,000)</option>
                  <option value="lcaas">Full LCaaS Implementation ($200,000)</option>
                </select>
              </div>

              <div style={{ padding: '16px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>{tier.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{tier.description}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Default timeline: {tier.timeline} | {tier.milestones.length} milestones | Base price: ${tier.basePrice.toLocaleString()}
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Client Details</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label><Building size={14} style={{ display: 'inline', marginRight: '6px' }} />Client / Company Name *</label>
                  <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Flexential" />
                </div>
                <div>
                  <label>Facility Location</label>
                  <input value={form.facilityLocation} onChange={(e) => set('facilityLocation', e.target.value)} placeholder="Charlotte, NC" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Contact Name</label>
                  <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Jane Doe, VP of Engineering" />
                </div>
                <div>
                  <label>Contact Email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="jane@flexential.com" />
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Facility Details</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Rack Count</label>
                  <input type="number" value={form.rackCount} onChange={(e) => set('rackCount', e.target.value)} placeholder="100" />
                </div>
                <div>
                  <label>Avg Power/Rack (kW)</label>
                  <input type="number" value={form.avgPowerPerRack} onChange={(e) => set('avgPowerPerRack', e.target.value)} placeholder="20" />
                </div>
                <div>
                  <label>Current PUE</label>
                  <input type="number" step="0.01" value={form.currentPUE} onChange={(e) => set('currentPUE', e.target.value)} placeholder="1.58" />
                </div>
                <div>
                  <label>Current Cooling</label>
                  <select value={form.currentCoolingType} onChange={(e) => set('currentCoolingType', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="Air Cooling (CRAC/CRAH)">Air Cooling (CRAC/CRAH)</option>
                    <option value="Air + Containment">Air + Containment</option>
                    <option value="Rear-Door Heat Exchangers">Rear-Door HX</option>
                    <option value="Direct-to-Chip">Direct-to-Chip</option>
                    <option value="Immersion">Immersion</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Pricing & Timeline</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label><DollarSign size={14} style={{ display: 'inline', marginRight: '6px' }} />Custom Price (leave blank for default)</label>
                  <input type="number" value={form.customPrice} onChange={(e) => set('customPrice', e.target.value)} placeholder={tier.basePrice.toLocaleString()} />
                </div>
                <div>
                  <label><Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />Custom Timeline</label>
                  <input value={form.customTimeline} onChange={(e) => set('customTimeline', e.target.value)} placeholder={tier.timeline} />
                </div>
              </div>

              <div>
                <label>Proposed Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>

              {/* Milestone preview */}
              <div style={{ padding: '16px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Payment Milestones Preview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tier.milestones.map((m, i) => {
                    const amount = Math.round(totalPrice * m.percent / 100);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
                          <span>{m.percent}%</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${amount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.9rem', fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '12px' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--accent)' }}>${totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '-8px' }}>Scope of Work</h4>

              <div>
                <label>Scope Items (one per line)</label>
                <textarea
                  rows={6}
                  value={form.scopeItems}
                  onChange={(e) => set('scopeItems', e.target.value)}
                  placeholder={`On-site thermal audit with infrared imaging\nPUE measurement and validation\nCooling system design and equipment specification\nWaste heat recovery feasibility assessment\nProject timeline and implementation roadmap`}
                />
              </div>

              <button onClick={handleGenerate} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                <Download size={18} /> Generate & Download Proposal PDF
              </button>

              {generated && (
                <div style={{
                  padding: '16px', borderRadius: '8px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  textAlign: 'center', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem',
                }}>
                  Proposal downloaded! Review it before sending to the client.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '32px', padding: '24px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Proposal PDF includes:</h3>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 2, paddingLeft: '20px' }}>
              <li>Service overview tailored to selected tier</li>
              <li>Client facility details and contact info</li>
              <li>Custom scope of work items</li>
              <li>Milestone-based payment schedule with amounts</li>
              <li>Standard terms & conditions (Net-15, change orders, confidentiality, cancellation)</li>
              <li>Signature blocks for both parties</li>
              <li>Page numbers and professional formatting</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
