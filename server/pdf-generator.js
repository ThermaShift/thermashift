/**
 * Generates branded PDF review reports for ThermaShift.
 * Uses jsPDF (already in dependencies).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let jsPDF;
try {
  const mod = require('jspdf');
  jsPDF = mod.jsPDF || mod.default?.jsPDF || mod;
} catch {
  console.log('[PDF] jsPDF not available server-side, PDF generation disabled');
}

export function generateReviewPDF(audit, lead) {
  if (!jsPDF) throw new Error('jsPDF not available');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ─── Header ───────────────────────────────────────────────
  doc.setFillColor(10, 22, 40); // #0a1628
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ThermaShift', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Cooling Intelligence. Environmental Impact.', margin, 28);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Cooling Efficiency Review', margin, 40);

  y = 55;

  // ─── Client Info ──────────────────────────────────────────
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Prepared for: ${lead?.name || audit.name || 'Valued Prospect'}`, margin, y);
  doc.text(`Company: ${lead?.company || audit.company || 'N/A'}`, margin, y + 5);
  doc.text(`Facility: ${audit.facility_location || 'N/A'}`, margin, y + 10);
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin - 60, y);

  y += 22;

  // ─── Key Metrics Box ──────────────────────────────────────
  doc.setDrawColor(0, 163, 224); // accent blue
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'S');

  const metricWidth = contentWidth / 3;
  const metrics = [
    { label: 'Est. Annual Savings', value: `$${(audit.estimated_annual_savings || 0).toLocaleString()}` },
    { label: 'Target PUE', value: String(audit.target_pue || 'N/A') },
    { label: 'Waste Heat Revenue', value: audit.waste_heat_revenue_potential > 0 ? `$${(audit.waste_heat_revenue_potential || 0).toLocaleString()}/yr` : 'N/A' },
  ];

  metrics.forEach((m, i) => {
    const x = margin + metricWidth * i + metricWidth / 2;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(m.label, x, y + 10, { align: 'center' });
    doc.setTextColor(0, 163, 224);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(m.value, x, y + 22, { align: 'center' });
  });

  y += 40;

  // ─── Facility Data ────────────────────────────────────────
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Facility Overview', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const facilityData = [
    ['Rack Count', String(audit.rack_count || 'N/A')],
    ['Avg Power/Rack', `${audit.avg_power_per_rack_kw || 'N/A'} kW`],
    ['Total Power', `${audit.total_power_mw || 'N/A'} MW`],
    ['Current PUE', String(audit.current_pue || 'N/A')],
    ['Cooling Type', audit.cooling_type || 'N/A'],
    ['GPU Workloads', audit.gpu_workloads ? 'Yes' : 'No'],
  ];

  facilityData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(value, margin + 45, y);
    y += 6;
  });

  y += 6;

  // ─── Executive Summary ────────────────────────────────────
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const summary = audit.review_summary || 'Review summary not available.';
  const lines = doc.splitTextToSize(summary, contentWidth);
  lines.forEach(line => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 5;
  });

  y += 8;

  // ─── Recommended Services ────────────────────────────────
  if (audit.recommended_services?.length) {
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setTextColor(10, 22, 40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommended Services', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    audit.recommended_services.forEach(service => {
      doc.text(`  •  ${service}`, margin, y);
      y += 6;
    });

    y += 4;
  }

  // ─── Detailed Findings ───────────────────────────────────
  const findings = typeof audit.review_full_report === 'string'
    ? JSON.parse(audit.review_full_report)
    : audit.review_full_report;

  if (findings && typeof findings === 'object') {
    const sections = [
      ['Current State Assessment', findings.current_state],
      ['PUE Analysis', findings.pue_analysis],
      ['Cooling Optimization', findings.cooling_optimization],
      ['Waste Heat Opportunity', findings.waste_heat_opportunity],
      ['ESG Compliance', findings.esg_compliance],
      ['Capacity Planning', findings.capacity_planning],
      ['ROI Projection', findings.roi_projection],
    ];

    sections.forEach(([title, content]) => {
      if (!content) return;
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setTextColor(10, 22, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const sectionLines = doc.splitTextToSize(content, contentWidth);
      sectionLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 5;
      });
      y += 6;
    });
  }

  // ─── Footer ───────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('ThermaShift — thermashift.net — Cooling Intelligence. Environmental Impact.', pageWidth / 2, 290, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, 290, { align: 'right' });
  }

  return doc.output('arraybuffer');
}
