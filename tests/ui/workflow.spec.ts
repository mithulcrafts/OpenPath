import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Audit, Health, TaskRun } from '../../shared/types.js';

const token = 'test-only-ui-installation-token';
async function authenticate(page: Page) {
  const response = await page.request.post('/api/auth', { data: { token } });
  expect(response.ok()).toBeTruthy();
}
async function completedAudit(request: APIRequestContext, baseURL: string) {
  const history = await request.get('/api/audits').then(response => response.json());
  const saved = history.audits.find((audit: { status: string }) => audit.status === 'complete');
  if (saved) return await request.get(`/api/audits/${saved.id}`).then(response => response.json()) as Audit;
  const queued = await request.post('/api/audits', { data: { url: baseURL + '/demo/broken/' } }).then(response => response.json());
  await expect.poll(async () => (await request.get(`/api/audits/${queued.id}`).then(response => response.json())).status, { timeout: 45000 }).toBe('complete');
  return await request.get(`/api/audits/${queued.id}`).then(response => response.json()) as Audit;
}

test('complete offline product flow: evidence, exports, independent trials, paired comparisons and reload', async ({ page, baseURL }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const runRequests: unknown[] = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runRequests.push(request.postDataJSON()); });
  await page.goto('/');
  await page.getByLabel('Installation access token').fill(token);
  await page.getByRole('button', { name: 'Continue to OpenPath' }).click();
  await expect(page.getByRole('heading', { name: /Make your website/ })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Audit history' })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByLabel('Website to inspect').fill('http://169.254.169.254/latest/meta-data/');
  await page.getByRole('button', { name: 'Run audit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('blocked');
  await page.getByLabel('Website to inspect').fill(baseURL + '/demo/broken/');
  await page.getByRole('button', { name: 'Run audit', exact: true }).click();
  await expect(page.getByText('AUDIT COMPLETE', { exact: true })).toBeVisible({ timeout: 45000 });
  const beforeId = new URL(page.url()).searchParams.get('audit')!;
  await expect(page.getByRole('heading', { name: 'What should agents do?', exact: true })).toBeVisible();
  await expect(page.getByText('Not task-verified', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Product capabilities' }).getByRole('button', { pressed: true })).toHaveCount(1);
  const briefDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export implementation brief', exact: true }).click();
  const briefFile = await briefDownload;
  const briefContents = await readFile((await briefFile.path())!, 'utf8');
  expect(briefContents).toContain('# OpenPath implementation brief:');
  expect(briefContents).toContain('Access profile: Browser agent');
  expect(briefContents).toContain('## Unknowns');
  expect(briefContents).toContain('Proposed changes have not been applied to the source.');
  await page.getByRole('navigation', { name: 'Audit sections' }).getByRole('button', { name: /^Plan changes/ }).click();
  await page.getByRole('combobox', { name: 'Agent profile', exact: true }).selectOption('browser');
  await page.getByRole('combobox', { name: 'Severity', exact: true }).selectOption('high');
  await expect(page.getByRole('heading', { name: 'Name controls by what they do' })).toBeVisible();
  await expect(page.getByText('Affects: Browser agents', { exact: true })).toBeVisible();
  await page.locator('.finding-evidence summary').click();
  await expect(page.locator('.finding-evidence pre')).toContainText('button');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download fix kit', exact: true }).click();
  const file = await download;
  expect(await readFile((await file.path())!, 'utf8')).toContain('Name controls by what they do');
  await page.getByRole('button', { name: 'View evidence', exact: true }).click();
  await expect(page.getByRole('img', { name: /Captured evidence/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Scripted demo. No NVIDIA model will be called.', { exact: true })).toBeVisible();
  // Hold the first trial read to exercise the gap between accepted POST and
  // loaded run state. A second paid attempt must remain disabled in that gap.
  let releaseTrialRead!: () => void;
  const trialReadGate = new Promise<void>(resolve => { releaseTrialRead = resolve; });
  await page.route(/\/api\/runs\/[a-f0-9-]{36}$/, async route => { await trialReadGate; await route.continue(); });
  await page.getByRole('button', { name: 'Run task trial', exact: true }).dblclick();
  await expect(page.getByText('Loading trial…', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Browser trials', exact: true }).getByRole('button', { name: /Run task trial|Trial in progress/ })).toBeDisabled();
  releaseTrialRead();
  await expect(page.getByRole('heading', { name: 'Task completed', exact: true })).toBeVisible({ timeout: 45000 });
  expect(runRequests).toHaveLength(1);
  const beforeRunId = new URL(page.url()).searchParams.get('run')!;
  await page.locator('.run-steps summary').click();
  await expect(page.getByRole('img', { name: /Step 0:/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download browser trace' })).toHaveAttribute('href', /trace\.zip$/);
  const remembered = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Task completed', exact: true })).toBeVisible();
  expect(page.url()).toBe(remembered);
  expect(runRequests).toHaveLength(1);
  await page.getByRole('button', { name: 'Audit fixed demo', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('audit')).not.toBe(beforeId);
  await expect(page.getByText('AUDIT COMPLETE', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  const comparison = page.getByRole('region', { name: 'Audit comparison', exact: true });
  await expect(comparison).toContainText('Matching inspected scope.');
  await expect(comparison.getByRole('row').filter({ hasText: 'Buttons have meaningful names' })).toContainText('improved');
  await page.getByRole('combobox', { name: 'Compare task with', exact: true }).selectOption(beforeRunId);
  await page.getByRole('button', { name: 'Run paired trial', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Task comparison', exact: true })).toContainText('unchanged', { timeout: 45000 });
  expect(runRequests).toHaveLength(2);
  expect(runRequests[1]).toMatchObject({ compareWith: beforeRunId });
  await expect(page.getByRole('heading', { name: 'Task completed', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('completed-report.png'), fullPage: true });
  await page.getByRole('button', { name: 'New audit', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Audit history' }).getByRole('button')).toHaveCount(2);
  const budget = await page.request.get('/api/budget').then(response => response.json());
  expect(budget.calls).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('mobile report fits the viewport and keyboard focus stays visible', async ({ page, baseURL }, testInfo) => {
  await authenticate(page);
  const audit = await completedAudit(page.request, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?audit=${audit.id}`);
  await expect(page.getByText('AUDIT COMPLETE', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Audit sections' }).getByRole('button', { name: /^Plan changes/ }).click();
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('interactions');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'New audit', exact: true }).click();
  await page.getByLabel('Website to inspect').focus();
  await expect(page.getByLabel('Website to inspect')).toBeFocused();
  expect(await page.getByLabel('Website to inspect').evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.screenshot({ path: testInfo.outputPath('mobile-home.png'), fullPage: true });
});

test('budget pause disables paid trials and custom model evidence never claims NVIDIA verification', async ({ page, baseURL }) => {
  await authenticate(page);
  const audit = await completedAudit(page.request, baseURL!);
  const health: Health = await page.request.get('/api/health').then(response => response.json());
  await page.route('**/api/health', route => route.fulfill({ json: { ...health, ai: 'configured', trialMode: 'live', budget: { ...health.budget, blocked: true, reservedUsd: 1 } } }));
  await page.route(`**/api/audits/${audit.id}`, route => route.fulfill({ json: { ...audit, model: { ...audit.model, mode: 'nemotron' }, inference: [{ id: 'local-test', provider: 'custom', requestedModel: 'nvidia/test', responseModel: 'nvidia/test', status: 'succeeded', durationMs: 10 }] } }));
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
  await page.goto(`/?audit=${audit.id}`);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('AI budget reached. Saved reports remain available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run task trial', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'View evidence', exact: true }).click();
  await expect(page.getByText('NVIDIA on Nebius verified', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Inspect provider evidence', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run task trial', exact: true })).toBeDisabled();
  expect(mutations).toEqual([]);
});

test('public task form submits declared assertions and distinguishes an inconclusive result', async ({ page, baseURL }) => {
  await authenticate(page);
  const audit = await completedAudit(page.request, baseURL!);
  const health = await page.request.get('/api/health').then(response => response.json());
  const runId = '00000000-0000-4000-8000-000000000123';
  const trial = { id: runId, auditId: audit.id, startUrl: 'https://example.com/', goal: 'Open pricing information', assertions: [{ kind: 'url_contains', value: '/pricing' }], status: 'complete', outcome: 'inconclusive', checks: [], steps: [], explanation: 'Local test fixture: provider unavailable.', createdAt: new Date().toISOString(), model: 'nvidia/test-fixture', profile: 'rendered-dom', promptVersion: 'test', maxSteps: 12, maxDurationMs: 120000 } satisfies TaskRun;
  await page.route('**/api/health', route => route.fulfill({ json: { ...health, ai: 'configured', trialMode: 'live' } }));
  await page.route(`**/api/audits/${audit.id}`, route => route.fulfill({ json: { ...audit, isDemo: false, url: 'https://example.com/', domain: 'example.com' } }));
  const bodies: unknown[] = [];
  await page.route('**/api/runs', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { id: runId } });
  });
  await page.route(`**/api/runs/${runId}`, route => route.fulfill({ json: trial }));
  await page.goto(`/?audit=${audit.id}`);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run task trial', exact: true })).toBeDisabled();
  await page.getByLabel('Browsing goal', { exact: true }).fill('Open pricing information');
  await page.getByRole('combobox', { name: 'Success condition', exact: true }).selectOption('url_contains');
  await page.getByLabel('Expected value', { exact: true }).fill('/pricing');
  await page.getByRole('button', { name: 'Run task trial', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Task inconclusive', exact: true })).toBeVisible();
  expect(bodies).toEqual([{ auditId: audit.id, goal: 'Open pricing information', assertions: [{ kind: 'url_contains', value: '/pricing' }] }]);
});

test('capability profiles scope changes and export links, preserve unknown destinations and prepare a trial without executing it', async ({ page, baseURL }) => {
  await authenticate(page);
  const audit = await completedAudit(page.request, baseURL!);
  const url = 'https://product.example/';
  const capabilityAudit: Audit = {
    ...audit, url, domain: 'product.example', isDemo: false, checks: [],
    pages: [{ ...audit.pages[0], id: 'page-1', url, title: 'Product', headings: ['Product'], controls: [], screenshot: undefined,
      links: [{ text: 'Pricing', href: `${url}pricing` }] }],
    evidence: [
      { id: 'ev-browser', pageId: 'page-1', url, description: 'The pricing link has no accessible name.', snippet: '<a href="/pricing"></a>' },
      { id: 'ev-html', pageId: 'page-1', url, description: 'The initial response has less text than the rendered page.' },
    ],
    findings: [
      { id: 'browser-name', title: 'Name the pricing link', category: 'discovery', severity: 'medium', observation: 'The captured pricing link has no accessible name.', impact: 'Its destination is unclear.', profiles: ['browser'], kind: 'observed', evidenceIds: ['ev-browser'], fix: 'Give the pricing link a meaningful accessible name.', verification: 'Inspect its accessible name.', source: 'rule' },
      { id: 'html-content', title: 'Review initial HTML content', category: 'readability', severity: 'medium', observation: 'Initial and rendered text differ.', impact: 'HTML readers may have less information.', profiles: ['html'], kind: 'observed', evidenceIds: ['ev-html'], fix: 'Check whether essential information needs server rendering.', verification: 'Compare the required information in both responses.', source: 'rule' },
    ],
  };
  await page.route(`**/api/audits/${audit.id}`, route => route.fulfill({ json: capabilityAudit }));
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
  await page.goto(`/?audit=${audit.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Review pricing', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Product capabilities' }).getByRole('button', { pressed: true }).getByText('Inferred', { exact: true })).toBeVisible();
  await expect(page.getByText('Proposed changes — not implemented', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Name the pricing link', exact: true })).toBeVisible();
  const brief = page.getByRole('link', { name: 'Export implementation brief', exact: true });
  await expect(brief).toHaveAttribute('href', new RegExp(`^/api/audits/${audit.id}/fix-kit\\?capability=review-pricing&profile=browser$`));
  // The offline product-flow test downloads a real stored brief. This fixture
  // checks that changing perspective updates both visible changes and its URL.
  await page.getByRole('combobox', { name: 'Agent perspective', exact: true }).selectOption('html');
  await expect(page.getByRole('heading', { name: 'Review initial HTML content', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Name the pricing link', exact: true })).toHaveCount(0);
  await expect(brief).toHaveAttribute('href', /capability=review-pricing&profile=html$/);
  await page.getByRole('combobox', { name: 'Agent perspective', exact: true }).selectOption('api');
  await expect(page.getByRole('heading', { name: 'Destination not inspected', exact: true })).toBeVisible();
  await expect(page.getByText('No scoped changes identified.', { exact: true })).toBeVisible();
  await expect(page.locator('.unknown-destination')).toHaveText(`${url}pricing`);
  await expect(page.getByText('Not task-verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Set up trial', exact: true }).click();
  await expect(page.getByLabel('Browsing goal', { exact: true })).toHaveValue(/Pricing/);
  await expect(page.getByLabel('Expected value', { exact: true })).toHaveValue('/pricing');
  await expect(page.getByRole('combobox', { name: 'Success condition', exact: true })).toHaveValue('url_contains');
  expect(mutations).toEqual([]);
});

test('unavailable saved reports show a recoverable error, and expired sessions return to login', async ({ page }) => {
  await authenticate(page);
  await page.goto('/?audit=00000000-0000-4000-8000-000000000099');
  await expect(page.getByRole('alert')).toContainText('Audit not found');
  await page.getByRole('button', { name: 'New audit', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Make your website/ })).toBeVisible();
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Installation access token')).toBeVisible();
});
