import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audit, AuditComparison, AuditSummary, Health, RunComparison, TaskRun } from '../shared/types.js';
import { api, useResource } from './api.js';
import { PathIllustration } from './PathIllustration.js';
import { ArrowRight, BookOpen, Box, Check, ChevronRight, CircleHelp, FileSearch, Globe2, History, MousePointer2, Network, Play, Plus, ScanLine, Settings2, ShieldCheck, X } from 'lucide-react';
import { AuditComparisonPanel, HistoryPanel, RunComparisonPanel, RunStatus } from './components.js';
import { CapabilityWorkspace } from './CapabilityWorkspace.js';
import type { ProductCapability } from '../shared/capabilities.js';

export type Tab = 'overview' | 'agent' | 'developer' | 'evidence' | 'verify';
type Selection = { audit?: string; run?: string; tab: Tab };
const tabs = [['overview', 'Understand'], ['developer', 'Plan changes'], ['verify', 'Verify'], ['evidence', 'Evidence'], ['agent', 'Agent playbook']] as const;
const auditDone = (value: Audit) => ['complete', 'failed'].includes(value.status);
const runDone = (value: TaskRun) => value.status === 'complete';
const readSelection = (): Selection => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as Tab;
  return { audit: params.get('audit') || undefined, run: params.get('run') || undefined, tab: tabs.some(([key]) => key === tab) ? tab : params.get('run') ? 'verify' : 'overview' };
};
const visibleDemo = (url: string) => new URL(new URL(url).pathname, window.location.origin).href;
const date = (value: string) => new Date(value).toLocaleString();

