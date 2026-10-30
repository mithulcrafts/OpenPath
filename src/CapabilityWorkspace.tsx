import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, Braces, Check, ChevronRight, Code2, Copy, FileCode2, FileSearch, FileText, Globe2, Map, MousePointer2, Network, Play, Search, ShieldCheck } from 'lucide-react';
import { capabilityFindings, getCapabilities, type ProductCapability } from '../shared/capabilities.js';
import type { Audit, Finding, Profile, TaskRun } from '../shared/types.js';
import { AgentView, DeveloperView, EvidenceView, InferenceDetails, Overview, verifiedNebius } from './components.js';
import type { Tab } from './App.js';

const profileNames: Record<Profile, string> = { browser: 'Browser agent', html: 'HTML reader', api: 'API client' };
const pathFor = (url: string) => { try { return new URL(url).pathname; } catch { return url; } };
const shorten = (text: string, length = 155) => text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text;
const contextualCode = (audit: Audit, finding: Finding): string | undefined => {
  if (!finding.code) return undefined;
  const controlTags = /<(input|select|textarea|button|a)\b/gi;
  const exampleTags = [...finding.code.matchAll(controlTags)].map(match => match[1].toLowerCase());
  const capturedTags = audit.evidence.filter(item => finding.evidenceIds.includes(item.id))
    .flatMap(item => [...(item.snippet || '').matchAll(controlTags)].map(match => match[1].toLowerCase()));
  if (capturedTags.length && exampleTags.length && !exampleTags.some(tag => capturedTags.includes(tag))) return undefined;
  return finding.code;
};

type Props = {
  audit: Audit; tab: Tab; onTab: (tab: Tab) => void; onPrepareTrial: (capability: ProductCapability) => void;
  trialPanel: ReactNode; comparisonPanel: ReactNode; fixedDemoAction?: ReactNode; onCompare: () => void; run?: TaskRun;
};

function EvidenceLink({ audit, finding, onOpen }: { audit: Audit; finding: Finding; onOpen: () => void }) {
  const evidence = audit.evidence.find(item => finding.evidenceIds.includes(item.id));
  return evidence ? <button className="evidence-chip" onClick={onOpen}><FileSearch size={13} /><span>{pathFor(evidence.url)} · captured evidence</span><ChevronRight size={12} /></button> : <span className="muted">No captured evidence for this proposal.</span>;
}

