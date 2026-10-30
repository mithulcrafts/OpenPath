import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilityFindings, exportCapabilityBrief, getCapabilities } from '../shared/capabilities.js';
import type { Audit, Evidence, Finding, PageEvidence } from '../shared/types.js';

function page(id: string, pathname: string, overrides: Partial<PageEvidence> = {}): PageEvidence {
  return { id, url: `https://product.example${pathname}`, title: 'Northstar', status: 200, rawTextLength: 500, renderedTextLength: 500,
    text: 'Northstar workspace', headings: ['Northstar'], controls: [], links: [], structuredData: { valid: 0, invalid: 0, types: [] },
    consoleErrors: [], requestErrors: [], inspectedAt: '2026-10-31T00:00:00.000Z', ...overrides };
}
function audit(pages: PageEvidence[], overrides: Partial<Audit> = {}): Audit {
  return { id: 'audit', url: 'https://product.example/', domain: 'product.example', status: 'complete', createdAt: '2026-10-31T00:00:00.000Z',
    progress: 100, events: [], pages, evidence: [], findings: [], checks: [], summary: 'Captured pages.', model: { mode: 'rules', name: 'none', note: '' },
    limitations: ['Only inspected public pages.'], isDemo: false, ...overrides };
}
function finding(id: string, evidenceIds: string[], profiles: Finding['profiles']): Finding {
  return { id, evidenceIds, profiles, category: 'readability', severity: 'medium', title: `Change ${id}`, observation: 'Captured text depends on rendering.',
    impact: 'An HTML reader may miss it.', kind: 'observed', fix: 'Expose the required information in the initial document.', verification: 'Fetch and inspect the initial HTML.', source: 'rule' };
}
const ev = (id: string, pageId: string): Evidence => ({ id, pageId, url: `https://product.example/${pageId}`, description: `${pageId} captured evidence` });

test('sparse and failed captures do not invent product features or successful tasks', () => {
  assert.deepEqual(getCapabilities(audit([])), []);
  const limited = getCapabilities(audit([page('home', '/', { title: '', headings: [], error: 'Timeout', status: 0 })]));
  assert.equal(limited.length, 1);
  assert.equal(limited[0].id, 'understand-product');
  assert.equal(limited[0].source, 'inferred');
  assert.equal(limited[0].suggestedAssertion, undefined);
  assert(limited[0].unknowns.some(item => item.includes('did not load')));
  assert(limited[0].unknowns.some(item => item.includes('not established')));
  assert.deepEqual(limited[0].route, [{ pageId: 'home' }]);
});

test('captured links form the route; duplicate fragments produce one capability', () => {
  const report = audit([
    page('home', '/', { links: [{ text: 'Products', href: '/products#top' }, { text: 'Products', href: '/products/' }] }),
    page('products', '/products', { title: 'Products', links: [{ text: 'Compare', href: '/compare#models' }, { text: 'Compare', href: '/compare' }] }),
    page('compare', '/compare/', { title: 'Compare products' }),
  ]);
  const capabilities = getCapabilities(report);
  const comparison = capabilities.find(item => item.id === 'compare-products')!;
  assert.equal(capabilities.filter(item => item.id === 'compare-products').length, 1);
  assert.deepEqual(comparison.route, [{ pageId: 'home' }, { pageId: 'products', linkedFromPageId: 'home' }, { pageId: 'compare', linkedFromPageId: 'products' }]);
  assert.deepEqual(comparison.suggestedAssertion, { kind: 'url_contains', value: '/compare' });
  assert.equal(comparison.targetPageId, 'compare', 'A trailing slash must not make a captured destination look unknown');
  assert(comparison.unknowns.some(item => item.includes('not established')));
  assert.equal(comparison.unknowns.some(item => item.includes('not inspected')), false);
});

