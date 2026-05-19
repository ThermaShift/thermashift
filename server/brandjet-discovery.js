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

// Geographic priority — countries where ENGLISH is the primary national
// language, plus UAE (Dubai) as an explicit exception per Steve: desert
// climate makes cooling critical and English is the de-facto business
// language despite Arabic being the official one.
//
// Strict English-primary:
//   United States, United Kingdom, Ireland, Canada, Australia, New Zealand
// Steve-approved exception:
//   United Arab Emirates (Dubai's DC industry)
const TARGET_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Ireland',
  'Canada',
  'Australia',
  'New Zealand',
  'United Arab Emirates',
];

// Post-filter: BrandJet's countryName search filter has some leakage —
// occasionally returns people whose listed country is outside the search
// region (often because they work for a multinational based elsewhere).
// We apply this set to the candidate's `country` field as a hard gate.
const ALLOWED_CANDIDATE_COUNTRIES = new Set([
  'united states', 'usa', 'us',
  'united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales', 'northern ireland',
  'ireland',
  'canada',
  'australia',
  'new zealand',
  'united arab emirates', 'uae', 'dubai',
]);

// 2-letter country-code TLDs that map to our allowed countries — used as a
// fallback signal when the `country` field is missing. Any other ccTLD is
// treated as a foreign-country signal and rejected.
const ALLOWED_COUNTRY_TLDS = new Set([
  'us',         // United States
  'uk', 'gb',   // United Kingdom
  'ie',         // Ireland
  'ca',         // Canada
  'au',         // Australia
  'nz',         // New Zealand
  'ae',         // United Arab Emirates
]);

// Generic / commercial TLDs that don't signal geography. Used to distinguish
// "this is a global .com" (allow) from "this is a .de German company" (reject)
// when the country field on the BrandJet record is empty.
const GENERIC_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  'biz', 'info', 'name', 'pro', 'mobi',
  'io', 'co', 'ai', 'app', 'dev', 'tech', 'cloud', 'inc', 'ltd',
  'xyz', 'online', 'site', 'store', 'global',
]);

function extractTLD(domain) {
  if (!domain) return null;
  const clean = String(domain).toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  const parts = clean.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

function allowedCandidateCountry(country, domain) {
  // Primary signal: explicit country field
  if (country) {
    return ALLOWED_CANDIDATE_COUNTRIES.has(String(country).toLowerCase().trim());
  }
  // Fallback when country is null/empty: infer from email/company domain TLD.
  // - 2-letter ccTLD (e.g. .de, .fi, .ee, .sa) must be in our allow list
  // - Generic TLDs (.com, .org, .io, ...) are ambiguous → allow
  // - No domain at all → allow (rare, can't infer)
  const tld = extractTLD(domain);
  if (!tld) return true;
  if (GENERIC_TLDS.has(tld)) return true;
  if (tld.length === 2) return ALLOWED_COUNTRY_TLDS.has(tld);
  // Unknown long TLD → conservative allow (assume new gTLD)
  return true;
}

// Job-level enum BrandJet uses; we accept VP and above
const ACCEPTABLE_LEVELS = new Set(['VP', 'Director', 'C-Level', 'Owner', 'Partner']);

// ─── Scoring ────────────────────────────────────────────────────────

// Headline / job-title keywords that signal ACTIVE investment focus areas.
// These boost the score because they tell us this person is currently
// working on something relevant to ThermaShift's services.
const HEADLINE_BOOST_KEYWORDS = [
  // Jackpot — Section 179D / PFAS migration are direct service-line matches
  { kw: 'section 179d', points: 8 },
  { kw: '179d', points: 8 },
  { kw: 'pfas', points: 8 },
  { kw: 'novec', points: 6 },
  { kw: 'fluorinert', points: 6 },
  // Strong — active AI/GPU buildout
  { kw: 'ai infrastructure', points: 5 },
  { kw: 'gpu', points: 4 },
  { kw: 'liquid cooling', points: 5 },
  { kw: 'direct-to-chip', points: 5 },
  { kw: 'immersion cooling', points: 5 },
  // Solid — active growth / capex signal
  { kw: 'expansion', points: 3 },
  { kw: 'scaling', points: 3 },
  { kw: 'new build', points: 3 },
  { kw: 'pre-construction', points: 3 },
  // Sustainability — ESG-driven buyers
  { kw: 'sustainability', points: 3 },
  { kw: 'carbon neutral', points: 4 },
  { kw: 'net zero', points: 4 },
  { kw: 'esg', points: 3 },
  { kw: 'pue', points: 3 },
  { kw: 'wue', points: 3 },
];
const HEADLINE_BOOST_CAP = 12;

function parseCompanySize(sizeStr) {
  // BrandJet `companySize` can be a number string ("9", "379") or a range string ("11-50")
  if (!sizeStr) return null;
  const s = String(sizeStr).trim();
  if (/^\d+$/.test(s)) return parseInt(s);
  const m = s.match(/^(\d+)\s*[-–]\s*(\d+)/);
  if (m) return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2);
  // "501-1000" or "1000+" patterns
  const m2 = s.match(/^(\d+)\+/);
  if (m2) return parseInt(m2[1]) * 2;
  return null;
}

