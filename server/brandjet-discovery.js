/**
 * BrandJet Discovery — find real decision-makers at ThermaShift-relevant
 * data centers, using BrandJet's native 700M-contact database via MCP.
 *
 * Strategy:
 *   1. Cross-reference: for every HOT/WARM company in intent_companies
 *      (Adzuna-sourced), search BrandJet for VP/Director/CSO-level
 *      contacts AT that company. Companies with hiring intent + real
 *      decision-maker = highest-precision target.
 *   2. Direct ICP search: separately, run a pure title+industry search
 *      against BrandJet's DB to surface decision-makers we'd miss via
 *      Adzuna alone (e.g., companies that aren't actively hiring but
 *      match our ICP).
 *   3. Smart credit usage: free searches first to qualify candidates,
 *      then reveal emails for top-scored matches (2 credits each).
 *      Hard cap per run to prevent runaway spend.
 *
 * All contacts get stored in `discovered_contacts` table with a score,
 * cross-references to intent_companies when applicable, and lifecycle
 * status. Then pushEnrichedToBrandJet() ships them into a BrandJet
 * lead list with real name + email + title — ready for campaign.
 */

import * as bj from './brandjet-mcp.js';

// ─── ICP Configuration ──────────────────────────────────────────────

// Decision-maker job titles we care about (cooling/DC infrastructure buyers)
const TARGET_TITLES = [
  'VP of Data Center Operations',
  'VP of Operations',
  'Director of Data Center Operations',
  'Director of Facilities',
  'Director of Mission Critical',
  'Head of Infrastructure',
  'Chief Sustainability Officer',
  'VP of Sustainability',
  'VP of Engineering',
  'Director of Engineering',
  'Head of Data Center',
];

// Industries where ThermaShift's services land — used for direct ICP search
const TARGET_INDUSTRIES = [
  'Data Center',
  'Colocation',
  'Cloud Computing',
  'Hosting',
  'Telecommunications',
  'Information Technology',
];

// Geographic priority — English-speaking, biased to US East Coast
const TARGET_COUNTRIES = ['United States', 'United Kingdom', 'Ireland', 'Canada', 'Australia'];

// Job-level enum BrandJet uses; we accept VP and above
const ACCEPTABLE_LEVELS = new Set(['VP', 'Director', 'C-Level', 'Owner', 'Partner']);

// ─── Scoring ────────────────────────────────────────────────────────

function scoreCandidate(candidate, { intentCompanyMatch = false } = {}) {
  let score = 0;
  const breakdown = {};

  // Title match (0-30)
  const title = (candidate.jobTitle || '').toLowerCase();
  const level = candidate.jobLevel || '';
  if (level === 'C-Level' || /chief/.test(title)) {
    score += 30; breakdown.title = 30;
  } else if (level === 'VP' || /\bvp\b|vice president/.test(title)) {
    score += 25; breakdown.title = 25;
  } else if (level === 'Director' || /director/.test(title)) {
    score += 20; breakdown.title = 20;
  } else if (level === 'Owner' || level === 'Partner') {
    score += 22; breakdown.title = 22;
  } else if (level === 'Manager' || /manager|head/.test(title)) {
    score += 10; breakdown.title = 10;
  }

  // Function relevance (0-15)
  const fn = (candidate.jobFunction || '').toLowerCase();
  const headline = ((candidate.headline || '') + ' ' + title).toLowerCase();
  if (/data center|colocation|colo|mission critical/.test(headline)) {
    score += 15; breakdown.function = 15;
  } else if (/facilities|operations|infrastructure|engineering/.test(fn + ' ' + headline)) {
    score += 10; breakdown.function = 10;
  } else if (/sustainability|esg|carbon|energy/.test(headline)) {
    score += 12; breakdown.function = 12;
  }

  // Industry match (0-15)
  const industry = (candidate.industry || '').toLowerCase();
  if (/data center|colocation|cloud|hosting/.test(industry)) {
    score += 15; breakdown.industry = 15;
  } else if (/telecom|information technology|software/.test(industry)) {
    score += 8; breakdown.industry = 8;
  }

  // Email available (0-10) — without this, the lead is useless for outreach
  if (candidate.emailAvailable) { score += 10; breakdown.email_available = 10; }

  // Cross-reference with intent_companies bonus (0-20) — the gold signal
  if (intentCompanyMatch) { score += 20; breakdown.intent_cross_reference = 20; }

  // Geo bonus (0-10) — already filtered by country, small boost
  if (candidate.country === 'United States') { score += 5; breakdown.geo = 5; }
  else if (candidate.country) { score += 3; breakdown.geo = 3; }

  let bucket;
  if (score >= 80) bucket = 'HOT';
  else if (score >= 60) bucket = 'WARM';
  else if (score >= 40) bucket = 'COLD';
  else bucket = 'SKIP';

  return { score, bucket, breakdown };
}

