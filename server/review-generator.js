/**
 * Auto-generates a cooling efficiency review from audit data using Claude API.
 * Called by the /api/audits endpoint when enough data is collected.
 */

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

const REVIEW_PROMPT = (audit) => `You are a senior data center cooling engineer generating a professional cooling efficiency review for a prospect. Generate a thorough, data-driven analysis based on the facility information provided.

## Facility Data
- Location: ${audit.facility_location || 'Not provided'}
- Facility Name: ${audit.facility_name || 'Not provided'}
- Rack Count: ${audit.rack_count || 'Not provided'}
- Average Power Per Rack: ${audit.avg_power_per_rack_kw || 'Not provided'} kW
- Total Facility Power: ${audit.total_power_mw || (audit.rack_count && audit.avg_power_per_rack_kw ? (audit.rack_count * audit.avg_power_per_rack_kw / 1000).toFixed(2) : 'Calculate from rack data')} MW
- Current PUE: ${audit.current_pue || '1.58 (industry average assumed)'}
- Cooling Type: ${audit.cooling_type || 'Not specified'}
- Biggest Challenge: ${audit.biggest_challenge || 'Not specified'}
- Current Annual Cooling Spend: ${audit.current_cooling_spend_annual ? '$' + audit.current_cooling_spend_annual.toLocaleString() : 'Estimate from power data'}
- ESG Tracking: ${audit.tracking_esg ? 'Yes' : 'No'}
- GPU Workloads: ${audit.gpu_workloads ? 'Yes' : 'No'}
- Planned Expansion: ${audit.planned_expansion ? 'Yes — ' + (audit.expansion_details || '') : 'No'}
- Facility Size: ${audit.facility_size_sqft ? audit.facility_size_sqft.toLocaleString() + ' sq ft' : 'Not provided'}
- Timeline: ${audit.timeline || 'Not specified'}

## Your Task
Generate a JSON response with this exact structure:

{
  "estimated_annual_savings": <number — estimated $ savings from cooling optimization>,
  "target_pue": <number — achievable PUE with recommended improvements>,
  "waste_heat_revenue_potential": <number — estimated annual $ from waste heat recovery, 0 if < 1MW>,
  "recommended_services": [<array of 1-3 service names from: "ESG Compliance & Sustainability Consulting", "Cooling Optimization & Liquid Cooling Design", "Waste Heat Recovery & Monetization", "AI-Driven Thermal Intelligence Platform">],
  "review_summary": "<3-5 paragraph executive summary covering: current state assessment, key findings, savings opportunities, waste heat potential, recommended next steps. Be specific with numbers. Reference their actual facility data. Sound authoritative but not salesy.>",
  "detailed_findings": {
    "current_state": "<assessment of current cooling efficiency>",
    "pue_analysis": "<current vs target PUE, what improvement means in $>",
    "cooling_optimization": "<specific recommendations for their cooling type and density>",
    "waste_heat_opportunity": "<waste heat analysis — revenue potential, use cases>",
    "esg_compliance": "<ESG gap analysis based on their tracking status>",
    "capacity_planning": "<future-proofing recommendations based on GPU/expansion plans>",
    "roi_projection": "<12-month ROI breakdown of recommended improvements>"
  }
}

## Calculation Guidelines
- Annual cooling cost estimate: Total MW × PUE overhead × $0.10/kWh × 8,760 hours × cooling fraction (typically 0.35-0.45)
- Savings = current cooling cost × (1 - target_pue/current_pue) roughly
- PUE targets: Air-only can typically reach 1.3-1.4; with liquid cooling 1.1-1.2; immersion 1.03-1.08
- Waste heat revenue: $30-$100 per MWh thermal, depending on reuse application
- If data is missing, use conservative industry averages and note the assumption

Respond ONLY with the JSON object, no markdown fencing.`;

export async function generateReview(audit) {
  if (!API_KEY) throw new Error('No API key configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: REVIEW_PROMPT(audit) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  // Parse the JSON response (handle potential markdown fencing)
  const cleaned = text.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  return JSON.parse(cleaned);
}
