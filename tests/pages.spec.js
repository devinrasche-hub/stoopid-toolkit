// Every .html page in the repo root must load cleanly:
// - non-empty <title>
// - zero pageerrors (uncaught exceptions / unhandled rejections)
// - zero console errors (only registry-host network noise is allowed)
// - no failed requests except to the score-registry host (favicon 404 is NOT allowed)
// - no horizontal document overflow on the mobile project
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

// The registry worker is a live external service; requests to it may fail
// (offline, sandboxed, rate-limited). Nothing else is excused.
const ALLOWED_HOST = 'stoopid-signal-registry.stoopidshow.workers.dev';
const isAllowedUrl = (url) => url.includes(ALLOWED_HOST);

for (const file of pages) {
  test(`${file} loads cleanly`, async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];

    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const loc = msg.location() || {};
      const text = msg.text();
      // "Failed to load resource" errors for the allowed registry host only.
      if (isAllowedUrl(text) || isAllowedUrl(loc.url || '')) return;
      consoleErrors.push(text);
    });
    page.on('requestfailed', (req) => {
      if (isAllowedUrl(req.url())) return;
      failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      if (res.status() < 400) return;
      if (isAllowedUrl(res.url())) return;
      failedRequests.push(`${res.url()} :: HTTP ${res.status()}`);
    });

    await page.goto(`/${file}`, { waitUntil: 'load' });
    // Let deferred scripts, animations, and late fetches settle.
    await page.waitForTimeout(1000);

    expect(await page.title(), 'title must be non-empty').not.toBe('');
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
    expect(failedRequests, 'no failed requests (incl. favicon)').toEqual([]);

    if (test.info().project.name === 'mobile') {
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, 'no horizontal document overflow on mobile').toBeLessThanOrEqual(0);
    }
  });
}