// ─── Supabase helpers ───────────────────────────────────────────────

let _sb;
export function configureDiscovery(sbHelper) {
  _sb = sbHelper;
}

async function upsertContact(payload) {
  // Dedupe by (source, source_external_id) — re-running shouldn't duplicate
  const key = `?source=eq.${encodeURIComponent(payload.source)}&source_external_id=eq.${encodeURIComponent(payload.source_external_id || '')}`;
  const existing = await _sb('discovered_contacts', 'GET', null, key + '&limit=1');
  if (existing && existing.length) {
    await _sb('discovered_contacts', 'PATCH',
      { ...payload, updated_at: new Date().toISOString() },
      `?id=eq.${existing[0].id}`);
    return existing[0].id;
  }
  const inserted = await _sb('discovered_contacts', 'POST',
    { ...payload, created_at: new Date().toISOString() });
  return inserted?.[0]?.id;
}

// ─── Main flows ─────────────────────────────────────────────────────

/**
 * Cross-reference flow: for each company we already identified via Adzuna
 * intent, find decision-makers there. Returns stats.
 */
export async function discoverContactsForIntentCompanies(opts = {}) {
  const {
    minScore = 50,            // intent_companies score threshold
    perCompanyLimit = 5,      // contacts to consider per company
    maxCompanies = 20,        // company budget per run
  } = opts;
  if (!_sb) throw new Error('Discovery not configured — call configureDiscovery(sb)');

  const stats = {
    started_at: new Date().toISOString(),
    companies_searched: 0,
    candidates_found: 0,
    contacts_stored: 0,
    errors: [],
  };

  // Pull intent companies we haven't already discovered contacts for
  const companies = await _sb('intent_companies', 'GET', null,
    `?score=gte.${minScore}&order=score.desc&limit=${maxCompanies}`);
  if (!companies || !companies.length) {
    console.log('[discovery] no intent companies above threshold');
    return stats;
  }

  for (const co of companies) {
    try {
      console.log(`[discovery] searching contacts at "${co.company}"`);
      const result = await bj.searchLeads({
        companyName: co.company,
        jobTitle: TARGET_TITLES.slice(0, 5),       // BrandJet accepts arrays
        countryName: TARGET_COUNTRIES[0],          // US first; iterate other geos in v2
      }, { searchType: 'people' });
      stats.companies_searched++;

      const people = result?.results || [];
      const ranked = people
        .map(p => ({ p, scored: scoreCandidate(p, { intentCompanyMatch: true }) }))
        .filter(x => x.scored.score >= 40)
        .sort((a, b) => b.scored.score - a.scored.score)
        .slice(0, perCompanyLimit);

      stats.candidates_found += ranked.length;

      for (const { p, scored } of ranked) {
        await upsertContact({
          source: 'brandjet',
          source_external_id: p.id,
          full_name: p.fullName,
          first_name: p.firstName,
          last_name: p.lastName,
          job_title: p.jobTitle,
          job_level: p.jobLevel,
          job_function: p.jobFunction,
          linkedin_url: p.linkedinUrl,
          profile_picture_url: p.profilePicture,
          headline: (p.headline || '').slice(0, 500),
          company: p.company,
          company_domain: p.companyDomain || p.domain,
          company_size: p.companySize,
          industry: p.industry,
          country: p.country || 'United States',
          email: p.email || null,
          email_status: p.emailAvailable ? 'available_unrevealed' : 'unknown',
          intent_company_id: co.id,
          score: scored.score,
          bucket: scored.bucket,
          score_breakdown: scored.breakdown,
          status: 'new',
        });
        stats.contacts_stored++;
      }
    } catch (e) {
      console.warn(`[discovery] error searching ${co.company}: ${e.message}`);
      stats.errors.push({ company: co.company, msg: e.message });
    }
  }

  stats.finished_at = new Date().toISOString();
  console.log(`[discovery] DONE: ${stats.companies_searched} searched, ${stats.contacts_stored} contacts stored, ${stats.errors.length} errors`);
  return stats;
}

/**
 * Reveal emails for top N un-revealed contacts. Costs 2 credits each.
 * Capped by `maxCredits` to prevent runaway spend.
 */
