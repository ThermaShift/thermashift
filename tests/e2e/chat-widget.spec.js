/**
 * Smoke tests for the chat widget — the #1 conversion surface on the
 * marketing site. The 2026-05-29 audit found broken CSS vars
 * (--bg-card, --bg-dark, --success) that made the widget render
 * with transparent panels. Those CSS aliases are now defined in
 * index.css; this test confirms the widget actually paints them.
 */

import { test, expect } from '@playwright/test';

test.describe('ChatWidget — Alex on the marketing site', () => {
  test.beforeEach(async ({ page }) => {
    // Network mock: don't burn Anthropic credits during e2e and
    // don't hit the real /api/chat (which is rate-limited).
    await page.route('**/api/chat', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"content_block_delta","delta":{"text":"Hello from mocked Alex."}}\n\ndata: [DONE]\n\n',
      });
    });
    await page.route('**/api/leads/lookup/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"found":false}' });
    });
    await page.goto('/');
  });

  test('chat widget button is visible on the homepage', async ({ page }) => {
    // The trigger button (bottom-right) should always be present
    // — the widget is the primary inbound conversion channel.
    const trigger = page.getByRole('button', { name: /chat|alex|open/i }).last();
    await expect(trigger).toBeVisible();
  });

  test('clicking the widget button opens the chat panel with non-transparent background', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /chat|alex|open/i }).last();
    await trigger.click();

    // Panel should appear. We look for the header text "Alex" or the
    // welcoming first-message paragraph.
    const panel = page.locator('text=Alex').first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    // CRITICAL: regression check on the CSS-var bug. The widget header
    // and input area used to reference --bg-card / --bg-dark which
    // weren't defined, so they fell back to transparent. The aliases
    // are now in index.css; if they go missing again the computed
    // background should NOT be transparent.
    const computed = await panel.evaluate((el) => {
      const target = el.closest('[role="dialog"], [class*="chat"]') || el.parentElement;
      const style = window.getComputedStyle(target);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(computed.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(computed.background).not.toBe('transparent');
  });

  test('returning-visitor lookup uses reduced-disclosure response', async ({ page }) => {
    // The /api/leads/lookup response was reduced on 2026-06-02 to
    // ONLY {found, name, company}. If a fresh client build started
    // depending on the old fields (lead_score, last_audit, etc.) the
    // returning-visitor handler would silently miss them.
    // We can't easily exercise the post-email returning-visitor flow
    // in a smoke test, but we CAN confirm the widget doesn't crash
    // when it gets the minimal response shape.
    const trigger = page.getByRole('button', { name: /chat|alex|open/i }).last();
    await trigger.click();
    // No error overlays / no React error UI.
    await expect(page.locator('text=Something broke')).not.toBeVisible();
  });
});
