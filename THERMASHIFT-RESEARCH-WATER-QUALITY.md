# ThermaShift — Water Quality Offering Research

**Goal:** Position ThermaShift as the partner data centers use to (a) stay compliant with EPA water rules, (b) measurably improve the water they discharge to the community, and (c) generate a defensible recurring-revenue line beyond pure cooling consulting.

**Status:** Research + product proposal. Pricing modeled. Tech stack scoped. Not yet built or marketed.

**Created:** 2026-05-23.

---

## 1. Why this fits ThermaShift

1. **Data centers are massive water consumers.** A single 15 MW hyperscale facility using evaporative cooling can consume 130 million+ gallons/year. Mid-market colos consume 1-20 MGY. Water is now the #2 environmental scrutiny after carbon — and unlike carbon, it's local.

2. **Existing fluid expertise is adjacent.** ThermaShift already pitches cooling fluid migration (PFAS / Novec). Water quality and water filtration are technically next to that — same buyers, same audit cadence, same regulatory inertia.

3. **Compliance is the wedge, filtration is the recurring revenue.** Audits are episodic; filtration service is monthly. One audit closes a door, then the door reopens monthly for years. Same playbook as energy audits (Section 179D one-time) → ongoing efficiency contracts.

4. **PFAS rule from EPA Final Rule April 2024 (MCL set for 6 compounds in drinking water) intersects directly with ThermaShift's existing PFAS-cooling-fluid messaging.** Customer using PFAS-containing cooling fluid now has TWO PFAS exposures: the fluid AND any water that touched it. ThermaShift can speak to both as a unified compliance story.

5. **Audit revenue is high-margin solo-founder work** — Steve goes out, takes samples, runs them through certified labs, writes the report. No equipment investment, no inventory. Filtration install is a partner-execution model (same as the cooling-project zero-capital playbook in `project_execution_model.md`).

---

## 2. The regulatory landscape (what we'd help customers comply with)

### Federal (US)

1. **Clean Water Act (CWA) — NPDES permits.** Any facility discharging to surface water (river, lake, ocean) or to a publicly owned treatment works (POTW) at volumes exceeding the local threshold needs an NPDES permit. Data centers discharging blowdown water from cooling towers almost always need one for large facilities.
   - Effluent limits set per pollutant: temperature, pH, total dissolved solids (TDS), residual chlorine, biocides, scale inhibitors, sometimes specific organics.
   - Reporting: monthly Discharge Monitoring Reports (DMRs) on EPA Form 3320-1 or state equivalent.

2. **Safe Drinking Water Act (SDWA) — if returning treated water to potable supply** (rare but emerging as drought drives "purple pipe" recycling). Sets the MCLs (Maximum Contaminant Levels) including the new PFAS MCLs.

3. **EPA PFAS National Drinking Water Regulation (April 2024)** — sets MCLs for:
   - PFOA: 4 ppt
   - PFOS: 4 ppt
   - PFNA: 10 ppt
   - PFHxS: 10 ppt
   - HFPO-DA (GenX): 10 ppt
   - Mixture (Hazard Index): 1.0
   - **Compliance deadline: 2029.** Initial monitoring required 2027.
   - DCs aren't drinking-water providers, but DCs in jurisdictions where water is recycled to potable supply are upstream contributors — and increasingly cities are pushing PFAS-source identification upstream.

4. **Resource Conservation and Recovery Act (RCRA)** if any cooling fluid waste is classified as hazardous on disposal — applies to Novec migration cleanup.

### State-level (the binding layer for most DCs)

- **Virginia (Loudoun, "Data Center Alley") — DEQ:** strict cooling-water discharge limits, water-use reporting mandatory above 10K gpd. New DCs need water-use plans pre-approval.
- **Texas (Dallas-Fort Worth, Austin):** TCEQ requires water-use efficiency plans for new construction >100 KW. Multiple counties impose drought-tier restrictions that force DCs onto recycled water.
- **Arizona (Phoenix metro):** Strict — facilities >5 MW require recycled-water source for cooling unless a hardship variance is granted.
- **North Carolina:** state-level NPDES program. Charlotte / Raleigh DCs in scope.
- **Oregon / Washington:** strong on temperature limits at discharge — protects salmonid populations.

### Industry codes / certifications customers may want help passing

- **WUE (Water Usage Effectiveness)** — The Green Grid metric (gallons / kWh IT load). Operators publish this in ESG reports.
- **ISO 46001:2019** — water efficiency management systems certification.
- **LEED v4.1 / v5 (Water Efficiency credits)** — needed for many enterprise tenant agreements.
- **Uptime Institute Tier Certification** — increasingly includes water-resilience criteria.