test('an uncaptured comparison destination stays unknown; external or non-web links do not create capabilities', () => {
  const report = audit([page('home', '/', { links: [
    { text: 'Compare models', href: '/compare' },
    { text: 'API documentation', href: 'https://external.example/api' },
    { text: 'Contact', href: 'mailto:sales@example.com' },
    { text: 'Search', href: 'javascript:search()' },
  ] })]);
  const capabilities = getCapabilities(report);
  assert.deepEqual(capabilities.map(item => item.id), ['compare-products']);
  assert.deepEqual(capabilities[0].pageIds, ['home']);
  assert.deepEqual(capabilities[0].route, [{ pageId: 'home' }]);
  assert.equal(capabilities[0].targetUrl, 'https://product.example/compare');
  assert.equal(capabilities[0].targetPageId, undefined);
  assert(capabilities[0].unknowns.some(item => item.includes('not inspected')));
  assert.match(exportCapabilityBrief(report, capabilities[0], 'browser'), /Uninspected link destination/);
});

test('disconnected captured pages are not represented as observed transitions', () => {
  const report = audit([page('home', '/'), page('pricing', '/pricing', { title: 'Pricing' })]);
  const pricing = getCapabilities(report).find(item => item.id === 'review-pricing')!;
  assert.deepEqual(pricing.route, [{ pageId: 'home' }, { pageId: 'pricing' }]);
  assert(pricing.unknowns.some(item => item.includes('No captured hyperlink')));
});

test('findings and exports stay scoped to route evidence and the selected access profile', () => {
  const report = audit([
    page('home', '/', { links: [{ text: 'Pricing', href: '/pricing' }, { text: 'Documentation', href: '/docs' }] }),
    page('pricing', '/pricing', { title: 'Pricing' }),
    page('docs', '/docs', { title: 'Documentation' }),
  ], {
    evidence: [ev('ev-home', 'home'), ev('ev-pricing', 'pricing'), ev('ev-docs', 'docs')],
    findings: [finding('html-only', ['ev-pricing', 'ev-docs'], ['html']), finding('browser-only', ['ev-home'], ['browser']), finding('docs-only', ['ev-docs'], ['html'])],
  });
  const pricing = getCapabilities(report).find(item => item.id === 'review-pricing')!;
  const html = capabilityFindings(report, pricing, 'html');
  assert.deepEqual(html.map(item => item.id), ['html-only']);
  assert.deepEqual(html[0].evidenceIds, ['ev-pricing']);
  assert.deepEqual(capabilityFindings(report, pricing, 'browser').map(item => item.id), ['browser-only']);
  assert.deepEqual(capabilityFindings(report, pricing, 'api'), []);
  const brief = exportCapabilityBrief(report, pricing, 'html');
  assert.match(brief, /pricing captured evidence/);
  assert.doesNotMatch(brief, /docs captured evidence/);
  assert.doesNotMatch(brief, /Change docs-only/);
  assert.match(brief, /not completed agent actions/);
  assert.match(brief, /Proposed changes have not been applied/);
  assert.match(brief, /untrusted evidence/);
  assert.match(brief, /deterministic signals/);
  assert.match(exportCapabilityBrief(report, pricing, 'api'), /not proof of compatibility/);
  assert.deepEqual(report.findings[0].evidenceIds, ['ev-pricing', 'ev-docs'], 'Source audit must not be mutated');
});

test('contact capability requires handoff and offers no automated submission task', () => {
  const report = audit([page('home', '/', { links: [{ text: 'Request a demo', href: '/contact' }] })]);
  const contact = getCapabilities(report).find(item => item.id === 'contact-team')!;
  assert.equal(contact.handoff, true);
  assert.equal(contact.suggestedTask, undefined);
  assert.equal(contact.suggestedAssertion, undefined);
  assert(contact.unknowns.some(item => item.includes('outside the supported')));
});

