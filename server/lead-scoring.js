/**
 * Lead scoring algorithm for ThermaShift.
 * Scores leads 0-100 based on facility size, data completeness, timeline urgency, and engagement.
 */

export function calculateLeadScore(lead, audit) {
  let score = 0;
  const breakdown = {};

  // ─── Contact completeness (max 15 points) ─────────────────
  let contactScore = 0;
  if (lead?.name) contactScore += 3;
  if (lead?.email) contactScore += 5;
  if (lead?.company) contactScore += 3;
  if (lead?.phone) contactScore += 4;
  breakdown.contact = contactScore;
  score += contactScore;

  // ─── Facility size / revenue potential (max 30 points) ────
  let facilityScore = 0;
  const racks = audit?.rack_count || 0;
  const powerPerRack = audit?.avg_power_per_rack_kw || 0;
  const totalMW = audit?.total_power_mw || (racks * powerPerRack / 1000);

  if (racks >= 500) facilityScore += 15;
  else if (racks >= 200) facilityScore += 12;
  else if (racks >= 100) facilityScore += 8;
  else if (racks >= 50) facilityScore += 5;
  else if (racks > 0) facilityScore += 2;

  if (totalMW >= 10) facilityScore += 15;
  else if (totalMW >= 5) facilityScore += 12;
  else if (totalMW >= 1) facilityScore += 8;
  else if (totalMW > 0) facilityScore += 4;

  breakdown.facility = facilityScore;
  score += facilityScore;

  // ─── PUE inefficiency = bigger opportunity (max 15 points) ─
  let pueScore = 0;
  const pue = audit?.current_pue || 0;
  if (pue >= 2.0) pueScore = 15;
  else if (pue >= 1.8) pueScore = 12;
  else if (pue >= 1.5) pueScore = 10;
  else if (pue >= 1.3) pueScore = 6;
  else if (pue > 0) pueScore = 3;
  breakdown.pue_opportunity = pueScore;
  score += pueScore;

  // ─── Timeline urgency (max 15 points) ─────────────────────
  let timelineScore = 0;
  const timeline = (audit?.timeline || '').toLowerCase();
  if (timeline.includes('immediate') || timeline.includes('asap') || timeline.includes('urgent')) timelineScore = 15;
  else if (timeline.includes('1-3 month') || timeline.includes('next month') || timeline.includes('near')) timelineScore = 12;
  else if (timeline.includes('3-6 month') || timeline.includes('6 month') || timeline.includes('next quarter')) timelineScore = 10;
  else if (timeline.includes('6-12') || timeline.includes('this year') || timeline.includes('year')) timelineScore = 6;
  else if (timeline.includes('12-18') || timeline.includes('next year') || timeline.includes('planning')) timelineScore = 3;
  breakdown.timeline = timelineScore;
  score += timelineScore;

  // ─── High-value signals (max 15 points) ───────────────────
  let signalScore = 0;
  if (audit?.gpu_workloads) signalScore += 5;       // GPU = high density = big project
  if (audit?.planned_expansion) signalScore += 3;    // Growing = more opportunity
  if (audit?.tracking_esg) signalScore += 3;         // ESG-aware = multiple services
  if (totalMW >= 1) signalScore += 4;                // Waste heat viable
  breakdown.signals = Math.min(signalScore, 15);
  score += Math.min(signalScore, 15);

  // ─── Data completeness bonus (max 10 points) ──────────────
  let dataScore = 0;
  const fields = [
    audit?.facility_location, audit?.rack_count, audit?.avg_power_per_rack_kw,
    audit?.current_pue, audit?.cooling_type, audit?.biggest_challenge,
    audit?.timeline, audit?.facility_size_sqft, audit?.current_cooling_spend_annual
  ];
  const filled = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  dataScore = Math.round((filled / fields.length) * 10);
  breakdown.data_completeness = dataScore;
  score += dataScore;

  // ─── Classify ─────────────────────────────────────────────
  let tier;
  if (score >= 75) tier = 'hot';
  else if (score >= 50) tier = 'warm';
  else if (score >= 25) tier = 'cool';
  else tier = 'cold';

  return {
    score: Math.min(score, 100),
    tier,
    breakdown
  };
}
