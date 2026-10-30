import path from 'node:path';
import { defineConfig } from '@playwright/test';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('.cache/ms-playwright');
const port = Number(process.env.OPENPATH_UI_TEST_PORT || 4175);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    actionTimeout: 15000,
    channel: 'chromium',
    launchOptions: { chromiumSandbox: true },
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      HOST: '127.0.0.1', PORT: String(port),
      OPENPATH_AI_ENABLED: 'false', OPENPATH_DEMO_MODE: 'true',
      OPENPATH_DATA_DIR: path.resolve('data', `ui-tests-${Date.now()}`),
      APP_ACCESS_TOKEN: 'test-only-ui-installation-token', TRUST_PROXY: '',
    },
  },
});
