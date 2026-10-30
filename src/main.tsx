import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Audit, CheckResult, Finding, Health, TaskRun } from '../shared/types.js';
import './styles.css';

const DEMO_URL = `${window.location.origin}/demo/broken/`;

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
  const [url, setUrl] = useState(DEMO_URL);
  const [auditId, setAuditId] = useState<string>();
  const [audit, setAudit] = useState<Audit>();
  const [runId, setRunId] = useState<string>();
  const [run, setRun] = useState<TaskRun>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'agent' | 'developer' | 'evidence'>('overview');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { api<Health>('/api/health').then(setHealth).catch(e => setError(e.message)); }, []);

  useEffect(() => {
    if (!auditId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await api<Audit>(`/api/audits/${auditId}`);
        if (stopped) return;
        setAudit(next);
        if (!['complete', 'failed'].includes(next.status)) window.setTimeout(poll, 900);
        else setBusy(false);
      } catch (e) { if (!stopped) { setError((e as Error).message); setBusy(false); } }
    };
    void poll();
    return () => { stopped = true; };
  }, [auditId]);

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
    total: audit?.checks.length || 0,
  }), [audit]);

  async function startAudit() {
    setError(''); setBusy(true); setRun(undefined); setRunId(undefined); setAudit(undefined); setTab('overview');
    try { const response = await api<{ id: string }>('/api/audits', { method: 'POST', body: JSON.stringify({ url: url.trim() }) }); setAuditId(response.id); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function startTrial() {
    if (!audit) return;
    setError(''); setRun(undefined);
    try { const response = await api<{ id: string }>('/api/runs', { method: 'POST', body: JSON.stringify({ auditId: audit.id }) }); setRunId(response.id); }
    catch (e) { setError((e as Error).message); }
  }

  const loading = busy || (!!audit && audit.status !== 'complete' && audit.status !== 'failed');
  const demo = url.includes('/demo/');

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
          {showAdvanced && <div className="advanced"><label>Demo shortcut <button className="link-button" onClick={() => setUrl(DEMO_URL)}>Use controlled storefront</button></label><small>Use the broken storefront to see a before-and-after agent task run.</small></div>}
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="hero-proof"><span>BUILT ON</span><b>NVIDIA Nemotron</b><span>·</span><b>Nebius Token Factory</b><span>·</span><b>Playwright</b></div>
      </section>}

      {audit && <section className="workspace">
        <div className="workspace-head">
          <div><div className="eyebrow">AUDIT {audit.status === 'complete' ? 'COMPLETE' : audit.status.toUpperCase()}</div><h2>{audit.domain}</h2><p className="muted">{audit.url}</p></div>
          <div className="head-actions"><button className="ghost" onClick={() => { setAudit(undefined); setAuditId(undefined); setRun(undefined); setRunId(undefined); setError(''); }}>← New audit</button><a className="ghost" href={`/api/audits/${audit.id}/fix-kit`} download>Download fix kit</a></div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="progress-card"><div className="progress-top"><span>{audit.events.at(-1)?.message || 'Working…'}</span><b>{audit.progress}%</b></div><div className="progress-track"><span style={{ width: `${audit.progress}%` }} /></div><div className="progress-events">{audit.events.slice(-3).map(e => <span key={e.time}>· {e.message}</span>)}</div></div>}
        {audit.status === 'failed' && <div className="error-banner">{audit.error || 'The audit failed.'}</div>}
        {audit.status === 'complete' && <>
          <div className="summary-grid"><div className="summary-card score"><span className="summary-label">AGENT READINESS</span><strong>{Math.max(0, Math.round((counts.passed / Math.max(1, counts.total)) * 100))}<small>/100</small></strong><span className="summary-caption">{counts.passed} of {counts.total} checks passed</span></div><div className="summary-card"><span className="summary-label">PAGES MAPPED</span><strong>{audit.pages.length}</strong><span className="summary-caption">same-origin evidence</span></div><div className="summary-card"><span className="summary-label">PRIORITY FINDINGS</span><strong className="danger-text">{counts.high + counts.medium}</strong><span className="summary-caption">{counts.high} high · {counts.medium} medium</span></div><div className="summary-card model-card"><span className="summary-label">ANALYSIS ENGINE</span><strong>{audit.model.mode === 'nemotron' ? 'Nemotron' : 'Rules'}</strong><span className="summary-caption">{audit.model.mode === 'nemotron' ? 'Nebius verified' : 'Evidence-only fallback'}</span></div></div>
          <div className="insight-callout"><span className="sparkle">✦</span><div><b>{demo ? 'Your storefront has an agent path — with friction.' : 'OpenPath found a clear path forward.'}</b><p>{audit.summary}</p></div></div>
          <nav className="tabs" aria-label="Audit sections">{([['overview','Overview'],['agent','Agent playbook'],['developer','Developer fixes'],['evidence','Evidence'] ] as const).map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'developer' && <span className="tab-count">{audit.findings.length}</span>}</button>)}</nav>
          {tab === 'overview' && <Overview audit={audit} onTrial={startTrial} run={run} />}
          {tab === 'agent' && <AgentView audit={audit} onTrial={startTrial} run={run} />}
          {tab === 'developer' && <DeveloperView audit={audit} />}
          {tab === 'evidence' && <EvidenceView audit={audit} />}
        </>}
      </section>}
    </main>
    <footer><span>OPENPATH · AGENT COMPATIBILITY AUDITOR</span><span>Evidence first. Claims second.</span></footer>
  </div>;
}