function scoreCompanySize(sizeStr) {
  const size = parseCompanySize(sizeStr);
  if (size === null) return { points: 0, label: 'unknown' };

  // Mid-market sweet spot: 50-2000 employees → +10
  if (size >= 50 && size <= 2000) return { points: 10, label: `mid-market (${size})` };
  // Large but still addressable: 2000-10000 → +5
  if (size > 2000 && size <= 10000) return { points: 5, label: `large (${size})` };
  // Enterprise: 10001-100000 → 0
  if (size > 10000 && size <= 100000) return { points: 0, label: `enterprise (${size})` };
  // Hyperscaler / mega-corp penalty: >100000
  if (size > 100000) return { points: -15, label: `hyperscaler (${size})` };
  // Too small to have meaningful infrastructure budget: <50
  return { points: -5, label: `too-small (${size})` };
}

function scoreHeadlineKeywords(candidate) {
  const text = [
    candidate.headline || '',
    candidate.jobTitle || '',
    candidate.company || '',
  ].join(' ').toLowerCase();
  let total = 0;
  const matches = [];
  for (const { kw, points } of HEADLINE_BOOST_KEYWORDS) {
    if (text.includes(kw)) {
      total += points;
      matches.push(kw);
    }
  }
  return { points: Math.min(HEADLINE_BOOST_CAP, total), matches };
}

function scoreTitleAndLevel(candidate) {
  const title = (candidate.jobTitle || '').toLowerCase();
  const level = candidate.jobLevel || '';
  // Refined spread — was flat 10/20/25/30; now 8/22/28/35 to better
  // differentiate C-suite from rank-and-file directors.
  if (level === 'C-Level' || /chief/.test(title)) return { points: 35, label: 'c-level' };
  if (level === 'VP' || /\bvp\b|vice president/.test(title)) return { points: 28, label: 'vp' };
  if (level === 'Owner' || level === 'Partner') return { points: 26, label: 'owner-partner' };
  if (/senior director|sr\. director|sr director/.test(title)) return { points: 24, label: 'sr-director' };
  if (level === 'Director' || /director/.test(title)) return { points: 22, label: 'director' };
  if (/head of/.test(title)) return { points: 18, label: 'head-of' };
  if (level === 'Manager' || /manager/.test(title)) return { points: 8, label: 'manager' };
  return { points: 0, label: 'individual-contributor' };
}

