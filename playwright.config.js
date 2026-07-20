// Playwright config for the STOOPID TOOLKIT static pages.
// Serves the repo root on a local static server, then runs every spec
// against both a desktop viewport and an iPhone 13 mobile profile.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'node tests/server.js',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      // iPhone 13 descriptor (viewport, UA, touch, deviceScaleFactor) but run
      // on Chromium — only Chromium is installed in CI and this sandbox.
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});
