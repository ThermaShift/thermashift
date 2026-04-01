# ThermaShift Operations Playbook
## Internal Use Only — Do Not Share With Clients

---

## Table of Contents
1. [Sales Process: First Contact to Signed Contract](#1-sales-process)
2. [Client Onboarding](#2-client-onboarding)
3. [Service Delivery: ESG Consulting](#3-esg-consulting)
4. [Service Delivery: Cooling Assessment & Design](#4-cooling-assessment)
5. [Service Delivery: SaaS Monitoring Platform](#5-saas-monitoring)
6. [Service Delivery: Waste Heat Recovery](#6-waste-heat-recovery)
7. [Service Delivery: LCaaS Implementation](#7-lcaas-implementation)
8. [Hiring & Subcontracting Guide](#8-hiring-guide)
9. [Emergency Procedures](#9-emergency-procedures)
10. [Templates & Scripts](#10-templates)

---

## 1. Sales Process: First Contact to Signed Contract

### Stage 1: Lead Generation (You do this yourself)

**Where leads come from:**
- Contact form on thermashift.net (Formspree sends to your email)
- LinkedIn outreach (your primary channel)
- Industry events (AFCOM, Data Center World, local ASHRAE chapter)
- Referrals from existing clients

**LinkedIn outreach template:**
> Hi [Name], I noticed [Company] is expanding in the Charlotte market. We help data center operators reduce cooling costs by 30-50% and turn waste heat into revenue. Would a 15-minute call make sense to see if there's a fit? No pitch — just a quick assessment of your cooling efficiency.

**When a lead comes in from the contact form:**
1. You receive the email from Formspree with all their facility details
2. Within 2 hours, respond with a personalized email (see template below)
3. Plug their numbers into the ROI Calculator to prepare talking points
4. Schedule the free 30-minute review call

### Stage 2: Discovery Call (30 minutes — FREE)

**Before the call (15 min prep):**
1. Research the company (LinkedIn, press releases, job postings for DC roles)
2. Run their numbers through the ROI Calculator (rack count, power, PUE from form)
3. Generate a Cooling Roadmap Report PDF using the Report Generator
4. Note 2-3 specific pain points from their form submission

**Call structure:**
- **0-5 min:** Introduction, confirm their role and what they're looking for
- **5-15 min:** Ask discovery questions (see below)
- **15-25 min:** Walk through the ROI Calculator numbers live (screen share)
- **25-30 min:** Propose next steps

**Discovery questions to ask:**
1. "What's driving your interest in cooling optimization right now?"
2. "What's your current PUE? Do you track it formally?"
3. "Are you facing any density challenges with AI/GPU workloads?"
4. "Do you have ESG reporting requirements from clients or regulators?"
5. "What's your timeline — is this exploratory or do you have budget allocated?"
6. "Who else is involved in this decision?"
7. "Have you evaluated liquid cooling options?"
8. "What would success look like for you in the next 12 months?"

**Key phrases that signal buying intent:**
- "We need to support higher density racks" → Cooling assessment + LCaaS
- "Our PUE is too high" → Monitoring platform + optimization
- "We have ESG requirements" → ESG consulting report
- "We're building a new facility" → Full design engagement
- "Our board/clients are asking about sustainability" → ESG + monitoring

### Stage 3: Proposal (You do this yourself)

**After the discovery call:**
1. Within 24 hours, email the Cooling Roadmap Report PDF (already generated)
2. Within 48 hours, prepare a formal proposal using the Proposal Generator (/proposal)
3. Tailor the proposal to their specific pain points from the call
4. Send with a brief email (see template below)

**Pricing strategy:**
- Always start with the ESG report ($7,500) — lowest barrier to entry
- If they want monitoring, quote per-rack pricing based on their count
- Bundle services for 10% discount (Assessment + Design, or Assessment + Monitoring)
- Never discount more than 15% — your prices are already below market

### Stage 4: Negotiation & Close

**Common objections and responses:**

**"Your price is too high"**
> "I understand. Let me show you the ROI — at your current PUE of [X], you're spending $[Y]/year in excess cooling energy. Our assessment pays for itself in [Z] months. And our monitoring is 50% less than Nlyte or Sunbird."

**"We need to think about it"**
> "Of course. I'll send a summary with the key numbers. What's a good time to reconnect next week? I want to make sure I address any concerns your team has."

**"Can you do a pilot?"**
> "Absolutely. We can start with a 3-month monitoring pilot on a subset of racks. If you see the value, we expand. No long-term commitment required for the pilot."

**"We already have DCIM software"**
> "Great — we integrate with your existing tools. ThermaShift adds the thermal intelligence and AI layer on top. We're not replacing your DCIM, we're making it smarter about cooling."

### Stage 5: Contract Signing

1. Generate the contract using the Contract Manager (/contracts)
2. Review the PDF carefully — check all service details and pricing
3. Send to client via email with signing instructions
4. Use a free e-signature service (SignWell, PandaDoc free tier, or Adobe Sign)
5. Once signed, collect the initial deposit before starting any work
6. Set up the client in the Monitoring Platform (/monitor) — create their API key
7. Send onboarding email (see template below)

---

## 2. Client Onboarding

### Onboarding Checklist (do this for every new client)

- [ ] Signed contract received
- [ ] Initial deposit received (verify in bank account)
- [ ] Client added to CRM Tracker (/tracker) with status "Won"
- [ ] Client created in Monitoring Platform → Authorized Clients → get API key
- [ ] Facility profile created in Monitoring Platform with their parameters
- [ ] Welcome email sent with:
  - [ ] Agent install guide link (thermashift.net/agent/INSTALL.html)
  - [ ] Their unique API key
  - [ ] Their facility ID
  - [ ] Polling interval recommendation
  - [ ] Your direct phone/email for support
- [ ] Kickoff call scheduled (30 min)
- [ ] Calendar reminders set for:
  - [ ] Monthly report delivery (by 5th of each month)
  - [ ] Quarterly business review
  - [ ] Contract renewal date (60 days before)

### Kickoff Call Agenda (30 min)

1. Introductions (if new stakeholders)
2. Confirm scope of work from contract
3. Walk through the monitoring dashboard together
4. Verify agent installation and data flow
5. Review alert thresholds and notification preferences
6. Set expectations for monthly reports
7. Schedule first check-in (2 weeks)

---

## 3. ESG Consulting Report — Service Delivery

### Who does the work: YOU (no subcontractor needed)

### Timeline: 2-3 weeks

### Step-by-step:

**Week 1: Data Collection**
1. Send client the data request checklist:
   - Current PUE data (monthly for past 12 months if available)
   - Electricity bills (12 months)
   - Water usage data
   - Facility specs (total IT load, cooling type, rack count)
   - Any existing ESG reports or sustainability policies
   - Regulatory requirements they're subject to
2. Research their specific regulatory environment:
   - SEC climate disclosure (if publicly traded)
   - EU CSRD (if EU operations)
   - State-level requirements (NC has limited requirements currently)
   - Customer sustainability requirements (their clients may require it)
3. Run their data through your Calculator and monitoring platform

**Week 2: Analysis & Writing**
1. Generate the Cooling Roadmap Report as a starting point
2. Expand it into a full ESG assessment:
   - **Executive Summary** — key findings and recommendations
   - **Current State** — PUE, WUE, carbon footprint, water usage
   - **Regulatory Landscape** — what applies to them, what's coming
   - **Gap Analysis** — where they fall short of best practices/regulations
   - **Recommendations** — prioritized action items with timeline
   - **Financial Impact** — cost of inaction vs. cost of compliance
   - **Appendix** — methodology, data sources, assumptions

**Week 3: Delivery**
1. Internal review (read it yourself with fresh eyes)
2. Deliver PDF to client
3. Schedule 1-hour walkthrough presentation
4. Present findings, answer questions
5. Propose next steps (monitoring, cooling assessment, or annual program)

### What you need to know:
- PUE = Total Facility Power / IT Power (industry average: 1.58)
- WUE = Water Usage / IT Power (lower is better)
- CUE = Carbon Emissions / IT Power
- Key regulations: EU Energy Efficiency Directive (2026 heat reuse mandate), SEC climate disclosure rules, ASHRAE TC 9.9 thermal guidelines
- ESG frameworks: GRI, SASB, CDP, TCFD

### Upsell opportunity:
"Based on this assessment, I recommend we set up ongoing monitoring so you can track these metrics in real-time. Our platform costs $[X]/month and gives you always-current data for ESG reporting."

---

## 4. Cooling Assessment & Design — Service Delivery

### Who does the work:
- **Assessment ($5K):** You + optional thermal engineer subcontractor
- **Full design ($25K):** You + thermal/mechanical engineer subcontractor (REQUIRED)

### For the $5K Assessment (you can do this yourself):

**What you need:**
- Infrared camera (rent one for $200-300/week from a local equipment rental)
- The monitoring agent installed on a sample of their servers
- Access to their facility for 4-6 hours

**Step-by-step:**
1. **Pre-visit:** Get floor plans, rack layouts, cooling unit locations
2. **On-site (4-6 hours):**
   - Walk the data hall, note hot/cold aisle configuration
   - Infrared scan of rack fronts and backs (photograph everything)
   - Check for blanking panels, cable management, airflow obstructions
   - Note CRAC/CRAH unit locations and settings
   - Measure inlet/outlet temps at 10-20 representative racks
   - Check raised floor tiles (perforated tiles in right locations?)
   - Document cooling unit nameplate data (capacity, model, age)
3. **Post-visit:** Analyze data, generate report with findings
4. **Deliverable:** PDF report with:
   - Thermal images annotated with findings
   - PUE measurement results
   - Specific problems identified (hot spots, bypass airflow, etc.)
   - Prioritized recommendations
   - ROI projections for each recommendation

### For the $25K Full Design (you need a subcontractor):

**Who to hire:**
- Licensed mechanical engineer with data center experience
- Find them on: LinkedIn, ASHRAE Charlotte chapter, BICSI, consulting firms
- Rate: $125-200/hour, expect 60-100 hours of engineering time
- Your cost: $7,500-$20,000 for the engineering work
- Your margin: $5,000-$17,500

**Your role:** Project manager — coordinate between client and engineer

**Step-by-step:**
1. Define scope with client (what cooling solution, how many racks)
2. Brief the engineer on findings from the assessment
3. Engineer produces:
   - Cooling system design drawings
   - Equipment specifications (make/model/quantity)
   - Piping/plumbing layout
   - Electrical requirements
   - Bill of materials with cost estimates
4. You review and package with your branding
5. Present to client with implementation timeline
6. Propose the implementation phase (LCaaS)

---

## 5. SaaS Monitoring Platform — Service Delivery

### Who does the work: YOU (fully automated)

### Setup time: 30 minutes per client

### Step-by-step:

1. **Create client account:**
   - Go to /monitor → Authorized Clients → Add Client
   - Enter client name, facility ID, max racks (from contract)
   - Copy the generated API key

2. **Create facility profile:**
   - Add Facility with their parameters (rack count, PUE, cooling type, thresholds)

3. **Send agent install instructions:**
   - Email them the install guide: thermashift.net/agent/INSTALL.html
   - Include their API key and facility ID
   - Recommend polling interval based on their tier:
     - Standard: 5 minutes
     - Professional: 1 minute
     - Enterprise: 30 seconds

4. **Verify data flow:**
   - Within 24 hours, check the dashboard for incoming data
   - Click "Live Data" to confirm readings are arriving
   - If no data, troubleshoot with client (firewall, Python issues)

5. **Ongoing service:**
   - Monthly: Generate and send a performance report
   - Quarterly: Schedule a business review call
   - As needed: Review AI recommendations and proactively alert client
   - Annual: Contract renewal discussion

### Monthly report template (email):
> Subject: ThermaShift Monthly Performance Report — [Month] [Year]
>
> Hi [Name],
>
> Here's your facility performance summary for [Month]:
> - Average PUE: [X] (target: [Y])
> - Hotspot incidents: [N]
> - Carbon footprint: [X] tonnes CO₂
> - AI recommendations actioned: [N] of [M]
>
> [Attach dashboard screenshot or PDF export]
>
> Key observations: [1-2 sentences about trends or concerns]
>
> Would you like to schedule a call to discuss? Happy to walk through the data.

---

## 6. Waste Heat Recovery — Service Delivery

### Who does the work:
- **Feasibility study ($10K):** You (research + analysis)
- **Broker setup ($25K):** You + legal review (contract template)
- **Revenue share (15%):** Ongoing management by you

### Step-by-step for Feasibility Study:

1. **Quantify heat output:**
   - Total IT power × 0.95 = waste heat in kW
   - At what temperature? (outlet air temp or water return temp)
   - Is it continuous or variable?

2. **Identify potential buyers within 5 miles:**
   - Greenhouses / vertical farms
   - District heating networks
   - Swimming pools / recreation centers
   - Industrial processes (brewing, food processing)
   - Algae bioreactors
   - Check local municipal plans for district heating initiatives

3. **Calculate revenue potential:**
   - Heat value: $0.02-0.05/kWh (depends on local market)
   - Annual revenue = recoverable kW × 8760 hours × $/kWh × utilization %
   - Typical utilization: 60-80% (seasonal for greenhouses, year-round for industrial)

4. **Assess infrastructure requirements:**
   - Heat exchanger to extract heat from cooling loop
   - Piping to transport hot water to buyer
   - Metering equipment
   - Estimated cost: $50K-$200K depending on distance and capacity

5. **Deliver report** with buyer recommendations, revenue projections, and infrastructure cost estimate

### Where to find heat buyers:
- Google Maps: search for greenhouses, farms, pools within 5 miles of the DC
- Local economic development office
- University agricultural departments (UNC, NC State)
- Municipal utilities (ask about district heating plans)
- Local brewery/food processing companies

---

## 7. LCaaS Implementation — Service Delivery

### Who does the work: Subcontractors (you manage)

### Required subcontractors:
1. **Mechanical engineer** — system design ($125-200/hr)
2. **Licensed plumber/pipefitter** — installation ($75-125/hr)
3. **Licensed electrician** — electrical connections ($75-125/hr)
4. **Equipment vendor** — cooling hardware (Motivair, CoolIT, GRC)

### Your role: General contractor / project manager

### Step-by-step:

**Phase 1: Design (2-4 weeks)**
1. Engineer produces installation drawings
2. Get 3 quotes from equipment vendors
3. Get 2-3 quotes from mechanical contractors
4. Present implementation plan and final cost to client
5. Client approves → collect Phase 1 milestone payment

**Phase 2: Procurement (2-6 weeks)**
1. Order equipment (client funds this via milestone payment)
2. Coordinate delivery schedule with facility
3. Schedule installation crew
4. Pre-install inspection of the facility

**Phase 3: Installation (1-4 weeks per phase)**
1. Mechanical installation (piping, manifolds, CDU)
2. Electrical connections
3. Equipment mounting (RDHX/cold plates/tanks)
4. Initial fluid fill and pressure testing

**Phase 4: Commissioning (1 week)**
1. System startup and leak testing
2. Performance validation (measure actual PUE improvement)
3. Install monitoring agents on new cooling equipment
4. Client acceptance testing
5. Final milestone payment

**Phase 5: Handoff**
1. Documentation package (as-built drawings, O&M manuals)
2. Training for facility staff
3. Set up ongoing monitoring via SaaS platform
4. 30-day warranty observation period
5. Release retention payment

### Finding subcontractors:

| Role | Where to Find | What to Look For |
|---|---|---|
| Mechanical Engineer | LinkedIn, ASHRAE, local engineering firms | PE license, data center experience, liquid cooling knowledge |
| Plumber/Pipefitter | Local mechanical contractor, union halls | Commercial/industrial experience, licensed in NC |
| Electrician | Local electrical contractor | Licensed in NC, commercial experience |
| Equipment Vendor | Motivair, CoolIT, GRC, Asetek | Partner programs, technical support, warranty |

### How to approach subcontractors:
> "Hi [Name], I'm Steve Betancur with ThermaShift. We do cooling optimization for data centers in the Charlotte area. I have a client project coming up that needs [mechanical engineering / plumbing / electrical] work. Are you available for a subcontract engagement? I handle the client relationship and project management. [Hourly rate / project quote] basis — interested in discussing?"

---

## 8. Hiring & Subcontracting Guide

### When to hire vs. subcontract:

| Situation | Hire | Subcontract |
|---|---|---|
| One-time project | No | Yes |
| Recurring need (3+ projects/year) | Consider | Start here |
| Specialized skill you lack | No | Yes |
| Core to your business | Eventually | Start here |
| Client-facing role | Consider | Be careful |

### Subcontractor agreement essentials:
1. **Scope of work** — specific deliverables
2. **Payment terms** — Net-30, tied to milestones
3. **Confidentiality/NDA** — protect client data
4. **Non-solicitation** — they can't poach your clients
5. **IP assignment** — work product belongs to ThermaShift
6. **Insurance** — require proof of liability insurance
7. **Termination** — either party can terminate with 14 days notice

### Revenue share model for subcontractors:
- **Option A:** Fixed hourly rate ($125-200/hr for engineers)
- **Option B:** Revenue share (60-70% to sub, 30-40% to you)
- **Option C:** Project-based flat fee (get a quote, add your 25% margin)

Recommendation: Start with Option A (hourly) until you know the subcontractor's quality. Switch to Option C (project-based) once you trust them — it's more predictable for your margins.

---

## 9. Emergency Procedures

### If a subcontractor leaves mid-project:

1. **Immediately notify the client** — transparency builds trust
2. **Invoke the resource replacement clause** in the contract (gives you 15 business days)
3. **Contact backup subcontractors** (always maintain a list of 2-3 alternatives)
4. **Provide a revised timeline** to the client
5. **Document everything** — dates, communications, impact assessment

### If a client threatens legal action:

1. **Do not admit fault** in any communication
2. **Review the contract** — check limitation of liability clause
3. **Document your performance** — every deliverable, email, and milestone
4. **Offer resolution** — "Let's discuss how to make this right"
5. **Consult a business attorney** (NC Bar referral service: 1-800-662-7660)
6. **Your contract limits liability to the contract value** — this protects you

### If you can't deliver on time:

1. **Notify client before the deadline** — never surprise them
2. **Explain the cause** (resource issue, technical complexity, etc.)
3. **Propose a revised timeline** with specific dates
4. **Offer a concession** if appropriate (small discount, extra deliverable)
5. **The force majeure clause covers** acts of God, but resource issues are covered by the resource replacement clause

---

## 10. Templates & Scripts

### Email: Response to Contact Form Submission

Subject: Your Free Cooling Efficiency Review — ThermaShift

> Hi [Name],
>
> Thanks for reaching out to ThermaShift. I reviewed your facility details — [X] racks at [Y] kW in [Location] with a PUE of [Z] — and I can already see some opportunities for significant savings.
>
> I'd love to schedule a quick 30-minute call to walk through a preliminary analysis. No sales pitch — just data.
>
> Are you available [Tuesday/Thursday] this week? Here's my calendar link: [insert link]
>
> Looking forward to it,
> Steve Betancur
> Founder, ThermaShift
> info@thermashift.net

### Email: Sending the Proposal

Subject: ThermaShift Proposal — [Company Name]

> Hi [Name],
>
> Great speaking with you [yesterday/on Tuesday]. As promised, I've attached our proposal for [service description].
>
> Quick summary:
> - [Service 1]: $[X]
> - [Service 2]: $[Y]/month
> - Total first-year value: $[Z]
>
> The proposal is valid for 30 days. Happy to jump on a call if you have questions or want to adjust the scope.
>
> Next steps: Review and sign at your convenience. Once signed, we can kick off within [X] days.
>
> Best,
> Steve

### Email: Client Onboarding

Subject: Welcome to ThermaShift — Getting Started

> Hi [Name],
>
> Welcome aboard! Here's everything you need to get started with ThermaShift monitoring:
>
> **Your credentials:**
> - Facility ID: [facility-id]
> - API Key: [api-key]
> - Polling interval: Every [X] minutes
>
> **Install the monitoring agent:**
> Follow the guide here: https://thermashift.net/agent/INSTALL.html
>
> **Quick install (one-liner):**
> [Insert OS-specific command]
>
> **What happens next:**
> 1. Install the agent on your servers (takes 5 minutes each)
> 2. Data will start flowing to your dashboard immediately
> 3. I'll review the initial data and send you a baseline report within 1 week
> 4. We'll schedule a kickoff call to review findings
>
> Questions? Reply to this email or call me at [phone].
>
> Steve Betancur
> Founder, ThermaShift

### Phone Script: Cold Call to Data Center

> "Hi [Name], this is Steve Betancur with ThermaShift. I help data center operators in the [Charlotte/Triangle/NoVA] area reduce cooling costs and monetize waste heat.
>
> I noticed [Company] has been [expanding/building/hiring for DC roles] and wanted to see if cooling efficiency is on your radar. We offer a free 30-minute cooling review — no obligation, just data.
>
> Would that be worth 30 minutes of your time this week?"

---

## Appendix: Key Industry Knowledge

### PUE Reference
- 1.0 = perfect (impossible)
- 1.1-1.2 = best in class (hyperscalers)
- 1.3-1.4 = good (modern colo)
- 1.5-1.6 = average
- 1.7+ = needs improvement

### Cooling Technology Comparison
| Tech | Max Rack Density | PUE Impact | Cost/Rack | Best For |
|---|---|---|---|---|
| Air + Containment | 15-20 kW | 1.3-1.5 | $500-2K | Legacy, low density |
| RDHX | 25-40 kW | 1.2-1.3 | $3K-8K | Retrofit, moderate density |
| Direct-to-Chip | 40-100 kW | 1.1-1.15 | $5K-15K | GPU/AI workloads |
| Immersion | 100-200+ kW | 1.02-1.06 | $10K-25K | Highest density |

### Key Regulations
- **EU Energy Efficiency Directive:** Mandates heat reuse from data centers by 2026
- **SEC Climate Disclosure:** Requires public companies to report climate risks
- **Germany Energy Efficiency Act:** DCs must achieve PUE ≤ 1.3 by 2030
- **ASHRAE TC 9.9:** Thermal guidelines for data centers (recommended inlet: 18-27°C)

### Competitor Pricing (for your reference only)
- Nlyte: $15-30/rack/month
- Sunbird dcTrack: $20-40/rack/month
- Schneider EcoStruxure: $50K-150K/year site license
- Your pricing: $10-18/rack/month (50% undercut)
