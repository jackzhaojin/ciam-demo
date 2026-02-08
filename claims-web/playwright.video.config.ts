import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './demo',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 600_000,
  expect: { timeout: 120_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    video: {
      mode: 'on',
      size: { width: 1280, height: 800 },
    },
    viewport: { width: 1280, height: 800 },
    trace: 'off',
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'video',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
