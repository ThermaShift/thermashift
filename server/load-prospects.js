// One-shot script to load Apollo CSV + research JSON into outreach_prospects.
// Run: node server/load-prospects.js [--dry-run]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const DRY_RUN = process.argv.includes('--dry-run');

// Real RFC 4180 CSV parser — handles quoted fields with commas and embedded newlines.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

// Company → talking point fallback when prospect not in research list.
const COMPANY_TALKING_POINTS = {
  'Flexential': "Flexential operates a 229,000+ sq ft Charlotte facility and is actively retrofitting for AI cooling density — Section 179D tax deductions on cooling efficiency upgrades expire June 30, 2026.",
  'DataBank': "DataBank is expanding aggressively across the Southeast and the 179D June 30 tax-deduction window creates real urgency for any 2026 cooling retrofit.",
  'PowerHouse Data Centers': "PowerHouse is building a 2.5M sq ft, 300MW campus on University City Blvd in Charlotte — first AI-tailored cooling decisions are being made now and ThermaShift's liquid-cooling-as-a-service maps directly to that workload profile.",
  'Aligned Data Centers': "Aligned positions itself on adaptive, sustainable infrastructure — ThermaShift's AI thermal-intelligence dashboard and waste-heat monetization fit your stated brand promise.",
  'Google': "Google announced a $1B NC investment in March 2026 for the Lenoir expansion, with stated commitments to renewable-large-customer programs — ThermaShift's Duke Energy incentive playbook applies directly.",
  'Apple': "Apple just put $175M into expanding the Maiden NC campus and your 100% renewable + circular-economy mandate aligns with ThermaShift's waste-heat monetization business.",
  'Meta': "Meta's Forest City NC campus operates under your stated water stewardship and renewable energy commitments — ThermaShift's ESG pillar maps directly to that brand.",
  'RMF Engineering': "RMF's NC offices are one of the most concentrated MEP/data-center engineering benches in the state — ThermaShift can be the thermal-intelligence layer on top of your commissioning work.",
  'Tetra Tech': "Tetra Tech is publicly speaking on innovative energy sources for AI data centers — partnering with ThermaShift as your thermal-intelligence subcontractor would scale faster than direct sales.",
  'Henderson Building Solutions': "Henderson is actively engaged in NC's data-center growth — partnership channel for thermal commissioning with ThermaShift as a specialist subcontractor.",
  'Henderson Engineers': "Henderson Engineers' mission-critical practice is national, but with no NC office, ThermaShift can be your trusted partner on ground in Charlotte / Triangle.",
  'Vertiv': "Vertiv just acquired Strategic Thermal Labs (2026) to deepen liquid-cooling — co-selling ThermaShift's CaaS with Vertiv's hardware would let you book NC deals your direct team can't service alone.",
  'TierPoint': "TierPoint operates 2 Charlotte (Center Park, North Myers) + 2 Raleigh facilities — ThermaShift's NC focus + Duke Energy efficiency incentives apply automatically across that footprint.",
  'H5 Data Centers': "H5's 207,000 sq ft Charlotte campus on David Taylor Drive is directly powered by Duke Energy — Duke incentives + 179D tax deductions apply almost line-for-line to any 2026 cooling improvement.",
  'Tract': "Tract's 400-acre Mooresville (30 min north of Charlotte) campus is in pre-design — exactly when ThermaShift's thermal intelligence layer adds the most value.",
  'Tract / Fleet Data Centers': "Tract/Fleet's 400-acre Mooresville (30 min north of Charlotte) campus is pre-design phase — first power 2029, sustainability decisions are being locked in now.",
  'Tract Capital / Fleet Data Centers': "Tract/Fleet's 400-acre Mooresville campus near Charlotte is pre-design — CEO-level conversation about platform-wide thermal-intelligence partnerships.",
  'Schneider Electric': "Schneider Electric's NC channel reps frequently encounter cooling efficiency gaps that warrant a specialist — ThermaShift can be your trusted local partner on cooling-specific opportunities.",
  'Compass Datacenters': "Compass operates several Southeast campuses and the Section 179D tax deduction window (expires June 30, 2026) makes any 2026 cooling efficiency upgrade tax-advantaged.",
};

const DEFAULT_TALKING_POINT =
  "Most data centers we analyze leave $200K-$500K/year on the table from cooling inefficiency alone — and Section 179D tax deductions for energy-efficient upgrades expire June 30, 2026.";

function inferRegion(state, city) {
  const ncCities = /charlotte|raleigh|durham|greensboro|winston|cary|asheville|maiden|lenoir|forest city|mooresville|huntersville|concord|harrisburg/i;
  const scCities = /york|rock hill|columbia|charleston|greenville/i;
  if (state === 'North Carolina' || ncCities.test(city || '')) return 'North Carolina';
  if (state === 'South Carolina' || scCities.test(city || '')) return 'South Carolina';
  return 'Southeast US';
}

