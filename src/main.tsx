import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Audit, AuditSummary, Category, Finding, Health, TaskRun } from '../shared/types.js';
import './styles.css';

type Tab = 'overview' | 'agent' | 'developer' | 'evidence';
type AssertionKind = 'visible_text' | 'url_contains';
const DEMO_URL = `${window.location.origin}/demo/broken/`;
const categories: Array<{ key: 'all' | Category; label: string }> = [
  { key: 'all', label: 'All categories' },
  { key: 'discovery', label: 'Find & access' },
  { key: 'readability', label: 'Read & understand' },
  { key: 'interactions', label: 'Use & complete' },
  { key: 'integrations', label: 'Connect directly' },
];

function api<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data as T;
  });
}
const severityTone = (severity: Finding['severity']) => severity === 'high' ? 'danger' : severity === 'medium' ? 'warn' : severity === 'low' ? 'info' : 'muted';

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [assertionKind, setAssertionKind] = useState<AssertionKind>('visible_text');
  const [assertionValue, setAssertionValue] = useState('');
  const [compareWith, setCompareWith] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditId, setAuditId] = useState<string>();
  const [audit, setAudit] = useState<Audit>();
  const [compareAudit, setCompareAudit] = useState<Audit>();
  const [runId, setRunId] = useState<string>();
  const [run, setRun] = useState<TaskRun>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    Promise.all([api<Health>('/api/health'), api<{ audits: AuditSummary[] }>('/api/audits')])
      .then(([nextHealth, nextHistory]) => { setHealth(nextHealth); setHistory(nextHistory.audits); setUrl(current => current || nextHealth.demoUrl || DEMO_URL); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!auditId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await api<Audit>(`/api/audits/${auditId}`);
        if (stopped) return;
        setAudit(next);
        if (!['complete', 'failed'].includes(next.status)) window.setTimeout(poll, 900);
        else { setBusy(false); api<{ audits: AuditSummary[] }>('/api/audits').then(value => setHistory(value.audits)).catch(() => {}); }
      } catch (e) { if (!stopped) { setError((e as Error).message); setBusy(false); } }
    };
    void poll();
    return () => { stopped = true; };
  }, [auditId]);

  useEffect(() => {
    if (!audit?.compareWith) { setCompareAudit(undefined); return; }
    api<Audit>(`/api/audits/${audit.compareWith}`).then(setCompareAudit).catch(() => setCompareAudit(undefined));
  }, [audit?.compareWith]);

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await api<TaskRun>(`/api/runs/${runId}`);
        if (stopped) return;
        setRun(next);
        if (next.status !== 'complete') window.setTimeout(poll, 900);
      } catch (e) { if (!stopped) setError((e as Error).message); }
    };
    void poll();
    return () => { stopped = true; };
  }, [runId]);

  const counts = useMemo(() => ({
    high: audit?.findings.filter(f => f.severity === 'high').length || 0,
    medium: audit?.findings.filter(f => f.severity === 'medium').length || 0,
    passed: audit?.checks.filter(c => c.status === 'pass').length || 0,
    warning: audit?.checks.filter(c => c.status === 'warning').length || 0,
    failed: audit?.checks.filter(c => c.status === 'fail').length || 0,
    untested: audit?.checks.filter(c => c.status === 'not_tested').length || 0,
    total: audit?.checks.length || 0,
  }), [audit]);

  async function startAudit() {
    setError(''); setBusy(true); setRun(undefined); setRunId(undefined); setAudit(undefined); setCompareAudit(undefined); setTab('overview');
    try {
      const response = await api<{ id: string }>('/api/audits', { method: 'POST', body: JSON.stringify({ url: url.trim(), compareWith: compareWith || undefined }) });
      setAuditId(response.id);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function startTrial() {
    if (!audit) return;
    const isDemo = audit.isDemo;
    if (!isDemo && health?.ai === 'unconfigured') { setError('Configure NEBIUS_API_KEY before running a live public-site trial.'); return; }
    if (!isDemo && (goal.trim().length < 5 || assertionValue.trim().length < 1)) {
      setError('Public-site trials need a browsing goal and an independent URL or visible-text assertion.');
      return;
    }
    setError(''); setRun(undefined);
    const body = isDemo ? { auditId: audit.id } : { auditId: audit.id, goal: goal.trim(), assertions: [{ kind: assertionKind, value: assertionValue.trim() }] };
    try { const response = await api<{ id: string }>('/api/runs', { method: 'POST', body: JSON.stringify(body) }); setRunId(response.id); }
    catch (e) { setError((e as Error).message); }
  }

  function openHistoryItem(id: string) {
    setHistoryOpen(false); setRun(undefined); setRunId(undefined); setError(''); setAudit(undefined); setAuditId(id);
  }

  const loading = busy || (!!audit && audit.status !== 'complete' && audit.status !== 'failed');
  const demo = audit?.isDemo ?? url.includes('/demo/');
  const canTrial = demo || (health?.ai !== 'unconfigured' && goal.trim().length >= 5 && assertionValue.trim().length > 0);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✦</span><span>OpenPath</span><span className="brand-tag">AGENT READINESS</span></div>
      <div className="top-actions"><span className="live-dot" /> {health?.ai === 'verified' ? 'Nebius verified' : health?.ai === 'configured' ? 'Nebius configured' : 'Rules + demo mode'} <span className="model-pill">{health?.model || 'Nemotron'}</span></div>
    </header>
    <main>
      {!audit && <section className="hero">
        <div className="eyebrow">THE WEB IS ABOUT TO BECOME AGENTIC</div>
        <h1>Make your website<br /><em>legible to agents.</em></h1>
        <p className="hero-copy">OpenPath inspects a URL like an AI agent would, then turns real browser evidence into a navigation playbook and a developer fix kit.</p>
        <div className="audit-card">
          <div className="input-label">WEBSITE TO INSPECT</div>
          <div className="url-row"><span className="url-icon">↗</span><input value={url} onChange={e => setUrl(e.target.value)} aria-label="Website URL" placeholder="https://your-product.com" onKeyDown={e => { if (e.key === 'Enter') void startAudit(); }} /><button className="primary" onClick={() => void startAudit()} disabled={!url.trim() || loading}>{loading ? 'Inspecting…' : 'Run audit  →'}</button></div>
          <div className="card-foot"><span>⌁ Bounded crawl · up to 4 pages</span><span>◈ No login or state changes</span><button className="text-button" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? 'Hide options' : 'Advanced options'}</button></div>
          {showAdvanced && <div className="advanced advanced-form">
            <label>Demo shortcut <button className="link-button" onClick={() => setUrl(health?.demoUrl || DEMO_URL)}>Use controlled storefront</button></label>
            <label>Task goal<input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Open the pricing page" /></label>
            <label>Success check<select value={assertionKind} onChange={e => setAssertionKind(e.target.value as AssertionKind)}><option value="visible_text">Visible text</option><option value="url_contains">URL contains</option></select><input value={assertionValue} onChange={e => setAssertionValue(e.target.value)} placeholder="e.g. Enterprise pricing" /></label>
            <label>Compare with<select value={compareWith} onChange={e => setCompareWith(e.target.value)}><option value="">No comparison</option>{history.map(item => <option key={item.id} value={item.id}>{item.domain} · {item.findingCount} findings · {new Date(item.createdAt).toLocaleString()}</option>)}</select></label>
            <small>Demo tasks use the controlled cart. Public trials require the goal and success check above.</small>
          </div>}
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="hero-proof"><span>BUILT ON</span><b>NVIDIA Nemotron</b><span>·</span><b>Nebius Token Factory</b><span>·</span><b>Playwright</b></div>
      </section>}

      {audit && <section className="workspace">
        <div className="workspace-head"><div><div className="eyebrow">AUDIT {audit.status === 'complete' ? 'COMPLETE' : audit.status.toUpperCase()}</div><h2>{audit.domain}</h2><p className="muted">{audit.url}</p></div><div className="head-actions"><button className="ghost" onClick={() => { setAudit(undefined); setAuditId(undefined); setRun(undefined); setRunId(undefined); setError(''); }}>← New audit</button><button className="ghost" onClick={() => setHistoryOpen(!historyOpen)}>History</button><a className="ghost" href={`/api/audits/${audit.id}/fix-kit`} download>Download fix kit</a></div></div>
        {historyOpen && <HistoryPanel history={history} currentId={audit.id} onOpen={openHistoryItem} />}
        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="progress-card"><div className="progress-top"><span>{audit.events.at(-1)?.message || 'Working…'}</span><b>{audit.progress}%</b></div><div className="progress-track"><span style={{ width: `${audit.progress}%` }} /></div><div className="progress-events">{audit.events.slice(-3).map(e => <span key={e.time}>· {e.message}</span>)}</div></div>}
        {audit.status === 'failed' && <div className="error-banner">{audit.error || 'The audit failed.'}</div>}
        {audit.status === 'complete' && <>
          <div className="summary-grid"><div className="summary-card score"><span className="summary-label">CHECKS IN SCOPE</span><strong>{counts.passed}<small>/{counts.total}</small></strong><span className="summary-caption">{counts.passed} pass · {counts.warning} warning · {counts.untested} untested</span></div><div className="summary-card"><span className="summary-label">PAGES MAPPED</span><strong>{audit.pages.length}</strong><span className="summary-caption">same-origin evidence</span></div><div className="summary-card"><span className="summary-label">PRIORITY FINDINGS</span><strong className="danger-text">{counts.high + counts.medium}</strong><span className="summary-caption">{counts.high} high · {counts.medium} medium</span></div><div className="summary-card model-card"><span className="summary-label">ANALYSIS ENGINE</span><strong>{audit.model.mode === 'nemotron' ? 'Nemotron' : 'Rules'}</strong><span className="summary-caption">{audit.model.mode === 'nemotron' ? 'Nebius verified' : 'Evidence-only fallback'}</span></div></div>
          <div className="insight-callout"><span className="sparkle">✦</span><div><b>{demo ? 'Your storefront has an agent path — with friction.' : 'OpenPath found a clear path forward.'}</b><p>{audit.summary}</p></div></div>
          {compareAudit && <ComparisonPanel current={audit} baseline={compareAudit} />}
          <nav className="tabs" aria-label="Audit sections">{([['overview','Overview'],['agent','Agent playbook'],['developer','Developer fixes'],['evidence','Evidence'] ] as const).map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'developer' && <span className="tab-count">{audit.findings.length}</span>}</button>)}</nav>
          {tab === 'overview' && <Overview audit={audit} onTrial={startTrial} run={run} canTrial={canTrial} health={health} />}
          {tab === 'agent' && <AgentView audit={audit} onTrial={startTrial} run={run} canTrial={canTrial} />}
          {tab === 'developer' && <DeveloperView audit={audit} />}
          {tab === 'evidence' && <EvidenceView audit={audit} />}
        </>}
      </section>}
    </main>
    <footer><span>OPENPATH · AGENT COMPATIBILITY AUDITOR</span><span>Evidence first. Claims second.</span></footer>
  </div>;
}

