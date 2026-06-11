/**
 * Security regression tests — the PII-gating + chat-prompt-leak fixes
 * shipped 2026-06-02 should never regress silently.
 *
 * These hit live API endpoints rather than UI, because the bugs they
 * cover live entirely server-side. Tests will only run meaningfully
 * against a real deployment — when running locally they may skip if
 * PLAYWRIGHT_BASE_URL isn't set to a real https origin.
 */

import { test, expect } from '@playwright/test';

const LIVE = process.env.PLAYWRIGHT_LIVE_API_URL || 'https://thermashift.net';

test.describe('Security regressions — PII + chat hardening', () => {
  test('SYSTEM_PROMPT is not present in the built client bundle', async () => {
    // The 2026-06-02 commit moved Alex's full pricing playbook from
    // src/api/chat.js (which shipped in the client bundle) to
    // server/alex-prompt.js. A regression would re-leak the playbook
    // to anyone who clicks View Source.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const distDir = path.resolve(process.cwd(), 'dist/assets');
    if (!fs.existsSync(distDir)) test.skip(true, 'No dist/ build — run `npm run build` first');
    const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const contents = fs.readFileSync(path.join(distDir, f), 'utf8');
      expect(contents, `Senior Cooling Consultant marker should not appear in ${f}`)
        .not.toContain('Senior Cooling Consultant');
      expect(contents, `Pricing playbook marker should not appear in ${f}`)
        .not.toContain('OBJECTION HANDLING');
    }
  });

  test('/api/audits/:id requires HMAC token (or admin)', async ({ request }) => {
    // The HMAC gate added 2026-06-02 prevents drive-by enumeration of
    // every audit by sequential id.
    const r = await request.get(`${LIVE}/api/audits/1`);
    // Should be 401 (no token) or 403 (admin denied) — definitely not
    // a 200 with the audit payload.
    expect([401, 403, 404]).toContain(r.status());
  });

  test('/api/invoices/:id requires HMAC token (or admin)', async ({ request }) => {
    const r = await request.get(`${LIVE}/api/invoices/1`);
    expect([401, 403, 404]).toContain(r.status());
  });

  test('/api/leads/:email/history is admin-only', async ({ request }) => {
    const r = await request.get(`${LIVE}/api/leads/test%40example.com/history`);
    // adminAuth returns 401 with a Basic challenge for missing token.
    expect([401, 403]).toContain(r.status());
  });

  test('/api/leads/lookup/:email returns only {found,name,company}', async ({ request }) => {
    // Reduced disclosure — should NOT include lead_score, last_audit, etc.
    const r = await request.get(`${LIVE}/api/leads/lookup/nonexistent%40example.com`);
    // The "found:false" case is what we expect for a fake email; the
    // important check is the shape of the keys, not the data.
    if (r.ok()) {
      const body = await r.json();
      const allowedKeys = new Set(['found', 'name', 'company']);
      for (const k of Object.keys(body)) {
        expect(allowedKeys, `key "${k}" should not be returned by lookup endpoint`).toContain(k);
      }
    }
  });
});