export default function App() {
  const [selection, setSelection] = useState<Selection>(readSelection);
  const [health, setHealth] = useState<Health>();
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  function prepareCapabilityTrial(capability: ProductCapability) {
    setBaselineRunId('');
    setGoal(capability.suggestedTask || '');
    setAssertionValue(capability.suggestedAssertion?.value || '');
    if (capability.suggestedAssertion) {
      setAssertionKind(capability.suggestedAssertion.kind);
    }
    navigate({ ...selection, tab: 'verify' });
  }
  const trialPanel = audit && <section className="panel trial-workspace" aria-label="Browser trials">
    <div className="trial-heading"><span className="section-icon"><Play size={22} /></span><div><p className="eyebrow">Independent verification</p><h2>Try a real task</h2><p className="muted">{trialMessage}</p></div></div>
    {health?.ai === 'error' && <p className="warning-text">{health.aiMessage}</p>}
    {audit.isDemo ? <p className="demo-task-description">Add one Everyday Tee in blue, size M, to the sandbox cart. A separate checker reads server-owned cart state.</p> : <div className="task-form"><label>Browsing goal<input value={goal} maxLength={1000} onChange={event => setGoal(event.target.value)} placeholder="Open the product comparison page" disabled={!!baselineRun} /></label><label>Success condition<select value={assertionKind} onChange={event => setAssertionKind(event.target.value as typeof assertionKind)} disabled={!!baselineRun}><option value="visible_text">Visible text</option><option value="url_contains">URL contains</option></select></label><label>Expected value<input value={assertionValue} maxLength={assertionKind === 'url_contains' ? 200 : 300} onChange={event => setAssertionValue(event.target.value)} placeholder="/compare" disabled={!!baselineRun} /></label><p><ShieldCheck size={13} />Browsing only. No login, forms, payments or messages.</p></div>}
    {audit.compareWith && <label className="baseline-label">Compare task with<select value={baselineRunId} onChange={event => setBaselineRunId(event.target.value)} disabled={trialPosting || !!pendingRun}><option value="">Independent attempt</option>{baselineRuns.data?.runs.filter(item => item.status === 'complete').map(item => <option value={item.id} key={item.id}>{item.outcome} · {date(item.createdAt)} · {item.model}</option>)}</select></label>}
    {baselineRuns.error && <p role="alert">Baseline trials unavailable: {baselineRuns.error}</p>}
    {baselineRun && <p>Same task: {baselineRun.goal} The server checks matching model, runner settings and assertions.</p>}
    <div className="trial-actions"><button className="primary" onClick={() => void startTrial()} disabled={!canTrial}><Play size={15} />{trialPosting ? 'Starting trial…' : pendingRun ? 'Trial in progress…' : baselineRun ? 'Run paired trial' : 'Run task trial'}</button>{pendingRun && pendingRun.id !== selection.run && <button className="ghost" onClick={() => navigate({ ...selection, tab: 'verify', run: pendingRun.id })}>Open active trial</button>}</div>
    {!audit.isDemo && trialAvailable && !publicTaskReady && !baselineRun && <p className="muted task-help">Enter a goal and an independent success condition to enable the trial.</p>}
    {savedRuns.error && <p role="alert">Saved trials unavailable: {savedRuns.error}</p>}
    {!!savedRuns.data?.runs.length && <label className="baseline-label">Saved trials<select value={selection.run || ''} onChange={event => navigate({ ...selection, tab: 'verify', run: event.target.value || undefined })}><option value="">Choose a recorded attempt</option>{savedRuns.data.runs.map(item => <option value={item.id} key={item.id}>{item.outcome || item.status} · {date(item.createdAt)} · {item.model}</option>)}</select></label>}
    {selection.run && !run && !runState.error && <p role="status">{runState.data ? 'This attempt belongs to a different audit.' : 'Loading trial…'}</p>}
    {run && <RunStatus run={run} />}{runComparison.data && <RunComparisonPanel comparison={runComparison.data} />}{runComparison.error && <p role="alert">Task comparison unavailable: {runComparison.error}</p>}
  </section>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar">
      <button className="brand" aria-label="OpenPath home" onClick={() => newAudit()}><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m16 2 12 7v14l-12 7L4 23V9Z" fill="currentColor"/><path d="m16 2 6 10-6 5-6-5ZM16 30l-6-10 6-5 6 5Z" fill="#58692d"/><path d="m10 12 6-3 6 3v8l-6 3-6-3Z" fill="#10191e"/></svg></span><span>OpenPath</span></button>
      <div className="product-switch"><span className="product-monogram">{audit ? audit.domain.replace(/^www\./, '').charAt(0).toUpperCase() : <Box size={15} />}</span><span>{audit?.domain || 'My workspace'}</span><ChevronRight size={13} /></div>
      <div className="breadcrumbs">Product <span>/</span> <b>{historyOpen ? 'History' : selection.audit ? 'Agent access' : 'Overview'}</b></div>
      <div className="topbar-actions"><span className={`connection-dot ${health?.ai === 'verified' ? 'connected' : ''}`} title={connectionLabel} aria-label={connectionLabel} />{audit?.status === 'complete' && <button className="ghost" onClick={() => { setHistoryOpen(false); navigate({ ...selection, tab: 'evidence' }); }}><FileSearch size={15} />View evidence</button>}<button className="ghost compact-button" onClick={() => newAudit()} aria-label="New audit"><Plus size={16} /><span>New audit</span></button></div>
    </header>
    <aside className="sidebar" aria-label="Workspace navigation"><nav className="side-nav">
      <button className={!selection.audit && !historyOpen ? 'selected' : ''} onClick={() => newAudit()}><Box size={22} /><span>Products</span></button>
      <button className={selection.audit && !historyOpen && selection.tab !== 'verify' ? 'selected' : ''} disabled={!selection.audit} onClick={() => { setHistoryOpen(false); navigate({ ...selection, tab: 'overview' }); }}><Network size={23} /><span>Access</span></button>
      <button className={selection.audit && !historyOpen && selection.tab === 'verify' ? 'selected' : ''} disabled={!selection.audit} onClick={() => { setHistoryOpen(false); navigate({ ...selection, tab: 'verify' }); }}><Play size={22} /><span>Trials</span></button>
      <button className={historyOpen ? 'selected' : ''} onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><History size={22} /><span>History</span></button>
    </nav><div className="rail-bottom"><a href="https://github.com/mithulcrafts/OpenPath#documentation" target="_blank" rel="noreferrer"><BookOpen size={21} /><span>Docs</span></a><button onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}><Settings2 size={21} /><span>Settings</span></button></div></aside>
    <div className="app-content"><main id="main-content">
      {message && <div className="global-message error-banner" role="alert"><span>{message}</span><button className="link-button" onClick={() => { setError(''); void refresh(); }}>Refresh status</button></div>}
      {settingsOpen && <section className="settings-panel panel" aria-label="Workspace settings"><div className="section-heading"><h2>Workspace settings</h2><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button></div><p>{connectionLabel}</p><p className="muted">NVIDIA Nemotron · Nebius Token Factory</p>{health?.budget && <div className="usage-card"><h3>AI spending limit</h3><strong>${health.budget.reservedUsd.toFixed(2)} <span>/ ${health.budget.limitUsd.toFixed(2)}</span></strong><p>Conservative reservation against this installation's limit. Reservations are not the provider bill.</p><p>Token-based estimate: ${health.budget.estimatedUsageUsd.toFixed(5)} · {health.budget.calls} requests.</p><p>{health.budget.message}</p><p>{health.budget.scope}</p></div>}<a href="https://github.com/mithulcrafts/OpenPath/blob/main/docs/BACKEND_RUNBOOK.md" target="_blank" rel="noreferrer">Configuration guide <ArrowRight size={13} /></a></section>}
      {historyOpen && <section className="history-workspace"><div className="page-heading"><p className="eyebrow">Your workspace</p><h1>Every inspection.<br /><span>One place to return.</span></h1><p>Reopen the evidence, changes and task trials behind your product.</p></div><HistoryPanel history={history} currentId={selection.audit} onOpen={openAudit} /></section>}
      {!selection.audit && !historyOpen && <section className="home-workspace">
        <div className="home-grid"><div className="launch-content"><div className="page-heading"><p className="eyebrow"><span className="status-pin" />Built for the agent-facing web</p><h1>Make your website<br />work for <span>agents.</span></h1><p>Your product has a new kind of user.<br />Find what agents can access—and what needs to change.</p></div>
          <form className="audit-card" onSubmit={event => { event.preventDefault(); void startAudit(); }}><label className="input-label" htmlFor="website-url">Website to inspect</label><div className="url-row"><div className="url-input"><Globe2 size={19} aria-hidden="true" /><input id="website-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://your-product.com" maxLength={2048} required disabled={auditPosting} autoComplete="url" spellCheck={false} /></div><button className="primary" type="submit" disabled={!url.trim() || auditPosting}>{auditPosting ? 'Starting audit…' : 'Run audit'}<ArrowRight size={16} /></button></div>
          <div className="card-foot"><span><Check size={13} />Up to 4 pages</span><span><ShieldCheck size={13} />Read-only inspection</span>{health?.demoAvailable && <button type="button" className="text-button" disabled={auditPosting} onClick={() => setUrl(visibleDemo(health.demoUrl))}>Use controlled demo</button>}</div>
          <details className="advanced-form"><summary>Compare with a saved audit</summary><label>Baseline audit<select value={compareWith} onChange={event => setCompareWith(event.target.value)} disabled={auditPosting}><option value="">No comparison</option>{history.filter(item => item.status === 'complete').map(item => <option key={item.id} value={item.id}>{item.domain}{new URL(item.url).pathname} · {date(item.createdAt)}</option>)}</select></label></details>
          <p className="form-note"><CircleHelp size={13} />{live && !health?.budget?.blocked ? 'One AI review, within your workspace spending limit.' : 'Rule-based inspection is available without paid AI analysis.'}</p></form>
        </div><PathIllustration /></div>
        <div className="workflow-line"><div><span>01</span><b>Understand the route</b><small>Captured pages. Actual controls.</small></div><ArrowRight size={17} /><div><span>02</span><b>Plan the changes</b><small>Scoped fixes with their evidence.</small></div><ArrowRight size={17} /><div><span>03</span><b>Verify the outcome</b><small>Real tasks. Independent checks.</small></div></div>
        <section className="recent-section" aria-label="Recent activity"><div className="section-heading"><div><h2>Your products <span className="count-badge">{history.length}</span></h2><p>Continue from a saved inspection.</p></div>{history.length > 0 && <button className="text-button" onClick={() => setHistoryOpen(true)}>View all audits<ArrowRight size={14} /></button>}</div>
          {history.length ? <div className="recent-table"><div className="recent-table-head" aria-hidden="true"><span>Product</span><span>Findings</span><span>Inspection</span><span>Captured</span><span /></div>{history.slice(0, 4).map(item => <button className="recent-row" key={item.id} onClick={() => openAudit(item.id)}><span className="recent-site"><span className="site-avatar" aria-hidden="true">{item.domain.replace(/^www\./, '').charAt(0).toUpperCase()}</span><span><strong>{item.domain}</strong><small>{new URL(item.url).pathname}</small></span></span><span className="recent-findings">{item.findingCount}</span><span className={`audit-status status-${item.status}`}><span />{item.status === 'complete' ? 'Complete' : item.status === 'failed' ? 'Failed' : 'In progress'}</span><time className="recent-date" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time><ChevronRight size={16} /></button>)}</div> : <div className="empty-history"><FileSearch size={26} /><h3>Your first product starts here.</h3><p>Enter a website above to map its agent access.</p></div>}
        </section>
      </section>}
      {!historyOpen && selection.audit && !audit && !auditState.error && <section className="loading-workspace" role="status"><p>Loading saved inspection…</p><div className="skeleton-line" /><div className="skeleton-panel" /></section>}
      {!historyOpen && audit && audit.status !== 'complete' && <section className="loading-workspace"><div className="page-heading"><p className="eyebrow audit-state" role="status">AUDIT {audit.status.toUpperCase()}</p><h1>{audit.domain}</h1><p>{audit.url}</p></div>{!auditDone(audit) && <div className="progress-card" role="status"><span className="section-icon"><ScanLine size={22} /></span><div><h2>Inspecting your product</h2><p>{audit.events.at(-1)?.message || 'Audit queued.'}</p><div className="progress-line"><progress max={100} value={audit.progress} aria-label="Audit progress" /><span>{audit.progress}%</span></div></div></div>}{audit.status === 'failed' && <div className="error-banner" role="alert">{audit.error || 'The audit failed.'}<button className="ghost" onClick={() => newAudit(audit)}>Review URL and retry</button></div>}</section>}
      {!historyOpen && audit?.status === 'complete' && <CapabilityWorkspace key={audit.id} audit={audit} tab={selection.tab} onTab={tab => navigate({ ...selection, tab })} onPrepareTrial={prepareCapabilityTrial} trialPanel={trialPanel} run={run} onCompare={() => newAudit(audit)} comparisonPanel={<>{auditComparison.error && <div className="error-banner" role="alert">Comparison unavailable: {auditComparison.error}</div>}{auditComparison.data && <AuditComparisonPanel comparison={auditComparison.data} onOpen={openAudit} />}</>} fixedDemoAction={audit.isDemo && /\/demo\/broken(\/|$)/.test(new URL(audit.url).pathname) && health?.demoAvailable ? <button className="ghost" disabled={auditPosting} onClick={() => void startAudit(visibleDemo(health.fixedDemoUrl), audit.id)}>{auditPosting ? 'Starting comparison…' : 'Audit fixed demo'}</button> : undefined} />}
    </main><footer className="workspace-footer"><span><span className="status-pin" />Evidence before assumptions.</span><span>NVIDIA Nemotron <span className="footer-divider">/</span> Nebius Token Factory</span></footer></div>
  </div>;
}