---

## 3. What we'd actually sell — the product menu

### 3.1 Water Quality Audit & Compliance Report (one-time)

The wedge offering. Steve (or a subcontracted environmental engineer) physically visits the facility, draws samples, sends them to a certified lab, writes a report. Customer gets a written audit they can file with regulators and use in ESG disclosures.

**What's in the audit:**

- Cooling tower makeup water sample + analysis (TDS, pH, chlorides, hardness, biocides, alkalinity, conductivity, full Langelier/Ryznar stability index)
- Cooling tower blowdown sample + analysis (same parameters, plus elevated-concentration signal)
- Sidestream filter effluent sample (if applicable)
- Discharge sample to POTW or surface water (NPDES-relevant parameters)
- PFAS panel (6 EPA-regulated compounds via EPA Method 537.1 or 533) — bundled add-on
- Heavy metals panel (Pb, Cu, Zn, Cr, Ni, Cd) — bundled add-on
- Total coliform / Legionella for evaporative systems — bundled add-on
- Mass balance: gallons in, gallons evaporated, gallons blowdown, recovery rate
- Cycles of concentration vs theoretical maximum (efficiency benchmark)
- Risk findings: which parameters approach state limits, which fail
- Recommendations: specific filtration / treatment / cycle-management changes

**Deliverable:** A 20-30 page PDF report with cover letter to regulator, raw lab data, executive summary, technical analysis, and remediation roadmap.

**Pricing:** **$8,500 per facility audit** for a single-site mid-market DC (under 5 MW), bundled.

Pricing logic:
- Lab costs: ~$1,500-$2,000 for the full sample panel through Eurofins, Pace Analytical, or Eurofins-equivalent
- Sampling visit (Steve or subcontractor): 1 day, $1,500 incl travel
- Report writing + review: 12-15 hours billable
- Margin: ~$4,000-$4,500 net of direct costs
- This compares to: Veolia / Evoqua charge $15K-$50K for equivalent audits but bundled with sales of their own equipment; pure environmental consultants like ERM / Trinity Consultants charge $20K-$60K but don't position as filtration providers afterward

**Tier upsells:**
- **+$1,500** add second site visit at same facility 90 days later (compliance posture verification)
- **+$2,500** add PFAS source attribution (which equipment is leaching PFAS)
- **+$3,500** multi-site discount package: 3+ sites for one client → $7,000/site
- **+$5,000** regulatory submittal package: we prepare the NPDES DMR forms and file them as your designated agent

**Recurring upsell after audit:**
- **Quarterly water quality check-in** ($2,500/quarter / $10K/year per site) — repeat sampling, trend analysis, regulator-ready quarterly report
- **Annual compliance certification** ($5K/year per site) — annual recertification report, regulatory liaison

### 3.2 Continuous Water Quality Monitoring (SaaS extension — the recurring revenue)

This is where the SaaS platform we already built does double duty. Add water-quality sensor categories to the existing monitoring_sensors table, ingest readings the same way, alert when values drift outside acceptable bands.

**New sensor types to add:**

| Sensor type | Measures | Typical vendor | Webhook? |
|---|---|---|---|
| conductivity | TDS / mineral content | Hach, Honeywell, Endress+Hauser | yes via gateway |
| ph | pH | same | yes |
| orp | oxidation-reduction potential (biocide health) | same | yes |
| chlorine_residual | free + total chlorine | same | yes |
| turbidity | suspended solids | same | yes |
| flow_makeup | makeup water gallons | flow meter | yes |
| flow_blowdown | blowdown gallons | flow meter | yes |
| flow_evap | calculated (makeup - blowdown - drift) | derived | derived |
| temp_supply / temp_return | cooling water | already supported | yes |
| pressure_diff_filter | filter inlet/outlet ΔP (clogging signal) | DP sensor | yes |

Already exists in our architecture. Adding these to the sensor_type enum is a half-day's work. Alert rules with `rule_type='above'` and `threshold_value` cover everything except the multivariate case (Langelier index — needs a derived metric).

**Pricing tier:** add a **Water tier** to the SaaS or fold into existing Pro:
- **Water Add-on: $299/month per site** — includes ingestion of water-quality sensors, alerting on regulatory-relevant thresholds, automated monthly DMR-style report email to the customer's environmental compliance officer
- **Bundle: Pro tier + Water = $799/month** (vs $599 Pro alone + $299 standalone)