async function sb(table, method, body, query = '') {
  const url = `${SUPABASE_URL}/${table}${query}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const csvText = fs.readFileSync(path.join(ROOT, 'apollo-contacts-export.csv'), 'utf8');
  const apollo = parseCSV(csvText);
  console.log(`Apollo rows: ${apollo.length}`);

  let research = [];
  try {
    research = JSON.parse(fs.readFileSync(path.join(ROOT, 'prospects-research.json'), 'utf8'));
  } catch { /* missing is fine */ }
  console.log(`Research rows: ${research.length}`);

  // Build research lookup by full name (lowercased) and by linkedin URL
  const researchByName = new Map();
  const researchByLinkedIn = new Map();
  for (const r of research) {
    const k = `${r.first_name} ${r.last_name}`.trim().toLowerCase();
    researchByName.set(k, r);
    if (r.linkedin_url) researchByLinkedIn.set(r.linkedin_url.replace(/\/$/, ''), r);
  }

  // Build prospect records
  const prospects = [];
  let skippedNoEmail = 0;
  let skippedNotVerified = 0;
  let skippedGeneric = 0;
  let matchedResearch = 0;

  for (const row of apollo) {
    const email = (row['Email'] || '').trim().toLowerCase();
    if (!email) { skippedNoEmail++; continue; }
    if (row['Email Status'] && row['Email Status'] !== 'Verified') { skippedNotVerified++; continue; }
    if (/^(info|support|sales|hello|admin|noreply|no-reply|contact)@/.test(email)) { skippedGeneric++; continue; }

    const first = (row['First Name'] || '').trim();
    const last = (row['Last Name'] || '').trim();
    const company = (row['Company Name'] || '').trim();
    const title = (row['Title'] || '').trim();
    const li = (row['Person Linkedin Url'] || '').trim().replace(/\/$/, '');
    const state = (row['State'] || '').trim();
    const city = (row['City'] || '').trim();

    // Match research first by linkedin, then by name
    const researchHit = researchByLinkedIn.get(li) || researchByName.get(`${first} ${last}`.toLowerCase());
    if (researchHit) matchedResearch++;

    const talking_point = researchHit?.talking_point || COMPANY_TALKING_POINTS[company] || DEFAULT_TALKING_POINT;

    prospects.push({
      email,
      first_name: first,
      last_name: last,
      company,
      title,
      linkedin_url: li,
      region: researchHit?.region || inferRegion(state, city),
      talking_point,
      source: 'apollo+research',
      status: 'queued',
    });
  }

  console.log(`\n— Filter summary —`);
  console.log(`  skipped no_email:     ${skippedNoEmail}`);
  console.log(`  skipped not_verified: ${skippedNotVerified}`);
  console.log(`  skipped generic:      ${skippedGeneric}`);
  console.log(`  matched research:     ${matchedResearch}`);
  console.log(`  ready to load:        ${prospects.length}\n`);

  if (DRY_RUN) {
    console.log(`— DRY RUN — first 3 prospects —`);
    for (const p of prospects.slice(0, 3)) console.log(JSON.stringify(p, null, 2));
    return;
  }

  // Sort: research-matched first (better talking points), then by tier-1 NC presence,
  // then everyone else. This puts the strongest first-day impressions at the front of the queue.
  prospects.sort((a, b) => {
    const aResearch = a.source === 'apollo+research' && /\b(tier-1|Charlotte NC|Triangle NC|Western NC)/i.test(a.region) ? 0 : 1;
    const bResearch = b.source === 'apollo+research' && /\b(tier-1|Charlotte NC|Triangle NC|Western NC)/i.test(b.region) ? 0 : 1;
    if (aResearch !== bResearch) return aResearch - bResearch;
    return 0;
  });

  // Stagger day-1 sends across 4 days. Each day's batch fires inside a 2-hour window
  // (1pm-3pm EST = 17:00-19:00 UTC) — strong B2B response window, avoids early-morning queue.
  const PER_DAY = Math.ceil(prospects.length / 4);
  const WINDOW_MS = 2 * 60 * 60 * 1000;
  const SLOT_GAP_MS = WINDOW_MS / Math.max(PER_DAY, 1);

  function dayWindowStart(dayOffset) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(17, 0, 0, 0); // 1pm EST / 12pm CST / 10am PST
    // If we're already past 1pm EST today, push the first sends 30 min from now
    const now = Date.now();
    if (dayOffset === 0 && d.getTime() < now + 30 * 60 * 1000) return now + 30 * 60 * 1000;
    return d.getTime();
  }

  let added = 0, skipped = 0, errored = 0;

  for (let i = 0; i < prospects.length; i++) {
    const p = prospects[i];
    const dayOffset = Math.floor(i / PER_DAY);
    const slotIndex = i % PER_DAY;
    const day1At = dayWindowStart(dayOffset) + slotIndex * SLOT_GAP_MS;
    const day3At = day1At + 3 * 24 * 60 * 60 * 1000;
    const day7At = day1At + 7 * 24 * 60 * 60 * 1000;

    try {
      const existing = await sb('outreach_prospects', 'GET', null,
        `?email=eq.${encodeURIComponent(p.email)}&limit=1`);
      if (existing?.length > 0) { skipped++; continue; }

      const saved = await sb('outreach_prospects', 'POST', { ...p, created_at: new Date().toISOString() });
      const prospectId = saved?.[0]?.id;

      const sequence = [
        { template: 'cold_intro',     scheduled_at: new Date(day1At).toISOString() },
        { template: 'cold_followup_1', scheduled_at: new Date(day3At).toISOString() },
        { template: 'cold_followup_2', scheduled_at: new Date(day7At).toISOString() },
      ];
      for (const step of sequence) {
        await sb('outreach_emails', 'POST', {
          prospect_id: prospectId,
          prospect_email: p.email,
          template: step.template,
          scheduled_at: step.scheduled_at,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
      added++;
      if (added % 10 === 0) console.log(`  loaded ${added}/${prospects.length}…`);
    } catch (err) {
      errored++;
      console.error(`  error on ${p.email}:`, err.message);
    }
  }

  console.log(`\n— Done —`);
  console.log(`  added:   ${added}`);
  console.log(`  skipped: ${skipped} (already existed)`);
  console.log(`  errored: ${errored}`);
}

main().catch(e => { console.error(e); process.exit(1); });
