/**
 * Intent Scraper — finds companies showing buying intent for ThermaShift's services.
 *
 * Sources (free public APIs):
 *   - Adzuna jobs API: companies hiring cooling/thermal/sustainability roles
 *   - NewsAPI: funding, AI/GPU expansion, and sustainability news mentions
 *
 * Output:
 *   - intent_companies table (Supabase) — one row per scored company
 *   - Each row has a 0-100 score and HOT/WARM/COLD/SKIP bucket
 *
 * Scoring (100-point total):
 *   - Hiring signals: up to 35 points (capped sum of Adzuna postings × keyword weight)
 *   - News signals: up to 35 points (capped sum of NewsAPI mentions × category weight)
 *   - Geography: up to 15 points (US East Coast > Texas/AZ > UK/IE > Canada/AU)
 *   - Section 179D urgency: up to 15 points (US-only, weighted by deadline proximity)
 *
 * Buckets:
 *   - HOT  (80-100): personalize, contact within 24h
 *   - WARM (60-79):  standard 5-touch sequence
 *   - COLD (40-59):  slow drip
 *   - SKIP (<40):    don't send
 */

import 'dotenv/config';

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api';
const NEWSAPI_BASE = 'https://newsapi.org/v2';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// ─── ICP Configuration ─────────────────────────────────────────────

// Countries we pull from + geographic weighting (0-15 points)
const COUNTRIES = [
  { code: 'us', weight: 15, name: 'United States' },
  { code: 'gb', weight: 8,  name: 'United Kingdom' },
  { code: 'ca', weight: 5,  name: 'Canada' },
  { code: 'au', weight: 4,  name: 'Australia' },
];

// Job-posting keywords that indicate ThermaShift-relevant hiring
const HIRING_KEYWORDS = [
  { kw: 'data center cooling engineer',  points: 10, category: 'cooling_direct' },
  { kw: 'data center thermal',           points: 10, category: 'cooling_direct' },
  { kw: 'mission critical cooling',      points: 8,  category: 'cooling_direct' },
  { kw: 'liquid cooling engineer',       points: 9,  category: 'cooling_direct' },
  { kw: 'CRAC CRAH technician',          points: 7,  category: 'cooling_direct' },
  { kw: 'data center mechanical engineer', points: 7, category: 'cooling_adjacent' },
  { kw: 'data center HVAC',              points: 6,  category: 'cooling_adjacent' },
  { kw: 'data center sustainability',    points: 5,  category: 'esg' },
  { kw: 'ESG data center',               points: 5,  category: 'esg' },
  { kw: 'chief sustainability officer',  points: 4,  category: 'esg' },
  { kw: 'GPU infrastructure',            points: 6,  category: 'ai_workload' },
  { kw: 'AI infrastructure engineer',    points: 6,  category: 'ai_workload' },
];

// News keyword categories — funding/expansion/AI signals (per company)
const NEWS_CATEGORIES = [
  {
    category: 'funding',
    points: 12,
    keywords: ['raised', 'funding round', 'series A', 'series B', 'series C', 'series D', 'investment', 'capital raise'],
  },
  {
    category: 'ai_gpu_expansion',
    points: 10,
    keywords: ['AI infrastructure', 'GPU deployment', 'NVIDIA', 'H100', 'liquid cooling', 'AI cluster', 'AI campus'],
  },
  {
    category: 'facility_expansion',
    points: 8,
    keywords: ['new data center', 'megawatt facility', 'phase 2', 'expansion', 'new campus', 'breaks ground'],
  },
  {
    category: 'sustainability',
    points: 5,
    keywords: ['ESG report', 'net zero', 'carbon neutral', 'sustainability commitment', 'renewable energy'],
  },
];

// Companies to skip (we don't want to send to ourselves, recruiters, or job aggregators)
const COMPANY_BLOCKLIST = new Set([
  'ThermaShift', 'unknown', 'unknown company', 'private', 'undisclosed',
  'recruiter', 'staffing', 'recruiting',
  'indeed', 'linkedin', 'glassdoor', 'monster',
]);

// Section 179D deadline: June 30, 2026. Closer = more urgency (US only).
const SECTION_179D_DEADLINE = new Date('2026-06-30T23:59:59Z');
const SECTION_179D_LAUNCH = new Date('2026-04-01T00:00:00Z');

// ─── API clients ─────────────────────────────────────────────────────