### 3.3 Filtration Engineering & Project Delivery (one-time projects + recurring service)

Continuous water improvement = filtration system design + install + service. Customer's water needs less treatment, less blowdown, lower TDS, better cycles of concentration → cost savings + compliance + ESG story.

**Technology options to spec for customers** (not building/manufacturing — recommending + integrating):

| Technology | Best for | Capex range | Op cost | Vendor partners |
|---|---|---|---|---|
| **Sidestream sand/multimedia filtration** | Suspended solids, basic clarification | $15-40K | low | Tonka, Smith & Loveless, Roberts Filter Group |
| **Centrifugal separators (hydrocyclones)** | Heavier particulates, sand/grit removal | $8-25K | very low | Lakos (Schlumberger), Spirotech |
| **Reverse osmosis (RO)** | TDS reduction (most cycles improvement) | $50-200K | electricity + membrane replacement | Veolia, Evoqua, Pure Water Group |
| **Ion exchange softening** | Hardness, calcium/magnesium | $20-60K | salt regeneration | Culligan, Kinetico, USFilter |
| **UV disinfection** | Legionella, biofilm prevention | $10-30K | bulb replacement annually | Trojan UV, Wedeco (Xylem) |
| **Chemical dosing systems** | Biocide / scale inhibitor management | $5-20K | chemistry | ChemAqua, Nalco Water (Ecolab) |
| **Granular activated carbon (GAC)** | Organics, residual chlorine, trace PFAS | $20-100K | media replacement 1-3 yrs | Calgon Carbon, Evoqua |
| **Ion-exchange resin for PFAS** | High-precision PFAS removal | $80-300K | resin replacement | Purolite, Evoqua |
| **Foam fractionation / SAF for PFAS** | Lower-cost PFAS at higher concentrations | $40-150K | minimal media | Battelle, EnvironGen |

**ThermaShift's role:** technical advisor + project integrator + recurring service provider. We DON'T manufacture filtration equipment. We:

1. Run the audit (3.1) — establish baseline + identify gaps.
2. Recommend the technology stack (the table above) — vendor-neutral. We're paid by the customer, not by Nalco/Veolia.
3. Coordinate a vendor RFP — customer picks, we manage.
4. Project-manage the install (zero-capital model: equipment 100% upfront from customer, our labor 30/40/30).
5. **Recurring service contract:** monthly visits to check filtration performance, swap consumables, log data into the SaaS platform, file regulatory reports.

**Pricing the project work:**
- **Engineering design + RFP coordination:** $25K-$75K depending on system complexity. Single-site sidestream filter ~$25K; multi-site multi-tech program $75K+.
- **Project management (install phase):** 8-12% of total project cost. Customer pays equipment vendor directly.
- **Annual service contract:** **$24K-$120K/year per site** depending on stack. Includes monthly site visits, consumables logistics, regulatory reporting, SaaS monitoring. **Margin: 30-40%** at solo-founder scale; better with proper subcontracting.

---

## 4. Continuous Water Improvement — what tech to recommend (deeper)

Steve asked specifically about "continuous water improvement and filtration." Below are the technology stacks that actually move the needle for data center cooling water.

### 4.1 The cycles-of-concentration play (biggest immediate ROI for most DCs)

Cooling towers typically operate at 3-5 cycles of concentration (the ratio of how concentrated minerals are in the recirculating water vs. fresh makeup). Better filtration + chemistry → higher cycles (6-8+) → 30-50% less makeup water and 30-50% less blowdown. That's both cost savings and discharge-permit relief.

**Stack to recommend:**
- Sidestream filtration (sand/multimedia) on a 5-10% slipstream of the recirc loop
- Automated chemical feed (Nalco / ChemAqua / ProChemTech) for scale inhibitor + biocide + dispersant
- Conductivity-based automatic blowdown control
- Continuous monitoring (SaaS — our product) for early scale/biofilm warning

Pitch: "We can get you from 4 cycles to 7 cycles. For a 5 MW DC, that's ~30 million gallons/year saved + commensurate sewer fees."

### 4.2 The PFAS removal play (compliance-driven, premium price)

For customers whose discharge sampling shows detectable PFAS — increasingly common as 537.1 sampling becomes mandatory:

**Stack:**
- Polishing GAC bed for organics + low-PFAS removal
- OR ion-exchange resin (selective PFAS resins from Purolite PFA694E, Evoqua A700E) for higher-PFAS streams
- Source attribution sub-study to identify which equipment is leaching (firefighting foams + AFFF in fire-suppression systems are common sources, also some HVAC sealants)

