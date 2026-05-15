/**
 * BrandJet REST API client (skeleton) + CSV export fallback.
 *
 * STATUS (2026-05-15): BrandJet's public REST API auth scheme is not yet
 * documented. `api.brandjet.ai/health` responds, but all data endpoints
 * return 401 regardless of header format we've tried (Bearer, X-API-Key,
 * Api-Key, query param). Founder said docs were "publishing mid-week" —
 * we'll wire up actual pushLeads() once auth is known.
 *
 * Until then, csvForBrandJet() lets Steve bulk-import scored leads into
 * BrandJet's UI via their CSV importer.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BRANDJET_API_BASE || 'https://api.brandjet.ai';

// ─── REST API skeleton (not yet wired — auth scheme pending) ─────────

async function bjRequest(method, route, body) {
  const key = process.env.BRANDJET_API_KEY;
  if (!key) throw new Error('BRANDJET_API_KEY not set');

  // Try the auth schemes the BrandJet docs hint at — first one that returns 2xx wins.
  const authHeaderVariants = [
    { Authorization: `Bearer ${key}` },
    { 'X-API-Key': key },
    { 'Api-Key': key },
  ];

  for (const auth of authHeaderVariants) {
    const r = await fetch(BASE + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...auth },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status !== 401 && r.status !== 403) {
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, ok: r.ok, body: parsed || text };
    }
  }
  // All variants returned 401/403
  return { status: 401, ok: false, body: { error: 'BrandJet auth scheme not yet supported by this client' } };
}

/**
 * Quick health check — useful to confirm the REST API is reachable from the VPS.
 * Returns true if /health returns 2xx.
 */
export async function brandjetHealth() {
  try {
    const r = await fetch(BASE + '/health', { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Push a single lead to BrandJet. Will error until BrandJet auth scheme is known.
 * Spec is a guess based on REST conventions — adjust once docs land.
 */
export async function pushLead({ company, country, contact_name, contact_email, contact_title, score, bucket, signal_summary }) {
  return bjRequest('POST', '/leads', {
    company_name: company,
    country: country?.toUpperCase(),
    full_name: contact_name,
    email: contact_email,
    title: contact_title,
    custom_fields: { thermashift_score: score, thermashift_bucket: bucket, signal: signal_summary },
  });
}

/**
 * Add a lead to an existing BrandJet campaign by ID.
 */
export async function addLeadToCampaign(campaignId, leadId) {
  return bjRequest('POST', `/campaigns/${campaignId}/leads`, { lead_id: leadId });
}

/**
 * List all campaigns. Useful for picking a target campaign from the dashboard.
 */
export async function listCampaigns() {
  return bjRequest('GET', '/campaigns');
}

// ─── CSV Export (working today — manual import path) ─────────────────

/**
 * Build a CSV that BrandJet's Lead Importer can ingest. Headers match
 * BrandJet's documented import schema: company, first_name, last_name,
 * email, title, country, linkedin_url, plus a custom thermashift_score
 * column so we can sort inside BrandJet.
 */
export function buildCSV(rows) {
  const headers = [
    'company',
    'first_name',
    'last_name',
    'email',
    'title',
    'country',
    'linkedin_url',
    'thermashift_score',
    'thermashift_bucket',
    'signal_summary',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const cells = [
      r.company || '',
      r.first_name || '',
      r.last_name || '',
      r.contact_email || r.email || '',
      r.contact_title || r.title || '',
      r.country ? r.country.toUpperCase() : '',
      r.linkedin_url || '',
      r.score ?? '',
      r.bucket || '',
      r.signal_summary || '',
    ];
    lines.push(cells.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Write a CSV file for BrandJet bulk import. Returns the absolute path.
 * Default location: /tmp/brandjet-import-<timestamp>.csv
 */
export async function writeCSVToDisk(rows, outputDir = '/tmp') {
  const csv = buildCSV(rows);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `brandjet-import-${ts}.csv`;
  const fullPath = path.join(outputDir, filename);
  await fs.writeFile(fullPath, csv, 'utf8');
  return fullPath;
}
