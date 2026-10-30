import { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Code2, Compass, ExternalLink, FileText, Globe, Image, Link2, ListChecks, MousePointer2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CATEGORY_META } from '../shared/types.js';
import type { Audit, AuditComparison, AuditSummary, Category, Finding, InferenceRecord, Profile, RunComparison, TaskRun } from '../shared/types.js';

export const profiles: Record<Profile, string> = { html: 'HTML readers', browser: 'Browser agents', api: 'API clients' };
export const categoryKeys = Object.keys(CATEGORY_META) as Category[];
const severityTone = (severity: Finding['severity']) => ({ high: 'danger', medium: 'warn', low: 'info', info: 'muted' })[severity];
export const stateLabel = (value?: string) => value === 'not_tested' ? 'not tested' : value || 'not present';
export const verifiedNebius = (records?: InferenceRecord[]) => !!records?.some(record => record.status === 'succeeded' && record.provider === 'nebius' && /^nvidia\//i.test(record.requestedModel) && /^nvidia\//i.test(record.responseModel || ''));
const categoryIcons = { discovery: Compass, readability: FileText, interactions: MousePointer2, integrations: Link2 };

export function HistoryPanel({ history, currentId, onOpen }: { history: AuditSummary[]; currentId?: string; onOpen: (id: string) => void }) {
  return <section className="panel history-panel" aria-label="Audit history"><div className="section-heading"><div><h2>Recent audits <span className="count-badge">{history.length}</span></h2><p className="muted">Revisit your reports without running a new audit.</p></div><Clock3 size={18} aria-hidden="true" /></div>
    {history.length ? history.map(item => <button className={`history-row ${item.id === currentId ? 'selected' : ''}`} key={item.id} onClick={() => onOpen(item.id)}>
      <span className="history-site-icon"><Globe size={18} aria-hidden="true" /></span><span className="history-site"><b>{item.domain}</b><small>{new URL(item.url).pathname}</small></span><span className="history-date">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span className="history-result"><span className={`check-state ${item.status}`}>{item.status}</span><small>{item.findingCount} findings</small></span><ChevronRight className="history-chevron" size={16} aria-hidden="true" />
    </button>) : <div className="report-empty"><span className="empty-icon"><FileText size={24} aria-hidden="true" /></span><b>No saved audits yet.</b><p>Your first report will appear here.</p></div>}
  </section>;
}

export function CheckGroups({ audit }: { audit: Audit }) {
  return <div className="check-groups">{categoryKeys.map((category, index) => { const Icon = categoryIcons[category]; return <section className="panel category-panel" key={category}>
    <div className="category-heading"><div className="category-marker"><span className="category-number">{String(index + 1).padStart(2, '0')}</span><Icon size={22} aria-hidden="true" /></div><div><h3>{CATEGORY_META[category].title}</h3><p className="muted">{CATEGORY_META[category].question}</p></div></div>
    <div className="category-checks">{audit.checks.filter(check => check.category === category).map(check => <details className="check-row" key={check.id}>
      <summary><ChevronRight className="disclosure-chevron" size={14} aria-hidden="true" /><span>{check.name}</span><span className={`check-state ${check.status}`}>{stateLabel(check.status)}</span></summary>
      <div className="check-detail"><p>{check.detail}</p><small>{check.evidenceIds.length ? `Evidence: ${check.evidenceIds.join(', ')}` : 'No issue-specific evidence recorded.'}</small></div>
    </details>)}</div>
  </section>; })}</div>;
}

export function Overview({ audit }: { audit: Audit }) {
  return <><div className="overview-grid"><section className="panel overview-pages"><div className="section-heading"><h3>What an agent sees</h3><span className="count-badge">{audit.pages.length} pages</span></div>
    {audit.pages.map(page => <div className="page-row" key={page.id}><div className="page-icon">{page.error ? <TriangleAlert size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}</div><div className="page-description"><b>{page.title || page.url}</b><span>{new URL(page.url).pathname} · {page.controls.length} controls</span>{page.error && <span>{page.error}</span>}</div>{page.error || page.status >= 400 ? <TriangleAlert className="page-state bad" size={16} aria-label="Page issue" /> : <CheckCircle2 className="page-state good" size={16} aria-label="Page captured" />}</div>)}
  </section><section className="panel overview-opportunities"><div className="section-heading"><h3>Top opportunities</h3><ListChecks size={18} aria-hidden="true" /></div>
    {audit.findings.length ? [...audit.findings].sort((a, b) => ['high', 'medium', 'low', 'info'].indexOf(a.severity) - ['high', 'medium', 'low', 'info'].indexOf(b.severity)).slice(0, 3).map(finding => <div className="finding-mini" key={finding.id}><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><div><b>{finding.title}</b><span>{finding.observation}</span></div></div>) : <p className="empty">No findings in the inspected scope.</p>}
  </section></div><div className="checks-section-heading"><h3>Compatibility checks</h3><span>{audit.checks.length} checks across {categoryKeys.length} areas</span></div><CheckGroups audit={audit} /></>;
}

export function AuditComparisonPanel({ comparison, onOpen }: { comparison: AuditComparison; onOpen: (id: string) => void }) {
  return <section className="panel comparison-panel" aria-label="Audit comparison"><div className="section-heading"><div><h3>Before / after audit</h3>
    <p className={comparison.scopeMatched ? 'muted' : 'warning-text'}>{comparison.scopeMatched ? 'Matching inspected scope.' : 'Different inspected scope: changes are not verified improvements.'}</p></div>
    <button className="link-button" onClick={() => onOpen(comparison.beforeId)}>Open baseline report <ArrowRight size={14} aria-hidden="true" /></button></div>
    <div className="table-scroll"><table><caption>Recorded check changes</caption><thead><tr><th>Check</th><th>Before</th><th>After</th><th>Result</th></tr></thead><tbody>
      {comparison.changes.map(change => <tr key={change.id}><th scope="row">{change.name}</th><td><span className={`check-state ${change.before}`}>{stateLabel(change.before)}</span></td><td><span className={`check-state ${change.after}`}>{stateLabel(change.after)}</span></td><td><span className={`transition ${change.transition}`}>{change.transition}</span></td></tr>)}
    </tbody></table></div><details className="quiet-disclosure"><summary>Comparison scope and limitations</summary><p>Before: {comparison.beforePages.join(', ')}</p><p>After: {comparison.afterPages.join(', ')}</p><ul>{comparison.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
  </section>;
}

export function RunComparisonPanel({ comparison }: { comparison: RunComparison }) {
  return <section className="panel comparison-panel" aria-label="Task comparison"><h3>Before / after task</h3><p><b>{comparison.transition}</b> · {comparison.comparable ? 'Matching task and runner settings' : 'Attempts are not comparable'}</p>
    <div className="comparison-grid"><div><small>Before</small><b>{comparison.before.outcome || 'Unknown'}</b><span>{comparison.before.steps} task actions</span></div><div className="comparison-arrow"><ArrowRight size={20} aria-hidden="true" /></div><div><small>After</small><b>{comparison.after.outcome || 'Unknown'}</b><span>{comparison.after.steps} task actions</span></div></div>
    <p className="comparison-note">Action counts exclude the initial page navigation.</p>
    {comparison.reasons.map(reason => <p className="warning-text" key={reason}>{reason}</p>)}<details className="quiet-disclosure"><summary>How to interpret this comparison</summary><ul>{comparison.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
  </section>;
}

export function AgentView({ audit }: { audit: Audit }) {
  return <div className="agent-layout"><section className="panel guidance-panel"><h3>Agent navigation guidance</h3><p className="playbook-intro">Observed checks guide the next action. Only a task trial verifies the declared outcome.</p>
    <div className="step-list">{audit.checks.map((check, index) => <div className="step" key={check.id}><span className="step-number">{index + 1}</span><div><b>{check.name}</b><span>{check.detail}</span><span className={`check-state ${check.status}`}>{stateLabel(check.status)}</span></div></div>)}</div>
  </section><section className="panel profile-panel"><h3>Different agents, different needs</h3><div className="profile-explainer"><FileText size={18} aria-hidden="true" /><div><b>HTML readers</b><p>Read page content without running scripts.</p></div></div><div className="profile-explainer"><MousePointer2 size={18} aria-hidden="true" /><div><b>Browser agents</b><p>Navigate through rendered controls and visible states.</p></div></div><div className="profile-explainer"><Code2 size={18} aria-hidden="true" /><div><b>API clients</b><p>Need documented operations and structured responses.</p></div></div><h4 className="guardrail-heading">Trial boundaries</h4>
    {['Fresh isolated browser context', 'No login, CAPTCHA or payment actions', 'Independent completion checks', 'Stops on repeated or invalid actions'].map(item => <div className="guardrail" key={item}><Check size={14} aria-hidden="true" />{item}</div>)}
  </section></div>;
}

export function DeveloperView({ audit }: { audit: Audit }) {
  const [category, setCategory] = useState<'all' | Category>('all');
  const [severity, setSeverity] = useState<'all' | Finding['severity']>('all');
  const [profile, setProfile] = useState<'all' | Profile>('all');
  const filtered = audit.findings.filter(finding => (category === 'all' || finding.category === category) && (severity === 'all' || finding.severity === severity) && (profile === 'all' || finding.profiles.includes(profile)));
  return <><div className="findings-toolbar"><div className="filter-form"><label>Category<select value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="all">All categories</option>{categoryKeys.map(key => <option key={key} value={key}>{CATEGORY_META[key].title}</option>)}</select></label>
    <label>Severity<select value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}><option value="all">All severities</option>{['high', 'medium', 'low', 'info'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Agent profile<select value={profile} onChange={e => setProfile(e.target.value as typeof profile)}><option value="all">All profiles</option>{Object.entries(profiles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><span className="filter-count" role="status">{filtered.length} of {audit.findings.length} findings</span></div>
    <div className="findings-list">{filtered.length ? filtered.map((finding, index) => <article className="finding-card" key={finding.id}><div className="finding-head"><span className="finding-number">{String(index + 1).padStart(2, '0')}</span><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><span className="finding-id">{finding.kind === 'observed' ? 'Observed finding' : 'Recommendation'}</span><span className="source">{finding.source === 'nemotron' ? 'AI reviewed' : 'Rule observed'}</span></div>
      <h3>{finding.title}</h3><p>{finding.observation}</p><p className="profile-tags">Affects: {finding.profiles.map(value => profiles[value]).join(', ')}</p>
      <div className="finding-columns"><div><h4>Why it matters</h4><p>{finding.impact}</p></div><div><h4>Proposed change</h4><p>{finding.fix}</p></div><div><h4>Verify</h4><p>{finding.verification}</p></div></div>
      {finding.code && <details><summary>Generic example · adapt to captured controls</summary><pre>{finding.code}</pre></details>}
      <details className="finding-evidence"><summary>Evidence: {finding.evidenceIds.length} records</summary>{finding.evidenceIds.map(id => { const evidence = audit.evidence.find(item => item.id === id); return <div key={id}><b>{id}</b>{evidence ? <><p>{evidence.description}</p>{evidence.selector && <code>{evidence.selector}</code>}{evidence.snippet && <pre>{evidence.snippet}</pre>}{evidence.screenshot && <a href={evidence.screenshot} target="_blank" rel="noreferrer">Open screenshot <ExternalLink size={12} aria-hidden="true" /></a>}</> : <p>Evidence is unavailable.</p>}</div>; })}</details>
    </article>) : <div className="empty panel">No findings match these filters.</div>}</div>
  </>;
}

export function EvidenceView({ audit }: { audit: Audit }) {
  return <div className="evidence-grid">{audit.pages.map(page => <section className="evidence-page panel" key={page.id}><div className="panel-title"><div><b>{page.title || page.url}</b><small>{new URL(page.url).pathname}</small></div><span className={`check-state ${page.status >= 400 ? 'fail' : ''}`}>HTTP {page.status || 'unknown'}</span></div>
    <div className="evidence-capture"><div className="evidence-browserbar"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span>{new URL(page.url).hostname}{new URL(page.url).pathname}</span><Globe size={12} aria-hidden="true" /></div>{page.screenshot ? <a className="screenshot-link" href={page.screenshot} target="_blank" rel="noreferrer"><img src={page.screenshot} alt={`Captured evidence for ${page.url}`} loading="lazy" /><span>View full screenshot <ExternalLink size={12} aria-hidden="true" /></span></a> : <div className="no-shot"><Image size={24} aria-hidden="true" />No screenshot captured</div>}</div>
    <div className="evidence-stats"><span><b>{page.controls.length}</b> controls</span><span><b>{page.headings.length}</b> headings</span><span><b>{page.links.length}</b> links</span></div>
    <details className="evidence-details"><summary>Evidence for {page.id}</summary>{audit.evidence.filter(evidence => evidence.pageId === page.id).map(evidence => <article className="evidence-record" key={evidence.id}><b>{evidence.id}</b><span>{evidence.description}</span>{evidence.selector && <code>{evidence.selector}</code>}{evidence.snippet && <pre>{evidence.snippet}</pre>}</article>)}</details>
  </section>)}</div>;
}

export function InferenceDetails({ records }: { records?: InferenceRecord[] }) {
  if (!records?.length) return <p className="muted">No model-call evidence recorded for this result.</p>;
  return <details className="inference-details"><summary>{records.length} recorded model {records.length === 1 ? 'call' : 'calls'}</summary><div className="inference-list">{records.map(record => <div className="inference-row" key={record.id}><b>{record.provider} · {record.status}</b><span>{record.requestedModel}</span><span>Returned: {record.responseModel || 'Not reported'} · {record.durationMs.toLocaleString()} ms</span><span>{record.usage ? `${record.usage.inputTokens.toLocaleString()} input / ${record.usage.outputTokens.toLocaleString()} output tokens` : 'Token usage not reported'}</span>{record.error && <span>{record.error}</span>}</div>)}</div></details>;
}

export function RunStatus({ run }: { run: TaskRun }) {
  const done = run.status === 'complete';
  const offline = run.model === 'openpath-demo-simulator';
  return <section className={`run-status outcome-${run.outcome || 'pending'}`} aria-label="Trial result"><div className="run-result-heading"><span className="run-result-icon">{run.outcome === 'completed' ? <CheckCircle2 size={22} aria-hidden="true" /> : done ? <CircleHelp size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}</span><div><h3>{done ? `Task ${run.outcome}` : 'Task running…'}</h3><p>{done ? run.explanation : `${run.steps.length} browser steps recorded`}</p></div></div>
    <p className="run-source"><ShieldCheck size={14} aria-hidden="true" />{offline ? 'Scripted demo · no NVIDIA inference' : verifiedNebius(run.inference) ? 'NVIDIA on Nebius · real model calls recorded' : 'Model trial · inspect call evidence'}</p>
    {run.checks.length > 0 && <div className="assertions">{run.checks.map((check, index) => <div className={check.passed ? 'assertion-pass' : 'assertion-fail'} key={index}><b>{check.passed ? 'PASS' : 'FAIL'}: {check.description}</b><p>{check.actual}</p></div>)}</div>}
    {run.trace && <a className="ghost" href={run.trace} download>Download browser trace</a>}
    <details className="run-steps"><summary>{run.steps.length} recorded browser steps</summary><div className="run-timeline">{run.steps.map(step => <article key={step.index}><span className="timeline-number">{step.index}</span><div className="timeline-body"><div className="timeline-heading"><b>{step.action}</b><small>{step.durationMs.toLocaleString()} ms</small></div><span>{step.target || step.url}</span><p>{step.result}</p>{step.error && <p className="warning-text">{step.error}</p>}{step.screenshot && <a href={step.screenshot} target="_blank" rel="noreferrer"><img src={step.screenshot} alt={`Step ${step.index}: ${step.action}`} loading="lazy" /></a>}</div></article>)}</div></details>
    <InferenceDetails records={run.inference} />
    <details className="run-settings quiet-disclosure"><summary>Run settings</summary><dl><div><dt>Model</dt><dd>{run.model}</dd></div><div><dt>Agent profile</dt><dd>{run.profile}</dd></div><div><dt>Limits</dt><dd>{run.maxSteps} actions / {run.maxDurationMs / 1000}s</dd></div><div><dt>Prompt version</dt><dd>{run.promptVersion}</dd></div></dl></details>
  </section>;
}