export function CapabilityWorkspace({ audit, tab, onTab, onPrepareTrial, trialPanel, comparisonPanel, fixedDemoAction, onCompare, run }: Props) {
  const capabilities = getCapabilities(audit);
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id || '');
  const [profile, setProfile] = useState<Profile>('browser');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [allFindings, setAllFindings] = useState(false);
  const capability = capabilities.find(item => item.id === selectedId) || capabilities[0];
  const findings = capability ? capabilityFindings(audit, capability, profile) : [];
  const firstFinding = findings[0];
  const routePages = capability?.route.map(node => audit.pages.find(page => page.id === node.pageId)).filter(page => !!page) || [];
  const routeConnected = !!capability && capability.route.length > 1 && capability.route.slice(1).every((node, index) => node.linkedFromPageId === capability.route[index].pageId);
  const entry = routePages[0];
  const target = routePages.at(-1);
  const shownCapabilities = capabilities.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const scopedAudit = { ...audit, findings };
  const openEvidence = () => onTab('evidence');
  const copyExample = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setCopyError(''); }
    catch { setCopyError('Clipboard unavailable. Select and copy the example below.'); }
  };
  const chooseCapability = (id: string) => { setSelectedId(id); setAllFindings(false); setCopied(false); setCopyError(''); if (tab === 'evidence' || tab === 'agent') onTab('overview'); };

  return <div className="capability-workspace">
    <aside className="capability-sidebar" aria-label="Product capabilities">
      <p className="eyebrow">Product capabilities</p><h2>What should agents do?</h2><p className="sidebar-subtitle">Suggested from inspected pages.</p>
      <label className="capability-search"><Search size={16} /><input aria-label="Find a capability" placeholder="Find a capability" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="capability-list">{shownCapabilities.map(item => <button key={item.id} className={`capability-option ${capability?.id === item.id ? 'active' : ''}`} aria-pressed={capability?.id === item.id} onClick={() => chooseCapability(item.id)}><span className="capability-option-heading"><strong>{item.title}</strong><ChevronRight size={15} /></span><span className={`state-tag ${item.handoff ? 'neutral' : 'amber'}`}>{item.handoff ? 'Human handoff' : 'Inferred'}</span><small>{item.handoff ? 'Outside automated trial scope' : `${item.pageIds.length} captured ${item.pageIds.length === 1 ? 'page' : 'pages'} · ${capabilityFindings(audit, item, profile).length} ${capabilityFindings(audit, item, profile).length === 1 ? 'change' : 'changes'}`}</small></button>)}</div>
      {!shownCapabilities.length && <p className="muted capability-empty">No capabilities match. Try another word.</p>}
      <div className="inspected-scope"><p className="eyebrow">Inspected scope</p><h3>{audit.domain}</h3>{audit.pages.map(page => <button key={page.id} onClick={openEvidence} title={page.url}><FileText size={15} /><span>{pathFor(page.url)}</span><span className={`scope-dot ${page.error || page.status >= 400 || page.status === 0 ? 'issue' : ''}`} /></button>)}<p>Public pages only · {audit.pages.length} captured</p></div>
      <div className="sidebar-inspection-meta"><span className="audit-state" role="status">AUDIT COMPLETE</span><time dateTime={audit.createdAt}>{new Date(audit.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
    </aside>
    <section className="capability-content">
      <div className="capability-header"><div><div className="capability-title-line"><h1>{tab === 'evidence' ? 'The evidence behind it.' : tab === 'agent' ? 'How agents see your product.' : capability?.title || 'Understand your product'}</h1>{tab !== 'evidence' && tab !== 'agent' && <span className="state-tag neutral">Not task-verified</span>}</div><p>{tab === 'evidence' ? 'Captured pages, observations and recorded model calls.' : tab === 'agent' ? 'Different access methods need different interfaces.' : capability?.description || audit.summary}</p></div><div className="profile-select"><select aria-label="Agent perspective" value={profile} onChange={event => { setProfile(event.target.value as Profile); setCopied(false); }}><option value="browser">Browser agent</option><option value="html">HTML reader</option><option value="api">API client</option></select><button className="text-button" onClick={() => onTab('agent')}>About agent profiles <ArrowRight size={12} /></button></div></div>
      <div className="workspace-tabbar"><nav className="tabs" aria-label="Audit sections">{([['overview', 'Understand'], ['developer', 'Plan changes'], ['verify', 'Verify']] as const).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => onTab(key)}>{label}{key === 'developer' && <span>{findings.length}</span>}</button>)}{(tab === 'evidence' || tab === 'agent') && <button className="active" aria-current="page">{tab === 'evidence' ? 'Evidence' : 'Agent profiles'}</button>}</nav><span className="map-readonly"><Map size={15} />{tab === 'overview' ? 'Read-only map' : 'Evidence-backed workspace'}</span></div>
      {tab === 'overview' && capability && <div className="understand-layout">
        <div className="route-canvas" aria-label="Capability route map"><div className="canvas-heading"><span>Current product route</span><div><span><i className="legend-line" />Observed route</span><span><i className="legend-line dashed" />Unknown</span></div></div>
          <div className="route-graph">
            <div className={`route-pages ${routePages.length > 1 ? 'has-connection' : 'single-page'}`}>
              {entry && routePages.length > 1 && <article className="route-entry"><div className="node-heading"><span>01</span><h3>Product entry</h3></div><div className="entry-identity"><span className="product-monogram">{audit.domain.replace(/^www\./, '').charAt(0).toUpperCase()}</span><div><b>{audit.domain}</b><small>{pathFor(entry.url)}</small></div></div><span className="state-tag neutral">Captured</span></article>}
              {routePages.length > 1 && <div className={`route-arrow ${!routeConnected ? 'unlinked' : ''}`} aria-label={routeConnected ? 'Route follows captured links' : 'Connection not verified'}><ArrowRight size={20} />{routePages.length > 2 && <small>via {routePages.length - 2}</small>}</div>}
              {target ? <article className="route-page"><div className="node-heading"><span>{routePages.length > 1 ? '02' : '01'}</span><div><h3>{shorten(target.title || 'Captured page', 55)}</h3><small>{pathFor(target.url)}</small></div></div>{target.screenshot ? <button className="route-screenshot" onClick={openEvidence} aria-label="View captured page evidence"><img src={target.screenshot} alt={`Captured ${target.title || target.url}`} /></button> : <div className="capture-placeholder"><FileSearch size={25} /><p>{target.error || 'Page text captured. No screenshot available.'}</p></div>}<div className="capture-footer"><FileText size={13} /><span>Captured page</span><small>{target.controls.length} controls</small></div></article> : <article className="route-page capture-placeholder"><FileSearch size={25} /><h3>No page captured</h3><p>The inspection did not produce enough evidence to draw this route.</p></article>}
            </div>
            {routePages.length > 2 && <div className="route-intermediate"><FileText size={13} />{routePages.length - 2} additional captured {routePages.length === 3 ? 'page' : 'pages'} in this route <button className="text-button" onClick={openEvidence}>View evidence</button></div>}
            <div className="route-connector"><span /><ArrowDown size={15} /><small>{firstFinding ? 'Observation to review' : 'Needs verification'}</small></div>
            <article className={`route-gap ${firstFinding ? 'observed-gap' : ''}`}><div className="node-heading"><span>{routePages.length > 1 ? '03' : '02'}</span><h3>{firstFinding?.title || (capability.targetUrl && !capability.targetPageId ? 'Destination not inspected' : 'Task outcome')}</h3><span className="state-tag amber">{firstFinding?.kind === 'observed' ? 'Observed' : 'Unknown'}</span></div><p><FileSearch size={16} />{shorten(firstFinding?.observation || capability.unknowns[0] || 'A captured page does not prove that an agent can complete this task.', 210)}</p>{firstFinding ? <EvidenceLink audit={audit} finding={firstFinding} onOpen={openEvidence} /> : capability.targetUrl ? <code className="unknown-destination">{capability.targetUrl}</code> : <small>Independent task verification required.</small>}</article>
            <div className="proposed-route"><p className="eyebrow">Proposed changes — not implemented</p><article className="proposal-node"><span className="proposal-icon"><Code2 size={24} /></span><div><div className="proposal-title"><h3>{firstFinding ? 'Make this route easier for agents' : 'Verify the inferred capability'}</h3><span className="state-tag cyan">Proposal</span></div><p>{shorten(firstFinding?.fix || 'Run a bounded task and inspect the independent outcome before claiming this capability works.', 205)}</p><div className="proposal-tags"><span>{profileNames[profile]}</span><span>{firstFinding ? `${firstFinding.evidenceIds.length} evidence records` : 'Outcome unknown'}</span></div></div></article></div>
          </div><div className="canvas-footer"><Network size={13} /><span>Routes inferred from captured links. A map is not a completed task.</span></div>
        </div>
        <aside className="implementation-brief" aria-label="Implementation brief"><div className="brief-heading"><h2>Implementation brief</h2><span className="state-tag amber">Draft</span></div><p>Changes for this capability, backed by inspected pages.</p><div className="brief-changes">{findings.length ? findings.slice(0, 2).map((finding, index) => <article key={finding.id}><span className="brief-step">{index + 1}</span><div><button className="brief-finding-title" onClick={() => onTab('developer')}>{finding.title}<ChevronRight size={13} /></button><p>{finding.fix}</p>{index === 0 && contextualCode(audit, finding) && <div className="brief-code"><div><span>Example change</span><button aria-label="Copy example change" onClick={() => void copyExample(finding.code!)}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button></div><pre>{finding.code}</pre>{copyError && <p role="alert">{copyError}</p>}</div>}<EvidenceLink audit={audit} finding={finding} onOpen={openEvidence} /></div></article>) : <div className="no-scoped-findings"><ShieldCheck size={24} /><h3>No scoped changes identified.</h3><p>This is limited to captured evidence. Verify the task before calling it compatible.</p></div>}</div>{findings.length > 2 && <button className="text-button more-changes" onClick={() => onTab('developer')}>View all {findings.length} changes <ArrowRight size={14} /></button>}
          <div className="brief-verify"><h3>Verify after implementation</h3><p>Run the same task and check its outcome independently.</p><button className="ghost" disabled={capability.handoff} title={capability.handoff ? 'Human handoff is outside automated trial scope' : undefined} onClick={() => onPrepareTrial(capability)}><Play size={15} />Set up trial</button></div>
          <a className="primary export-brief" href={`/api/audits/${audit.id}/fix-kit?capability=${encodeURIComponent(capability.id)}&profile=${profile}`} download><FileCode2 size={17} />Export implementation brief</a><p className="brief-footnote">A change plan. Your source is not modified.</p>
        </aside>
      </div>}
      {tab === 'developer' && <div className="detail-workspace"><div className="detail-intro"><div><p className="eyebrow">From evidence to implementation</p><h2>Give your team a concrete next step.</h2><p>{allFindings ? `All ${audit.findings.length} findings across the complete inspection.` : `${findings.length} ${findings.length === 1 ? 'change' : 'changes'} scoped to ${(capability?.title || 'this capability').toLowerCase()} for ${profileNames[profile].toLowerCase()}s.`}</p></div><div className="head-actions"><button className="ghost" onClick={onCompare}>Compare after changes</button>{fixedDemoAction}<a className="primary" href={`/api/audits/${audit.id}/fix-kit`} download><ArrowDownToLine size={15} />Download fix kit</a></div></div>{comparisonPanel}<label className="findings-scope">Findings scope<select value={allFindings ? 'all' : 'capability'} onChange={event => setAllFindings(event.target.value === 'all')}><option value="capability">Selected capability and agent</option><option value="all">Full inspection · all profiles</option></select></label><DeveloperView key={`${audit.id}-${capability?.id}-${profile}-${allFindings}`} audit={allFindings ? audit : scopedAudit} /><p className="scope-note">These are proposed changes. OpenPath does not modify the product's source code.</p></div>}
      {tab === 'verify' && <div className="detail-workspace"><div className="detail-intro"><div><p className="eyebrow">Move from an assumption to an outcome</p><h2>Let an agent try.</h2><p>A separate checker decides whether the declared condition was met.</p></div><div className="head-actions"><button className="ghost" onClick={onCompare}>Compare after changes</button>{fixedDemoAction}</div></div>{run?.status === 'complete' && <p className="scope-note">Recorded attempt: {run.goal.replace(/[.!?]+\s*$/, '')}. Its result applies to this exact task, not every inferred capability.</p>}{trialPanel}{comparisonPanel}</div>}
      {tab === 'evidence' && <div className="detail-workspace"><section className="model-evidence panel"><div className="section-heading"><div><p className="eyebrow">Analysis provenance</p><h2>{audit.model.mode === 'nemotron' ? 'NVIDIA Nemotron analysis' : 'Rule-based analysis'}</h2></div><span className={`state-tag ${verifiedNebius(audit.inference) ? 'cyan' : 'neutral'}`}>{verifiedNebius(audit.inference) ? 'NVIDIA on Nebius verified' : audit.model.mode === 'nemotron' ? 'Inspect provider evidence' : 'No AI review claimed'}</span></div><p>{audit.model.note}</p><InferenceDetails records={audit.inference} /></section><EvidenceView audit={audit} /><details className="panel full-inspection"><summary>Full inspection and compatibility checks</summary><p className="muted">{audit.summary}</p><Overview audit={audit} /></details><a className="ghost" href={`/api/audits/${audit.id}/fix-kit`} download><ArrowDownToLine size={15} />Download fix kit</a></div>}
      {tab === 'agent' && <div className="detail-workspace"><AgentView audit={audit} /></div>}
      {tab !== 'overview' && <details className="panel limitations"><summary>Inspection scope and limitations</summary><ul>{audit.limitations.map((note, index) => <li key={index}>{note}</li>)}</ul><p>Capability names and routes are inferred from captured page evidence. They are not model-generated guarantees.</p>{audit.isDemo && <p>Controlled storefront variants. Scripted demo mode does not call NVIDIA.</p>}</details>}
    </section>
  </div>;
}
