import { useState } from 'react';
import { FileText, Download, Building, Thermometer, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';

function generateReport(data) {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Colors
  const cyan = [6, 182, 212];
  const dark = [15, 23, 42];
  const gray = [148, 163, 184];

  // Header bar
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
  doc.text('Cooling Roadmap Report', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text(`Prepared for: ${data.clientName} | ${data.facilityLocation}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 12;

  // Divider
  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 10;

  // Section: Executive Summary
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('1. Executive Summary', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const execSummary = `This report presents a comprehensive cooling optimization roadmap for ${data.clientName}'s ${data.facilityLocation} facility. Based on our assessment of ${data.rackCount} racks operating at an average of ${data.avgPowerPerRack}kW per rack with a current PUE of ${data.currentPUE}, we have identified significant opportunities for energy savings, operational efficiency improvements, and waste heat monetization.`;
  const splitExec = doc.splitTextToSize(execSummary, 170);
  doc.text(splitExec, margin, y);
  y += splitExec.length * 5 + 8;

  // Section: Current State
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('2. Current Facility Assessment', margin, y);
  y += 8;

  const totalIT = data.rackCount * data.avgPowerPerRack;
  const totalFacility = totalIT * data.currentPUE;
  const coolingPower = totalFacility - totalIT;
  const annualEnergy = totalFacility * 8760;
  const annualCost = annualEnergy * data.electricityRate;
  const coolingCost = coolingPower * 8760 * data.electricityRate;

  const metrics = [
    ['Total IT Power', `${totalIT.toLocaleString()} kW`],
    ['Total Facility Power', `${totalFacility.toLocaleString()} kW`],
    ['Cooling Overhead', `${coolingPower.toLocaleString()} kW`],
    ['Current PUE', data.currentPUE.toString()],
    ['Annual Energy Consumption', `${(annualEnergy / 1000000).toFixed(1)} GWh`],
    ['Annual Energy Cost', `$${(annualCost / 1000000).toFixed(2)}M`],
    ['Annual Cooling Cost', `$${(coolingCost / 1000000).toFixed(2)}M`],
    ['Rack Count', data.rackCount.toString()],
    ['Avg Power per Rack', `${data.avgPowerPerRack} kW`],
  ];

  doc.setFontSize(9);
  metrics.forEach(([label, value]) => {
    doc.setTextColor(...gray);
    doc.text(label, margin + 4, y);
    doc.setTextColor(...dark);
    doc.text(value, 120, y);
    y += 5.5;
  });
  y += 8;

  // Section: Recommendations
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('3. Cooling Transition Recommendations', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const recs = [];
  if (data.avgPowerPerRack <= 25) {
    recs.push('Phase 1: Deploy Rear-Door Heat Exchangers (RDHx) on highest-density racks to reduce ambient cooling load by 30-50%. Estimated PUE improvement: 0.10-0.15.');
  }
  if (data.avgPowerPerRack > 15) {
    recs.push('Phase 2: Implement Direct-to-Chip (D2C) liquid cooling for GPU/AI workload racks exceeding 30kW. Industry standard for 50-150kW rack densities. Target PUE: 1.15.');
  }
  if (data.avgPowerPerRack > 50) {
    recs.push('Phase 3: Evaluate full immersion cooling for highest-density deployments (100kW+). Proven to deliver 39% TCO reduction with PUE as low as 1.03-1.06.');
  }
  recs.push('Ongoing: Implement real-time thermal monitoring (ThermaShift Thermal Intelligence Platform) for continuous PUE optimization and hotspot prevention.');

  recs.forEach((rec, i) => {
    const split = doc.splitTextToSize(`${rec}`, 165);
    doc.text(split, margin + 4, y);
    y += split.length * 5 + 4;
  });
  y += 6;

  // New page for financials
  doc.addPage();
  y = margin;

  // Section: Financial Impact
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('4. Financial Impact Analysis', margin, y);
  y += 10;

  const targetPUE = data.avgPowerPerRack > 50 ? 1.08 : data.avgPowerPerRack > 25 ? 1.15 : 1.25;
  const newTotalPower = totalIT * targetPUE;
  const newAnnualCost = newTotalPower * 8760 * data.electricityRate;
  const annualSavings = annualCost - newAnnualCost;
  const wasteHeatRevenue = totalIT * 0.95 * 0.6 * 8760 * 0.03;
  const totalAnnualValue = annualSavings + wasteHeatRevenue;

  const financials = [
    ['Target PUE', targetPUE.toString()],
    ['Projected Annual Energy Cost', `$${(newAnnualCost / 1000000).toFixed(2)}M`],
    ['Annual Energy Savings', `$${(annualSavings / 1000000).toFixed(2)}M`],
    ['Annual Waste Heat Revenue Potential', `$${(wasteHeatRevenue / 1000).toFixed(0)}K`],
    ['Total Annual Value Creation', `$${(totalAnnualValue / 1000000).toFixed(2)}M`],
    ['5-Year Cumulative Value', `$${(totalAnnualValue * 5 / 1000000).toFixed(1)}M`],
    ['Carbon Reduction (annual)', `${((annualEnergy - newTotalPower * 8760) * 0.42 / 1000000).toFixed(0)} thousand tonnes CO₂`],
  ];

  doc.setFontSize(9);
  financials.forEach(([label, value]) => {
    doc.setTextColor(...gray);
    doc.text(label, margin + 4, y);
    doc.setTextColor(...dark);
    doc.text(value, 120, y);
    y += 6;
  });
  y += 10;

  // Section: Waste Heat Recovery
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('5. Waste Heat Recovery Opportunities', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const heatText = [
    `Your facility produces approximately ${(totalIT * 0.95).toFixed(0)} kW of waste heat continuously. At outlet temperatures of 32-43°C, this heat is directly usable for:`,
    '',
    '• Greenhouse / Vertical Farm Heating — A 2,000m² greenhouse can operate entirely on data center waste heat. Local agricultural partners near your facility could benefit.',
    '',
    '• District Heating — Municipal utilities across the US and Europe are actively exploring waste heat purchasing agreements. ThermaShift can broker these deals.',
    '',
    '• Algae Bioreactor Carbon Capture — A 100m³ algae pond captures ~14,000 kg CO₂/year, producing biofuel or supplements as a secondary revenue stream.',
    '',
    `Estimated recoverable heat: ${(totalIT * 0.95 * 0.6).toFixed(0)} kW (60% recovery rate)`,
    `Estimated annual revenue: $${(wasteHeatRevenue / 1000).toFixed(0)}K from heat sales alone.`,
  ];

  heatText.forEach(line => {
    const split = doc.splitTextToSize(line, 170);
    doc.text(split, margin + 4, y);
    y += split.length * 5 + 1;
  });
  y += 10;

  // Section: Next Steps
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('6. Recommended Next Steps', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const steps = [
    '1. On-site thermal audit with infrared imaging to baseline current hotspots and cooling efficiency',
    '2. PUE measurement and validation across peak and off-peak periods',
    '3. Detailed engineering design for recommended cooling transition phases',
    '4. Waste heat buyer identification and preliminary revenue agreements',
    '5. Implementation timeline and budget with ThermaShift Cooling-as-a-Service pricing',
    '6. Ongoing monitoring via ThermaShift Thermal Intelligence Platform',
  ];

  steps.forEach(step => {
    const split = doc.splitTextToSize(step, 165);
    doc.text(split, margin + 4, y);
    y += split.length * 5 + 3;
  });
  y += 12;

  // Footer
  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('This report was prepared by ThermaShift. For questions, contact info@thermashift.net.', margin, y);
  y += 4;
  doc.text('© 2026 ThermaShift. All rights reserved. Confidential.', margin, y);

  return doc;
}

export default function Report() {
  const [form, setForm] = useState({
    clientName: '',
    facilityLocation: '',
    rackCount: '50',
    avgPowerPerRack: '30',
    currentPUE: '1.5',
    electricityRate: '0.08',
  });
  const [generated, setGenerated] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleGenerate = () => {
    if (!form.clientName.trim() || !form.facilityLocation.trim()) {
      alert('Please enter both Client Name and Facility Location.');
      return;
    }
    const reportData = {
      ...form,
      rackCount: Math.max(1, parseInt(form.rackCount) || 50),
      avgPowerPerRack: Math.max(1, parseFloat(form.avgPowerPerRack) || 30),
      currentPUE: Math.max(1.0, parseFloat(form.currentPUE) || 1.5),
      electricityRate: Math.max(0.01, parseFloat(form.electricityRate) || 0.08),
    };
    const doc = generateReport(reportData);
    const safeName = form.clientName.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_') || 'Report';
    const filename = `ThermaShift_Cooling_Roadmap_${safeName}.pdf`;
    doc.save(filename);
    setGenerated(true);
  };

  return (
    <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
      <section style={{ padding: '60px 0' }}>
        <div className="container" style={{ maxWidth: '700px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <FileText size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Cooling Roadmap Report Generator</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>
            Generate a professional PDF report for your client engagements. Enter the facility details below and download a branded ThermaShift Cooling Roadmap Report.
          </p>

          <div className="card" style={{ padding: '36px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label><Building size={14} style={{ display: 'inline', marginRight: '6px' }} />Client Name</label>
                  <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Flexential" />
                </div>
                <div>
                  <label>Facility Location</label>
                  <input value={form.facilityLocation} onChange={(e) => set('facilityLocation', e.target.value)} placeholder="Charlotte, NC" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label><Thermometer size={14} style={{ display: 'inline', marginRight: '6px' }} />Number of Racks</label>
                  <input type="number" value={form.rackCount} onChange={(e) => set('rackCount', e.target.value)} />
                </div>
                <div>
                  <label>Avg Power per Rack (kW)</label>
                  <input type="number" value={form.avgPowerPerRack} onChange={(e) => set('avgPowerPerRack', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label><DollarSign size={14} style={{ display: 'inline', marginRight: '6px' }} />Current PUE</label>
                  <input type="number" step="0.01" value={form.currentPUE} onChange={(e) => set('currentPUE', e.target.value)} />
                </div>
                <div>
                  <label>Electricity Rate ($/kWh)</label>
                  <input type="number" step="0.01" value={form.electricityRate} onChange={(e) => set('electricityRate', e.target.value)} />
                </div>
              </div>

              <button onClick={handleGenerate} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                <Download size={18} /> Generate & Download PDF Report
              </button>

              {generated && (
                <div style={{
                  padding: '16px', borderRadius: '8px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  textAlign: 'center', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem',
                }}>
                  Report downloaded! Check your Downloads folder.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '32px', padding: '24px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Report includes:</h3>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 2, paddingLeft: '20px' }}>
              <li>Executive summary tailored to the client's facility</li>
              <li>Current state assessment with PUE, energy, and cost analysis</li>
              <li>Cooling transition recommendations (RDHx → D2C → Immersion)</li>
              <li>Financial impact analysis with 5-year projections</li>
              <li>Waste heat recovery opportunities and revenue estimates</li>
              <li>Recommended next steps for engagement</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