function scoreCandidate(candidate, { intentCompanyMatch = false, hardSignal = false } = {}) {
  let score = 0;
  const breakdown = {};

  // Title / seniority (0-35)
  const titleScore = scoreTitleAndLevel(candidate);
  score += titleScore.points;
  breakdown.title = { points: titleScore.points, label: titleScore.label };

  // Function relevance (0-15)
  const fn = (candidate.jobFunction || '').toLowerCase();
  const title = (candidate.jobTitle || '').toLowerCase();
  const headline = ((candidate.headline || '') + ' ' + title).toLowerCase();
  if (/data center|colocation|colo|mission critical/.test(headline)) {
    score += 15; breakdown.function = 15;
  } else if (/sustainability|esg|carbon|energy/.test(headline)) {
    score += 12; breakdown.function = 12;
  } else if (/facilities|operations|infrastructure|engineering/.test(fn + ' ' + headline)) {
    score += 10; breakdown.function = 10;
  }

  // Industry match (0-15)
  const industry = (candidate.industry || '').toLowerCase();
  if (/data center|colocation|cloud|hosting/.test(industry)) {
    score += 15; breakdown.industry = 15;
  } else if (/telecom|information technology|software/.test(industry)) {
    score += 8; breakdown.industry = 8;
  }

  // Email available — outreach gate (0-5, was 10)
  if (candidate.emailAvailable) { score += 5; breakdown.email_available = 5; }

  // Cross-reference with intent_companies (0-15, was 20)
  if (intentCompanyMatch) { score += 15; breakdown.intent_cross_reference = 15; }

  // Hard-signal keyword in company/headline/title (0-10, was 15)
  if (hardSignal) { score += 10; breakdown.hard_signal = 10; }

  // Company size — mid-market sweet spot bonus, hyperscaler penalty
  const sizeScore = scoreCompanySize(candidate.companySize);
  score += sizeScore.points;
  breakdown.company_size = { points: sizeScore.points, label: sizeScore.label };

  // Headline-keyword active-investment boost (0-12)
  const headlineScore = scoreHeadlineKeywords(candidate);
  if (headlineScore.points > 0) {
    score += headlineScore.points;
    breakdown.headline_keywords = { points: headlineScore.points, matches: headlineScore.matches };
  }

  // Geo bonus (0-5) — already filtered by country
  if (candidate.country === 'United States') { score += 5; breakdown.geo = 5; }
  else if (candidate.country) { score += 3; breakdown.geo = 3; }

  // Bucketing — thresholds match the wider possible range (max ~115)
  let bucket;
  if (score >= 85) bucket = 'HOT';
  else if (score >= 65) bucket = 'WARM';
  else if (score >= 45) bucket = 'COLD';
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
  const existing = await _sb('discovered_contacts', 'GET', null, key + '&select=*&limit=1');
  if (existing && existing.length) {
    const e = existing[0];
    // Discovery should refresh re-discoverable fields (names, scores, company
    // metadata) but MUST NOT overwrite lifecycle state. Previously the PATCH
    // spread the whole payload — that reset status='pushed_to_brandjet' back
    // to 'new' on every sweep, releasing pushed contacts into the next push
    // pool and creating duplicate entries across BrandJet lists.
    const patch = {
      full_name: payload.full_name,
      first_name: payload.first_name,
      last_name: payload.last_name,
      job_title: payload.job_title,
      job_level: payload.job_level,
      job_function: payload.job_function,
      linkedin_url: payload.linkedin_url,
      profile_picture_url: payload.profile_picture_url,
      headline: payload.headline,
      company: payload.company,
      company_domain: payload.company_domain,
      company_size: payload.company_size,
      industry: payload.industry,
      country: payload.country,
      intent_company_id: payload.intent_company_id,
      score: payload.score,
      bucket: payload.bucket,
      score_breakdown: payload.score_breakdown,
      updated_at: new Date().toISOString(),
    };
    // Only refresh email/email_status when discovery has new info AND we
    // haven't already moved past those states. Verified emails and country-
    // rejected records keep their existing email_status.
    if (!e.email && payload.email) patch.email = payload.email;
    if (e.email_status !== 'verified' && e.email_status !== 'rejected_country') {
      patch.email_status = payload.email_status;
    }
    // NEVER touched by discovery: status, brandjet_lead_list_id, pushed_at,
    // email_revealed_at, credits_spent. Those are owned by the reveal/push
    // pipeline downstream.
    await _sb('discovered_contacts', 'PATCH', patch, `?id=eq.${e.id}`);
    return e.id;
  }
  const inserted = await _sb('discovered_contacts', 'POST',
    { ...payload, created_at: new Date().toISOString() });
  return inserted?.[0]?.id;
}

// ─── Main flows ─────────────────────────────────────────────────────

// Industries that AUTO-QUALIFY a candidate. These are unambiguous DC-buyer
// signals — anyone whose `industry` field matches one of these is in.
const STRONG_INDUSTRY_KEYWORDS = [
  'data center', 'colocation', 'colo',
  'cloud computing', 'cloud infrastructure',
  'web hosting', 'managed hosting',
  'real estate investment trust', // Digital Realty, Equinix, etc.
];

// Industries that are POSSIBLY-RELEVANT but too broad to qualify on their own.
// A weak-industry match is useful for scoring but doesn't pass the qualifier
// without corroborating hard_signal or intent-company cross-reference.
// (P4 reason: telecom industry catches NJ Transit; IT infrastructure catches
// billing/banking MSPs like RevSpring/Alogent.)
const WEAK_INDUSTRY_KEYWORDS = [
  'telecommunications', 'wireless carrier',
  'it infrastructure', 'managed it services', 'systems integrator',
];

