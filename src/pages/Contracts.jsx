import { useState } from 'react';
import { FileText, Download, Plus, Trash2, Check, DollarSign, Clock, Server, Shield } from 'lucide-react';
import jsPDF from 'jspdf';

// Internal pricing model (NOT shown to client)
// Based on market analysis and operational cost recovery
const PRICING = {
  // SaaS Monitoring - per rack/month
  monitoring: {
    label: 'Thermal Intelligence Platform (SaaS)',
    unit: 'rack/month',
    tiers: [
      { name: 'Standard', maxRacks: 50, pricePerRack: 18, features: ['Real-time monitoring', 'PUE/WUE/Carbon reporting', 'Rack thermal mapping', 'CSV data import'] },
      { name: 'Professional', maxRacks: 200, pricePerRack: 15, features: ['Everything in Standard', 'AI thermal intelligence', 'Hotspot prediction', 'Custom alert thresholds', 'API access'] },
      { name: 'Enterprise', maxRacks: 9999, pricePerRack: 10, features: ['Everything in Professional', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'Multi-facility'] },
    ],
  },
  // ESG Consulting - per engagement
  esg: {
    label: 'ESG & Environmental Consulting',
    unit: 'per report',
    options: [
      { name: 'ESG Baseline Assessment', price: 7500, description: 'Current state assessment, gap analysis, regulatory compliance review' },
      { name: 'Full ESG Report + Roadmap', price: 12500, description: 'Comprehensive report with carbon accounting, heat reuse feasibility, and compliance roadmap' },
      { name: 'Annual ESG Program', price: 35000, description: '4 quarterly reports, ongoing compliance monitoring, regulatory updates, board-ready presentations' },
    ],
  },
  // Cooling Assessment - per facility
  cooling: {
    label: 'Cooling Assessment & Design',
    unit: 'per facility',
    options: [
      { name: 'Cooling Efficiency Review', price: 5000, description: 'On-site thermal audit, PUE validation, infrared imaging, recommendations report' },
      { name: 'Full Engineering Design', price: 25000, description: 'Detailed cooling system design, equipment specification, layout drawings, implementation plan' },
      { name: 'Assessment + Design Bundle', price: 27000, description: 'Combined audit and design package with 10% bundle discount' },
    ],
  },
  // Waste Heat Recovery - per facility
  wasteHeat: {
    label: 'Waste Heat Recovery & Monetization',
    unit: 'per facility',
    options: [
      { name: 'Feasibility Study', price: 10000, description: 'Heat output assessment, buyer identification, revenue projections, infrastructure requirements' },
      { name: 'Broker Setup + First Agreement', price: 25000, description: 'Feasibility study plus heat buyer negotiation, contract structuring, and first revenue agreement' },
      { name: 'Revenue Share Model', price: 0, description: 'No upfront cost — ThermaShift takes 15% of ongoing heat revenue as management fee', isRevenueShare: true },
    ],
  },
  // LCaaS Implementation
  lcaas: {
    label: 'Liquid Cooling-as-a-Service',
    unit: 'per project',
    options: [
      { name: 'RDHX Retrofit (per rack)', price: 8000, description: 'Rear-door heat exchanger installation per rack, includes equipment, labor, and commissioning' },
      { name: 'Direct-to-Chip Deployment (per rack)', price: 15000, description: 'D2C liquid cooling per rack, manifold, piping, and commissioning' },
      { name: 'Immersion Cooling (per rack)', price: 25000, description: 'Full immersion cooling tank per rack, fluid, plumbing, and commissioning' },
    ],
  },
  // Sensors
  sensors: {
    label: 'Environmental Sensors',
    unit: 'per sensor',
    options: [
      { name: 'Temperature Sensor (wireless)', price: 45, description: 'WiFi-connected temperature/humidity sensor for inlet/outlet monitoring' },
      { name: 'Power Meter (per rack)', price: 150, description: 'Smart PDU power monitoring per rack with data logging' },
      { name: 'Environmental Sensor Bundle (10-pack)', price: 350, description: '10 wireless temp/humidity sensors with gateway hub' },
    ],
  },
};

