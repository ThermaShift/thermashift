/**
 * Demo scenario library — each scenario is a complete, self-contained
 * pre-baked demo client that the seed-all-demos.js script materializes
 * in Supabase. Steve picks the right scenario based on the prospect
 * conversation; every tab in /saas tells that scenario's story.
 */

export const SCENARIOS = [
  // ════════════════════════════════════════════════════════════════════
  // 1. GPU / AI HOTSPOT — Mid-market colo with high-density workload
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_gpu_hotspot',
    label: 'GPU / AI Hotspot',
    icon: '🔥',
    blurb: 'Mid-market colo with localized hot-aisle hotspot from new GPU/AI workload. Liquid Cooling Design & Install upsell ($40-60K).',
    bestFor: 'Charlotte/regional colos, AI/GPU buyers, Flexential/DataBank-style prospects',
    apiKey: 'tsk_demo_9f42e3c62de1be877830fa37dab0f3f2',

    company: 'ThermaShift Demo Co',
    contactName: 'Demo Operator',
    contactEmail: 'demo@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Charlotte Tier-III Colo', city: 'Charlotte', state: 'NC', facility_type: 'colocation', square_footage: 32000, rack_count: 120 },
      { name: 'Research Triangle Edge', city: 'Cary', state: 'NC', facility_type: 'edge', square_footage: 8500, rack_count: 24 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Hot Aisle 3 — Rack 12', type: 'temperature', unit: '°F', baseline: 78, variance: 4, location: 'Cold Aisle A', zone: 'A-3' },
      { siteIndex: 0, name: 'Hot Aisle 3 — Rack 18', type: 'temperature', unit: '°F', baseline: 82, variance: 6, willTrigger: true, location: 'Cold Aisle A', zone: 'A-3' },
      { siteIndex: 0, name: 'Hot Aisle 5 — Rack 04', type: 'temperature', unit: '°F', baseline: 76, variance: 3, location: 'Cold Aisle B', zone: 'B-5' },
      { siteIndex: 0, name: 'CRAC 2 Supply', type: 'temperature', unit: '°F', baseline: 62, variance: 2, location: 'Mech room', zone: 'CRAC' },
      { siteIndex: 0, name: 'CRAC 2 Return', type: 'temperature', unit: '°F', baseline: 78, variance: 3, location: 'Mech room', zone: 'CRAC' },
      { siteIndex: 0, name: 'Cold Aisle A Humidity', type: 'humidity', unit: '%', baseline: 45, variance: 5, location: 'Cold Aisle A', zone: 'A-3' },
      { siteIndex: 0, name: 'PDU 2A Power', type: 'power', unit: 'kW', baseline: 18.4, variance: 1.5, location: 'PDU room', zone: 'PDU' },
      { siteIndex: 1, name: 'Edge Rack Temp', type: 'temperature', unit: '°F', baseline: 74, variance: 2, location: 'Server closet', zone: 'edge' },
      { siteIndex: 1, name: 'Edge Humidity', type: 'humidity', unit: '%', baseline: 48, variance: 3, location: 'Server closet', zone: 'edge' },
    ],

    rule: {
      siteIndex: 0, sensorName: 'Hot Aisle 3 — Rack 18',
      name: 'Hot aisle critical (>85°F)',
      rule_type: 'above', threshold_value: 85, threshold_window_minutes: 10,
      severity: 'critical', debounce_count: 2,
    },

    openIncident: {
      siteIndex: 0, sensorName: 'Hot Aisle 3 — Rack 18',
      severity: 'critical', minutesAgo: 22,
      trigger_value: 87.4, trigger_threshold: 85, peak_value: 88.9,
      summary: 'Hot aisle critical (>85°F): saw 87.4°F sustained',
    },

    coolingActions: {
      pending: [
        {
          action_type: 'set_crac_fan_speed',
          target_label: 'CRAC 2 (Charlotte Tier-III)',
          parameters: { target_label: 'CRAC 2', speed_percent: 95 },
          reasoning: 'Hot Aisle 3 Rack 18 sustained 87-89°F over the last 30 min while CRAC 2 is currently at 78%. Increasing to 95% should drop hot-aisle temps 4-6°F. Estimated +$18/day energy. Risk if no action: GPU thermal throttling within 60 min.',
        },
        {
          action_type: 'set_chilled_water_setpoint',
          target_label: 'Plant chilled water supply',
          parameters: { target_label: 'CW Supply', setpoint_f: 44 },
          reasoning: 'Lowering CW setpoint from 46°F to 44°F adds ~12% cooling capacity at peak. ROI: ~$200/day in avoided emergency mechanical cooling vs ~$60/day extra chiller energy. Net: $140/day.',
        },
      ],
      historicalManual: { action_type: 'set_pump_vfd_speed', target_label: 'Primary CHW pump #1', params: { speed_percent: 78 }, reasoning: 'Match thermal load. Estimated +9% chilled water flow.' },
      historicalAuto: { action_type: 'enable_economizer', target_label: 'Outside-air dampers', params: { target_label: 'CRAH zone B' }, reasoning: 'Outside air 52°F. Free cooling viable. Auto-approved.' },
      autoRule: { action_type: 'enable_economizer' },
    },

    advisorResponse: {
      headline: 'Hot Aisle 3 Rack 18 is recurring critical (88°F now, 14× in 30 days) — your air cooling has aged out of this zone.',
      analysis: 'Rack 18 has triggered 14 critical hot-aisle alerts in 30 days while neighboring Rack 12 (same row) runs steady at 78°F. The pattern points to localized power density (3 GPU servers on Rack 18 vs 1 on Rack 12), not facility-wide cooling capacity. CRAC 2 is operating normally with a healthy 16°F delta-T but cannot deliver enough airflow at this density. Without intervention you have ~60 minutes before GPU thermal throttling kicks in and ~$12,400/month of cumulative downtime risk if the pattern continues.',
      recommendations: [
        { action: "Increase CRAC 2 fan speed from 78% to 95% — buys you 4-6°F drop in 5 minutes. Open the Cooling AI tab and approve the proposed action.", urgency: 'today', expected_impact: 'Stops thermal throttling within 5 min · ~$18/day extra fan energy' },
        { action: 'Inspect Rack 18 for blocked vents, failed perforated tile alignment, or improperly seated server bezels — physical airflow obstruction causes ~40% of recurring hotspots.', urgency: 'today', expected_impact: 'If found: 5-8°F drop, no equipment cost' },
        { action: 'Confirm economizer auto-approval rule stays enabled — saved $612 last month.', urgency: 'this week', expected_impact: 'Confirms autonomous savings stay enabled' },
      ],
      upsell: { service: 'LCaaS', why: 'Rack 18 has outgrown air cooling at 30kW+ density. A rear-door heat exchanger retrofit eliminates this hotspot permanently and reduces CRAC 2 load by ~15%. ROI 14-21 months on incident risk alone.', estimated_value: '$40,000–$60,000', cta: 'Schedule a free 30-min consultation' },
      demo_funnel: {
        explore: 'Open the Cooling AI tab to see two AI-proposed actions waiting for your approval — including the CRAC fan speed increase referenced above.',
        ask_questions: 'Open Chat with AI to read a sample multi-turn conversation about this exact Rack 18 pattern.',
        get_quote: 'Open Recommendations to see the Liquid Cooling Design & Install upsell ($40-60K one-time project) ready for one-click escalation to Steve.',
      },
    },

    chat: {
      title: 'Rack 18 hotspot pattern analysis',
      messages: [
        { role: 'user', content: 'Why does Hot Aisle 3 Rack 18 keep spiking? It happens 2-3 times a week.' },
        { role: 'assistant', content: "Looking at 30 days of data on Rack 18, the pattern is clear: spikes correlate strongly with afternoon GPU workload bursts (2-5pm EST), and CRAC 2 fan speed lags behind by 8-12 minutes. Three things going on:\n\n1. **CRAC 2 control loop is too slow.** It only reacts when temps are already 84°F+. By the time it ramps, you're already at 87°F.\n\n2. **Hot aisle return path is partially blocked.** Comparing Rack 12 (77°F avg) vs Rack 18 (82°F avg) suggests airflow constraint, not cooling capacity.\n\n3. **Workload stacking.** Rack 18 has 3 GPU servers vs Rack 12's 1. This is a power density problem, not a cooling problem.\n\nRecommend: I can propose a fan speed pre-action when GPU utilization predicts a spike. Want me to set that up?" },
        { role: 'user', content: "Yes. Also — what's the long-term fix?" },
        { role: 'assistant', content: "Setting up predictive fan ramp now. For long-term:\n\nThe physical fix is liquid cooling on Rack 18 specifically — it's a high-density GPU rack that's outgrown air cooling. ThermaShift's Liquid Cooling Design & Install service does a rear-door heat exchanger retrofit on that rack alone — $40-60K one-time project, equipment owned by you from day one — eliminates the hotspot permanently and reduces CRAC 2 load by ~15%.\n\nROI: at $200/incident downtime risk × 14 incidents/30 days = $2,800/month exposure. Project pays back in 14-21 months even before energy savings.\n\nWant me to flag that as a Recommendation in your dashboard? Steve will reach out to scope it." },
        { role: 'user', content: 'Yes, flag it.' },
        { role: 'assistant', content: "Done. You'll see it under Recommendations. Steve gets a notification at admin@thermashift.net and will reach out within 24 hours to scope a quote." },
      ],
    },

    escalations: [
      { service: 'LCaaS', value_low: 40000, value_high: 60000,
        pitch: "Rack 18 has triggered 14 critical hot-aisle alerts in the last 30 days — recurring pattern suggests power density has outgrown air cooling. ThermaShift's Liquid Cooling Design & Install service deploys a rear-door heat exchanger ($40-60K one-time project, equipment owned by you) that eliminates this hotspot permanently and reduces CRAC 2 load by ~15%. ROI: 14-21 months on incident risk alone.",
        trigger_pattern: 'rule_1: 14 critical incidents in 30 days on Hot Aisle 3 Rack 18' },
      { service: 'Waste Heat Recovery', value_low: 200000, value_high: 500000,
        pitch: "Your Charlotte facility runs CRAC return temps at 78°F average — that's 3.4M BTU/hr of recoverable heat being vented. ThermaShift's Waste Heat Recovery service could capture this and route it to a district heating partner or commercial greenhouse, generating $200-500K/year in incremental revenue.",
        trigger_pattern: 'sustained CRAC return temps >75°F across both sites for 60+ days' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 2. HYPERSCALE WASTE HEAT — sustained heat output = revenue opportunity
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_hyperscale_waste_heat',
    label: 'Hyperscale Waste Heat',
    icon: '♨️',
    blurb: 'Hyperscale operator with sustained high return temps. Waste heat monetization opportunity ($300K-$1M/yr).',
    bestFor: 'Hyperscale (Apple/Meta/Google scale), sustainability-driven CFOs',
    apiKey: 'tsk_demo_polaris_8e2c1d5f4b9a3e6d7c0f8a',

    company: 'Polaris Cloud Networks',
    contactName: 'Director of Sustainability',
    contactEmail: 'demo+polaris@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Polaris Maiden NC Campus', city: 'Maiden', state: 'NC', facility_type: 'hyperscale', square_footage: 350000, rack_count: 1800 },
      { name: 'Polaris Lenoir NC Annex', city: 'Lenoir', state: 'NC', facility_type: 'hyperscale', square_footage: 220000, rack_count: 1100 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Hall A CRAH Return', type: 'temperature', unit: '°F', baseline: 78, variance: 2 },
      { siteIndex: 0, name: 'Hall B CRAH Return', type: 'temperature', unit: '°F', baseline: 80, variance: 2 },
      { siteIndex: 0, name: 'Hall C CRAH Return', type: 'temperature', unit: '°F', baseline: 79, variance: 2 },
      { siteIndex: 0, name: 'Chiller Plant CW Supply', type: 'temperature', unit: '°F', baseline: 45, variance: 1 },
      { siteIndex: 0, name: 'Chiller Plant CW Return', type: 'temperature', unit: '°F', baseline: 60, variance: 2 },
      { siteIndex: 0, name: 'Total IT Power', type: 'power', unit: 'MW', baseline: 24.6, variance: 1.5 },
      { siteIndex: 0, name: 'Outside Air Temp', type: 'temperature', unit: '°F', baseline: 55, variance: 8 },
      { siteIndex: 1, name: 'Hall A CRAH Return', type: 'temperature', unit: '°F', baseline: 76, variance: 2 },
      { siteIndex: 1, name: 'Total IT Power', type: 'power', unit: 'MW', baseline: 14.8, variance: 1.0 },
    ],

    rule: { siteIndex: 0, sensorName: 'Hall B CRAH Return', name: 'CRAH return >82°F sustained', rule_type: 'above', threshold_value: 82, threshold_window_minutes: 30, severity: 'warning', debounce_count: 4 },
    openIncident: null, // hyperscale story is about sustained patterns, not active alarms

    coolingActions: {
      pending: [
        { action_type: 'enable_economizer', target_label: 'Maiden Campus all halls', parameters: { target_label: 'Free cooling all zones' },
          reasoning: 'Outside air dropped to 51°F. Switching to economizer mode saves an estimated $4,800/day vs mechanical cooling at current load.' },
      ],
      historicalManual: { action_type: 'set_chilled_water_setpoint', target_label: 'Plant CW Supply', params: { setpoint_f: 47 }, reasoning: 'Raised CW setpoint 1°F to match lower outside air conditions. Estimated $1,200/day savings.' },
      historicalAuto: { action_type: 'enable_economizer', target_label: 'Lenoir Annex', params: { target_label: 'Lenoir Annex' }, reasoning: 'Outside air <55°F. Auto-approved per economizer rule.' },
      autoRule: { action_type: 'enable_economizer' },
    },

    advisorResponse: {
      headline: 'Your facilities vent ~6.8M BTU/hr of usable heat year-round. That\'s $400K-$900K/year of unrealized revenue.',
      analysis: 'Both campuses run sustained CRAH return temps of 76-80°F across all halls — well within healthy operating range, but representing ~6.8M BTU/hr (2 MW thermal) of consistent heat output that\'s currently vented to atmosphere. With heat pumps to upgrade reject temperature from 80°F to a usable 140-160°F, this becomes commercially marketable to district heating networks, commercial greenhouses, or algae bioreactors. Nordic data centers selling at $15-25/MWh thermal generate $300-700K/year per MW of recoverable heat. Your scale could realize the upper end of this range.',
      recommendations: [
        { action: 'Schedule a feasibility study to identify district heating candidates within 5 miles of Maiden — North Carolina has emerging municipal interest.', urgency: 'this month', expected_impact: '$300-700K/yr recurring revenue at scale' },
        { action: 'Document current CRAH return temp baseline for ESG reporting — improving heat utilization metrics is reportable for SEC climate disclosure rules.', urgency: 'this week', expected_impact: 'ESG narrative leverage with stakeholders' },
        { action: 'Confirm economizer auto-approval is enabled on both campuses — saved $112,000 last quarter combined.', urgency: 'today', expected_impact: 'Continues autonomous savings' },
      ],
      upsell: { service: 'Waste Heat Recovery', why: 'At your scale, waste heat monetization can fund itself in 2-3 years and generate $300K-$1M/year recurring revenue indefinitely. ThermaShift handles feasibility, partner negotiation, and capture infrastructure design.', estimated_value: '$300,000–$1,000,000/year', cta: 'Schedule a feasibility assessment' },
      demo_funnel: {
        explore: 'Open the Cooling AI tab — economizer auto-approval has saved this client $112K last quarter.',
        ask_questions: 'Open Chat with AI for a sample conversation about waste heat economics and feasibility.',
        get_quote: 'Open Recommendations for the Waste Heat Recovery escalation ($300K-$1M/year) — one click sends to Steve.',
      },
    },

    chat: {
      title: 'Waste heat monetization feasibility',
      messages: [
        { role: 'user', content: 'How realistic is waste heat monetization at our scale? Has anyone in NC actually done this?' },
        { role: 'assistant', content: "Realistic at your scale, no widespread NC precedent yet — which is partly why the opportunity is undervalued. Quick framing:\n\n**Nordic precedent (proven):** Stockholm Data Parks (Bahnhof, Interxion, Equinix) sells reject heat to Stockholm Exergi at $15-25/MWh thermal. Microsoft's Espoo Finland facility heats 250,000 homes via waste heat sale. These are commercial, not pilot.\n\n**US analogues (emerging):** QTS Atlanta has a partnership with Georgia Power for greenhouse heating. Compass Datacenters has pilot at Lenoir Falls.\n\n**Your specific opportunity:** Maiden + Lenoir combined = ~2 MW thermal continuous. Two paths:\n\n1. **Direct municipal sale** — Maiden's town district heating doesn't exist yet, but Hickory and Charlotte have existing networks within 30 miles. ROI dependent on transmission cost.\n2. **Co-located commercial use** — partner with a greenhouse operator (Lipman Family Farms operates large greenhouse complex in NC) or aquaculture (saltwater shrimp farms are emerging in the Carolinas).\n\nWant me to flag this for Steve to scope a feasibility study?" },
        { role: 'user', content: "Yes. Also what about the carbon accounting angle?" },
        { role: 'assistant', content: "Strong angle. SEC climate disclosure rules (effective 2026) require Scope 1+2 emissions reporting, with Scope 3 phasing in. **Heat sold to a third party offsets their fossil-fuel heating** — that translates to credible Scope 3 reduction claims that pass auditor scrutiny.\n\nFor your stakeholder narrative:\n• 2 MW × 8,760 hr/yr = 17.5 GWh thermal/yr\n• If displacing natural gas heating (95% of NC commercial heat): ~3,200 tonnes CO₂e avoided/year\n• At voluntary carbon market $25-50/tonne: $80-160K/yr in carbon offset value alone\n\nThis is on top of the direct revenue from heat sale. ESG reporting frameworks (CDP, GRI, TCFD) all credit this. I'll flag both opportunities for Steve. Anything else?" },
      ],
    },

    escalations: [
      { service: 'Waste Heat Recovery', value_low: 300000, value_high: 1000000,
        pitch: "Both Polaris campuses output ~6.8M BTU/hr of usable heat year-round, currently vented. With heat pump upgrades, this becomes marketable to district heating, greenhouse operators, or aquaculture partners. ThermaShift handles feasibility, partner negotiation, and capture infrastructure design. Conservative range: $300K-$1M/year recurring revenue.",
        trigger_pattern: 'sustained CRAH return temps >75°F across both campuses 90+ days' },
      { service: 'ESG Consulting', value_low: 25000, value_high: 75000,
        pitch: "Section 179D tax deduction expires June 30 ($1.88/sq ft for cooling efficiency upgrades). Your 350K sq ft Maiden + 220K sq ft Lenoir combined = potential $1.07M federal deduction if any HVAC efficiency improvements were placed in service since 2023. Most operators leave this on the table.",
        trigger_pattern: 'Section 179D documentation gap' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 3. MULTI-SITE COLOCATION — Performance variance, consistency play
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_multi_site_colo',
    label: 'Multi-site Colocation',
    icon: '🌐',
    blurb: 'Regional colo provider with 4 sites showing performance variance. Consistency + Pro tier upsell.',
    bestFor: 'Regional colos, MSPs, multi-site operators',
    apiKey: 'tsk_demo_crescent_3a7f2c9b1e4d8a6c5f0b9e',

    company: 'Crescent DataWorks',
    contactName: 'VP of Operations',
    contactEmail: 'demo+crescent@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Charlotte Primary', city: 'Charlotte', state: 'NC', facility_type: 'colocation', square_footage: 28000, rack_count: 110 },
      { name: 'Atlanta South', city: 'Atlanta', state: 'GA', facility_type: 'colocation', square_footage: 22000, rack_count: 80 },
      { name: 'Memphis Hub', city: 'Memphis', state: 'TN', facility_type: 'colocation', square_footage: 18000, rack_count: 65 },
      { name: 'Nashville Edge', city: 'Nashville', state: 'TN', facility_type: 'edge', square_footage: 9500, rack_count: 30 },
    ],

    sensors: [
      { siteIndex: 0, name: 'CRAC Avg Return', type: 'temperature', unit: '°F', baseline: 76, variance: 2 },
      { siteIndex: 0, name: 'PUE', type: 'power', unit: 'ratio', baseline: 1.42, variance: 0.04 },
      { siteIndex: 1, name: 'CRAC Avg Return', type: 'temperature', unit: '°F', baseline: 81, variance: 3, willTrigger: true },
      { siteIndex: 1, name: 'PUE', type: 'power', unit: 'ratio', baseline: 1.61, variance: 0.05 },
      { siteIndex: 2, name: 'CRAC Avg Return', type: 'temperature', unit: '°F', baseline: 75, variance: 2 },
      { siteIndex: 2, name: 'PUE', type: 'power', unit: 'ratio', baseline: 1.38, variance: 0.03 },
      { siteIndex: 3, name: 'Edge Rack Temp', type: 'temperature', unit: '°F', baseline: 73, variance: 2 },
      { siteIndex: 3, name: 'PUE', type: 'power', unit: 'ratio', baseline: 1.45, variance: 0.04 },
    ],

    rule: { siteIndex: 1, sensorName: 'CRAC Avg Return', name: 'Atlanta — CRAC return >83°F', rule_type: 'above', threshold_value: 83, threshold_window_minutes: 20, severity: 'warning', debounce_count: 3 },
    openIncident: { siteIndex: 1, sensorName: 'CRAC Avg Return', severity: 'warning', minutesAgo: 45, trigger_value: 84.2, trigger_threshold: 83, peak_value: 85.1, summary: 'Atlanta CRAC return temp drift' },

    coolingActions: {
      pending: [
        { action_type: 'set_crac_fan_speed', target_label: 'Atlanta Hall 2 CRACs', parameters: { target_label: 'Atlanta CRACs', speed_percent: 90 },
          reasoning: 'Atlanta South PUE has drifted to 1.61 vs Charlotte and Memphis at 1.38-1.42. Investigation suggests CRAC fan speeds were manually reduced 6 months ago and never reset. Restoring to 90% should pull PUE back under 1.50 and recover ~$8,400/month in efficiency loss.' },
      ],
      historicalManual: { action_type: 'set_pump_vfd_speed', target_label: 'Charlotte CHW pump', params: { speed_percent: 72 }, reasoning: 'Reduced pump VFD from 85% to 72% to match cooler outside air. $410/month savings.' },
      historicalAuto: { action_type: 'enable_economizer', target_label: 'Memphis Hub', params: { target_label: 'Memphis economizer' }, reasoning: 'Outside air <58°F. Auto-approved.' },
      autoRule: { action_type: 'enable_economizer' },
    },

    advisorResponse: {
      headline: 'Atlanta South is the outlier — PUE 1.61 vs your 1.40 average. That\'s ~$100K/year of efficiency loss in one site.',
      analysis: "Comparing your 4 sites side-by-side: Charlotte (1.42), Atlanta (1.61), Memphis (1.38), Nashville (1.45). Atlanta's PUE drift correlates with CRAC return temps consistently 4-6°F higher than peer sites. Three likely root causes: CRAC fan speeds manually reduced 6 months ago and never reset, hot/cold aisle containment degradation, or upstream chiller plant inefficiency. **At Atlanta's load (~620 kW IT), the gap from 1.42 to 1.61 = $9,300/month or $111K/year in pure waste.** Cross-site visibility is what surfaced this — operators running each site in isolation rarely catch this kind of drift.",
      recommendations: [
        { action: 'Approve the proposed Atlanta CRAC fan reset (already drafted in Cooling AI tab) — first-step recovery, $0 cost, 5-min implementation.', urgency: 'today', expected_impact: '~$8,400/month recovery if root cause is fan setting' },
        { action: 'Send a tech to physically inspect Atlanta hot/cold aisle containment + CRAC airflow next site visit.', urgency: 'this week', expected_impact: 'Likely 0.05-0.10 PUE improvement = $5-10K/month' },
        { action: 'Create a multi-site PUE benchmark dashboard so future drift is visible within 7 days, not 6 months.', urgency: 'this month', expected_impact: 'Prevents recurrence' },
      ],
      upsell: { service: 'Platform Expansion', why: 'You\'re running on Guard tier across 4 sites. Pro tier ($599/mo) adds AI auto-action so corrections like the Atlanta CRAC reset happen automatically when patterns are detected, not when a human eventually notices the bill.', estimated_value: '$300/mo additional, ROI <1 month at this drift rate', cta: 'Upgrade to Pro' },
      demo_funnel: {
        explore: 'Open Cooling AI to approve the Atlanta CRAC fan reset — $8,400/month recovery starts today.',
        ask_questions: 'Open Chat with AI for a sample multi-site comparison conversation.',
        get_quote: 'Open Recommendations for the optimization audit upsell.',
      },
    },

    chat: {
      title: 'Atlanta PUE drift root cause',
      messages: [
        { role: 'user', content: "Atlanta's PUE has been creeping up for 6 months. We can't figure out why. Charlotte and Memphis are fine. What gives?" },
        { role: 'assistant', content: "Looking at your sensor data across all 4 sites, the Atlanta drift is real and the pattern points to one of three root causes — in order of probability based on what I can see:\n\n**1. Manual CRAC fan adjustment never reset (most likely)** — Atlanta CRAC fan speeds dropped from ~88% to ~72% in November 2025 based on power draw signature. No corresponding maintenance ticket. Common after a noise complaint or temporary load reduction. **Fix: bump fans back to 88-92%, takes 5 min, immediate PUE improvement.**\n\n**2. Hot/cold aisle containment failure** — possibly torn curtains, missing blanking panels, or a propped-open door. Would manifest as CRAC return temps lagging behind cold aisle temps (which is what we're seeing). **Fix: physical site inspection.**\n\n**3. Chiller plant inefficiency (least likely)** — if it were a chiller issue, supply temp would also drift. Your CW supply is rock-steady at 45°F. Rules this out.\n\nWant me to draft an action proposal for #1 right now? It's effectively risk-free at this point." },
        { role: 'user', content: "Yes draft it. And what's the dollar value if all three are fixed?" },
        { role: 'assistant', content: "Drafted. You'll see it under Cooling AI tab.\n\n**Atlanta-specific dollar math** (assumes Atlanta runs 620 kW IT load 8,760 hr/yr at $0.085/kWh):\n• Current PUE 1.61 → cost $463K/year cooling+overhead\n• Target PUE 1.45 (matches your fleet average) → cost $416K/year\n• **Savings: $47K/year** at minimum, $111K/year if Atlanta hits Memphis-tier 1.38\n\n**Multi-site pattern lesson:** the reason Atlanta drifted unnoticed for 6 months is single-site teams optimize locally. Pro tier auto-action would have flagged this within 7 days of drift starting. That's $40K-$70K of cumulative loss avoided.\n\nUpgrading to Pro tier adds $300/mo across your 4 sites (you're on Guard now). Want me to flag the Pro upgrade for Steve?" },
      ],
    },

    escalations: [
      { service: 'Platform Expansion', value_low: 3600, value_high: 7200,
        pitch: "Crescent is on Guard tier ($299/mo) but PUE drift at Atlanta went undetected 6 months. Pro tier ($599/mo) adds AI auto-action that would have caught and self-corrected this within 7 days — saving the $40-70K in cumulative efficiency loss. Annual upgrade cost ($3,600) pays for itself with the first prevented drift.",
        trigger_pattern: 'multi-site PUE variance >0.15 between sites' },
      { service: 'Cooling Optimization', value_low: 25000, value_high: 75000,
        pitch: "Atlanta South facility shows multiple efficiency degradation signals beyond the CRAC fan issue — likely 0.10-0.15 PUE improvement available with a full optimization audit. At $9-13K/month savings post-audit, project pays back in 6-9 months even at the high end of scope.",
        trigger_pattern: 'Atlanta site PUE 0.20+ above peer average' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 4. PFAS / NOVEC MIGRATION — 3M exited, urgent replacement
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_pfas_migration',
    label: 'PFAS / Novec Migration',
    icon: '🧪',
    blurb: 'Edge facility using 3M Novec for immersion cooling. 3M exited end of 2025 — urgent transition needed.',
    bestFor: 'Immersion cooling users, regulated industries, sustainability-driven',
    apiKey: 'tsk_demo_atlas_5d9c4f1b8a2e7c6d3f0b9a',

    company: 'Atlas Edge Solutions',
    contactName: 'Director of Infrastructure',
    contactEmail: 'demo+atlas@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Atlas Pittsburgh Edge', city: 'Pittsburgh', state: 'PA', facility_type: 'edge', square_footage: 6500, rack_count: 18 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Immersion Tank A — Fluid Temp', type: 'temperature', unit: '°F', baseline: 122, variance: 3 },
      { siteIndex: 0, name: 'Immersion Tank B — Fluid Temp', type: 'temperature', unit: '°F', baseline: 118, variance: 3 },
      { siteIndex: 0, name: 'Tank A — GPU Cluster Power', type: 'power', unit: 'kW', baseline: 42.0, variance: 4 },
      { siteIndex: 0, name: 'Tank B — GPU Cluster Power', type: 'power', unit: 'kW', baseline: 38.0, variance: 4 },
      { siteIndex: 0, name: 'Heat Exchanger Out', type: 'temperature', unit: '°F', baseline: 95, variance: 2 },
      { siteIndex: 0, name: 'Ambient Humidity', type: 'humidity', unit: '%', baseline: 42, variance: 5 },
    ],

    rule: { siteIndex: 0, sensorName: 'Immersion Tank A — Fluid Temp', name: 'Tank A fluid temp >130°F', rule_type: 'above', threshold_value: 130, threshold_window_minutes: 5, severity: 'critical', debounce_count: 2 },
    openIncident: null,

    coolingActions: {
      pending: [
        { action_type: 'set_pump_vfd_speed', target_label: 'Tank A circulation pump', parameters: { target_label: 'Tank A pump', speed_percent: 88 },
          reasoning: 'Tank A fluid temp drifting up over the last week (118 → 122°F average). Increasing circulation 8% maintains target temps. Note: this also increases evaporative loss — relevant given your Novec inventory situation.' },
      ],
      historicalManual: { action_type: 'set_pump_vfd_speed', target_label: 'Tank B circulation pump', params: { speed_percent: 80 }, reasoning: 'Match higher GPU load on Tank B.' },
      historicalAuto: null,
      autoRule: null,
    },

    advisorResponse: {
      headline: '3M ceased Novec manufacturing end of 2025. You have a regulatory + supply-chain emergency forming.',
      analysis: "Your Pittsburgh facility runs two-phase Novec immersion on Tank A and Tank B. **3M exited PFAS manufacturing entirely end of 2025** — last-buy was March 2025. Distributors will run dry by mid-2026. **Pennsylvania PFAS reporting begins 2026**, full ban patterns matching Maine (2030) and Minnesota (2025) suggest a 3-5 year usability window for any remaining inventory. Beyond regulatory: your fluid evaporation rate at current pump speeds means natural top-up needs ~120 gal/year per tank. With Novec selling at $400/gal in panic-buy spot market and replacement supply uncertain, you're looking at $48K/year in fluid alone if you don't transition. **The good news: Chemours Opteon 2P50, Castrol ON DC20, and Engineered Fluids ElectroCool are all viable replacements at lower price points — but compatibility testing takes 60-90 days.** This is a now-priority project, not a 2027 project.",
      recommendations: [
        { action: 'Inventory remaining Novec stock and document fluid SKU + lot numbers — required for any audit and helps Chemours/Shell/Castrol scope a like-for-like replacement.', urgency: 'today', expected_impact: 'Foundation for transition plan' },
        { action: 'Schedule sample compatibility testing with Chemours Opteon 2P50 (closest Novec replacement) — small-tank trial in next 60 days.', urgency: 'this month', expected_impact: 'De-risks production transition' },
        { action: 'Engage ThermaShift PFAS Migration Audit ($25-50K) — produces auditor-ready transition plan covering fluid replacement, hardware compatibility, regulatory documentation, and timeline.', urgency: 'this month', expected_impact: '$48K/yr Novec cost avoided · regulatory exposure eliminated' },
      ],
      upsell: { service: 'ESG Consulting', why: 'PFAS migration is the single biggest dielectric fluid disruption in 30 years and most operators don\'t have a documented plan. ThermaShift\'s PFAS Migration Audit produces an auditor-ready transition document, vendor-by-vendor SKU mapping, and SEC/state filing templates. We\'ve done this for several Carolinas operators — fastest path to compliance.', estimated_value: '$25,000–$50,000', cta: 'Schedule a PFAS Transition Audit' },
      demo_funnel: {
        explore: 'Open Cooling AI to see the pump VFD adjustment proposal — modest action, but the real conversation is the migration plan.',
        ask_questions: 'Open Chat with AI for a sample conversation about Opteon vs ElectroCool tradeoffs.',
        get_quote: 'Open Recommendations for the PFAS Transition Audit ($25-50K) — one click to escalate.',
      },
    },

    chat: {
      title: 'Novec → Opteon vs ElectroCool migration',
      messages: [
        { role: 'user', content: "We need to get off Novec. What's actually the best replacement for two-phase immersion at our scale?" },
        { role: 'assistant', content: "Three real options for two-phase replacement, ranked by realistic match to Novec performance:\n\n**1. Chemours Opteon 2P50** — closest analogue. HFO chemistry, similar boiling point (~50°C), drop-in compatibility for most Novec-designed tanks. Trade-off: still has GWP (~150) but PFAS-free and not subject to 3M phase-out. Pricing: roughly 60-70% of Novec at current spot. **Best if you want minimal hardware changes.**\n\n**2. Engineered Fluids ElectroCool / AmpCool (single-phase hydrocarbon)** — completely different cooling regime. Requires switching from two-phase to single-phase, which means new pump+heat-exchanger sizing. Higher capital cost upfront but 80-90% lower fluid cost long-term. **Best if you have budget for hardware refit.**\n\n**3. Castrol ON DC20 (ester-based hydrocarbon)** — single-phase, partnered with Submer hardware ecosystem. Strong sustainability story (biodegradable, GWP <10). Same caveat as #2: hardware changes needed.\n\nFor your 18-rack edge site where downtime risk matters: I'd push toward Opteon 2P50 first as a minimum-disruption move, then evaluate ElectroCool/Castrol on next refresh cycle. Want a detailed migration cost comparison?" },
        { role: 'user', content: "Yes — and what's the regulatory timeline I'm working against?" },
        { role: 'assistant', content: "Here's the realistic clock:\n\n**Federal:** No federal PFAS ban yet but EPA issued strict water/soil contamination limits in 2024. Indirect cost (cleanup liability, insurance) rising.\n\n**Pennsylvania (your state):** PA mandatory PFAS reporting begins 2026 — you'll need to declare Novec inventory. No ban yet but commercial use expected to be restricted by 2028-2030.\n\n**Maine:** All non-essential PFAS banned 2030. Setting national precedent.\n\n**Minnesota:** Industrial PFAS phase-out underway 2025+.\n\n**EU REACH:** broad PFAS restriction proposal in final review, likely 2027 implementation.\n\n**Insurance angle:** Several major insurers (AIG, Chubb) added PFAS exclusions to liability policies in 2025. If you have a fluid release event with Novec, your coverage may not apply. **This is the actual urgent driver** — not regulation, but insurance posture.\n\nMost operators I see have a 3-5 year planning window. You're looking at 2026 for inventory documentation, 2027 for hardware/fluid transition, 2028-2029 for full regulatory cushion. **ThermaShift's PFAS Audit walks through this site-specifically.** Want me to flag it for Steve to scope?" },
        { role: 'user', content: 'Yes flag it.' },
        { role: 'assistant', content: 'Done. Steve will reach out within 24 hours. Audit produces an auditor-ready transition document, vendor-by-vendor SKU mapping, and a 24-month implementation calendar. Most operators wrap this engagement in 3-4 weeks.' },
      ],
    },

    escalations: [
      { service: 'ESG Consulting', value_low: 25000, value_high: 50000,
        pitch: "Atlas Edge runs Novec immersion at Pittsburgh — 3M exited PFAS Dec 2025, supply chain panic forming. PA reporting begins 2026, insurance exclusions already in market. ThermaShift's PFAS Migration Audit produces auditor-ready transition plan, vendor-by-vendor SKU mapping, 24-month calendar. Most operators wrap engagement in 3-4 weeks. Net: regulatory exposure eliminated, $48K/yr Novec cost avoided.",
        trigger_pattern: 'Active Novec/PFAS use detected, no transition plan documented' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 5. GREENFIELD — 100MW AI campus in design phase
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_greenfield_ai_campus',
    label: 'Greenfield AI Campus',
    icon: '🏗️',
    blurb: 'New 100MW AI campus in pre-design. Full Thermal Intelligence + Liquid Cooling Design & Install opportunity ($500K-$2M).',
    bestFor: 'Hyperscale builds, pre-design phase, sustainability-mandated greenfields',
    apiKey: 'tsk_demo_apex_7b2d8f5c1a9e4c6d0f3b8e',

    company: 'Apex Digital Infrastructure',
    contactName: 'VP of Engineering',
    contactEmail: 'demo+apex@thermashift.net',
    timezone: 'America/Phoenix',

    sites: [
      { name: 'Apex Phoenix-1 (in design)', city: 'Phoenix', state: 'AZ', facility_type: 'hyperscale', square_footage: 480000, rack_count: 4500 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Site Outside Air Temp', type: 'temperature', unit: '°F', baseline: 92, variance: 12 },
      { siteIndex: 0, name: 'Site Outside Humidity', type: 'humidity', unit: '%', baseline: 28, variance: 10 },
      { siteIndex: 0, name: 'Test Hall A — IT Power', type: 'power', unit: 'MW', baseline: 1.8, variance: 0.5 },
      { siteIndex: 0, name: 'Test Hall A — Cooling Power', type: 'power', unit: 'MW', baseline: 0.55, variance: 0.15 },
    ],

    rule: { siteIndex: 0, sensorName: 'Site Outside Air Temp', name: 'Outside air >100°F', rule_type: 'above', threshold_value: 100, threshold_window_minutes: 30, severity: 'info', debounce_count: 4 },
    openIncident: null,

    coolingActions: {
      pending: [],
      historicalManual: null,
      historicalAuto: null,
      autoRule: null,
    },

    advisorResponse: {
      headline: 'Phoenix at 480K sq ft / 100MW lands at PUE 1.55 with conventional design. With ThermaShift involved pre-design, you can hit 1.20.',
      analysis: 'Phoenix climate (avg high 92°F, low humidity 28%) is paradoxically excellent for cooling efficiency IF designed for it from day one. Conventional N+1 chiller plant + air-cooled CRAH design will hit ~1.55 PUE. **Adaptive design using direct evaporative + adiabatic spray + selective liquid cooling on AI/GPU halls can hit 1.20 PUE** — that\'s 22% cooling energy reduction = ~$3.4M/year operating cost difference at your scale and Phoenix electricity rates. The decision window is now: post-design, retrofit costs are 3-5x. Three architectural choices have outsized impact: (1) cooling architecture mix, (2) free-cooling utilization design, (3) waste heat capture for adjacent commercial use (Phoenix has emerging algae bioreactor industry).',
      recommendations: [
        { action: 'Engage ThermaShift Cooling Optimization in pre-design phase — produces a thermal architecture spec your MEP firm uses as input.', urgency: 'this month', expected_impact: 'PUE 1.55 → 1.20 = ~$3.4M/yr opex savings' },
        { action: 'Engage ThermaShift for the Liquid Cooling Design & Install scope on AI/GPU halls before construction — single integrated project for design + procurement + commissioning.', urgency: 'this quarter', expected_impact: 'Locked-in cooling spec from pre-design · faster time to first MW' },
        { action: 'Document Section 179D eligibility before placed-in-service date — at 480K sq ft, this is potentially $900K of federal tax deduction.', urgency: 'this quarter', expected_impact: '$900K tax deduction at $1.88/sq ft' },
      ],
      upsell: { service: 'LCaaS', why: 'Greenfield is where ThermaShift adds the most leverage. Pre-design involvement on a 100MW AI campus locks in 22% lifetime energy savings and accelerates time-to-first-MW by 6-9 months. Equipment paid upfront and owned by you, labor 30/40/30.', estimated_value: '$500,000–$2,000,000 (one-time project)', cta: 'Schedule a 90-min pre-design workshop' },
      demo_funnel: {
        explore: 'Open Cooling AI tab — pre-design facility has minimal sensor history (test hall only), but the action engine framework is ready.',
        ask_questions: 'Open Chat with AI for sample conversation about Phoenix climate adaptive cooling architecture.',
        get_quote: 'Open Recommendations for the Liquid Cooling Design & Install pre-design engagement ($500K-$2M).',
      },
    },

    chat: {
      title: 'Phoenix climate adaptive cooling architecture',
      messages: [
        { role: 'user', content: 'How aggressive can we get with adiabatic + evaporative cooling in Phoenix? Our MEP firm is conservative.' },
        { role: 'assistant', content: "Aggressively. Phoenix's climate makes it one of the best cities in North America for evaporative-dominant cooling — and yet most MEP firms default to chiller-plant-heavy designs because that's what they know. Three points to push your MEP on:\n\n**1. Wet-bulb temperature is your real metric** — Phoenix avg wet-bulb is 65°F, peak summer 78°F. **You can deliver 75-80°F supply air via direct evaporative cooling 88% of the year** with zero mechanical chiller use. The 12% remainder is your peak-load mechanical backup.\n\n**2. Indirect evaporative + adiabatic spray gets you to ~92% free-cooling** — adds adiabatic mist on the dry-side coil to hit higher operating ranges. Used by Microsoft Quincy WA, Google Mayes OK, Yotta India. Proven at hyperscale.\n\n**3. Water cost is the only real argument against** — Phoenix water is constrained. But your evaporative consumption (~5 gal/MWh) is 1/30th of mechanical-only PUE 1.55 design's water embedded in upstream electricity. **You actually save water by going evaporative.**\n\nYour MEP is being conservative because adiabatic systems require more controls sophistication and they don't want commissioning risk. ThermaShift can specify the controls layer + commissioning — that's exactly what our Liquid Cooling Design & Install project covers (one-time project, equipment owned by you). Want a Phoenix climate-specific PUE projection?" },
        { role: 'user', content: 'Yes. And what about the heat capture angle?' },
        { role: 'assistant', content: "Phoenix is unusual for heat capture but the opportunity is real:\n\n**Algae bioreactor partnerships** — Arizona has emerging algae-for-biofuels and algae-for-feedstock industry (Heliae, ATP3). They need 80-95°F process water continuously. Your reject heat at exactly that temperature, $0.005/kWh equivalent value to them, $30-50K/year per acre of algae production they can support.\n\n**Greenhouse partnership** — Maricopa County has the largest commercial greenhouse cluster in the Southwest (Eurofresh, NatureSweet). They use natural gas heating fall-spring. Reject heat displaces 100% of that load. $200-400K/year revenue potential at your scale.\n\n**Aquaculture (saltwater shrimp)** — Arizona has 6 commercial saltwater shrimp farms (NaturalShrimp, SD Shrimp). They need 80-85°F brood tanks year-round. Tight match.\n\nPick one of these as a pre-design partner and you have a co-located customer who pays for the heat infrastructure. **At $500K/year revenue, the heat capture facility pays for itself in <3 years.** Want me to flag both the Liquid Cooling Design & Install project and Waste Heat Recovery for Steve?" },
        { role: 'user', content: 'Yes flag both.' },
        { role: 'assistant', content: "Done. Steve will scope a combined Liquid Cooling Design & Install + Waste Heat Recovery engagement. Total project value: $500K-$2M (cooling design + install) + $50-300K (waste heat feasibility + design). Both are one-time project engagements — equipment 100% upfront, labor 30/40/30. Makes it a flagship engagement for your campus and a reference for ThermaShift's hyperscale practice. Expect contact within 24 hours." },
      ],
    },

    escalations: [
      { service: 'LCaaS', value_low: 500000, value_high: 2000000,
        pitch: "Apex Phoenix is in pre-design — single highest-leverage moment in any data center's life. ThermaShift Cooling Optimization + Liquid Cooling Design & Install engagement at this stage delivers PUE 1.20 vs conventional 1.55 = $3.4M/yr opex savings, accelerates time-to-first-MW by 6-9 months, and gives you owned cooling infrastructure (equipment paid upfront, labor 30/40/30). Project services scope: $500K-$2M. Pays back in <12 months of operation.",
        trigger_pattern: 'Greenfield 100MW+ AI campus, pre-design phase' },
      { service: 'Waste Heat Recovery', value_low: 200000, value_high: 600000,
        pitch: "Phoenix has emerging algae bioreactor + greenhouse + aquaculture industries that consume 80-95°F process heat continuously. Co-located heat capture partnership generates $200-600K/year recurring revenue and supports ESG reporting narrative. Pre-design engagement allows physical heat distribution to be designed in, not retrofitted.",
        trigger_pattern: 'Hyperscale build with regional commercial heat demand' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 6. 179D / ENERGY EFFICIENCY — Mid-market retrofit, June 30 deadline
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_179d_retrofit',
    label: 'Section 179D Retrofit',
    icon: '💰',
    blurb: 'Mid-market 35K sq ft facility with cooling efficiency upgrade opportunity. Section 179D urgency.',
    bestFor: 'Capital-efficient CFOs, mid-market operators, retrofit candidates',
    apiKey: 'tsk_demo_heritage_2c8a4f7d1b9e3c6d5f0a8b',

    company: 'Heritage Tower Data',
    contactName: 'Director of Facilities',
    contactEmail: 'demo+heritage@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Heritage Cleveland Primary', city: 'Cleveland', state: 'OH', facility_type: 'colocation', square_footage: 35000, rack_count: 140 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Hall A CRAC Return', type: 'temperature', unit: '°F', baseline: 82, variance: 3 },
      { siteIndex: 0, name: 'Hall A CRAC Supply', type: 'temperature', unit: '°F', baseline: 64, variance: 2 },
      { siteIndex: 0, name: 'Hall B CRAC Return', type: 'temperature', unit: '°F', baseline: 80, variance: 3 },
      { siteIndex: 0, name: 'Total IT Power', type: 'power', unit: 'kW', baseline: 880, variance: 60 },
      { siteIndex: 0, name: 'Total Cooling Power', type: 'power', unit: 'kW', baseline: 540, variance: 40 },
      { siteIndex: 0, name: 'Outside Air Temp', type: 'temperature', unit: '°F', baseline: 50, variance: 10 },
    ],

    rule: { siteIndex: 0, sensorName: 'Hall A CRAC Return', name: 'CRAC return >85°F', rule_type: 'above', threshold_value: 85, threshold_window_minutes: 30, severity: 'warning', debounce_count: 3 },
    openIncident: null,

    coolingActions: {
      pending: [
        { action_type: 'enable_economizer', target_label: 'Hall A + B economizer', parameters: { target_label: 'Free cooling all halls' },
          reasoning: 'Outside air at 48°F. Switching to free cooling saves $480/day vs current mechanical cooling.' },
      ],
      historicalManual: null,
      historicalAuto: null,
      autoRule: null,
    },

    advisorResponse: {
      headline: 'Your facility is leaving $66K of federal tax deduction on the table — Section 179D expires June 30 and you have qualifying improvements unfiled.',
      analysis: "Heritage Cleveland operates at PUE ~1.61 with conventional CRAC architecture. Two relevant signals: (1) **Total cooling power is 540 kW supporting 880 kW IT** — that's 60% cooling overhead, well above industry mid-market average of 40-45%. (2) **Outside air at 50°F average means ~80% of the year qualifies for economizer free-cooling**, but you're not using it. A mid-effort cooling efficiency upgrade — economizer activation, CRAC fan VFDs, hot/cold aisle containment — would drop PUE from 1.61 to ~1.40. **At 35,000 sq ft, that improvement plus existing depreciable HVAC qualifies for Section 179D federal tax deduction at $1.88/sq ft = $65,800.** Section 179D drops to $0.50/sq ft after June 30, 2026 — capturing 73% less. **You have under 60 days to place qualifying improvements in service.** This is the most time-sensitive financial opportunity I see in your data.",
      recommendations: [
        { action: 'Approve the proposed economizer activation in Cooling AI tab — no capital cost, immediate $480/day savings, qualifies as a 179D-eligible improvement when documented.', urgency: 'today', expected_impact: '$480/day energy savings + 179D documentation start' },
        { action: 'Engage ThermaShift ESG Consulting + Cooling Optimization combined scope — 30-day execution, places qualifying improvements in service before June 30 deadline.', urgency: 'this month', expected_impact: '$25-50K project + $66K tax deduction + $80K/year opex savings' },
        { action: 'Document existing cooling improvements made since Jan 2023 — many operators have 3-7 forgotten qualifying touchpoints (CRAC swaps, VFD installs, control upgrades).', urgency: 'this week', expected_impact: 'Possibly additional $20-40K in retroactive 179D filings' },
      ],
      upsell: { service: 'ESG Consulting', why: 'The 179D tax deduction filing alone returns $66K of federal tax value before June 30 — drops to $17K after. Combined with our cooling optimization scope, this is a $25-50K project that returns $146K+ in year one (tax + opex + capacity recovery). 5-7x ROI.', estimated_value: '$25,000–$50,000 (project) · $66,000 tax deduction', cta: 'Schedule a 60-min Section 179D scoping call' },
      demo_funnel: {
        explore: 'Open Cooling AI to approve the economizer activation — first qualifying 179D improvement in motion today.',
        ask_questions: 'Open Chat with AI for sample 179D + Duke-style efficiency rebate stacking conversation.',
        get_quote: 'Open Recommendations for the ESG Consulting engagement — fast-track scoping call.',
      },
    },

    chat: {
      title: 'Section 179D + utility rebate stacking',
      messages: [
        { role: 'user', content: 'How exactly does Section 179D work for cooling improvements? My CPA has never filed one.' },
        { role: 'assistant', content: "Most generalist CPAs haven't — 179D is niche, mostly used by green-building consultants. Quick primer:\n\n**The deduction:** Up to **$1.88 per square foot** federal tax deduction for energy-efficient building improvements that achieve at least 25% energy reduction vs ASHRAE 90.1-2007 reference. **Drops to $0.50/sq ft for most properties after June 30, 2026.**\n\n**What qualifies for cooling specifically:**\n• CRAC/CRAH replacements with higher-efficiency models\n• VFDs on cooling pumps and fans\n• Economizer (free cooling) implementations  \n• Chilled water plant optimization\n• Hot/cold aisle containment\n• Smart cooling controls\n• Building envelope improvements affecting cooling load\n\n**For Heritage Cleveland specifically:**\n• 35,000 sq ft × $1.88 = **$65,800 maximum deduction** if you achieve full 50% energy reduction\n• Sliding scale: $0.94/sq ft = $32,900 at 25% reduction (still substantial)\n• **Catch:** improvements must be placed in service before June 30, 2026 even if filing happens later in the year\n\n**Required documentation:** energy modeling by a qualified third party (~$5-15K). ThermaShift handles this in our ESG Consulting scope.\n\n**Stacking with utility rebates:** Ohio doesn't have Duke-tier programs but **AEP Ohio Smart Grid Rebates ($25-50/kW saved)** layer cleanly on top. At your scale: $20-40K additional rebate.\n\n**Total economic picture:**\n• Project investment: $25-50K\n• 179D deduction: $33-66K\n• AEP Ohio rebate: $20-40K\n• Year-1 opex savings: $80K\n• **Year 1 net: $108-156K return on $25-50K spend**\n\nWant me to flag this for Steve to scope?" },
        { role: 'user', content: 'Yes. What\'s the timeline if we kick off this week?' },
        { role: 'assistant', content: "Aggressive but doable for the June 30 deadline:\n\n**Week 1 (now):** Scoping call with Steve, energy baseline modeling kickoff, signed engagement letter.\n**Weeks 2-3:** Full energy model, identify qualifying improvements, vendor quotes for any equipment.\n**Weeks 4-6:** Implement quick-win improvements (economizer activation, controls upgrades, VFD installs). All can be done without facility outage.\n**Week 7:** Energy model post-implementation, 179D documentation package finalized.\n**Week 8 (last week of June):** Improvements placed in service. **Documented before June 30 deadline. Tax filing happens at next return cycle.**\n\nAEP Ohio rebate filings happen in parallel — typical processing 60-90 days post-completion.\n\n**Critical:** the deadline is for placed-in-service date, not tax filing date. So we need to start within the next 2 weeks to give buffer for vendor lead times. If you wait until early June, you're at risk of missing.\n\nWant me to flag for Steve as urgent — kickoff call within 48 hours?" },
        { role: 'user', content: 'Yes urgent.' },
        { role: 'assistant', content: "Flagged with urgency tag. Steve will reach out within 24 hours to schedule a kickoff call this week. Engagement scope: Cooling Optimization + ESG Consulting combined, 30-day execution path." },
      ],
    },

    escalations: [
      { service: 'ESG Consulting', value_low: 25000, value_high: 50000,
        pitch: "Heritage Cleveland has $65,800 of Section 179D tax deduction at risk — expires June 30, drops to $17K after. Combined Cooling Optimization + ESG engagement places qualifying improvements in service before deadline, captures full deduction, plus $80K/year opex savings + $20-40K AEP Ohio rebate. Year 1 net return: $108-156K on $25-50K spend. Time-critical — needs kickoff this week.",
        trigger_pattern: '35K+ sq ft mid-market facility, no 179D documentation, June 30 deadline approaching' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 7. MISSION-CRITICAL EDGE — Financial services, zero-tolerance downtime
  // ════════════════════════════════════════════════════════════════════
  {
    id: 'demo_mission_critical_edge',
    label: 'Mission-Critical Edge',
    icon: '🛡️',
    blurb: 'Financial services edge sites with zero-tolerance for downtime. Premium tier monitoring + auto-action.',
    bestFor: 'Banking, healthcare, regulated industries with strict SLA',
    apiKey: 'tsk_demo_sentinel_9e1c4f7d2b8a3e6c5f0b9d',

    company: 'Sentinel Edge',
    contactName: 'Head of Infrastructure Operations',
    contactEmail: 'demo+sentinel@thermashift.net',
    timezone: 'America/New_York',

    sites: [
      { name: 'Sentinel Stamford NOC', city: 'Stamford', state: 'CT', facility_type: 'edge', square_footage: 4200, rack_count: 14 },
      { name: 'Sentinel Jersey City DR', city: 'Jersey City', state: 'NJ', facility_type: 'edge', square_footage: 3800, rack_count: 12 },
      { name: 'Sentinel Boston Tertiary', city: 'Boston', state: 'MA', facility_type: 'edge', square_footage: 2900, rack_count: 8 },
    ],

    sensors: [
      { siteIndex: 0, name: 'Trading Floor Rack Avg', type: 'temperature', unit: '°F', baseline: 72, variance: 1 },
      { siteIndex: 0, name: 'Cold Aisle Humidity', type: 'humidity', unit: '%', baseline: 45, variance: 2 },
      { siteIndex: 0, name: 'CRAC Status (PRIMARY)', type: 'temperature', unit: '°F', baseline: 64, variance: 1 },
      { siteIndex: 0, name: 'CRAC Status (BACKUP)', type: 'temperature', unit: '°F', baseline: 64, variance: 1 },
      { siteIndex: 1, name: 'DR Rack Avg', type: 'temperature', unit: '°F', baseline: 73, variance: 1 },
      { siteIndex: 1, name: 'CRAC Status (PRIMARY)', type: 'temperature', unit: '°F', baseline: 65, variance: 1 },
      { siteIndex: 2, name: 'Boston Rack Avg', type: 'temperature', unit: '°F', baseline: 73, variance: 1, willTrigger: true },
    ],

    rule: { siteIndex: 2, sensorName: 'Boston Rack Avg', name: 'Boston rack temp >78°F', rule_type: 'above', threshold_value: 78, threshold_window_minutes: 5, severity: 'critical', debounce_count: 1 },
    openIncident: { siteIndex: 2, sensorName: 'Boston Rack Avg', severity: 'critical', minutesAgo: 8, trigger_value: 79.4, trigger_threshold: 78, peak_value: 80.1, summary: 'Boston tertiary rack drift — investigating' },

    coolingActions: {
      pending: [
        { action_type: 'request_chiller_stage_up', target_label: 'Boston backup chiller', parameters: { target_label: 'Boston Backup' },
          reasoning: 'Boston rack temps drifting 1.5°F above setpoint over the last 8 minutes. Primary chiller fan signature suggests partial failure. Bringing backup online preemptively avoids any service event. Critical: Boston is part of triple-redundant trading infrastructure.' },
        { action_type: 'request_human_intervention', target_label: 'Boston site dispatch', parameters: { reason: 'Suspected CRAC primary fan failure — physical inspection required' },
          reasoning: 'Cooling auto-action can stabilize temps but cannot diagnose root cause. Recommend on-call tech dispatch within 60 min to inspect CRAC primary unit at Boston site.' },
      ],
      historicalManual: { action_type: 'set_crac_fan_speed', target_label: 'Stamford CRAC primary', params: { speed_percent: 92 }, reasoning: 'Pre-emptive ramp ahead of scheduled trading volume spike.' },
      historicalAuto: { action_type: 'enable_economizer', target_label: 'Jersey City DR', params: { target_label: 'Jersey City' }, reasoning: 'Outside air <60°F. Auto-approved.' },
      autoRule: { action_type: 'enable_economizer' },
    },

    advisorResponse: {
      headline: 'Boston tertiary site shows pre-failure CRAC signature — recommend human dispatch in next 60 min before trading-hour cutover.',
      analysis: "Sentinel runs primary-DR-tertiary triple redundancy across Stamford → Jersey City → Boston for trading floor compute. **Boston rack temps have drifted 1.5°F above setpoint over the last 8 minutes**, and the CRAC primary fan signature shows the early-failure pattern (intermittent current draw, slight phase imbalance) we see ~24-72 hours before mechanical CRAC fan failures. **This is exactly the kind of subtle pre-failure signal that conventional monitoring misses.** AI auto-action can stabilize the immediate temperature drift by bringing the backup chiller online, but the root cause needs physical inspection within 60 minutes — before US trading session opens at 9:30am ET. **At your industry, a 30-second blip during trading hours = $50K-$500K in latency-sensitive transaction loss + regulatory disclosure obligations.** Both action proposals are queued in Cooling AI tab.",
      recommendations: [
        { action: 'Approve the Boston backup chiller stage-up in Cooling AI tab — stabilizes temperature within 90 seconds while diagnosis happens.', urgency: 'today', expected_impact: 'Prevents thermal event during trading hours' },
        { action: 'Approve the human dispatch action — gets your on-call tech to Boston site for CRAC inspection within 60 min.', urgency: 'today', expected_impact: 'Diagnoses root cause before secondary failure' },
        { action: 'Document this incident pattern for SOC 2 / SR 11-7 compliance — predictive cooling intervention is exactly the kind of operational maturity auditors reward.', urgency: 'this week', expected_impact: 'Audit posture improvement' },
      ],
      upsell: { service: 'Platform Expansion', why: 'Mission-critical edge sites are the most justifiable use case for Pro tier ($599/mo per site) — auto-action with permission rules means latency-critical incidents resolve in seconds without paging a human at 3am. At your downtime cost, Pro tier pays for itself in a single avoided event per year.', estimated_value: '$1,797/mo (3 sites Pro) vs $899/mo (3 sites Guard)', cta: 'Schedule Pro tier expansion call' },
      demo_funnel: {
        explore: 'Open Cooling AI tab — two pending actions (chiller stage-up + human dispatch) are queued for the active Boston incident.',
        ask_questions: 'Open Chat with AI for a sample compliance / audit posture conversation.',
        get_quote: 'Open Recommendations for the multi-site Pro tier expansion.',
      },
    },

    chat: {
      title: 'AI auto-action audit posture for SOC 2 / SR 11-7',
      messages: [
        { role: 'user', content: "Our auditors are starting to ask about AI making decisions on infrastructure. How do we explain auto-action in our SOC 2 narrative?" },
        { role: 'assistant', content: "Auditor-friendly narrative — borrows directly from how banks document algorithmic trading controls under SR 11-7:\n\n**1. Frame it as 'augmented operations' not 'autonomous AI.'** Every action requires either explicit human approval or a previously-approved permission rule with parameter constraints. This is no different from a pre-approved standing trading order.\n\n**2. Document the human-in-the-loop boundaries.** Your permission rules table is your control narrative. Each rule has: trigger conditions, parameter ceiling/floor, severity classification, who approved (and when), and an audit log of every invocation.\n\n**3. Maintain an immutable audit trail.** ThermaShift's audit log captures every action proposal, approval source (human or rule), execution outcome, and before/after state. **This is more rigorous than most manual operations** — auditors love this because it's queryable, timestamped, and tamper-proof.\n\n**4. Reference precedent.** Goldman Sachs uses similar AI infrastructure ops for its trading-floor data centers. JPMorgan's COIN system is documented at the Federal Reserve level. You're not blazing trail.\n\n**Specific SOC 2 mapping:**\n• CC6.1 (logical access): Permission rules + actor-tracked audit log\n• CC7.2 (system monitoring): Real-time anomaly detection with response\n• CC8.1 (change management): Action proposal → approval → execution chain documented\n• A1.2 (availability): Predictive intervention reduces unplanned downtime — directly improves availability metrics\n\nFor SR 11-7 (model risk): we provide model card documentation for the AI advisor, including training data scope, performance metrics, known limitations, and validation methodology.\n\nWant the full audit narrative template? I can flag for Steve to send." },
        { role: 'user', content: "Yes please. Also — what's the realistic ROI on Pro tier vs our current Guard?" },
        { role: 'assistant', content: "Will flag for Steve. ROI math at your specific risk profile:\n\n**Cost delta:**\n• Guard: $299/mo × 3 sites = $897/mo = $10,764/year\n• Pro: $599/mo × 3 sites = $1,797/mo = $21,564/year\n• Net additional: $10,800/year\n\n**Risk avoided per Pro:**\n• Pro adds AI auto-action — currently the Boston incident requires you to manually approve. With Pro + permission rule, chiller stage-up happens in 90 seconds vs 8-15 min human response time during business hours, vs 30-60 min after-hours.\n• At financial services downtime cost: $50K-$500K per minute of trading disruption.\n• Boston-style pre-failure signals: ~6-10 per year across your 3 sites based on similar operators we monitor.\n• If even ONE incident per year has Pro auto-action prevent escalation to actual outage: $50K-$500K avoided vs $10,800 spent.\n\n**Compliance angle:** SOC 2 + SR 11-7 examiners increasingly expect autonomous response for mission-critical infrastructure. Pro tier *is* the documented control. Auditors prefer it. Your insurance underwriter (likely AIG or Chubb for tech E&O at your size) gives credit for documented predictive maintenance.\n\n**My take:** Pro tier is a no-brainer at your industry. The cost is rounding error vs the protection. Want me to flag the upgrade for Steve as part of the audit narrative engagement?" },
        { role: 'user', content: 'Yes flag both.' },
        { role: 'assistant', content: "Flagged. Steve will reach out within 24 hours with the SOC 2 / SR 11-7 audit narrative template and the multi-site Pro expansion scoping. Combined engagement value lands around $25-40K (advisory) + $1,797/mo recurring (Pro tier × 3 sites). Most institutions wrap the audit narrative work in 2-3 weeks." },
      ],
    },

    escalations: [
      { service: 'Platform Expansion', value_low: 21564, value_high: 21564,
        pitch: "Sentinel runs trading-floor mission-critical infrastructure across 3 edge sites currently on Guard tier. Boston pre-failure event today is exactly why Pro tier ($1,797/mo across 3 sites) exists — AI auto-action stabilizes incidents in seconds vs minutes of human response. At financial services downtime cost ($50K-$500K/minute), Pro tier pays for itself with a single prevented incident per year. Plus SOC 2 / SR 11-7 audit posture improvement.",
        trigger_pattern: 'Mission-critical edge sites, current Guard tier, regulated industry' },
      { service: 'ESG Consulting', value_low: 25000, value_high: 40000,
        pitch: "SOC 2 + SR 11-7 audit narrative documentation for AI infrastructure operations — most regulated operators don't have a formal control framework for autonomous cooling actions. ThermaShift provides the documentation, model card, control mapping, and validation methodology that examiners are starting to expect. Typical engagement 2-3 weeks.",
        trigger_pattern: 'Regulated industry with active SOC 2 / SR 11-7 compliance program' },
    ],
  },
];
