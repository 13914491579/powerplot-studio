import { defineConfig } from '@playwright/test';

const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
const localURL = 'http://127.0.0.1:4173';
const useEdge = process.platform === 'win32' && !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: remoteURL ? 180_000 : 60_000,
  expect: { timeout: remoteURL ? 60_000 : 5_000 },
  workers: 1,
  projects: [{ name: useEdge ? 'Microsoft Edge' : 'Chromium', use: { browserName: 'chromium', ...(useEdge ? { channel: 'msedge' } : {}) } }],
  use: { baseURL: remoteURL || localURL, navigationTimeout: remoteURL ? 60_000 : 30_000, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  outputDir: '.qa/test-results',
  webServer: remoteURL ? undefined : { command: 'pnpm preview --port 4173 --strictPort', url: localURL, reuseExistingServer: !process.env.CI },
});
