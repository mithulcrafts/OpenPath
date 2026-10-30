import type { Audit, AuditComparison, CheckStatus, RunComparison, TaskRun } from '../shared/types.js';
import { isDemoUrl } from './config.js';

const counts = (audit: Audit) => {
  const result: Record<CheckStatus, number> = { pass: 0, warning: 0, fail: 0, not_tested: 0 };
  for (const check of audit.checks) result[check.status]++;
  return result;
};
const bad = (status?: CheckStatus) => status === 'warning' || status === 'fail';

export function compareAudits(before: Audit, after: Audit): AuditComparison {
  const controlledPair = isDemoUrl(before.url) && isDemoUrl(after.url);
  const scope = (audit: Audit) => [...new Set(audit.pages.map(page => {
    const url = new URL(page.url);
    // Only the application's controlled variants receive this path mapping.
    // Arbitrary staging/production URLs are never assumed to be equivalent.
    if (controlledPair) url.pathname = url.pathname.replace(/^\/demo\/(broken|fixed)(?=\/|$)/, '/demo/variant');
    url.hash = '';
    return url.href;
  }))].sort();
  const beforePages = scope(before); const afterPages = scope(after);
  const scopeMatched = before.status === 'complete' && after.status === 'complete'
    && beforePages.length > 0 && JSON.stringify(beforePages) === JSON.stringify(afterPages)
    && [...before.pages, ...after.pages].every(page => !page.error && page.status >= 200 && page.status < 400);
  const ids = [...new Set([...before.checks, ...after.checks].map(check => check.id))];
  const changes: AuditComparison['changes'] = ids.map(id => {
    const old = before.checks.find(check => check.id === id);
    const next = after.checks.find(check => check.id === id);
    let transition: AuditComparison['changes'][number]['transition'] = 'unverified';
    if (scopeMatched && old && next && old.status !== 'not_tested' && next.status !== 'not_tested') {
      transition = old.status === next.status ? 'unchanged'
        : bad(old.status) && next.status === 'pass' ? 'improved'
        : old.status === 'pass' && bad(next.status) ? 'regressed' : 'unchanged';
    }
    return { id, name: (next || old)!.name, category: (next || old)!.category,
      before: old?.status, after: next?.status, transition,
      beforeEvidenceIds: old?.evidenceIds || [], afterEvidenceIds: next?.evidenceIds || [] };
  });
  return { beforeId: before.id, afterId: after.id, scopeMatched, beforePages, afterPages,
    counts: { before: counts(before), after: counts(after) }, changes,
    limitations: [
      'Check changes describe inspected evidence, not universal agent compatibility or task success.',
      'A missing or untested check is not a verified fix.',
      ...(!scopeMatched ? ['Page coverage or inspection success differs. Changes remain unverified until matching pages are inspected successfully.'] : []),
      ...(controlledPair ? ['The controlled broken/fixed routes are mapped to equivalent paths. The fixed variant is predefined, not an automatic repair.'] : []),
    ] };
}

export function runSettingsMismatches(before: TaskRun, after: Pick<TaskRun, 'goal' | 'model' | 'promptVersion' | 'profile' | 'maxSteps' | 'maxDurationMs' | 'assertions'>): string[] {
  const fields = ['goal', 'model', 'promptVersion', 'profile', 'maxSteps', 'maxDurationMs'] as const;
  const reasons = fields.filter(field => before[field] !== after[field]).map(field => `Different ${field}.`);
  if (JSON.stringify(before.assertions) !== JSON.stringify(after.assertions)) reasons.push('Different success conditions.');
  return reasons;
}

export function compareRuns(before: TaskRun, after: TaskRun): RunComparison {
  const reasons = runSettingsMismatches(before, after);
  if (before.status !== 'complete' || after.status !== 'complete') reasons.push('Both attempts must finish first.');
  const scripted = before.model === 'openpath-demo-simulator' && after.model === 'openpath-demo-simulator';
  if (!scripted) {
    const deployment = (run: TaskRun) => [...new Set((run.inference || []).map(record => JSON.stringify([record.provider, record.endpointOrigin, record.requestedModel, record.responseModel])))].sort();
    if (![before, after].every(run => run.inference?.length && run.inference.every(record => record.status === 'succeeded' && record.responseModel))) {
      reasons.push('Successful inference metadata is incomplete.');
    } else if (JSON.stringify(deployment(before)) !== JSON.stringify(deployment(after))) reasons.push('Different recorded model providers or deployments.');
  }
  const completed = (run: TaskRun) => run.outcome === 'completed' && run.checks.length === run.assertions.length && run.checks.length > 0 && run.checks.every(check => check.passed);
  if ([before, after].some(run => run.outcome === 'completed' && !completed(run))) reasons.push('A completion claim lacks matching independent checks.');
  if ([before, after].some(run => !run.outcome || ['blocked', 'inconclusive'].includes(run.outcome))) reasons.push('A blocked or inconclusive attempt cannot establish improvement.');
  const comparable = reasons.length === 0;
  const transition: RunComparison['transition'] = !comparable ? 'unverified'
    : before.outcome === 'failed' && completed(after) ? 'improved'
    : completed(before) && after.outcome === 'failed' ? 'regressed'
    : before.outcome === after.outcome ? 'unchanged' : 'changed';
  const snapshot = (run: TaskRun) => ({ outcome: run.outcome, checks: run.checks, steps: run.steps.filter(step => step.action !== 'Open website').length, durationMs: run.durationMs, model: run.model });
  return { beforeId: before.id, afterId: after.id, comparable, reasons, transition, before: snapshot(before), after: snapshot(after), limitations: [
    'This compares two recorded attempts. It does not establish a success rate or prove which change caused an outcome.',
    'Fresh browser contexts are used, but content, network conditions and model behavior can vary.',
    ...(scripted ? ['Both attempts use scripted demo decisions. No NVIDIA model behavior is measured.'] : []),
  ] };
}