Pitch tied to existing ThermaShift PFAS-cooling-fluid story: "We help you migrate the cooling fluid AND clean up the legacy contamination at the same audit."

### 4.3 The recycled-water enablement play (drought-affected geos)

For customers in AZ/TX/NV/CA facing recycled-water mandates:

**Stack:**
- Pre-treatment for incoming recycled water (multimedia + GAC + UV)
- Sidestream RO if recycled water TDS is elevated
- Robust biocide regime (recycled water often higher in biofilm-forming organisms)

Pitch: "Recycled water is mandatory in your jurisdiction. We design the pre-treatment train so your existing cooling towers can use it without scale, biofouling, or Legionella risk."

### 4.4 The Legionella prevention play (insurance-driven)

ASHRAE 188-2021 requires Water Management Plans for facilities with cooling towers + Legionella risk. Insurance carriers increasingly require certified WMPs.

**Stack:**
- UV disinfection on makeup line
- Continuous ORP/chlorine residual monitoring (our SaaS)
- Quarterly Legionella sampling (audit add-on)
- Documented WMP with our written program

Pitch: "Your insurance carrier wants documentation. We provide the plan + the monitoring + the quarterly testing as a single package."

---

## 5. Operationally: how Steve actually delivers this without hiring

This is a zero-headcount strategy. Same playbook as the cooling-project model.

### Sampling visits

- **Steve himself** flies/drives to the facility for the initial audit. One day of work. Travel reimbursed by the audit fee. (Builds direct customer relationships — critical at solo-founder stage.)
- **Subcontract sampling** to a certified environmental sampler ($800-$1,500/site) once Steve doesn't want to be on a plane every week.
- **Customer's own staff with a kit + checklist** for the routine quarterly samples — Steve trains them once, they ship samples to our lab partner.

### Lab analysis

- **Partner with one national certified lab** (Eurofins, Pace Analytical, Test America/Eurofins, Bureau Veritas). Negotiate volume pricing — typically 15-25% off list above $50K/yr commit.
- Lab does the analytical work; ThermaShift packages results into the report.
- Critical: lab must be NELAC/ELAP certified for the analytes you're reporting. For PFAS specifically, EPA Method 533 or 537.1 certification.

### Reporting

- Template the audit report in markdown → PDF render (we already have the report generation infra via `server/review-generator.js`). Customize per facility.
- AI Advisor (Claude) can generate the narrative analysis sections from the structured lab data — Steve reviews + signs.
- 12-15 hours per audit, dropping to 4-6 hours after templates mature.

### Filtration project execution

- Engineering design: subcontract to a licensed P.E. (water treatment) on an hourly basis ($150-$225/hr) until volume justifies hiring.
- Install: customer hires the equipment vendor's preferred installer directly (zero-capital), or we coordinate a local MEP.
- Recurring service: 1 day/month per site for monthly check-ins. At 5 client-sites = 1 week/month of Steve's time. At 20 sites = needs a service tech hire, which the recurring revenue funds.

---

## 6. Go-to-market

### Initial positioning

**Tagline draft:** "Water you can defend. Compliance, cost, and community impact — measured every month."

### Where to introduce this offering

1. **Existing outreach copy** — add a 4th tier to `outreach-copy-draft.md` (or extend tier A) referencing water audit + PFAS as a unified compliance story.
2. **Add a service line page** to thermashift.net under Services.
3. **ESG / Sustainability conferences** — Data Center World has an ESG track. AFCOM Charlotte chapter (per `project_event_monitoring`) has water-related sessions.
4. **AFCOM NC + Carolina DC operator network** — Steve's local geography. Easier travel for sampling visits.

### Lead-gen specific to water

- **EPA NPDES discharge data is public.** State databases list facilities discharging above thresholds, their permit limits, and any violations. A short scraper against the EPA ECHO database (`https://echo.epa.gov`) can identify DCs with recent violations or near-violation patterns — these are pre-qualified leads. Free, defensible (public data), ethical.
- **State drought declarations + recycled-water mandates** — when AZ ADWR or CA SWRCB tightens rules, every DC operator in the state needs a partner. Steve flags via news monitoring (we have NewsAPI integration already).
- **3M Novec exit anniversary (end of 2025)** — natural anchor for outreach: "You're already thinking about cooling fluid migration; let's bundle the water-quality audit."

### Pricing posture