// Hard signal — if any of these keywords appear in the company name, headline,
// or jobTitle, the candidate auto-qualifies even if industry is ambiguous.
const HARD_SIGNAL_KEYWORDS = [
  'data center', 'datacenter', 'colocation', 'colo ',
  'mission critical', 'mission-critical',
  'cooling', 'thermal', 'hvac',
  'cloud infrastructure', 'edge computing', 'edge data',
  'crac', 'crah', 'cdu',  // industry terminology only insiders use
];

// Negative signal — if these appear in the company name, AUTO-REJECT.
// Caught Asmodee (board games), Vidio (video streaming), 1980books, etc.
// P4 additions: transit / healthcare / legal / insurance verticals that
// passed via the old telecom + IT-services industry catch-alls.
const NEGATIVE_COMPANY_KEYWORDS = [
  'games', 'gaming', 'entertainment', 'media',
  'video', 'streaming', 'tv', 'broadcast',
  'books', 'publishing', 'magazine',
  'fashion', 'apparel', 'cosmetics',
  'restaurant', 'food', 'beverage',
  'travel', 'hotel', 'hospitality',
  'nonprofit', 'charity', 'foundation',
  'school', 'university', 'college', 'academy',
  'church', 'religious',
  'agency', 'recruiting', 'staffing', 'recruitment', 'talent',
  'consulting',  // too broad — most pure consultancies aren't DC operators
  // P4 — off-ICP verticals
  'transit', 'transportation',
  'hospital', 'medical center', 'health system', 'healthcare', 'clinic',
  'pharmaceutical', 'pharma', 'biotech',
  'court', 'attorney', 'judiciary',
  'insurance',
];

// Hyperscalers / big-tech / SaaS giants — matched anywhere in the company
// name via word boundary so variants like "Yahoo Inc", "Yahoo!", "Amazon Web
// Services" all get caught even though the prefix-blocklist below didn't.
// Word boundary avoids false positives like "DataBank" or "Pawsitive".
const HYPERSCALER_NAMES = [
  // Big-tech hyperscalers
  'google', 'amazon', 'aws', 'microsoft', 'azure',
  'apple', 'meta', 'facebook', 'ibm', 'oracle',
  'hp', 'hpe', 'dell', 'cisco', 'yahoo',
  // CDN / edge — not buying our cooling services
  'akamai', 'cloudflare', 'fastly',
  // International hyperscalers
  'alibaba', 'tencent', 'baidu',
  // SaaS giants
  'salesforce', 'workday', 'adobe',
];
const HYPERSCALER_REGEX = new RegExp(
  '\\b(' + HYPERSCALER_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i',
);

// POSITIVE company hints — DC operators that BrandJet sometimes classifies
// as "Telecommunications" or "Information Technology", causing them to be
// dropped by the strong-industry-only qualifier. Word-boundary match. Add
// here when a known DC operator we want gets filtered out for the wrong
// reason. Keep this list short — overuse defeats the strong-industry gate.
const POSITIVE_COMPANY_HINTS = [
  'ntt',                        // Global NTT / NTT Communications — telecom-classified DC giant
  'lumen', 'centurylink',       // Lumen Technologies — telecom-classified DC ops
  'iron mountain',              // Data center / records — sometimes "real estate"
  'cyxtera',                    // Colo — sometimes misclassified
  'segra', 'consolidated communications',  // Regional telecom + DC ops
];
const POSITIVE_COMPANY_REGEX = new RegExp(
  '\\b(' + POSITIVE_COMPANY_HINTS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i',
);

function isPositiveCompany(company) {
  if (!company) return false;
  return POSITIVE_COMPANY_REGEX.test(company.toLowerCase());
}

// Companies to skip (cooling vendors + recruiters). Prefix-match because some
// of these (e.g., "carrier", "trane") collide with common words/industries.
const COMPANY_BLOCKLIST = new Set([
  'vertiv','vertiv group','schneider electric','schneider','johnson controls',
  'trane','trane technologies','carrier','delta electronics',
  'insight global','liberty personnel services','liberty personnel','breagh recruitment','eligo recruitment','reed talent solutions','hireiq solutions',
  'cbre','jacobs','jll',
]);

function strongIndustry(industry) {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  return STRONG_INDUSTRY_KEYWORDS.some(kw => lower.includes(kw));
}

function weakIndustry(industry) {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  return WEAK_INDUSTRY_KEYWORDS.some(kw => lower.includes(kw));
}

// Backward-compat: scoring uses this combined check for the +8/+15 industry
// bonus. The qualification gate uses strongIndustry() only.
function relevantIndustry(industry) {
  return strongIndustry(industry) || weakIndustry(industry);
}

