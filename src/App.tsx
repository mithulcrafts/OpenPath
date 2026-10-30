import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audit, AuditComparison, AuditSummary, Health, RunComparison, TaskRun } from '../shared/types.js';
import { api, useResource } from './api.js';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, FileSearch, Globe2, History, Layers3, MousePointer2, Plus, ScanLine, ShieldCheck } from 'lucide-react';
import { AgentView, AuditComparisonPanel, DeveloperView, EvidenceView, HistoryPanel, InferenceDetails, Overview, RunComparisonPanel, RunStatus, verifiedNebius } from './components.js';

type Tab = 'overview' | 'agent' | 'developer' | 'evidence';
type Selection = { audit?: string; run?: string; tab: Tab };
const tabs = [['overview', 'Overview'], ['agent', 'Agent playbook'], ['developer', 'Developer fixes'], ['evidence', 'Evidence']] as const;
const auditDone = (value: Audit) => ['complete', 'failed'].includes(value.status);
const runDone = (value: TaskRun) => value.status === 'complete';
const readSelection = (): Selection => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as Tab;
  return { audit: params.get('audit') || undefined, run: params.get('run') || undefined, tab: tabs.some(([key]) => key === tab) ? tab : 'overview' };
};
const visibleDemo = (url: string) => new URL(new URL(url).pathname, window.location.origin).href;
const date = (value: string) => new Date(value).toLocaleString();

