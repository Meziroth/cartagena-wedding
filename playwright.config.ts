// Browser tests (npm run e2e): every screen at phone and desktop size, with axe accessibility checks.
// They run against the built-in example data, so no Supabase project or account is needed.
import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/cartagena-wedding/`,
    // Locally, use the installed Edge (no extra download); in CI, Playwright's own Chromium.
    channel: CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/cartagena-wedding/`,
    env: { VITE_DATA_SOURCE: 'mock' },
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
