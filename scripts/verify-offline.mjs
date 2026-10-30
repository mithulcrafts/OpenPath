import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

// Exercise the compiled production server in its own data directory. AI is
// explicitly disabled, even if the parent environment or .env contains a key.
const root = process.cwd();
const folder = path.join(root, 'data', 'verification', `offline-${Date.now()}`);
await mkdir(folder, { recursive: true });
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const publicIndex = process.argv.indexOf('--public-url');
const publicUrl = publicIndex >= 0 ? process.argv[publicIndex + 1] : undefined;
const token = randomUUID() + randomUUID();
const report = { mode: 'offline-production-verification', startedAt: new Date().toISOString(), checks: [], audits: [], runs: [] };
let child;
let cookie = '';
let output = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function checked(label) { report.checks.push(label); console.log(`PASS ${label}`); }

function launch() {
  output = '';
  child = spawn(process.execPath, ['--import', './scripts/production.mjs', 'dist/server/index.js'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', OPENPATH_DATA_DIR: path.join(folder, 'store'),
      APP_ACCESS_TOKEN: token, OPENPATH_AI_ENABLED: 'false', OPENPATH_DEMO_MODE: 'true', NEBIUS_API_KEY: '', CHROMIUM_NO_SANDBOX: 'false' },
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-5000); });
}
async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Production server exited during startup: ${output}`);
    try {
      const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return await response.json();
    } catch { /* The server has not bound its port yet. */ }
    await pause(250);
  }
  throw new Error(`Production server did not become ready: ${output}`);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  await new Promise(resolve => {
    const timer = setTimeout(() => current.kill(), 10000);
    current.once('exit', () => { clearTimeout(timer); resolve(); });
    if (current.connected) current.send('openpath:shutdown'); else current.kill();
  });
}
async function request(route, { body, authorised = true, expected = 200, binary = false, text = false, baseUrl = origin } = {}) {
  const response = await fetch(baseUrl + route, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorised && cookie ? { Cookie: cookie } : {}) }, redirect: 'manual',
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if(response.status !== expected)throw new Error(`${route}: expected HTTP ${expected}, received ${response.status}: ${(await response.text()).slice(0,500)}`);
  if (route === '/api/auth' && response.ok) cookie = response.headers.get('set-cookie').split(';')[0];
  if (binary) return Buffer.from(await response.arrayBuffer());
  if (text) return response.text();
  return response.json();
}
async function waitFor(route, limitMs = 180000) {
  const deadline = Date.now() + limitMs;
  while (Date.now() < deadline) {
    const value = await request(route);
    if (value.status === 'failed') throw new Error(value.error || `${route} failed.`);
    if (value.status === 'complete') return value;
    await pause(500);
  }
  throw new Error(`${route}: job did not finish within the verification deadline.`);
}

try {
  launch();
  const health = await ready();
  assert.equal(health.aiEnabled, false);
  assert.equal(health.ai, 'unconfigured');
  assert.equal(health.trialMode, 'scripted-demo');
  assert.equal(health.needsAuth, true);
  assert.equal(health.browserInstalled, true);
  checked('Production startup, installed browser and explicit offline mode');
  await request('/', { text: true, authorised: false, expected: 302 });
  assert.match(await request('/login', { text: true, authorised: false }), /Installation access token/);
  await request('/api/audits', { authorised: false, expected: 401 });
  await request('/api/auth', { body: { token }, authorised: false });
  assert.equal((await request('/api/health')).needsAuth, false);
  checked('Private API protection and installation session login');
  const html = await request('/', { text: true });
  assert.match(html, /id="root"/);
  checked('Compiled React application is served after login');
  await request('/api/connection/test', { body: {}, expected: 409 });
  await request('/api/audits', { body: { url: 'http://169.254.169.254/latest/meta-data/' }, expected: 400 });
  checked('No-key model calls and private-network targets are refused');
  for (const [variant, url] of [['broken', health.demoUrl], ['fixed', health.fixedDemoUrl]]) {
    const enteredUrl = variant === 'broken' ? url.replace('127.0.0.1', 'localhost') : url;
    const queued = await request('/api/audits', { body: { url: enteredUrl, ...(report.audits[0] ? { compareWith: report.audits[0].id } : {}) }, expected: 202,
      baseUrl: variant === 'broken' ? `http://localhost:${port}` : origin });
    const audit = await waitFor(`/api/audits/${queued.id}`);
    assert.equal(audit.url, url, 'Visible localhost demo URLs must map to the server sandbox.');
    assert.equal(audit.model.mode, 'rules');
    assert.equal(audit.inference?.length || 0, 0);
    assert(audit.pages.length > 0 && audit.pages.length <= 4);
    assert.equal(audit.checks.find(check => check.id === 'button-names')?.status, variant === 'broken' ? 'warning' : 'pass');
    report.audits.push(audit);
    const png = await request(audit.pages[0].screenshot, { binary: true });
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    await writeFile(path.join(folder, `${variant}-page.png`), png);
    const attempt = await request('/api/runs', { body: { auditId: audit.id, ...(report.runs[0] ? { compareWith: report.runs[0].id } : {}) }, expected: 202 });
    const run = await waitFor(`/api/runs/${attempt.id}`);
    assert.equal(run.outcome, 'completed', run.explanation);
    assert(run.checks.length > 0 && run.checks.every(check => check.passed));
    assert.equal(run.inference?.length || 0, 0);
    assert.match(run.explanation, /Scripted demo only/);
    report.runs.push(run);
    const trace = await request(run.trace, { binary: true });
    assert.equal(trace.subarray(0, 2).toString(), 'PK');
    const brief = await request(`/api/audits/${audit.id}/fix-kit`, { text: true });
    assert.match(brief, /Deterministic rules; no AI analysis claimed/);
    await writeFile(path.join(folder, `${variant}-fix-kit.md`), brief);
    checked(`${variant}: queued audit, real PNG evidence, scripted cart check, trace and Markdown export`);
  }
  report.auditComparison = await request(`/api/audits/${report.audits[1].id}/comparison`);
  assert.equal(report.auditComparison.scopeMatched, true);
  assert.equal(report.auditComparison.changes.find(change => change.id === 'button-names')?.transition, 'improved');
  report.runComparison = await request(`/api/runs/${report.runs[1].id}/comparison`);
  assert.equal(report.runComparison.comparable, true);
  assert.equal(report.runComparison.transition, 'unchanged');
  checked('Before/after reports distinguish a corrected check from unchanged task success');
  if (publicUrl) {
    const queued = await request('/api/audits', { body: { url: publicUrl }, expected: 202 });
    const audit = await waitFor(`/api/audits/${queued.id}`);
    assert.equal(audit.model.mode, 'rules');
    assert(audit.pages.some(page => !page.error && page.status >= 200 && page.status < 400), 'At least one public page must render successfully.');
    report.publicAudit = audit;
    checked('Public HTTP/DNS/browser inspection with AI explicitly disabled');
  }
  await stop(); launch(); await ready();
  assert.equal((await request('/api/audits')).audits.length, publicUrl ? 3 : 2);
  assert.equal((await request(`/api/runs/${report.runs[1].id}`)).outcome, 'completed');
  checked('Completed reports and task outcomes survive a production restart');
  report.completedAt = new Date().toISOString();
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Offline verification failed.';
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await stop();
  await writeFile(path.join(folder, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Verification artifacts: ${folder}`);
  console.log('No AI provider was called. Scripted results do not measure NVIDIA behavior.');
}
