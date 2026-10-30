import '../server/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { createApp, errorHandler } from '../server/app.js';

test('the installation gate accepts a valid token, rejects a bad token and restores the report page', async () => {
  const previous = process.env.APP_ACCESS_TOKEN;
  const token = 'local-test-installation-token';
  process.env.APP_ACCESS_TOKEN = token;
  const app = createApp();
  app.get('/', (_req, res) => res.type('html').send('<!doctype html><title>Fixture application</title><h1>Fixture application</h1>'));
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  // This test browser operates our own local login page, not an audited target.
  const browser = await chromium.launch({ headless: true, channel: 'chromium', chromiumSandbox: true });
  try {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(origin);
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.getByLabel('Installation access token').fill('wrong-token');
    await page.getByRole('button', { name: 'Continue to OpenPath' }).click();
    await page.getByRole('alert').filter({ hasText: 'Invalid installation access token.' }).waitFor();
    await page.getByLabel('Installation access token').fill(token);
    await page.getByRole('button', { name: 'Continue to OpenPath' }).click();
    await page.getByRole('heading', { name: 'Fixture application' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
    const health = await context.request.get(origin + '/api/health');
    assert.equal((await health.json()).needsAuth, false);
    const state = await context.storageState();
    assert(state.cookies.find(cookie => cookie.name === 'op_session')?.httpOnly);
    assert(!JSON.stringify(state).includes(token), 'The raw installation token must not be saved in browser storage.');
    await page.reload(); await page.getByRole('heading', { name: 'Fixture application' }).waitFor();
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.APP_ACCESS_TOKEN; else process.env.APP_ACCESS_TOKEN = previous;
  }
});
