/**
 * Smoke tests for the public marketing site.
 * These catch the kinds of bugs the 2026-05-29 audit found:
 *   - Footer service links pointing to "/" instead of section anchors
 *   - Hero copy regressions
 *   - Service cards missing or duplicated
 *   - Missing nav, missing CTA, etc.
 *
 * Tests are deliberately small + deterministic. No screenshot diffing.
 */

import { test, expect } from '@playwright/test';

test.describe('Home page — public marketing surface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero renders with current positioning', async ({ page }) => {
    // The hero pill + h1 + subhead should all be present.
    await expect(page.getByText('Data Center Cooling & Sustainability')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/Cooling Intelligence/);
    await expect(page.locator('h1')).toContainText(/Environmental Impact/);
    // The hero subtitle was corrected from "AI data centers" to
    // "mid-market data centers and AI-first facilities" on 2026-06-04.
    await expect(page.getByText(/mid-market data centers and AI-first facilities/i)).toBeVisible();
  });

  test('hero CTAs link to real routes (not "/")', async ({ page }) => {
    const auditCta = page.getByRole('link', { name: /free thermal audit/i });
    await expect(auditCta).toHaveAttribute('href', '/contact');
    const calcCta = page.getByRole('link', { name: /roi calculator/i });
    await expect(calcCta).toHaveAttribute('href', '/calculator');
  });

  test('shows all four service cards with their tags', async ({ page }) => {
    // The services array drives 4 cards. If any is missing the audit-
    // surfaced 4-service-line narrative is broken.
    const tags = ['Liquid Cooling', 'Revenue from Heat', 'SaaS', 'Consulting'];
    for (const tag of tags) {
      await expect(page.getByText(tag, { exact: false }).first()).toBeVisible();
    }
  });

  test('service descriptions reflect the 2026-06-04 honesty corrections', async ({ page }) => {
    // "turnkey installation" was retired in favor of "partnered installers"
    await expect(page.locator('body')).not.toContainText(/turnkey installation of rear-door/i);
    // "broker heat sales to greenhouses" replaced with "assess... and connect you with viable offtake buyers"
    await expect(page.locator('body')).not.toContainText(/We broker heat sales/i);
    // "hotspot prediction" replaced with "hotspot detection and alerting"
    await expect(page.locator('body')).not.toContainText(/hotspot prediction/i);
    // The corrected language should be present
    await expect(page.locator('body')).toContainText(/partnered installers/i);
    await expect(page.locator('body')).toContainText(/viable offtake buyers/i);
  });

  test('footer service links scroll to specific service anchors (not "/")', async ({ page }) => {
    // Audit-surfaced bug: footer links all pointed to "/" and bounced
    // prospects back to the homepage with no scroll context.
    const expectedAnchors = [
      ['Liquid Cooling Design & Install', '/#service-liquid-cooling'],
      ['Waste Heat Recovery', '/#service-waste-heat'],
      ['Thermal Intelligence Platform', '/#service-platform'],
      ['ESG Consulting', '/#service-esg'],
    ];
    for (const [text, href] of expectedAnchors) {
      const link = page.getByRole('link', { name: new RegExp(text, 'i') }).last();
      await expect(link).toHaveAttribute('href', href);
    }
  });

  test('footer service anchor IDs actually exist on the page', async ({ page }) => {
    // The href is correct — but the id has to also exist or the link
    // is a no-op. Test both halves.
    for (const id of ['service-liquid-cooling', 'service-waste-heat', 'service-platform', 'service-esg']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('navigation to Calculator works', async ({ page }) => {
    await page.getByRole('link', { name: /roi calculator/i }).first().click();
    await expect(page).toHaveURL(/\/calculator/);
    // Calculator should render its inputs, not blank-page on a render error.
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