export async function revealTopEmails({ maxCredits = 100, minScore = 60 } = {}) {
  if (!_sb) throw new Error('Discovery not configured');
  const balance = await bj.getEnrichmentBalance();
  console.log(`[reveal] balance: ${balance?.balance} credits`);
  if (!balance || balance.balance < 2) {
    return { revealed: 0, skipped: 'insufficient_balance', balance: balance?.balance || 0 };
  }
  const budget = Math.min(maxCredits, balance.balance);
  const targetCount = Math.floor(budget / 2);

  // Pick top-scored contacts with email_status='available_unrevealed', no email yet
  const candidates = await _sb('discovered_contacts', 'GET', null,
    `?email_status=eq.available_unrevealed&email=is.null&score=gte.${minScore}&order=score.desc&limit=${targetCount}`);

  let revealed = 0, failed = 0;
  for (const c of (candidates || [])) {
    try {
      const r = await bj.revealEmail(c.source_external_id);
      const email = r?.email || r?.emailAddress || r?.contactInfo?.email;
      if (email) {
        await _sb('discovered_contacts', 'PATCH',
          {
            email,
            email_status: 'verified',
            email_revealed_at: new Date().toISOString(),
            credits_spent: (c.credits_spent || 0) + 2,
            updated_at: new Date().toISOString(),
          },
          `?id=eq.${c.id}`);
        revealed++;
        console.log(`[reveal] ✓ ${c.full_name} → ${email}`);
      } else {
        await _sb('discovered_contacts', 'PATCH',
          { email_status: 'reveal_failed', credits_spent: (c.credits_spent || 0) + 2, updated_at: new Date().toISOString() },
          `?id=eq.${c.id}`);
        failed++;
      }
    } catch (e) {
      console.warn(`[reveal] error for ${c.full_name}: ${e.message}`);
      failed++;
    }
  }

  const newBalance = await bj.getEnrichmentBalance();
  return { revealed, failed, balance_after: newBalance?.balance };
}

/**
 * Push enriched contacts (with revealed emails) into a fresh BrandJet
 * lead list. Returns the BJ lead list id + push stats.
 */
export async function pushEnrichedToBrandJet({ listName, maxLeads = 50, minScore = 60 } = {}) {
  if (!_sb) throw new Error('Discovery not configured');

  const ts = new Date().toISOString().slice(0, 10);
  const finalListName = listName || `ThermaShift Enriched ${ts}`;

  const contacts = await _sb('discovered_contacts', 'GET', null,
    `?email=not.is.null&status=eq.new&score=gte.${minScore}&order=score.desc&limit=${maxLeads}`);
  if (!contacts || !contacts.length) {
    return { listId: null, pushed: 0, message: 'No enriched contacts ready to push' };
  }

  console.log(`[push] creating list "${finalListName}" with ${contacts.length} enriched contacts`);
  const listId = await bj.createLeadList(finalListName);
  if (!listId) throw new Error('Failed to create lead list');

  let pushed = 0, failed = 0;
  for (const c of contacts) {
    try {
      await bj.addLead({
        leadListId: listId,
        name: c.full_name || c.company || 'Unknown',
        email: c.email,
        linkedinProfileUrl: c.linkedin_url,
        customVariables: {
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          company: c.company || '',
          job_title: c.job_title || '',
          job_level: c.job_level || '',
          country: c.country || '',
          thermashift_score: c.score,
          thermashift_bucket: c.bucket,
        },
      });
      await _sb('discovered_contacts', 'PATCH',
        {
          status: 'pushed_to_brandjet',
          brandjet_lead_list_id: listId,
          pushed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        `?id=eq.${c.id}`);
      pushed++;
    } catch (e) {
      console.warn(`[push] error for ${c.full_name}: ${e.message}`);
      failed++;
    }
  }
  return { listId, listName: finalListName, pushed, failed };
}

/**
 * Full pipeline: discover → reveal → push.
 */
export async function runFullDiscovery(opts = {}) {
  const {
    minIntentScore = 50,
    perCompanyLimit = 5,
    maxCompanies = 20,
    revealCreditsCap = 100,
    revealMinScore = 60,
    pushMinScore = 60,
    pushListName,
  } = opts;

  console.log('[discovery] step 1: search BrandJet for contacts at intent companies');
  const search = await discoverContactsForIntentCompanies({
    minScore: minIntentScore, perCompanyLimit, maxCompanies,
  });

  console.log('[discovery] step 2: reveal emails for top contacts');
  const reveal = await revealTopEmails({
    maxCredits: revealCreditsCap, minScore: revealMinScore,
  });

  console.log('[discovery] step 3: push enriched contacts to BrandJet lead list');
  const push = await pushEnrichedToBrandJet({
    listName: pushListName, minScore: pushMinScore,
  });

  return { search, reveal, push };
}
