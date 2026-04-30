/**
 * One-shot outreach hygiene script — run on VPS:
 *   node server/fix-outreach.js [--dry-run]
 *
 * What it does:
 *  1. Pulls Resend's last 100 emails. For any with last_event=bounced, marks
 *     the matching outreach_prospect as opted_out and cancels their pending
 *     follow-up emails so we don't re-email a bouncing address.
 *  2. Replaces the research-style talking_points (which read like internal
 *     notes describing the prospect) with prospect-facing 1-2 sentence opening
 *     lines, keyed by linkedin_url.
 *  3. Reports counts.
 */
import 'dotenv/config';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const RESEND_KEY = process.env.RESEND_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

async function sb(table, method, body, query = '') {
  const r = await fetch(`${SUPABASE_URL}/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Prospect-facing rewrites — short, references public info, ends connects to ThermaShift.
const NEW_TALKING_POINTS = {
  'https://www.linkedin.com/in/ryan-mallory-3483504': "Congrats on the Flexential CEO appointment — with the Charlotte campus retrofitting for AI density, the Section 179D tax window (closing June 30) creates a real urgency for cooling efficiency upgrades.",
  'https://www.linkedin.com/in/thomas-bailey-00b68749': "Saw your move from Xcel to Flexential's VP Energy role — ThermaShift's playbook on Duke Energy efficiency rebates and 179D tax stacking might dovetail with what you're planning.",
  'https://www.linkedin.com/in/matthew-baumann-7369939': "Curious how Flexential's standardized expansion model is handling waste-heat monetization — could be $100K-1M/yr per site that's currently venting to atmosphere.",
  'https://www.linkedin.com/in/jominarik': "With your AWS DC infrastructure background, you've seen what AI thermal density does to cooling assumptions — happy to share what we're seeing across colo operators right now.",
  'https://www.linkedin.com/in/kevinooley': "Caught your asset-backed-securities talk — Section 179D ($1.88/sq ft retrofit deduction, expires June 30) might be a capital-efficient line for your 2026 cooling roadmap.",
  'https://www.linkedin.com/in/doug-fleit-298a891b': "With PowerHouse's University City campus pencilling out 300MW of AI capacity, the cooling decisions you make pre-design tend to compound — would love to share what we're seeing on liquid cooling economics.",
  'https://www.linkedin.com/in/karen-p-a33b22a2': "Your sustainability work at PowerHouse caught my eye — ThermaShift bundles ESG + waste-heat monetization for hyperscale builds, which could add a real revenue line to the Charlotte campus.",
  'https://www.linkedin.com/in/andrewschaap1': "Aligned's adaptive infrastructure positioning is exactly where AI thermal intelligence lands — happy to share what we're seeing on cooling efficiency in the AI era.",
  'https://www.linkedin.com/in/brad-hefner-31098327': "With Google's $1B NC investment landing at Lenoir, Duke's renewable-large-customer program creates some interesting stacking opportunities with Section 179D efficiency deductions.",
  'https://www.linkedin.com/in/brandon-keesee-71524a73': "Apple's Maiden expansion is a great case study in renewable + circular economy at scale — ThermaShift's waste-heat monetization could add a revenue line to that ethos.",
  'https://www.linkedin.com/in/kelley-mccall-27b10a175': "With Meta's water stewardship and renewable commitments at Forest City, ThermaShift's ESG + waste-heat services could help quantify that sustainability story for stakeholders.",
  'https://www.linkedin.com/in/cary-bolt-fmp-37962233': "Saw your facilities work at Forest City — happy to share what we're seeing on hot-aisle thermal intelligence for hyperscale ops if you're piloting anything new.",
  'https://www.linkedin.com/in/taylor-thompson-rmf': "RMF's Charlotte commissioning practice is the perfect partner for thermal intelligence — we'd love to be the analytics layer on top of your mission-critical work.",
  'https://www.linkedin.com/in/matthew-boatwright-pe-5a0ba488': "Your Raleigh campus utility work maps straight to Section 179D-eligible cooling upgrades (deduction expires June 30) — could be worth comparing notes on.",
  'https://www.linkedin.com/in/mitchell-bowker': "Saw you're with RMF NC — with Section 179D's June 30 deadline, NC data center cooling retrofits are a hot zone for stackable tax + utility incentives right now.",
  'https://www.linkedin.com/in/samskhalilieh': "Caught your piece on innovative energy sources for AI data centers — ThermaShift could partner with Tetra Tech's NC clients on the thermal intelligence and cooling layer.",
  'https://www.linkedin.com/in/danrakes': "Henderson's NC mission-critical pipeline is exactly where ThermaShift adds value as a specialist thermal partner — open to a quick chat to see if there's a fit?",
  'https://www.linkedin.com/in/charlotte-lamping-nyc': "Henderson Engineers' national mission-critical book has lots of NC-adjacent work — ThermaShift can be your local cooling specialist on those projects.",
  'https://www.linkedin.com/in/jason-spencer-49a1aa99': "With Vertiv's Strategic Thermal Labs acquisition, the liquid-cooling stack is getting a workout — ThermaShift's CaaS could be the install and managed-service layer for your NC pipeline.",
  'https://www.linkedin.com/in/jerailey': "Vertiv's new Carolinas factory-direct office puts you right in our backyard — ThermaShift could be a local services partner on cooling deployments.",
  'https://www.linkedin.com/in/scott-capps-5a235a30': "TierPoint's NC footprint (Charlotte + Raleigh) makes you a natural fit for stacking Duke Energy efficiency rebates with Section 179D — happy to walk through a case study.",
  'https://www.linkedin.com/in/david-dunn-3143a21': "H5's University Research Park campus on Duke Energy is in the sweet spot for stacking efficiency rebates with 179D tax deductions — could be worth 15 minutes to walk through.",
  'https://www.linkedin.com/in/williamcjohnson1': "With 30+ years in DC mechanical/electrical, you've probably seen every cooling architecture — ThermaShift's intelligence layer might be useful for benchmarking the Charlotte campus against peers.",
  'https://www.linkedin.com/in/eric-wilcox-14a0501': "Tract's Mooresville campus pre-design is the sweet spot for thermal intelligence and waste-heat monetization — would love to share what we're seeing on hyperscale cooling economics.",
  'https://www.linkedin.com/in/nat-sahlstrom-4837a85': "With your Amazon renewables background, you know how energy strategy compounds in early design — ThermaShift's thermal layer plugs into that same logic for cooling and waste heat.",
  'https://www.linkedin.com/in/grantvanrooyen': "Tract's NC campus is in pre-design — the cooling and thermal intelligence layer is where ThermaShift can add the most value before first power.",
};

function normalizeUrl(u) {
  if (!u) return '';
  return String(u).replace(/^http:/, 'https:').replace(/\/$/, '').toLowerCase();
}

async function main() {
  console.log(`\n▶ Outreach hygiene fix ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

  // ─── 1. Find bounces from Resend ──────────────────────────
  console.log('— Step 1: query Resend for bounced emails —');
  const resendRes = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const resendData = await resendRes.json();
  const items = resendData.data || resendData;
  const bounced = items.filter(e => e.last_event === 'bounced' && (e.from || '').includes('steve@'));
  console.log(`  Resend reports ${bounced.length} bounce(s) from steve@`);

  let optedOut = 0, followupsCancelled = 0;
  for (const b of bounced) {
    const email = (b.to || [])[0] || '';
    if (!email) continue;
    console.log(`  bounced: ${email} (id=${b.id})`);
    if (DRY_RUN) continue;
    // Mark prospect opted_out
    const r1 = await sb('outreach_prospects', 'PATCH',
      { status: 'opted_out', notes: 'auto-marked: bounced delivery', updated_at: new Date().toISOString() },
      `?email=eq.${encodeURIComponent(email.toLowerCase())}`);
    if (r1?.length) optedOut += r1.length;
    // Cancel pending follow-ups for this email
    const r2 = await sb('outreach_emails', 'PATCH',
      { status: 'skipped' },
      `?prospect_email=eq.${encodeURIComponent(email.toLowerCase())}&status=eq.pending`);
    if (r2?.length) followupsCancelled += r2.length;
  }
  console.log(`  → opted_out=${optedOut}, follow-ups cancelled=${followupsCancelled}`);

  // ─── 2. Rewrite bad talking_points ────────────────────────
  console.log('\n— Step 2: rewrite research-style talking_points to prospect-facing —');
  const prospects = await sb('outreach_prospects', 'GET', null,
    '?select=id,linkedin_url,first_name,last_name,company,talking_point&limit=500');

  let updated = 0, matched = 0;
  for (const p of prospects) {
    const key = normalizeUrl(p.linkedin_url);
    if (!key) continue;
    const newTP = NEW_TALKING_POINTS[key] || NEW_TALKING_POINTS[`https://${key.replace(/^https?:\/\//, '')}`];
    if (!newTP) continue;
    matched++;
    if (p.talking_point === newTP) continue;
    if (DRY_RUN) {
      console.log(`  WOULD UPDATE ${p.first_name} ${p.last_name} (${p.company})`);
      continue;
    }
    await sb('outreach_prospects', 'PATCH',
      { talking_point: newTP, updated_at: new Date().toISOString() },
      `?id=eq.${p.id}`);
    updated++;
  }
  console.log(`  → matched=${matched}, updated=${updated}`);

  // ─── 3. Summary ────────────────────────────────────────────
  console.log('\n— Done —');
  console.log(`  Bounced opted_out:     ${optedOut}`);
  console.log(`  Follow-ups cancelled:  ${followupsCancelled}`);
  console.log(`  Talking_points matched: ${matched}`);
  console.log(`  Talking_points updated: ${updated}`);
  console.log(`\n  When ready to resume: set OUTREACH_PAUSED=0 in .env, then 'pm2 restart thermashift --update-env'`);
}

main().catch(e => { console.error(e); process.exit(1); });