async function searchAdzuna(country, query) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) throw new Error('ADZUNA_APP_ID / ADZUNA_APP_KEY not set');
  const url = `${ADZUNA_BASE}/jobs/${country}/search/1?app_id=${id}&app_key=${key}&what=${encodeURIComponent(query)}&results_per_page=50&max_days_old=30`;
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Adzuna ${country} "${query}": ${r.status} ${txt.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.results || [];
}

async function searchNewsAPI(query, daysBack = 60) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error('NEWSAPI_KEY not set');
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
  const url = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&from=${from}&sortBy=publishedAt&pageSize=20&language=en&apiKey=${key}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status !== 'ok') throw new Error(`NewsAPI "${query}": ${d.code || ''} ${d.message || JSON.stringify(d).slice(0,200)}`);
  return d.articles || [];
}

// ─── Supabase helpers (PostgREST) ─────────────────────────────────────

async function sb(table, method, body, query = '') {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
  };
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`Supabase ${method} ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ─── Scoring helpers ──────────────────────────────────────────────────

function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeRealCompany(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (lower.length < 2 || lower.length > 100) return false;
  for (const blocked of COMPANY_BLOCKLIST) {
    if (lower.includes(blocked.toLowerCase())) return false;
  }
  return true;
}

function section179dUrgencyBonus(country) {
  if (country !== 'us') return 0;
  const now = Date.now();
  const launch = SECTION_179D_LAUNCH.getTime();
  const deadline = SECTION_179D_DEADLINE.getTime();
  if (now > deadline) return 0;
  if (now < launch) return 5;
  // Linear ramp from 5 (90 days before deadline) up to 15 (at deadline)
  const progress = (now - launch) / (deadline - launch);
  return Math.min(15, Math.round(5 + progress * 10));
}

function summarize(c) {
  const parts = [];
  if (c.hiring_signals.length) {
    parts.push(`hiring ${c.hiring_signals.length} cooling/thermal roles`);
  }
  if (c.news_signals.length) {
    const cats = [...new Set(c.news_signals.map(n => n.category))];
    parts.push(`news: ${cats.join(', ')}`);
  }
  if (c.country === 'us' && c.urgency_bonus > 0) {
    parts.push(`179D-eligible (${c.urgency_bonus}pt urgency boost)`);
  }
  return parts.join(' · ') || 'general firmographic match';
}

// ─── Main pipeline ───────────────────────────────────────────────────

export async function runIntentScrape(opts = {}) {
  const {
    countriesOverride = null,
    hiringKeywordsOverride = null,
    enrichNewsForTopN = 20,    // Limit NewsAPI calls (free tier = 100/day)
    dryRun = false,
  } = opts;

  const countries = countriesOverride || COUNTRIES;
  const hiringKws = hiringKeywordsOverride || HIRING_KEYWORDS;

  const stats = {
    started_at: new Date().toISOString(),
    adzuna_calls: 0,
    newsapi_calls: 0,
    companies_found: 0,
    new_rows: 0,
    updated_rows: 0,
    errors: [],
  };

  // companies map: key = `${normalizedName}::${country}`, value = aggregated signal data
  const companies = new Map();

  // 1. Pull hiring signals from Adzuna across countries × keywords
  console.log(`[intent-scraper] phase 1: hiring signals (${countries.length} countries × ${hiringKws.length} keywords)`);
  for (const country of countries) {
    for (const sig of hiringKws) {
      try {
        const jobs = await searchAdzuna(country.code, sig.kw);
        stats.adzuna_calls++;
        for (const j of jobs) {
          const companyRaw = j.company?.display_name;
          const company = normalizeCompanyName(companyRaw);
          if (!looksLikeRealCompany(company)) continue;

          const key = `${company.toLowerCase()}::${country.code}`;
          if (!companies.has(key)) {
            companies.set(key, {
              company,
              country: country.code,
              country_weight: country.weight,
              hiring_signals: [],
              news_signals: [],
              urgency_bonus: 0,
            });
          }
          const c = companies.get(key);
          c.hiring_signals.push({
            keyword: sig.kw,
            category: sig.category,
            points: sig.points,
            title: (j.title || '').slice(0, 200),
            location: j.location?.display_name,
            posted: j.created,
          });
        }
      } catch (e) {
        stats.errors.push({ phase: 'adzuna', country: country.code, kw: sig.kw, msg: e.message });
        console.warn(`[intent-scraper] adzuna error ${country.code}/${sig.kw}:`, e.message);
      }
    }
  }

  stats.companies_found = companies.size;
  console.log(`[intent-scraper] phase 1 done: ${companies.size} unique companies from ${stats.adzuna_calls} Adzuna calls`);

  // 2. For top companies (by hiring volume), pull news signals
  console.log(`[intent-scraper] phase 2: news signals for top ${enrichNewsForTopN} companies`);
  const topCompanies = [...companies.values()]
    .sort((a, b) => b.hiring_signals.length - a.hiring_signals.length)
    .slice(0, enrichNewsForTopN);

  for (const c of topCompanies) {
    for (const cat of NEWS_CATEGORIES) {
      try {
        // Quoted company name + any category keyword
        const kwOr = cat.keywords.slice(0, 6).map(k => `"${k}"`).join(' OR ');
        const query = `"${c.company}" AND (${kwOr})`;
        const articles = await searchNewsAPI(query, 60);
        stats.newsapi_calls++;
        for (const a of articles.slice(0, 3)) {
          c.news_signals.push({
            category: cat.category,
            points: cat.points,
            title: (a.title || '').slice(0, 240),
            url: a.url,
            source: a.source?.name,
            publishedAt: a.publishedAt,
          });
        }
      } catch (e) {
        stats.errors.push({ phase: 'newsapi', company: c.company, cat: cat.category, msg: e.message });
        // Don't spam — only log first few
        if (stats.errors.length < 5) {
          console.warn(`[intent-scraper] newsapi error ${c.company}/${cat.category}:`, e.message);
        }
      }
    }
  }
  console.log(`[intent-scraper] phase 2 done: ${stats.newsapi_calls} NewsAPI calls`);

  // 3. Score and bucket every company
  console.log(`[intent-scraper] phase 3: scoring ${companies.size} companies`);
  const scored = [];
  for (const c of companies.values()) {
    const hiringScore = Math.min(35, c.hiring_signals.reduce((s, h) => s + h.points, 0));
    const newsScore = Math.min(35, c.news_signals.reduce((s, n) => s + n.points, 0));
    const geoBonus = Math.min(15, c.country_weight);
    const urgency = section179dUrgencyBonus(c.country);
    c.urgency_bonus = urgency;
    c.geo_bonus = geoBonus;

    const score = hiringScore + newsScore + geoBonus + urgency;
    let bucket;
    if (score >= 80) bucket = 'HOT';
    else if (score >= 60) bucket = 'WARM';
    else if (score >= 40) bucket = 'COLD';
    else bucket = 'SKIP';

    scored.push({
      ...c,
      score,
      bucket,
      signal_summary: summarize(c),
    });
  }
  scored.sort((a, b) => b.score - a.score);

  // 4. Persist to Supabase (upsert by (company, country))
  if (!dryRun && SUPABASE_KEY) {
    console.log(`[intent-scraper] phase 4: upserting ${scored.length} rows to Supabase`);
    for (const c of scored) {
      try {
        const existing = await sb('intent_companies', 'GET', null,
          `?company=eq.${encodeURIComponent(c.company)}&country=eq.${c.country}&limit=1`);
        const row = {
          company: c.company,
          country: c.country,
          score: c.score,
          bucket: c.bucket,
          hiring_signals: c.hiring_signals,
          news_signals: c.news_signals,
          geo_bonus: c.geo_bonus,
          urgency_bonus: c.urgency_bonus,
          signal_summary: c.signal_summary,
          last_scored_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (existing.length) {
          await sb('intent_companies', 'PATCH', row, `?id=eq.${existing[0].id}`);
          stats.updated_rows++;
        } else {
          await sb('intent_companies', 'POST', row);
          stats.new_rows++;
        }
      } catch (e) {
        stats.errors.push({ phase: 'persist', company: c.company, msg: e.message });
        console.warn(`[intent-scraper] persist error ${c.company}:`, e.message);
      }
    }
  }

  stats.finished_at = new Date().toISOString();
  const bucketCounts = scored.reduce((acc, c) => { acc[c.bucket] = (acc[c.bucket] || 0) + 1; return acc; }, {});
  stats.buckets = bucketCounts;

  console.log('[intent-scraper] DONE', JSON.stringify({ stats, top5: scored.slice(0, 5).map(c => ({ company: c.company, country: c.country, score: c.score, bucket: c.bucket, signal: c.signal_summary })) }, null, 2));
  return { stats, scored };
}

// ─── CLI mode ────────────────────────────────────────────────────────

const _entry = process.argv[1] ? `file://${process.argv[1].replace(/\\/g, '/')}` : null;
if (_entry && import.meta.url === _entry) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  runIntentScrape({ dryRun }).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