function hardSignalMatch(candidate) {
  // jobTitle AND headline deliberately excluded. We search BY title via
  // TARGET_TITLES (all containing "data center" / "mission critical" / etc.),
  // and LinkedIn headlines almost always echo the title. Including either
  // field made hardSignal tautologically true for every search result and
  // bypassed the company-level qualifier — LexisNexis, Alogent, water farms
  // and other non-DC companies were sneaking through P4 because their
  // employees' titles contained "data center" by construction. hardSignal
  // now verifies the COMPANY actually operates in the DC space.
  const text = [
    candidate.company || '',
    candidate.industry || '',
  ].join(' ').toLowerCase();
  return HARD_SIGNAL_KEYWORDS.some(kw => text.includes(kw));
}

function negativeCompanyMatch(company) {
  if (!company) return false;
  const lower = company.toLowerCase();
  return NEGATIVE_COMPANY_KEYWORDS.some(kw => lower.includes(kw));
}

function blockedCompany(company) {
  if (!company) return true;
  const lower = company.toLowerCase().trim();
  if (HYPERSCALER_REGEX.test(lower)) return true;
  for (const blocked of COMPANY_BLOCKLIST) {
    if (lower === blocked || lower.startsWith(blocked + ' ') || lower.startsWith(blocked + ',')) return true;
  }
  return false;
}

/**
 * Find decision-makers via title-based search of BrandJet's 700M-contact DB.
 *
 * We iterate target titles one-at-a-time (basic 'people' search only accepts
 * single-string jobTitle), accumulate raw candidates, post-filter for
 * DC-relevant industries + non-blocked companies, then store top scorers.
 *
 * Cross-reference with intent_companies (Adzuna-sourced hiring intent) adds
 * a +20 score bonus when a candidate's company also shows up in our intent
 * pipeline — that's the gold signal.
 */
export async function discoverByTitleSearch(opts = {}) {
  const {
    titles = TARGET_TITLES,
    countries = ['United States'],
    minScore = 50,
  } = opts;
  if (!_sb) throw new Error('Discovery not configured — call configureDiscovery(sb)');

  const stats = {
    started_at: new Date().toISOString(),
    searches_run: 0,
    raw_candidates: 0,
    industry_passed: 0,
    company_passed: 0,
    contacts_stored: 0,
    errors: [],
  };

  // Pre-load intent_companies for cross-reference scoring
  const intentRows = await _sb('intent_companies', 'GET', null, '?select=id,company&limit=2000');
  const intentByName = new Map(
    (intentRows || []).map(r => [r.company.toLowerCase().trim(), r.id])
  );

  for (const country of countries) {
    for (const title of titles) {
      try {
        const result = await bj.searchLeads({ jobTitle: title, countryName: country });
        stats.searches_run++;
        const people = result?.results || [];
        stats.raw_candidates += people.length;

        for (const p of people) {
          const companyMatch = p.company && intentByName.get(p.company.toLowerCase().trim());

          // 0. HARD REJECT: candidate's country not in English-primary list + UAE exception.
          //    Falls back to domain TLD when country field is empty (was the leak
          //    that let through .sa / .ee / .de / .fi contacts on prior runs).
          if (!allowedCandidateCountry(p.country, p.companyDomain || p.domain)) continue;

          // 1. HARD REJECT: negative company keywords (games, media, hotels, recruiters)
          if (negativeCompanyMatch(p.company)) continue;

          // 2. HARD REJECT: blocklisted companies (hyperscalers, cooling vendors)
          if (blockedCompany(p.company)) continue;

          // 3. QUALIFY: needs ONE of these signals
          //    a) Hard-signal keyword in company name or industry (not title!)
          //    b) STRONG industry match (data center / colocation / cloud / hosting / REIT)
          //    c) Cross-referenced to known intent company
          //    d) Positive company hint — known DC operator BrandJet sometimes
          //       misclassifies as telecom/IT (NTT, Lumen, Iron Mountain, etc.)
          // P5 fix: hardSignal no longer reads jobTitle/headline (was tautological
          // because we search BY DC titles). Off-ICP companies whose employees
          // happened to have DC-flavored titles (LexisNexis, Alogent, etc.) now drop.
          const hardSignal = hardSignalMatch(p);
          const industryStrong = strongIndustry(p.industry);
          const positiveCompany = isPositiveCompany(p.company);
          if (!hardSignal && !industryStrong && !companyMatch && !positiveCompany) continue;
          stats.industry_passed++;
          stats.company_passed++;

          const scored = scoreCandidate(p, { intentCompanyMatch: !!companyMatch, hardSignal });
          if (scored.score < minScore) continue;

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
            country: p.country || country,
            email: p.email || null,
            email_status: p.emailAvailable ? 'available_unrevealed' : 'unknown',
            intent_company_id: companyMatch || null,
            score: scored.score,
            bucket: scored.bucket,
            score_breakdown: scored.breakdown,
            status: 'new',
          });
          stats.contacts_stored++;
        }
      } catch (e) {
        console.warn(`[discovery] error searching "${title}" in ${country}: ${e.message}`);
        stats.errors.push({ title, country, msg: e.message });
      }
    }
  }

  stats.finished_at = new Date().toISOString();
  console.log(`[discovery] DONE: ${stats.searches_run} searches, ${stats.raw_candidates} raw, ${stats.contacts_stored} stored (≥${minScore}), ${stats.errors.length} errors`);
  return stats;
}