- **Audit:** the wedge. Priced to win — $8.5K is below most competitors and well below "we'll need a meeting with your VP of Operations" pricing levels. Yes to a $5K audit for a first-customer reference.
- **Recurring monitoring:** $299/mo add-on. Almost-free relative to the customer's water bill (often $50K+/year for DCs).
- **Project engineering:** premium but well-justified ($25-75K). Comparable to MEP consulting hours.
- **Annual service:** the recurring revenue line. $24-120K/yr range, ~35% margin, scalable.

---

## 7. Risks and dependencies

1. **Lab certification matters.** PFAS results from a non-NELAC lab can be challenged. Vet the lab partner carefully — recommendation: **start with Eurofins (largest PFAS-certified network) or Pace Analytical.**

2. **Liability on regulatory submittals.** If we file an NPDES DMR on behalf of a customer and the data is wrong, both the customer AND we could face penalties. Errors-and-omissions insurance required before offering "regulatory submittal package" upsells. Budget: $1,500-$3,000/year for $1M E&O policy at solo-founder scale.

3. **NPDES permit work is regulated practice in some states.** Most states allow non-licensed agents to assist with reporting; a few (CA, NY, NJ) require a registered P.E. or hazardous-waste designation. Check per-state before claiming regulatory submittal services in those geos.

4. **Cooling fluid PFAS audit overlap with existing positioning.** Be careful not to confuse the message. The cooling-fluid PFAS migration is about replacing PFAS-containing fluids inside immersion or fire-suppression systems. The water-quality PFAS audit is about residual PFAS in cooling water — could come from cooling fluids OR from external sources (incoming water, fire suppression history, etc.). Customer pitch needs to make the distinction clear.

5. **One bad customer experience kills the offering** — water is regulated by name. A facility that gets fined after our audit said "you're fine" is reputational catastrophe. Conservative sampling + lab QC critical.

6. **Capital constraint on the install side.** Filtration equipment ranges $5K-$300K. We are not the buyer; the customer is. The zero-capital model holds. But ThermaShift may need to provide upfront engineering hours (sometimes 20-40 hours of unbilled scoping work) before a paying project closes. Budget for this — first few projects may have negative ROI on the engineering hours alone.

---

## 8. What I'd recommend building first (sequencing)

### Phase A — September/October sprint (after first paying SaaS customer signs)

1. **Audit deliverable template** — markdown + PDF render. Lock the structure now so first audit goes smoothly.
2. **Sample chain-of-custody documents** — required by certified labs.
3. **Lab partnership signed** — Eurofins or Pace, volume pricing.
4. **One-page "Water Quality Audit" service description** for the website.
5. **EPA ECHO scraper** — extends the existing intent-scoring pipeline. Cheap to build (1-2 days).
6. **E&O insurance quote** — get it in process before first audit.

### Phase B — After first audit completed

1. Add the new sensor types to `monitoring_sensors.sensor_type` enum and `monitoring-advisor.js` reasoning context.
2. Build water-tier billing logic.
3. Add filtration partner relationships — Tonka, ChemAqua, Calgon as initial 3.
4. Filter-equipment-spec template library (Excel / structured docs ThermaShift can hand customers).

### Phase C — Scale

1. Subcontracted sampler network (3-5 partners regionally).
2. Service contract templates.
3. Regulatory submittal capability — only after E&O is in place AND a customer requests it.

---

## 9. The clean summary for Steve

**Three product offerings:**

| Offering | Price | Cadence | Margin | Time-to-build |
|---|---|---|---|---|
| Water Quality Audit | $8,500/site | one-time | ~50% | weeks (Phase A) |
| Continuous Monitoring (water add-on) | $299/mo/site | recurring | ~80% | days (extends existing SaaS) |
| Filtration Project Engineering + Service | $25K-$75K engineering + $24-120K/yr service | one-time + recurring | 30-40% | months (Phase B) |

**Wedge:** the $8,500 audit. Buys you 4-8 hours of access to a decision-maker. From there, monthly monitoring add-on, then filtration engineering on a 3-12 month timeline.

**Why this beats competitors:**
- Veolia / Evoqua bundle audit with equipment sales → not vendor-neutral, customer suspects bias
- Pure consultancies (ERM, Trinity) charge 2-3x more, deliver static reports without ongoing monitoring
- Nobody offers the integrated audit → SaaS monitoring → filtration service stack in one relationship

**First action items if you decide to pursue:**
1. Get a lab partner quote (Eurofins or Pace) — informs your real cost basis.
2. Get an E&O insurance quote.
3. Draft a 1-pager for the offering and add it to thermashift.net.
4. Add water-quality sensors to the SaaS schema (small code change).
5. Pick a friendly first customer to do the audit at a discount for case-study rights.