function Overview({ audit, onTrial, run }: { audit: Audit; onTrial: () => void; run?: TaskRun }) {
  const top = [...audit.findings].sort((a,b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0,3);
  return <div className="overview-grid"><div className="panel"><div className="panel-title"><span>WHAT AN AGENT SEES</span><span className="panel-meta">{audit.pages.length} pages · {audit.evidence.length} evidence</span></div>{audit.pages.slice(0,3).map(page => <div className="page-row" key={page.id}><div className="page-icon">{page.error ? '!' : '⌁'}</div><div><b>{page.title || new URL(page.url).pathname}</b><span>{new URL(page.url).pathname || '/'} · {page.controls.length} controls · {page.headings.length} headings</span></div><span className={`status-dot ${page.error ? 'bad' : 'good'}`} /></div>)}</div><div className="panel"><div className="panel-title"><span>TOP OPPORTUNITIES</span><span className="panel-meta">Prioritized</span></div>{top.length ? top.map(f => <FindingMini finding={f} key={f.id} />) : <p className="empty">No findings in the inspected scope.</p>}</div><div className="panel trial-panel"><div className="trial-icon">▶</div><div><div className="panel-title"><span>PROVE THE PATH</span></div><b>{audit.suggestedTask || 'Run a harmless browser task against this site.'}</b><p>OpenPath will use a fresh browser and an independent success assertion.</p><button className="primary" onClick={onTrial}>Run task trial  →</button>{run && <RunStatus run={run} />}</div></div></div>;
}

function AgentView({ audit, onTrial, run }: { audit: Audit; onTrial: () => void; run?: TaskRun }) {
  return <div className="agent-layout"><div className="panel playbook"><div className="panel-title"><span>AGENT NAVIGATION PLAYBOOK</span><span className="chip">{audit.model.mode === 'nemotron' ? 'NEMOTRON REVIEWED' : 'RULE GENERATED'}</span></div><p className="playbook-intro">A compact navigation contract an agent can use without guessing.</p><div className="step-list">{[...audit.checks.filter(c => c.status !== 'pass').slice(0,5), ...audit.checks.filter(c => c.status === 'pass').slice(0,3)].map((check, index) => <div className="step" key={check.id}><span className="step-number">{index + 1}</span><div><b>{check.name}</b><span>{check.detail}</span><code>{check.status === 'pass' ? '✓ verified' : '↳ inspect evidence before acting'}</code></div></div>)}</div><button className="primary" onClick={onTrial}>Run this path in a fresh browser  →</button>{run && <RunStatus run={run} />}</div><div className="panel guardrails"><div className="panel-title"><span>RUN GUARDRAILS</span></div>{['Fresh isolated browser context','No login, CAPTCHA or payment actions','Independent completion assertion','Stops on repeated or ambiguous actions'].map(item => <div className="guardrail" key={item}><span>✓</span>{item}</div>)}</div></div>;
}

function DeveloperView({ audit }: { audit: Audit }) { return <div className="findings-list">{audit.findings.length ? audit.findings.map(f => <FindingCard finding={f} key={f.id} audit={audit} />) : <div className="empty panel">No developer changes were found in this scope.</div>}</div>; }
function EvidenceView({ audit }: { audit: Audit }) { return <div className="evidence-grid">{audit.pages.map(page => <div className="evidence-page panel" key={page.id}><div className="panel-title"><span>{page.title || page.url}</span><span className="chip">{page.status || '—'}</span></div>{page.screenshot ? <img src={page.screenshot} alt={`Captured evidence for ${page.url}`} /> : <div className="no-shot">No screenshot captured</div>}<div className="evidence-stats"><span>{page.controls.length} controls</span><span>{page.headings.length} headings</span><span>{page.links.length} links</span></div></div>)}</div>; }
function FindingMini({ finding }: { finding: Finding }) { return <div className="finding-mini"><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><div><b>{finding.title}</b><span>{finding.observation}</span></div></div>; }
function FindingCard({ finding, audit }: { finding: Finding; audit: Audit }) { return <article className="finding-card"><div className="finding-head"><span className={`severity ${severityTone(finding.severity)}`}>{finding.severity}</span><span className="finding-id">{finding.id} · {finding.category}</span><span className="source">{finding.source === 'nemotron' ? '✦ Nemotron' : '◌ Rule'}</span></div><h3>{finding.title}</h3><p>{finding.observation}</p><div className="finding-columns"><div><label>WHY IT MATTERS</label><p>{finding.impact}</p></div><div><label>PROPOSED CHANGE</label><p>{finding.fix}</p></div><div><label>VERIFY</label><p>{finding.verification}</p></div></div><div className="finding-evidence">Evidence: {finding.evidenceIds.map(id => { const ev = audit.evidence.find(e => e.id === id); return <span key={id}>{id}{ev?.selector ? ` · ${ev.selector}` : ''}</span>; })}</div></article>; }
function RunStatus({ run }: { run: TaskRun }) { const done = run.status === 'complete'; return <div className={`run-status ${run.outcome === 'completed' ? 'run-good' : done ? 'run-bad' : ''}`}><div><b>{done ? run.outcome : 'Running task trial…'}</b><span>{done ? run.explanation : `${run.steps.length} browser steps recorded`}</span></div>{done && <div className="assertions">{run.checks.map(c => <span key={c.description}>{c.passed ? '✓' : '×'} {c.description}</span>)}</div>}</div>; }

createRoot(document.getElementById('root')!).render(<App />);