function generateContract(data) {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;
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
  doc.text('thermashift.net | info@thermashift.net | Harrisburg, NC', margin, 38);

  y = 55;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...dark);
  doc.text('Service Agreement', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text(`Client: ${data.clientName}`, margin, y);
  y += 5;
  doc.text(`Facility: ${data.facilityLocation}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Contract #: TS-${Date.now().toString().slice(-6)}`, margin, y);
  y += 10;

  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 10;

  // Section 1: Services
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('1. Services & Pricing', margin, y);
  y += 10;

  let totalMonthly = 0;
  let totalOneTime = 0;

  data.services.forEach((svc, idx) => {
    if (y > 250) { doc.addPage(); y = margin; }

    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.setFont(undefined, 'bold');
    doc.text(`${idx + 1}. ${svc.name}`, margin + 4, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    const descSplit = doc.splitTextToSize(svc.description || '', 165);
    doc.text(descSplit, margin + 8, y);
    y += descSplit.length * 4.5 + 2;

    doc.setTextColor(...cyan);
    if (svc.isMonthly) {
      doc.text(`Monthly: $${svc.monthlyTotal.toLocaleString()}/mo (${svc.quantity} ${svc.unitLabel} x $${svc.unitPrice})`, margin + 8, y);
      totalMonthly += svc.monthlyTotal;
    } else if (svc.isRevenueShare) {
      doc.text('Revenue Share: 15% of ongoing heat revenue (no upfront cost)', margin + 8, y);
    } else {
      doc.text(`One-time: $${svc.price.toLocaleString()}`, margin + 8, y);
      totalOneTime += svc.price;
    }
    y += 8;
  });

  y += 6;

  // Totals
  if (y > 240) { doc.addPage(); y = margin; }
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y - 4, 170, 20, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  if (totalOneTime > 0) {
    doc.text(`One-Time Investment: $${totalOneTime.toLocaleString()}`, margin + 8, y + 2);
  }
  if (totalMonthly > 0) {
    doc.text(`Monthly Recurring: $${totalMonthly.toLocaleString()}/month`, margin + 8, y + (totalOneTime > 0 ? 10 : 2));
  }
  doc.setFont(undefined, 'normal');
  y += 26;

  // Section 2: Contract Terms
  if (y > 230) { doc.addPage(); y = margin; }
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('2. Contract Terms', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const terms = [
    `Contract Duration: ${data.contractLength} months`,
    `Start Date: ${data.startDate || 'Upon execution'}`,
    `Payment Terms: Net-15 from invoice date`,
    `Billing Cycle: ${totalMonthly > 0 ? 'Monthly in advance for recurring services' : 'Per milestone as outlined in SOW'}`,
    `Auto-Renewal: Contract auto-renews for successive ${data.contractLength}-month terms unless cancelled with 30 days written notice`,
    `Early Termination: Client may terminate with 60 days notice. Remaining one-time service fees are non-refundable.`,
  ];

  terms.forEach(t => {
    const split = doc.splitTextToSize(t, 165);
    doc.text(split, margin + 4, y);
    y += split.length * 4.5 + 3;
  });
  y += 6;

  // Section 3: Monitoring Metrics
  if (data.monitoringMetrics && data.monitoringMetrics.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }
    doc.setFontSize(14);
    doc.setTextColor(...dark);
    doc.text('3. Monitoring Metrics & SLAs', margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    data.monitoringMetrics.forEach(m => {
      doc.text(`${m.metric}: ${m.target}`, margin + 4, y);
      y += 5.5;
    });
    y += 8;
  }

  // Section 4: Terms & Conditions
  doc.addPage();
  y = margin;
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text(`${data.monitoringMetrics?.length > 0 ? '4' : '3'}. General Terms & Conditions`, margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const conditions = [
    'Confidentiality: All facility data, reports, and deliverables are confidential. ThermaShift will not share client data with third parties without written consent. This obligation survives termination for a period of 3 years.',
    'Data Security: All monitoring data is transmitted over HTTPS encryption. Data is stored in SOC 2 compliant cloud infrastructure. Client retains ownership of all facility data collected.',
    'Intellectual Property: Reports, designs, and recommendations prepared by ThermaShift are licensed to the client for internal use only. ThermaShift retains ownership of all methodologies, tools, software, algorithms, and platforms used to deliver services.',
    'Limitation of Liability: ThermaShift total liability under this agreement shall not exceed the total fees paid by client in the 12 months preceding any claim. In no event shall ThermaShift be liable for indirect, incidental, consequential, special, or punitive damages, including but not limited to lost profits, facility downtime, equipment damage, data loss, or business interruption, regardless of the cause of action.',
    'Indemnification: Client shall indemnify and hold harmless ThermaShift and its subcontractors from any claims, damages, or expenses arising from (a) client misuse of deliverables, (b) client facility conditions, or (c) client failure to follow ThermaShift recommendations communicated in writing.',
    'Resource Substitution: ThermaShift may utilize qualified subcontractors to perform services under this agreement. In the event a key resource becomes unavailable during an engagement, ThermaShift shall have fifteen (15) business days to assign a qualified replacement. Project timelines will be adjusted accordingly with written notice to the client. ThermaShift guarantees replacement resources will meet equivalent qualification standards.',
    'Warranty: ThermaShift warrants that services will be performed in a professional and workmanlike manner consistent with industry standards. Client must notify ThermaShift of any warranty claims within 30 days of deliverable receipt. ThermaShift will re-perform deficient work at no additional cost.',
    'Insurance: ThermaShift maintains professional liability (E&O) insurance with minimum coverage of $1,000,000 per occurrence.',
    'Non-Solicitation: During the contract term and for 12 months thereafter, neither party shall directly solicit or hire employees or subcontractors of the other party who were involved in delivering services under this agreement.',
    'Dispute Resolution: The parties agree to attempt resolution through good-faith negotiation for 30 days, then non-binding mediation administered by the American Arbitration Association in Mecklenburg County, North Carolina, before pursuing litigation. The prevailing party in any legal action shall be entitled to recover reasonable attorney fees.',
    'Force Majeure: Neither party is liable for delays or failure to perform caused by circumstances beyond reasonable control, including but not limited to natural disasters, pandemics, government actions, utility failures, cyberattacks, or supply chain disruptions. Affected party must notify the other within 5 business days.',
    'Governing Law: This agreement is governed by and construed in accordance with the laws of the State of North Carolina, without regard to conflict of law principles. Exclusive jurisdiction and venue shall be in the state or federal courts located in Mecklenburg County, North Carolina.',
    'Entire Agreement: This document constitutes the entire agreement between the parties and supersedes all prior discussions, proposals, and agreements. Modifications require written consent signed by both parties.',
    'Severability: If any provision of this agreement is found invalid or unenforceable, the remaining provisions shall continue in full force and effect.',
    'Assignment: Neither party may assign this agreement without prior written consent of the other party, except ThermaShift may assign to a successor entity in the event of merger, acquisition, or reorganization.',
  ];

  conditions.forEach(c => {
    const split = doc.splitTextToSize(`- ${c}`, 165);
    doc.text(split, margin + 4, y);
    y += split.length * 4.5 + 3;
  });
  y += 10;

  // Signatures
  if (y > 220) { doc.addPage(); y = margin; }
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('Acceptance', margin, y);
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('By signing below, both parties agree to the terms outlined in this Service Agreement.', margin, y);
  y += 12;

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

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text(`ThermaShift Service Agreement — ${data.clientName} — Page ${i} of ${pageCount}`, margin, 287);
  }

  return doc;
}

export default function Contracts() {
  const [form, setForm] = useState({
    clientName: '',
    facilityLocation: '',
    contactName: '',
    contactEmail: '',
    rackCount: '100',
    contractLength: '12',
    startDate: '',
    monitoringMetrics: [
      { metric: 'PUE Target', target: 'Maintain below 1.40' },
      { metric: 'Hotspot Response', target: 'Alert within 5 minutes, remediation within 1 hour' },
      { metric: 'Uptime SLA', target: '99.99% monitoring platform availability' },
      { metric: 'Reporting', target: 'Monthly performance report delivered by 5th of each month' },
    ],
    services: [],
  });
  const [generated, setGenerated] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const addService = (category, option) => {
    const svc = { ...option, category };
    if (category === 'monitoring') {
      const rackCount = parseInt(form.rackCount) || 100;
      const tier = PRICING.monitoring.tiers.find(t => rackCount <= t.maxRacks) || PRICING.monitoring.tiers[2];
      svc.name = `${tier.name} Monitoring (${rackCount} racks)`;
      svc.description = tier.features.join(', ');
      svc.unitPrice = tier.pricePerRack;
      svc.unitLabel = 'racks';
      svc.quantity = rackCount;
      svc.monthlyTotal = rackCount * tier.pricePerRack;
      svc.isMonthly = true;
    }
    set('services', [...form.services, svc]);
  };

  const removeService = (idx) => {
    set('services', form.services.filter((_, i) => i !== idx));
  };

  const addMetric = () => {
    set('monitoringMetrics', [...form.monitoringMetrics, { metric: '', target: '' }]);
  };

  const updateMetric = (idx, field, val) => {
    const updated = [...form.monitoringMetrics];
    updated[idx][field] = val;
    set('monitoringMetrics', updated);
  };

  const removeMetric = (idx) => {
    set('monitoringMetrics', form.monitoringMetrics.filter((_, i) => i !== idx));
  };

  const totalMonthly = form.services.filter(s => s.isMonthly).reduce((sum, s) => sum + s.monthlyTotal, 0);
  const totalOneTime = form.services.filter(s => !s.isMonthly && !s.isRevenueShare).reduce((sum, s) => sum + (s.price || 0), 0);

  const handleGenerate = () => {
    if (!form.clientName.trim()) { alert('Enter client name.'); return; }
    if (form.services.length === 0) { alert('Add at least one service.'); return; }
    const doc = generateContract(form);
    const safeName = form.clientName.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    doc.save(`ThermaShift_Contract_${safeName}.pdf`);
    setGenerated(true);
  };

  return (
    <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
      <section style={{ padding: '60px 0' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <FileText size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Contract Manager</h1>
            <span style={{ padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>INTERNAL</span>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>
            Create client contracts with service selection, monitoring SLAs, and competitive pricing. Generates a professional PDF service agreement.
          </p>

          <div className="card" style={{ padding: '36px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Client Info */}
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-12px' }}>Client Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div><label>Client Name *</label><input value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Flexential" /></div>
                <div><label>Facility Location</label><input value={form.facilityLocation} onChange={e => set('facilityLocation', e.target.value)} placeholder="Charlotte, NC" /></div>
                <div><label>Contact Name</label><input value={form.contactName} onChange={e => set('contactName', e.target.value)} placeholder="Jane Doe" /></div>
                <div><label>Contact Email</label><input value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="jane@flexential.com" /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div><label>Rack Count</label><input type="number" value={form.rackCount} onChange={e => set('rackCount', e.target.value)} /></div>
                <div>
                  <label>Contract Length</label>
                  <select value={form.contractLength} onChange={e => set('contractLength', e.target.value)}>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </select>
                </div>
                <div><label>Start Date</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
              </div>

              {/* Service Selection */}
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-12px' }}>Add Services</h4>

              {Object.entries(PRICING).map(([key, category]) => (
                <div key={key} style={{ padding: '16px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>{category.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                    {(key === 'monitoring' ? [{ name: 'Add Monitoring', price: 0 }] : category.options).map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => addService(key, opt)}
                        style={{
                          padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '6px', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>{opt.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {key === 'monitoring' ? `$10-18/rack/month based on volume` : opt.isRevenueShare ? '15% revenue share' : `$${opt.price.toLocaleString()}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Selected Services */}
              {form.services.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-12px' }}>Selected Services</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.services.map((svc, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{svc.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {svc.isMonthly ? `$${svc.monthlyTotal.toLocaleString()}/month` : svc.isRevenueShare ? '15% revenue share' : `$${(svc.price || 0).toLocaleString()} one-time`}
                          </div>
                        </div>
                        <button onClick={() => removeService(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    ))}

                    {/* Totals */}
                    <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--accent)', marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                        {totalOneTime > 0 && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>One-Time</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>${totalOneTime.toLocaleString()}</div>
                          </div>
                        )}
                        {totalMonthly > 0 && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Monthly Recurring</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>${totalMonthly.toLocaleString()}/mo</div>
                          </div>
                        )}
                        {totalMonthly > 0 && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Annual Contract Value</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning)' }}>${(totalOneTime + totalMonthly * parseInt(form.contractLength || 12)).toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Monitoring SLAs */}
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-12px' }}>Monitoring Metrics & SLAs</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {form.monitoringMetrics.map((m, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', alignItems: 'center' }}>
                    <input value={m.metric} onChange={e => updateMetric(i, 'metric', e.target.value)} placeholder="Metric" style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                    <input value={m.target} onChange={e => updateMetric(i, 'target', e.target.value)} placeholder="Target / SLA" style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                    <button onClick={() => removeMetric(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={addMetric} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem', alignSelf: 'flex-start' }}>
                  <Plus size={14} /> Add Metric
                </button>
              </div>

              {/* Generate */}
              <button onClick={handleGenerate} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                <Download size={18} /> Generate Contract PDF
              </button>

              {generated && (
                <div style={{
                  padding: '16px', borderRadius: '8px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  textAlign: 'center', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem',
                }}>
                  Contract PDF downloaded. Review before sending to client.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
