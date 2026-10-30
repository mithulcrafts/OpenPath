import { useState } from 'react';
import { CATEGORY_META } from '../shared/types.js';
import type { Audit, AuditComparison, AuditSummary, Category, Finding, InferenceRecord, Profile, RunComparison, TaskRun } from '../shared/types.js';

export const profiles: Record<Profile, string> = { html: 'HTML readers', browser: 'Browser agents', api: 'API clients' };
export const categoryKeys = Object.keys(CATEGORY_META) as Category[];
const severityTone = (severity: Finding['severity']) => ({ high: 'danger', medium: 'warn', low: 'info', info: 'muted' })[severity];
export const stateLabel = (value?: string) => value === 'not_tested' ? 'not tested' : value || 'not present';
export const verifiedNebius = (records?: InferenceRecord[]) => !!records?.some(record => record.status === 'succeeded' && record.provider === 'nebius' && /^nvidia\//i.test(record.requestedModel) && /^nvidia\//i.test(record.responseModel || ''));

export function HistoryPanel({ history, currentId, onOpen }: { history: AuditSummary[]; currentId?: string; onOpen: (id: string) => void }) {
  return <section className="panel history-panel" aria-label="Audit history"><h2>Recent audits</h2><p className="muted">Opening a report uses no AI credits.</p>
    {history.length ? history.map(item => <button className={`history-row ${item.id === currentId ? 'selected' : ''}`} key={item.id} onClick={() => onOpen(item.id)}>
      <span><b>{item.domain}</b><small>{new URL(item.url).pathname} · {new Date(item.createdAt).toLocaleString()}</small></span><span>{item.status} · {item.findingCount} findings</span>
    </button>) : <p className="empty">No saved audits yet.</p>}
  </section>;
}

export function CheckGroups({ audit }: { audit: Audit }) {
  return <div className="check-groups">{categoryKeys.map(category => <section className="panel" key={category}>
    <h3>{CATEGORY_META[category].title}</h3><p className="muted">{CATEGORY_META[category].question}</p>
    {audit.checks.filter(check => check.category === category).map(check => <details className="check-row" key={check.id}>
      <summary><span>{check.name}</span><span className={`check-state ${check.status}`}>{stateLabel(check.status)}</span></summary>
      <p>{check.detail}</p><small>{check.evidenceIds.length ? `Evidence: ${check.evidenceIds.join(', ')}` : 'No issue-specific evidence recorded.'}</small>
    </details>)}
  </section>)}</div>;
}

export function Overview({ audit }: { audit: Audit }) {
  return <><div className="overview-grid"><section className="panel"><h3>What an agent sees</h3>
    {audit.pages.map(page => <div className="page-row" key={page.id}><div className="page-icon">{page.error ? '!' : '⌁'}</div><div><b>{page.title || page.url}</b><span>{new URL(page.url).pathname} · {page.controls.length} controls</span>{page.error && <span>{page.error}</span>}</div><span className={`status-dot ${page.error || page.status >= 400 ? 'bad' : 'good'}`} /></div>)}
  </section><section className="panel"><h3>Top opportunities</h3>
    {audit.findings.length ? [...audit.findings].sort((a, b) => ['high', 'medium', 'low', 'info'].indexOf(a.severity) - ['high', 'medium', 'low', 'info'].indexOf(b.severity)).slice(0, 3).map(finding => <div className="finding-mini" key={finding.id}><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><div><b>{finding.title}</b><span>{finding.observation}</span></div></div>) : <p className="empty">No findings in the inspected scope.</p>}
  </section></div><CheckGroups audit={audit} /></>;
}

export function AuditComparisonPanel({ comparison, onOpen }: { comparison: AuditComparison; onOpen: (id: string) => void }) {
  return <section className="panel comparison-panel" aria-label="Audit comparison"><h3>Before / after audit</h3>
    <p className={comparison.scopeMatched ? 'muted' : 'warning-text'}>{comparison.scopeMatched ? 'Matching inspected scope.' : 'Different inspected scope: changes are not verified improvements.'}</p>
    <button className="link-button" onClick={() => onOpen(comparison.beforeId)}>Open baseline report</button>
    <div className="table-scroll"><table><caption>Recorded check changes</caption><thead><tr><th>Check</th><th>Before</th><th>After</th><th>Result</th></tr></thead><tbody>
      {comparison.changes.map(change => <tr key={change.id}><th scope="row">{change.name}</th><td>{stateLabel(change.before)}</td><td>{stateLabel(change.after)}</td><td>{change.transition}</td></tr>)}
    </tbody></table></div><details><summary>Comparison scope and limitations</summary><p>Before: {comparison.beforePages.join(', ')}</p><p>After: {comparison.afterPages.join(', ')}</p><ul>{comparison.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
  </section>;
}

export function RunComparisonPanel({ comparison }: { comparison: RunComparison }) {
  return <section className="panel comparison-panel" aria-label="Task comparison"><h3>Before / after task</h3><p><b>{comparison.transition}</b> · {comparison.comparable ? 'Matching task and runner settings' : 'Attempts are not comparable'}</p>
    <div className="comparison-grid"><div><small>BEFORE</small><b>{comparison.before.outcome || 'Unknown'}</b><span>{comparison.before.steps} task actions</span></div><div className="comparison-arrow">→</div><div><small>AFTER</small><b>{comparison.after.outcome || 'Unknown'}</b><span>{comparison.after.steps} task actions</span></div></div>
    <p>Action counts exclude the initial page navigation.</p>
    {comparison.reasons.map(reason => <p className="warning-text" key={reason}>{reason}</p>)}<ul>{comparison.limitations.map(note => <li key={note}>{note}</li>)}</ul>
  </section>;
}

export function AgentView({ audit }: { audit: Audit }) {
  return <div className="agent-layout"><section className="panel"><h3>Agent navigation guidance</h3><p className="playbook-intro">Observed checks guide the next action. Only a task trial verifies the declared outcome.</p>
    <div className="step-list">{audit.checks.map((check, index) => <div className="step" key={check.id}><span className="step-number">{index + 1}</span><div><b>{check.name}</b><span>{check.detail}</span><code>{stateLabel(check.status)}</code></div></div>)}</div>
  </section><section className="panel"><h3>Different agents, different needs</h3><p>HTML readers cannot run scripts. Browser agents use rendered controls. API clients need documented operations.</p>
    {['Fresh isolated browser context', 'No login, CAPTCHA or payment actions', 'Independent completion checks', 'Stops on repeated or invalid actions'].map(item => <div className="guardrail" key={item}>✓ {item}</div>)}
  </section></div>;
}

export function DeveloperView({ audit }: { audit: Audit }) {
  const [category, setCategory] = useState<'all' | Category>('all');
  const [severity, setSeverity] = useState<'all' | Finding['severity']>('all');
  const [profile, setProfile] = useState<'all' | Profile>('all');
  const filtered = audit.findings.filter(finding => (category === 'all' || finding.category === category) && (severity === 'all' || finding.severity === severity) && (profile === 'all' || finding.profiles.includes(profile)));
  return <><div className="filter-form"><label>Category<select value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="all">All categories</option>{categoryKeys.map(key => <option key={key} value={key}>{CATEGORY_META[key].title}</option>)}</select></label>
    <label>Severity<select value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}><option value="all">All severities</option>{['high', 'medium', 'low', 'info'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Agent profile<select value={profile} onChange={e => setProfile(e.target.value as typeof profile)}><option value="all">All profiles</option>{Object.entries(profiles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="findings-list">{filtered.length ? filtered.map(finding => <article className="finding-card" key={finding.id}><div className="finding-head"><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><span className="finding-id">{finding.id} · {finding.kind}</span><span className="source">{finding.source === 'nemotron' ? 'AI reviewed' : 'Rule observed'}</span></div>
      <h3>{finding.title}</h3><p>{finding.observation}</p><p className="profile-tags">Affects: {finding.profiles.map(value => profiles[value]).join(', ')}</p>
      <div className="finding-columns"><div><h4>Why it matters</h4><p>{finding.impact}</p></div><div><h4>Proposed change</h4><p>{finding.fix}</p></div><div><h4>Verify</h4><p>{finding.verification}</p></div></div>
      {finding.code && <details><summary>Example change</summary><pre>{finding.code}</pre></details>}
      <details className="finding-evidence"><summary>Evidence: {finding.evidenceIds.length} records</summary>{finding.evidenceIds.map(id => { const evidence = audit.evidence.find(item => item.id === id); return <div key={id}><b>{id}</b>{evidence ? <><p>{evidence.description}</p>{evidence.selector && <code>{evidence.selector}</code>}{evidence.snippet && <pre>{evidence.snippet}</pre>}{evidence.screenshot && <a href={evidence.screenshot} target="_blank" rel="noreferrer">Open screenshot</a>}</> : <p>Evidence is unavailable.</p>}</div>; })}</details>
    </article>) : <div className="empty panel">No findings match these filters.</div>}</div>
  </>;
}

export function EvidenceView({ audit }: { audit: Audit }) {
  return <div className="evidence-grid">{audit.pages.map(page => <section className="evidence-page panel" key={page.id}><div className="panel-title"><span>{page.title || page.url}</span><span className="chip">HTTP {page.status || 'unknown'}</span></div>
    {page.screenshot ? <a href={page.screenshot} target="_blank" rel="noreferrer"><img src={page.screenshot} alt={`Captured evidence for ${page.url}`} loading="lazy" /></a> : <div className="no-shot">No screenshot captured</div>}
    <div className="evidence-stats"><span>{page.controls.length} controls</span><span>{page.headings.length} headings</span><span>{page.links.length} links</span></div>
    <details className="evidence-details"><summary>Evidence for {page.id}</summary>{audit.evidence.filter(evidence => evidence.pageId === page.id).map(evidence => <article className="evidence-record" key={evidence.id}><b>{evidence.id}</b><span>{evidence.description}</span>{evidence.selector && <code>{evidence.selector}</code>}{evidence.snippet && <pre>{evidence.snippet}</pre>}</article>)}</details>
  </section>)}</div>;
}

export function InferenceDetails({ records }: { records?: InferenceRecord[] }) {
  if (!records?.length) return <p className="muted">No model-call evidence recorded for this result.</p>;
  return <details className="inference-details"><summary>{records.length} recorded model calls</summary>{records.map(record => <div className="inference-row" key={record.id}><b>{record.provider} · {record.status}</b><span>{record.requestedModel}</span><span>Returned: {record.responseModel || 'Not reported'} · {record.durationMs} ms</span><span>{record.usage ? `${record.usage.inputTokens} input / ${record.usage.outputTokens} output tokens` : 'Token usage not reported'}</span>{record.error && <span>{record.error}</span>}</div>)}</details>;
}

export function RunStatus({ run }: { run: TaskRun }) {
  const done = run.status === 'complete';
  const offline = run.model === 'openpath-demo-simulator';
  return <section className={`run-status outcome-${run.outcome || 'pending'}`} aria-label="Trial result"><div><h3>{done ? `Task ${run.outcome}` : 'Task running…'}</h3><p>{done ? run.explanation : `${run.steps.length} browser steps recorded`}</p>
    <p>{offline ? 'Scripted demo · no NVIDIA inference' : verifiedNebius(run.inference) ? 'NVIDIA on Nebius · real model calls recorded' : 'Model trial · inspect call evidence'}</p><small>{run.model} · {run.profile} · {run.maxSteps} actions / {run.maxDurationMs / 1000}s · {run.promptVersion}</small></div>
    {run.checks.length > 0 && <div className="assertions">{run.checks.map((check, index) => <div key={index}><b>{check.passed ? 'PASS' : 'FAIL'}: {check.description}</b><p>{check.actual}</p></div>)}</div>}
    {run.trace && <a className="ghost" href={run.trace} download>Download browser trace</a>}
    <details className="run-steps"><summary>{run.steps.length} recorded browser steps</summary>{run.steps.map(step => <article key={step.index}><b>{step.index}. {step.action}</b><span>{step.target || step.url}</span><span>{step.result} · {step.durationMs} ms</span>{step.error && <span className="warning-text">{step.error}</span>}{step.screenshot && <a href={step.screenshot} target="_blank" rel="noreferrer"><img src={step.screenshot} alt={`Step ${step.index}: ${step.action}`} loading="lazy" /></a>}</article>)}</details>
    <InferenceDetails records={run.inference} />
  </section>;
}