// Keep the cross-reference function exported for advanced use cases, but the
// default pipeline now uses discoverByTitleSearch (richer + actually works).
export async function discoverContactsForIntentCompanies(opts = {}) {
  return discoverByTitleSearch(opts);
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

  let revealed = 0, failed = 0, skipped_country = 0;
  for (const c of (candidates || [])) {
    // Backstop: re-check country gate before spending 2 credits. Catches
    // records that pre-date the TLD-fallback fix or any other edge case.
    if (!allowedCandidateCountry(c.country, c.company_domain)) {
      await _sb('discovered_contacts', 'PATCH',
        { email_status: 'rejected_country', updated_at: new Date().toISOString() },
        `?id=eq.${c.id}`);
      skipped_country++;
      continue;
    }
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
  return { revealed, failed, skipped_country, balance_after: newBalance?.balance };
}

/**
 * Push enriched contacts (with revealed emails) into a fresh BrandJet
 * lead list. Returns the BJ lead list id + push stats.
 */
export async function pushEnrichedToBrandJet({ listName, maxLeads = 50, minScore = 60, topNPerCompany = 1 } = {}) {
  if (!_sb) throw new Error('Discovery not configured');

  // Always append a high-precision timestamp suffix so re-runs in the same
  // day don't collide on BrandJet's list-name dedup. (Discovered when 3
  // successive runs all named "ThermaShift Enriched" — the 4th failed at
  // create_list because BrandJet returned a non-standard response we
  // couldn't parse to a list ID.)
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const finalListName = listName ? `${listName} ${ts}` : `ThermaShift Enriched ${ts}`;

  // Pull a broader pool, then dedup per company in code so we pick the
  // best contact per account rather than emailing 3 directors at the
  // same firm (looks robotic to recipients).
  const allCandidates = await _sb('discovered_contacts', 'GET', null,
    `?email=not.is.null&status=eq.new&score=gte.${minScore}&order=score.desc&limit=${maxLeads * 4}`);
  if (!allCandidates || !allCandidates.length) {
    return { listId: null, pushed: 0, message: 'No enriched contacts ready to push' };
  }

  // Per-company dedup: keep top N (by score) per normalized company name
  const perCompanyCount = new Map();
  const contacts = [];
  for (const c of allCandidates) {
    const key = (c.company || '').toLowerCase().trim();
    const seen = perCompanyCount.get(key) || 0;
    if (seen >= topNPerCompany) continue;
    perCompanyCount.set(key, seen + 1);
    contacts.push(c);
    if (contacts.length >= maxLeads) break;
  }

  if (!contacts.length) {
    return { listId: null, pushed: 0, message: 'No contacts left after per-company dedup' };
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
    titles,
    countries = ['United States'],
    discoverMinScore = 50,
    revealCreditsCap = 100,
    revealMinScore = 60,
    pushMinScore = 60,
    pushListName,
    topNPerCompany = 1,
  } = opts;

  console.log('[discovery] step 1: title-based search of BrandJet contact DB');
  const search = await discoverByTitleSearch({
    titles: titles || TARGET_TITLES,
    countries,
    minScore: discoverMinScore,
  });

  console.log('[discovery] step 2: reveal emails for top contacts');
  const reveal = await revealTopEmails({
    maxCredits: revealCreditsCap, minScore: revealMinScore,
  });

  console.log(`[discovery] step 3: push enriched contacts (top ${topNPerCompany}/company)`);
  const push = await pushEnrichedToBrandJet({
    listName: pushListName, minScore: pushMinScore, topNPerCompany,
  });

  return { search, reveal, push };
}
