import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --directory ../../frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
