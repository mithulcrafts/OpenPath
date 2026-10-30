import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';

// Run against the local, already-running application. Credentials stay in the
// environment; the report contains only controlled-demo results and metadata.
const root = process.cwd();
const local = await readFile(path.join(root, '.env'), 'utf8').then(parse).catch(() => ({}));
const setting = (name, fallback = '') => process.env[name]?.trim() || local[name]?.trim() || fallback;
const origin = `http://127.0.0.1:${Number(setting('PORT', '4173'))}`;
const accessToken = setting('APP_ACCESS_TOKEN');
const headers = { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) };
const report = { startedAt: new Date().toISOString(), connection: undefined, audits: [], runs: [], limitations: [
  'One run per variant is not a benchmark or proof of general reliability.',
  'Both storefront variants are predefined. No automatic source repair is claimed.',
  'Inference records are application observations, not independent provider attestations.',
] };
const folder = path.resolve(root, setting('OPENPATH_DATA_DIR', 'data'), 'verification');
const filename = path.join(folder, `live-${Date.now()}.json`);

async function request(route, body) {
  const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(70000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${route}: ${result.error || `HTTP ${response.status}`}`);
  return result;
}
async function waitFor(route, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let previous = '';
  while (Date.now() < deadline) {
    const result = await request(route);
    if (result.status !== previous) {
      console.log(`${route}: ${result.status}`);
      previous = result.status;
    }
    if (['complete', 'failed'].includes(result.status)) return result;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`${route}: verification timed out. The server may still be finishing the queued job.`);
}
function verifyRecords(records, label) {
  if (!records?.length || !records.every(record => record.provider === 'nebius' && record.status === 'succeeded' && /^nvidia\//i.test(record.requestedModel))) {
    throw new Error(`${label}: successful NVIDIA inference on Nebius was not verified. Inspect the saved report.`);
  }
}
async function save() {
  await mkdir(folder, { recursive: true });
  await writeFile(filename, JSON.stringify(report, null, 2));
}

try {
  const health = await request('/api/health');
  if (health.aiEnabled === false) throw new Error('Set OPENPATH_AI_ENABLED=true before live verification. No inference was attempted.');
  if (health.ai === 'unconfigured') throw new Error('Add NEBIUS_API_KEY to .env before live verification. No inference was attempted.');
  if (!health.browserInstalled || !health.demoAvailable) throw new Error('Install Chromium and build the demo before live verification.');
  if (!/^nvidia\//i.test(health.model)) throw new Error('Select an account-supported NVIDIA model in NEBIUS_MODEL first.');
  console.log(`Verifying ${health.model} through the local application. This uses real Token Factory credits.`);
  report.connection = await request('/api/connection/test', {});
  verifyRecords(report.connection.inference, 'Connection test');
  await save();
  for (const [variant, url] of [['broken', health.demoUrl], ['fixed', health.fixedDemoUrl]]) {
    const queued = await request('/api/audits', { url, ...(report.audits[0] ? { compareWith: report.audits[0].id } : {}) });
    const audit = await waitFor(`/api/audits/${queued.id}`, 240000);
    report.audits.push(audit);
    await save();
    if (audit.status !== 'complete' || audit.model.mode !== 'nemotron') throw new Error(`${variant} audit did not complete with model analysis: ${audit.error || audit.model.note}`);
    verifyRecords(audit.inference, `${variant} review`);
    const attempt = await request('/api/runs', { auditId: audit.id, ...(report.runs[0] ? { compareWith: report.runs[0].id } : {}) });
    const run = await waitFor(`/api/runs/${attempt.id}`, 180000);
    report.runs.push(run);
    await save();
    console.log(`${variant} trial outcome: ${run.outcome}. Independent checks: ${run.checks.filter(check => check.passed).length}/${run.checks.length}.`);
    verifyRecords(run.inference, `${variant} trial`);
    if (run.outcome === 'inconclusive') throw new Error(`${variant} trial was inconclusive: ${run.explanation}`);
  }
  report.auditComparison = await request(`/api/audits/${report.audits[1].id}/comparison`);
  report.runComparison = await request(`/api/runs/${report.runs[1].id}/comparison`);
  report.completedAt = new Date().toISOString();
  report.fixedTaskCompleted = report.runs[1].outcome === 'completed' && report.runs[1].checks.length > 0 && report.runs[1].checks.every(check => check.passed);
  if (!report.fixedTaskCompleted) process.exitCode = 2;
  console.log('Live inference recorded. Use the actual outcomes in the demo, including any failures.');
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Verification failed.';
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await save();
  console.log(`Private verification report: ${filename}`);
}