export default function App() {
  const [selection, setSelection] = useState<Selection>(readSelection);
  const [health, setHealth] = useState<Health>();
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [compareWith, setCompareWith] = useState('');
  const [goal, setGoal] = useState('');
  const [assertionKind, setAssertionKind] = useState<'visible_text' | 'url_contains'>('visible_text');
  const [assertionValue, setAssertionValue] = useState('');
  const [baselineRunId, setBaselineRunId] = useState('');
  const [auditPosting, setAuditPosting] = useState(false);
  const [trialPosting, setTrialPosting] = useState(false);
  const [error, setError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const auditLock = useRef(false);
  const trialLock = useRef(false);
  const navigationVersion = useRef(0);
  const auditState = useResource<Audit>(selection.audit ? `/api/audits/${selection.audit}` : undefined, auditDone);
  const audit = auditState.data;
  const runState = useResource<TaskRun>(selection.audit && selection.run ? `/api/runs/${selection.run}` : undefined, runDone);
  const run = runState.data?.auditId === audit?.id ? runState.data : undefined;
  const auditComparison = useResource<AuditComparison>(audit?.status === 'complete' && audit.compareWith ? `/api/audits/${audit.id}/comparison` : undefined);
  const runComparison = useResource<RunComparison>(run?.status === 'complete' && run.compareWith ? `/api/runs/${run.id}/comparison` : undefined);
  const savedRuns = useResource<{ runs: TaskRun[] }>(audit?.status === 'complete' ? `/api/runs?auditId=${audit.id}&state=${run?.status || 'none'}` : undefined);
  const baselineRuns = useResource<{ runs: TaskRun[] }>(audit?.compareWith ? `/api/runs?auditId=${audit.compareWith}` : undefined);
  const baselineRun = baselineRuns.data?.runs.find(item => item.id === baselineRunId);
  const pendingRun = run && run.status !== 'complete' ? run : savedRuns.data?.runs.find(item => item.status !== 'complete');
  const loadingSelectedRun = !!selection.run && !runState.data && !runState.error;

  const refresh = useCallback(async () => {
    try {
      const [nextHealth, nextHistory] = await Promise.all([api<Health>('/api/health'), api<{ audits: AuditSummary[] }>('/api/audits')]);
      setHealth(nextHealth); setHistory(nextHistory.audits); setServiceError('');
    } catch (failure) { setServiceError((failure as Error).message); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { if (audit && auditDone(audit)) void refresh(); }, [audit?.id, audit?.status, refresh]);
  useEffect(() => { if (run?.status === 'complete') void refresh(); }, [run?.id, run?.status, refresh]);
  useEffect(() => {
    const changed = () => { navigationVersion.current++; setSelection(readSelection()); setHistoryOpen(false); setError(''); };
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);
  useEffect(() => { setGoal(''); setAssertionValue(''); setBaselineRunId(''); }, [selection.audit]);

  function navigate(next: Selection) {
    navigationVersion.current++;
    const params = new URLSearchParams();
    if (next.audit) params.set('audit', next.audit);
    if (next.run) params.set('run', next.run);
    if (next.tab !== 'overview') params.set('tab', next.tab);
    window.history.pushState({}, '', `/${params.size ? `?${params}` : ''}`);
    setSelection(next); setError('');
  }
  function openAudit(id: string) { setHistoryOpen(false); navigate({ audit: id, tab: 'overview' }); }
  function newAudit(baseline?: Audit) {
    setHistoryOpen(false);
    setCompareWith(baseline?.id || '');
    if (baseline) setUrl(baseline.isDemo ? visibleDemo(baseline.url) : baseline.url);
    navigate({ tab: 'overview' });
  }
  async function startAudit(target = url, baseline = compareWith) {
    if (auditLock.current || !target.trim()) return;
    auditLock.current = true; setAuditPosting(true); setError('');
    const version = navigationVersion.current;
    try {
      const response = await api<{ id: string }>('/api/audits', { method: 'POST', body: JSON.stringify({ url: target.trim(), ...(baseline ? { compareWith: baseline } : {}) }) });
      if (version === navigationVersion.current) navigate({ audit: response.id, tab: 'overview' });
      void refresh();
    } catch (failure) { if (version === navigationVersion.current) setError((failure as Error).message); }
    finally { auditLock.current = false; setAuditPosting(false); }
  }
  const live = health?.trialMode === 'live';
  const trialAvailable = !!health && (live ? !health.budget?.blocked : health.trialMode === 'scripted-demo' && !!audit?.isDemo);
  const publicTaskReady = goal.trim().length >= 5 && assertionValue.trim().length > 0;
  const canTrial = audit?.status === 'complete' && trialAvailable && !trialPosting && !loadingSelectedRun && !pendingRun && (!!audit.isDemo || !!baselineRun || publicTaskReady);
  async function startTrial() {
    if (!audit || !canTrial || trialLock.current) return;
    trialLock.current = true; setTrialPosting(true); setError('');
    const version = navigationVersion.current;
    const custom = baselineRun ? baselineRun.assertions.every(check => check.kind !== 'fixture_cart') : !audit.isDemo;
    const body = { auditId: audit.id, ...(baselineRun ? { compareWith: baselineRun.id } : {}), ...(custom ? { goal: baselineRun?.goal || goal.trim(), assertions: baselineRun?.assertions || [{ kind: assertionKind, value: assertionValue.trim() }] } : {}) };
    try {
      const response = await api<{ id: string }>('/api/runs', { method: 'POST', body: JSON.stringify(body) });
      if (version === navigationVersion.current) navigate({ ...selection, run: response.id });
      void refresh();
    } catch (failure) { if (version === navigationVersion.current) setError((failure as Error).message); }
    finally { trialLock.current = false; setTrialPosting(false); }
  }

  const connectionLabel = !health ? 'Checking connection' : health.ai === 'error' ? 'Last AI call failed' : health.ai === 'verified' ? 'Model connection verified' : health.trialMode === 'live' ? 'AI configured' : 'Offline mode';
  const trialMessage = !health ? 'Checking trial availability…' : live ? health.budget?.blocked ? 'AI budget reached. Saved reports remain available.' : 'Live NVIDIA trial. Uses API credits within the application cap.' : trialAvailable ? 'Scripted demo. No NVIDIA model will be called.' : 'Live trials are unavailable. Configure model access on the server.';
  const message = error || auditState.error || runState.error || serviceError;
  const counts = audit ? { pass: audit.checks.filter(check => check.status === 'pass').length, warning: audit.checks.filter(check => check.status === 'warning').length, fail: audit.checks.filter(check => check.status === 'fail').length, untested: audit.checks.filter(check => check.status === 'not_tested').length } : undefined;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <button className="brand" aria-label="OpenPath home" onClick={() => newAudit()}>
        <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 28 28" fill="none"><path d="M7 21V9a4 4 0 0 1 4-4h10M7 21h10a4 4 0 0 0 4-4V7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="m12 16 5-5m-5 0h5v5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span>OpenPath</span>
      </button>
      <div className="workspace-label"><span className="workspace-avatar"><Layers3 size={17} /></span><span>My workspace<small>Agent compatibility</small></span></div>
      <p className="nav-label">Workspace</p>
      <nav className="side-nav">
        <button className={!selection.audit && !historyOpen ? 'selected' : ''} onClick={() => newAudit()}><Plus size={17} />New audit</button>
        <button className={historyOpen ? 'selected' : ''} onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><History size={17} />History<span className="nav-count" aria-hidden="true">{history.length}</span></button>
        {selection.audit && !historyOpen && <div className="nav-current"><FileSearch size={17} /><span>Audit report</span></div>}
      </nav>
      <div className="sidebar-bottom">
        <a className="sidebar-docs" href="https://github.com/mithulcrafts/OpenPath#documentation" target="_blank" rel="noreferrer"><BookOpen size={16} />Documentation<ArrowRight size={14} /></a>
        <div className="connection-block"><span className={`connection-indicator ${health?.ai === 'verified' ? 'connected' : health?.ai === 'error' ? 'connection-error' : ''}`} /><span>{connectionLabel}</span></div>
        {health?.budget && <details className={`usage-card ${health.budget.blocked ? 'budget-blocked' : ''}`} aria-label="AI spending limit"><summary><span>AI usage</span><strong>${health.budget.reservedUsd.toFixed(2)} <span>/ ${health.budget.limitUsd.toFixed(2)}</span></strong></summary><div className="usage-detail"><p>Conservative reservation against this workspace's limit.</p><p>Token-based estimate: ${health.budget.estimatedUsageUsd.toFixed(5)} · {health.budget.calls} requests.</p><p>{health.budget.message}</p><p>{health.budget.scope}</p><p>Reservations are not the provider bill.</p></div></details>}
        <div className="workspace-provider">NVIDIA Nemotron<span>on Nebius Token Factory</span></div>
      </div>
    </aside>
    <div className="app-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><span>{historyOpen ? 'History' : selection.audit ? 'Audit report' : 'New audit'}</span>{audit && !historyOpen && <><ChevronRight size={14} /><span className="breadcrumb-domain">{audit.domain}</span></>}</div><span className="inspection-badge"><ShieldCheck size={14} />Read-only inspection</span></header>
      <main id="main-content">
        {message && <div className="global-message error-banner" role="alert"><span>{message}</span><button className="link-button" onClick={() => { setError(''); void refresh(); }}>Refresh status</button></div>}
        {historyOpen && <section className="history-workspace"><div className="page-heading"><p className="eyebrow">Your workspace</p><h1>Audit history</h1><p>Pick up where you left off. Your reports and evidence, in one place.</p></div><HistoryPanel history={history} currentId={selection.audit} onOpen={openAudit} /></section>}
        {!selection.audit && !historyOpen && <section className="home-workspace">
          <div className="page-heading"><p className="eyebrow">Website audits</p><h1>Make your website work for agents.</h1><p>Find the barriers. Understand the fixes. Verify what works.</p></div>
          <div className="home-grid">
            <form className="audit-card" onSubmit={event => { event.preventDefault(); void startAudit(); }}>
              <div className="audit-card-heading"><span className="section-icon"><ScanLine size={21} /></span><div><h2>Start a website audit</h2><p>A clear picture of how agents experience your product.</p></div></div>
              <label className="input-label" htmlFor="website-url">Website to inspect</label>
              <div className="url-row"><div className="url-input"><Globe2 size={18} aria-hidden="true" /><input id="website-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://your-website.com" maxLength={2048} required disabled={auditPosting} autoComplete="url" spellCheck={false} /></div><button className="primary" type="submit" disabled={!url.trim() || auditPosting}>{auditPosting ? 'Starting audit…' : 'Run audit'}<ArrowRight size={16} /></button></div>
              <div className="card-foot"><span><Check size={14} />Up to 4 pages</span><span><ShieldCheck size={14} />Read-only</span>{health?.demoAvailable && <button type="button" className="text-button" disabled={auditPosting} onClick={() => setUrl(visibleDemo(health.demoUrl))}>Use controlled demo</button>}</div>
              <details className="advanced-form"><summary>Compare with a saved audit</summary><label>Baseline audit<select value={compareWith} onChange={event => setCompareWith(event.target.value)} disabled={auditPosting}><option value="">No comparison</option>{history.filter(item => item.status === 'complete').map(item => <option key={item.id} value={item.id}>{item.domain}{new URL(item.url).pathname} · {date(item.createdAt)}</option>)}</select></label></details>
              <p className="form-note"><CircleHelp size={14} />{live && !health?.budget?.blocked ? 'Includes one AI review within your workspace spending limit.' : 'Rule-based inspection is available without paid AI analysis.'}</p>
            </form>
            <aside className="workflow-guide"><p className="eyebrow">From URL to evidence</p><ol><li><span>01</span><div><h3>Inspect the experience</h3><p>Discover what agents can read and interact with.</p></div></li><li><span>02</span><div><h3>Get a clear action plan</h3><p>Review specific changes, backed by page evidence.</p></div></li><li><span>03</span><div><h3>Put it to the test</h3><p>Run a task and check its outcome independently.</p></div></li></ol><div className="guide-note"><ShieldCheck size={16} /><span>Your site stays untouched.</span></div></aside>
          </div>
          <section className="recent-section" aria-label="Recent activity"><div className="section-heading"><div><h2>Recent audits<span className="count-badge">{history.length}</span></h2><p>Saved results. Ready when you are.</p></div>{history.length > 0 && <button className="text-button" onClick={() => setHistoryOpen(true)}>View all audits<ArrowRight size={14} /></button>}</div>
            {history.length ? <div className="recent-table"><div className="recent-table-head" aria-hidden="true"><span>Website</span><span>Findings</span><span>Status</span><span>Inspected</span><span /></div>{history.slice(0, 5).map(item => <button className="recent-row" key={item.id} onClick={() => openAudit(item.id)}><span className="recent-site"><span className="site-avatar"><Globe2 size={17} /></span><span><strong>{item.domain}</strong><small>{new URL(item.url).pathname}</small></span></span><span className="recent-findings">{item.findingCount}<small> findings</small></span><span className={`audit-status status-${item.status}`}><span />{item.status === 'complete' ? 'Completed' : item.status === 'failed' ? 'Failed' : 'In progress'}</span><time className="recent-date" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<small>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></time><ChevronRight size={16} className="row-chevron" /></button>)}</div> : <div className="empty-history"><FileSearch size={26} /><h3>Your first audit starts here.</h3><p>Enter a website above to create your first report.</p></div>}
          </section>
        </section>}
        {!historyOpen && selection.audit && !audit && !auditState.error && <section className="workspace loading-workspace" role="status"><p>Loading saved report…</p><div className="skeleton-line" /><div className="skeleton-panel" /></section>}
        {!historyOpen && audit && <section className="workspace">
          <div className="workspace-head"><div><div className="eyebrow audit-state" role="status">AUDIT {audit.status.toUpperCase()}</div><h1>{audit.domain}</h1><p className="report-address"><Globe2 size={14} />{audit.url}</p></div><div className="head-actions">
            {audit.status === 'complete' && <button className="ghost" disabled={auditPosting} onClick={() => newAudit(audit)}>Compare after changes</button>}
            {audit.status === 'complete' && audit.isDemo && /\/demo\/broken(\/|$)/.test(new URL(audit.url).pathname) && health?.demoAvailable && <button className="ghost" disabled={auditPosting} onClick={() => void startAudit(visibleDemo(health.fixedDemoUrl), audit.id)}>{auditPosting ? 'Starting comparison…' : 'Audit fixed demo'}</button>}
            {auditDone(audit) && <a className="primary" href={`/api/audits/${audit.id}/fix-kit`} download><ArrowDownToLine size={16} />Download fix kit</a>}
          </div></div>
          {!auditDone(audit) && <div className="progress-card" role="status"><span className="section-icon"><ScanLine size={22} /></span><div><h2>Inspecting your website</h2><p>{audit.events.at(-1)?.message || 'Audit queued.'}</p><div className="progress-line"><progress max={100} value={audit.progress} aria-label="Audit progress" /><span>{audit.progress}%</span></div></div></div>}
          {audit.status === 'failed' && <div className="error-banner" role="alert">{audit.error || 'The audit failed.'}<button className="ghost" onClick={() => newAudit(audit)}>Review URL and retry</button></div>}
          {audit.status === 'complete' && counts && <>
            <div className="summary-grid"><div className="summary-card"><span className="summary-label">Checks passed</span><strong>{counts.pass}<small> / {audit.checks.length}</small></strong><span className="summary-caption">{counts.warning} warning · {counts.fail} fail · {counts.untested} not tested</span></div><div className="summary-card"><span className="summary-label">Pages inspected</span><strong>{audit.pages.length}</strong><span className="summary-caption">Within the audit scope</span></div><div className="summary-card"><span className="summary-label">Findings</span><strong>{audit.findings.length}</strong><span className="summary-caption">Observations & recommendations</span></div><div className="summary-card model-card"><span className="summary-label">Analysis</span><strong>{audit.model.mode === 'nemotron' ? 'AI reviewed' : 'Rule-based'}</strong><span className="summary-caption">{verifiedNebius(audit.inference) ? 'NVIDIA on Nebius verified' : audit.model.mode === 'nemotron' ? 'Inspect provider evidence' : 'Deterministic checks'}</span></div></div>
            <div className="insight-callout"><span className="insight-icon"><FileSearch size={18} /></span><div><h2>Report summary</h2><p>{audit.summary}</p></div></div>
            <details className="analysis-details"><summary>Analysis details</summary><div className="model-note"><p>{audit.model.note}</p><InferenceDetails records={audit.inference} /></div></details>
            {audit.isDemo && <p className="muted demo-note">Controlled, predefined storefront variants. OpenPath does not automatically edit the product source.</p>}
            {auditComparison.error && <div className="error-banner" role="alert">Comparison unavailable: {auditComparison.error}</div>}
            {auditComparison.data && <AuditComparisonPanel comparison={auditComparison.data} onOpen={openAudit} />}
            <nav className="tabs" aria-label="Audit sections">{tabs.map(([key, label]) => <button key={key} className={selection.tab === key ? 'active' : ''} aria-current={selection.tab === key ? 'page' : undefined} onClick={() => navigate({ ...selection, tab: key })}>{label}</button>)}</nav>
            {selection.tab === 'overview' && <Overview audit={audit} />}{selection.tab === 'agent' && <AgentView audit={audit} />}{selection.tab === 'developer' && <DeveloperView key={audit.id} audit={audit} />}{selection.tab === 'evidence' && <EvidenceView audit={audit} />}
            <section className="panel trial-workspace" aria-label="Browser trials"><div className="trial-heading"><span className="section-icon"><MousePointer2 size={20} /></span><div><h2>Try a real task</h2><p className="muted">{trialMessage}</p></div></div>
              {health?.ai === 'error' && <p className="warning-text">{health.aiMessage}</p>}
              {audit.isDemo ? <p className="demo-task-description">Add one Everyday Tee in blue, size M, to the sandbox cart. A separate checker reads server-owned cart state.</p> : <div className="task-form"><label>Browsing goal<input value={goal} maxLength={1000} onChange={event => setGoal(event.target.value)} placeholder="Open the pricing page" disabled={!!baselineRun} /></label><label>Success condition<select value={assertionKind} onChange={event => setAssertionKind(event.target.value as typeof assertionKind)} disabled={!!baselineRun}><option value="visible_text">Visible text</option><option value="url_contains">URL contains</option></select></label><label>Expected value<input value={assertionValue} maxLength={assertionKind === 'url_contains' ? 200 : 300} onChange={event => setAssertionValue(event.target.value)} placeholder="Pricing" disabled={!!baselineRun} /></label><p><ShieldCheck size={13} />Browsing only. No login, forms, payments or messages.</p></div>}
              {audit.compareWith && <label className="baseline-label">Compare task with<select value={baselineRunId} onChange={event => setBaselineRunId(event.target.value)} disabled={trialPosting || !!pendingRun}><option value="">Independent attempt</option>{baselineRuns.data?.runs.filter(item => item.status === 'complete').map(item => <option value={item.id} key={item.id}>{item.outcome} · {date(item.createdAt)} · {item.model}</option>)}</select></label>}
              {baselineRuns.error && <p role="alert">Baseline trials unavailable: {baselineRuns.error}</p>}
              {baselineRun && <p>Same task: {baselineRun.goal} The server checks matching model, runner settings and assertions.</p>}
              <div className="trial-actions"><button className="primary" onClick={() => void startTrial()} disabled={!canTrial}><MousePointer2 size={15} />{trialPosting ? 'Starting trial…' : pendingRun ? 'Trial in progress…' : baselineRun ? 'Run paired trial' : 'Run task trial'}</button>{pendingRun && pendingRun.id !== selection.run && <button className="ghost" onClick={() => navigate({ ...selection, run: pendingRun.id })}>Open active trial</button>}</div>
              {!audit.isDemo && trialAvailable && !publicTaskReady && !baselineRun && <p className="muted task-help">Enter a goal and an independent success condition to enable the trial.</p>}
              {savedRuns.error && <p role="alert">Saved trials unavailable: {savedRuns.error}</p>}
              {!!savedRuns.data?.runs.length && <label className="baseline-label">Saved trials<select value={selection.run || ''} onChange={event => navigate({ ...selection, run: event.target.value || undefined })}><option value="">Choose a recorded attempt</option>{savedRuns.data.runs.map(item => <option value={item.id} key={item.id}>{item.outcome || item.status} · {date(item.createdAt)} · {item.model}</option>)}</select></label>}
              {selection.run && !run && !runState.error && <p role="status">{runState.data ? 'This attempt belongs to a different audit.' : 'Loading trial…'}</p>}
              {run && <RunStatus run={run} />}{runComparison.data && <RunComparisonPanel comparison={runComparison.data} />}{runComparison.error && <p role="alert">Task comparison unavailable: {runComparison.error}</p>}
            </section>
            <details className="panel limitations"><summary>Scope and limitations</summary><ul>{audit.limitations.map((note, index) => <li key={index}>{note}</li>)}</ul></details>
          </>}
        </section>}
      </main>
      <footer className="workspace-footer"><span>OpenPath</span><span><ShieldCheck size={13} />Reports saved in this workspace</span></footer>
    </div>
  </div>;
}