function HistoryPanel({ history, currentId, onOpen }: { history: AuditSummary[]; currentId: string; onOpen: (id: string) => void }) { return <div className="panel history-panel"><div className="panel-title"><span>RECENT AUDITS</span><span className="panel-meta">{history.length} saved</span></div>{history.length ? history.map(item => <button className={`history-row ${item.id === currentId ? 'selected' : ''}`} key={item.id} onClick={() => onOpen(item.id)}><span><b>{item.domain}</b><small>{new Date(item.createdAt).toLocaleString()} · {item.pageCount} pages</small></span><span>{item.findingCount} findings</span></button>) : <p className="empty">No previous audits.</p>}</div>; }
function ComparisonPanel({ current, baseline }: { current: Audit; baseline: Audit }) { const pass = (a: Audit) => a.checks.filter(c => c.status === 'pass').length; return <div className="panel comparison-panel"><div className="panel-title"><span>BEFORE / AFTER COMPARISON</span><span className="chip">{baseline.domain}</span></div><div className="comparison-grid"><div><small>BASELINE</small><b>{pass(baseline)}/{baseline.checks.length} checks</b><span>{baseline.findings.length} findings</span></div><div className="comparison-arrow">→</div><div><small>CURRENT</small><b>{pass(current)}/{current.checks.length} checks</b><span>{current.findings.length} findings</span></div></div><p className="muted">This compares the two recorded audit scopes. It does not claim causality for changes between runs.</p></div>; }
function Overview({ audit, onTrial, run, canTrial, health }: { audit: Audit; onTrial: () => void; run?: TaskRun; canTrial: boolean; health: Health | null }) { const top = [...audit.findings].sort((a,b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0,3); return <div className="overview-grid"><div className="panel"><div className="panel-title"><span>WHAT AN AGENT SEES</span><span className="panel-meta">{audit.pages.length} pages · {audit.evidence.length} evidence</span></div>{audit.pages.slice(0,3).map(page => <div className="page-row" key={page.id}><div className="page-icon">{page.error ? '!' : '⌁'}</div><div><b>{page.title || new URL(page.url).pathname}</b><span>{new URL(page.url).pathname || '/'} · {page.controls.length} controls · {page.headings.length} headings</span></div><span className={`status-dot ${page.error ? 'bad' : 'good'}`} /></div>)}</div><div className="panel"><div className="panel-title"><span>TOP OPPORTUNITIES</span><span className="panel-meta">Prioritized</span></div>{top.length ? top.map(f => <FindingMini finding={f} key={f.id} />) : <p className="empty">No findings in the inspected scope.</p>}</div><div className="panel trial-panel"><div className="trial-icon">▶</div><div><div className="panel-title"><span>PROVE THE PATH</span></div><b>{audit.suggestedTask || 'Run a harmless browser task against this site.'}</b><p>{audit.isDemo ? 'Fresh browser + independent sandbox assertion.' : health?.ai === 'unconfigured' ? 'Configure Nebius before running a live public-site trial.' : 'Provide a goal and success check in Advanced options to run this browsing-only trial.'}</p><button className="primary" onClick={onTrial} disabled={!canTrial}>{canTrial ? 'Run task trial  →' : 'Add task assertion'}</button>{run && <RunStatus run={run} />}</div></div></div>; }
function AgentView({ audit, onTrial, run, canTrial }: { audit: Audit; onTrial: () => void; run?: TaskRun; canTrial: boolean }) { return <div className="agent-layout"><div className="panel playbook"><div className="panel-title"><span>AGENT NAVIGATION PLAYBOOK</span><span className="chip">{audit.model.mode === 'nemotron' ? 'NEMOTRON REVIEWED' : 'RULE GENERATED'}</span></div><p className="playbook-intro">A compact navigation contract built from observed controls and checks. It is guidance until a task-level trial passes.</p><div className="step-list">{[...audit.checks.filter(c => c.status !== 'pass').slice(0,5), ...audit.checks.filter(c => c.status === 'pass').slice(0,3)].map((check, index) => <div className="step" key={check.id}><span className="step-number">{index + 1}</span><div><b>{check.name}</b><span>{check.detail}</span><code>{check.status === 'pass' ? '✓ verified' : '↳ inspect evidence before acting'}</code></div></div>)}</div><button className="primary" onClick={onTrial} disabled={!canTrial}>{canTrial ? 'Run this path in a fresh browser  →' : 'Add a task assertion to trial this site'}</button>{run && <RunStatus run={run} />}</div><div className="panel guardrails"><div className="panel-title"><span>RUN GUARDRAILS</span></div>{['Fresh isolated browser context','No login, CAPTCHA or payment actions','Independent completion assertion','Stops on repeated or ambiguous actions'].map(item => <div className="guardrail" key={item}><span>✓</span>{item}</div>)}</div></div>; }
function DeveloperView({ audit }: { audit: Audit }) { const [category, setCategory] = useState<'all' | Category>('all'); const filtered = category === 'all' ? audit.findings : audit.findings.filter(f => f.category === category); return <div><div className="finding-filters">{categories.map(item => <button key={item.key} className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}>{item.label}</button>)}</div><div className="findings-list">{filtered.length ? filtered.map(f => <FindingCard finding={f} key={f.id} audit={audit} />) : <div className="empty panel">No findings in this category.</div>}</div></div>; }
function EvidenceView({ audit }: { audit: Audit }) { return <div className="evidence-grid">{audit.pages.map(page => { const records = audit.evidence.filter(e => e.pageId === page.id); return <div className="evidence-page panel" key={page.id}><div className="panel-title"><span>{page.title || page.url}</span><span className="chip">{page.status || '—'}</span></div>{page.screenshot ? <img src={page.screenshot} alt={`Captured evidence for ${page.url}`} /> : <div className="no-shot">No screenshot captured</div>}<div className="evidence-stats"><span>{page.controls.length} controls</span><span>{page.headings.length} headings</span><span>{page.links.length} links</span></div><details className="evidence-details"><summary>{records.length} evidence records</summary>{records.map(record => <article className="evidence-record" key={record.id}><b>{record.id}</b><span>{record.description}</span>{record.selector && <code>{record.selector}</code>}{record.snippet && <pre>{record.snippet}</pre>}</article>)}</details></div>; })}</div>; }
function FindingMini({ finding }: { finding: Finding }) { return <div className="finding-mini"><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><div><b>{finding.title}</b><span>{finding.observation}</span></div></div>; }
function FindingCard({ finding, audit }: { finding: Finding; audit: Audit }) { return <article className="finding-card"><div className="finding-head"><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><span className="finding-id">{finding.id} · {finding.category}</span><span className="source">{finding.source === 'nemotron' ? '✦ Nemotron' : '◌ Rule'}</span></div><h3>{finding.title}</h3><p>{finding.observation}</p><div className="finding-columns"><div><label>WHY IT MATTERS</label><p>{finding.impact}</p></div><div><label>PROPOSED CHANGE</label><p>{finding.fix}</p></div><div><label>VERIFY</label><p>{finding.verification}</p></div></div><details className="finding-evidence"><summary>Evidence: {finding.evidenceIds.length} record(s)</summary>{finding.evidenceIds.map(id => { const ev = audit.evidence.find(e => e.id === id); return <div key={id}><b>{id}</b>{ev?.selector && <code>{ev.selector}</code>}{ev?.snippet && <pre>{ev.snippet}</pre>}</div>; })}</details></article>; }
function RunStatus({ run }: { run: TaskRun }) { const done = run.status === 'complete'; const offline = run.model === 'openpath-demo-simulator'; return <div className={`run-status ${run.outcome === 'completed' ? 'run-good' : done ? 'run-bad' : ''}`}><div><b>{done ? run.outcome : 'Running task trial…'}</b><span>{done ? run.explanation : `${run.steps.length} browser steps recorded`}</span><small>{offline ? 'Controlled demo simulator · no NVIDIA inference' : `${run.model} · ${run.profile} · ${run.maxSteps} steps / ${Math.round(run.maxDurationMs / 1000)}s budget`}</small></div>{done && <div className="assertions">{run.checks.map(c => <span key={c.description}>{c.passed ? '✓' : '×'} {c.description}</span>)}{run.trace && <a href={run.trace}>Open trace</a>}</div>}<details className="run-steps"><summary>{run.steps.length} recorded browser steps</summary>{run.steps.map(step => <article key={step.index}><b>{step.index}. {step.action}</b><span>{step.target || step.url} · {step.result}</span>{step.screenshot && <img src={step.screenshot} alt={`Step ${step.index}`} />}</article>)}</details></div>; }

createRoot(document.getElementById('root')!).render(<App />);