test('scoped recommendations hide unrelated input examples for captured select controls without rewriting the audit', () => {
  const inputExample = '<label htmlFor="work-email">Work email</label><input id="work-email" type="email" />';
  const selectExample = '<label for="plan">Plan</label><select id="plan"><option>Team</option></select>';
  const report = audit([
    page('home', '/', { links: [{ text: 'Pricing', href: '/pricing' }] }),
    page('pricing', '/pricing', { title: 'Pricing' }),
    page('docs', '/docs', { title: 'Documentation' }),
  ], {
    evidence: [
      { ...ev('ev-pricing', 'pricing'), snippet: '<SELECT id="plan"><option>Team</option></SELECT>' },
      { ...ev('ev-docs', 'docs'), snippet: '<input type="email">' },
    ],
    findings: [
      { ...finding('generic-label', ['ev-pricing', 'ev-docs'], ['browser']), code: inputExample },
      { ...finding('select-label', ['ev-pricing'], ['browser']), code: selectExample },
    ],
  });
  const pricing = getCapabilities(report).find(item => item.id === 'review-pricing')!;
  const scoped = capabilityFindings(report, pricing, 'browser');
  assert.equal(scoped.find(item => item.id === 'generic-label')?.code, undefined);
  assert.equal(scoped.find(item => item.id === 'select-label')?.code, selectExample);
  assert.equal(report.findings[0].code, inputExample, 'Preserve the original recorded audit');
  const brief = exportCapabilityBrief(report, pricing, 'browser');
  assert.doesNotMatch(brief, /work-email/);
  assert.match(brief, /<select id="plan">/);
  assert.match(brief, /Change generic-label/, 'Keep the supported finding and fix text');
});

test('capability brief API validates scope and preserves the original full export', async () => {
  const { createApp, errorHandler } = await import('../server/app.js');
  const { mkdir, mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const http = await import('node:http');
  const temp = await mkdtemp(path.join(tmpdir(), 'openpath-capability-api-'));
  const previousData = process.env.OPENPATH_DATA_DIR;
  const previousToken = process.env.APP_ACCESS_TOKEN;
  process.env.OPENPATH_DATA_DIR = temp;
  process.env.APP_ACCESS_TOKEN = 'capability-api-test-token';
  const app = createApp();
  app.use(errorHandler);
  const server = http.createServer(app);
  try {
    const report = audit([page('home', '/', { links: [{ text: 'Pricing', href: '/pricing' }] })], { id: '00000000-0000-4000-8000-000000000001' });
    await mkdir(path.join(temp, 'audits'));
    await writeFile(path.join(temp, 'audits', `${report.id}.json`), JSON.stringify(report));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/audits/${report.id}/fix-kit`;
    const headers = { Authorization: 'Bearer capability-api-test-token' };
    assert.equal((await fetch(`${url}?capability=review-pricing`)).status, 401);
    const scoped = await fetch(`${url}?capability=review-pricing&profile=html`, { headers });
    assert.equal(scoped.status, 200);
    assert.match(scoped.headers.get('content-disposition') || '', /review-pricing-html-brief\.md/);
    const brief = await scoped.text();
    assert.match(brief, /Access profile: HTML reader/);
    assert.match(brief, /Uninspected link destination/);
    const original = await fetch(url, { headers });
    assert.equal(original.status, 200);
    assert.match(await original.text(), /# OpenPath agent-compatibility change brief/);
    assert.equal((await fetch(`${url}?capability=missing`, { headers })).status, 404);
    assert.equal((await fetch(`${url}?capability=review-pricing&profile=universal`, { headers })).status, 400);
    assert.equal((await fetch(`${url}?capability=review-pricing&profile=html&profile=api`, { headers })).status, 400);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousData === undefined) delete process.env.OPENPATH_DATA_DIR; else process.env.OPENPATH_DATA_DIR = previousData;
    if (previousToken === undefined) delete process.env.APP_ACCESS_TOKEN; else process.env.APP_ACCESS_TOKEN = previousToken;
    const resolved = path.resolve(temp);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('openpath-capability-api-')) throw new Error('Unsafe test cleanup path.');
    await rm(resolved, { recursive: true, force: true });
  }
});
