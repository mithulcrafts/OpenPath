import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAudits, compareRuns } from '../server/comparison.js';
import { exportFixKit } from '../server/report.js';
import type { Audit, CheckStatus, InferenceRecord, TaskRun } from '../shared/types.js';

const audit = (id: string, status: CheckStatus, variant = 'broken'): Audit => ({
  id, url: `http://127.0.0.1:4173/demo/${variant}/product`, domain: '127.0.0.1:4173', status: 'complete', createdAt: '2026-10-30T00:00:00Z', progress: 100, events: [],
  pages: [{ id: 'page-1', url: `http://127.0.0.1:4173/demo/${variant}/product`, title: 'Store', status: 200, rawTextLength: 100, renderedTextLength: 100, text: 'Store', headings: ['Store'], controls: [], links: [], structuredData: { valid: 0, invalid: 0, types: [] }, consoleErrors: [], requestErrors: [], inspectedAt: '2026-10-30T00:00:00Z' }],
  evidence: [], findings: [], checks: [{ id: 'button-names', name: 'Button names', category: 'interactions', status, detail: 'Observed check', evidenceIds: status === 'warning' ? ['ev-1'] : [] }],
  summary: 'Observed check results', model: { mode: 'rules', name: 'none', note: 'No inference' }, limitations: [], isDemo: true,
});
const run = (id: string, outcome: 'completed' | 'failed' | 'inconclusive'): TaskRun => ({
  id, auditId: 'audit', startUrl: 'http://127.0.0.1:4173/demo/fixed/product', goal: 'Add one item', assertions: [{ kind: 'fixture_cart', sku: 'tee', color: 'blue', size: 'M', quantity: 1 }], status: 'complete', outcome,
  createdAt: '2026-10-30T00:00:00Z', steps: [], checks: [{ description: 'Cart matches', passed: outcome === 'completed', actual: outcome }], explanation: '', model: 'openpath-demo-simulator', profile: 'rendered-dom', promptVersion: 'demo-v1', maxSteps: 12, maxDurationMs: 120000,
});

test('paired controlled variants compare stable checks and export their evidence changes', () => {
  process.env.PORT = '4173';
  const before = audit('before', 'warning'); const after = audit('after', 'pass', 'fixed');
  const comparison = compareAudits(before, after);
  assert.equal(comparison.scopeMatched, true);
  assert.equal(comparison.changes[0].transition, 'improved');
  assert.deepEqual(comparison.changes[0].beforeEvidenceIds, ['ev-1']);
  assert.equal(comparison.counts.before.warning, 1);
  assert.equal(comparison.counts.after.pass, 1);
  assert.match(exportFixKit(after, [], comparison), /warning → pass \(improved\)/);
});

test('a missing, untested or failed-to-render page cannot become a verified fix', () => {
  const before = audit('before', 'warning'); const after = audit('after', 'not_tested', 'fixed');
  assert.equal(compareAudits(before, after).changes[0].transition, 'unverified');
  after.checks[0].status = 'pass'; after.pages[0].error = 'Page did not render';
  assert.equal(compareAudits(before, after).scopeMatched, false);
  assert.equal(compareAudits(before, after).changes[0].transition, 'unverified');
  after.pages = [];
  assert.equal(compareAudits(before, after).scopeMatched, false);
});

test('public staging and production domains are not silently treated as matching scope', () => {
  const before = audit('before', 'warning'); const after = audit('after', 'pass');
  before.url = before.pages[0].url = 'https://staging.example.com/product';
  after.url = after.pages[0].url = 'https://example.com/product';
  assert.equal(compareAudits(before, after).scopeMatched, false);
});

test('unchanged scripted success is not shown as an improvement or NVIDIA measurement', () => {
  const comparison = compareRuns(run('before', 'completed'), run('after', 'completed'));
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.transition, 'unchanged');
  assert(comparison.limitations.some(limit => limit.includes('No NVIDIA')));
});

test('actual failed-to-passed attempts require matching settings and independent checks', () => {
  const before = run('before', 'failed'); const after = run('after', 'completed');
  assert.equal(compareRuns(before, after).transition, 'improved');
  after.maxSteps = 24;
  assert.equal(compareRuns(before, after).comparable, false);
  after.maxSteps = 12; after.checks[0].passed = false;
  assert.equal(compareRuns(before, after).transition, 'unverified');
});

test('inconclusive attempts and different provider deployments cannot establish improvement', () => {
  assert.equal(compareRuns(run('before', 'inconclusive'), run('after', 'completed')).transition, 'unverified');
  const before = run('before', 'failed'); const after = run('after', 'completed');
  before.model = after.model = 'nvidia/example';
  assert.equal(compareRuns(before, after).comparable, false);
  const record: InferenceRecord = { id: 'call', provider: 'nebius', endpointOrigin: 'https://api.tokenfactory.nebius.com', requestedModel: 'nvidia/example', responseModel: 'nvidia/example', tool: 'browser_action', startedAt: '', durationMs: 10, status: 'succeeded' };
  before.inference = [record]; after.inference = [{ ...record, provider: 'custom', endpointOrigin: 'http://localhost:1234' }];
  assert.equal(compareRuns(before, after).comparable, false);
  after.inference = [{ ...record }];
  assert.equal(compareRuns(before, after).transition, 'improved');
});
