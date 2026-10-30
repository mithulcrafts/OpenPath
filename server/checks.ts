import { load } from 'cheerio';
import type { Audit, Category, CheckResult, Evidence, Finding, PageEvidence, Profile } from '../shared/types.js';

export function parseHtml(html: string) {
  const $ = load(html);
  const structuredData = { valid: 0, invalid: 0, types: [] as string[] };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()); structuredData.valid++;
      const entries = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.['@graph']) ? data['@graph'] : [])];
      for (const entry of entries) if (entry?.['@type']) structuredData.types.push(String(entry['@type']));
    } catch { structuredData.invalid++; }
  });
  $('script,style,noscript,head,svg').remove();
  return { rawText: $('body').text().replace(/\s+/g, ' ').trim(), structuredData };
}

export function inspectPages(pages: PageEvidence[]): Pick<Audit, 'checks' | 'findings' | 'evidence'> {
  const evidence: Evidence[] = [];
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const addEvidence = (page: PageEvidence, description: string, snippet?: string, selector?: string) => {
    const id = `ev-${evidence.length + 1}`;
    evidence.push({ id, pageId: page.id, url: page.url, description, snippet, selector, screenshot: page.screenshot }); return id;
  };
  const addFinding = (category: Category, title: string, observation: string, impact: string, profiles: Profile[], evidenceIds: string[], fix: string, verification: string, severity: Finding['severity'] = 'medium', code?: string, kind: Finding['kind'] = 'observed') => {
    findings.push({ id: `finding-${findings.length + 1}`, category, title, observation, impact, profiles, evidenceIds, fix, verification, severity, code, kind, source: 'rule' });
  };
  const addCheck = (id: string, category: Category, name: string, bad: string[], detail: string, empty = false) => {
    checks.push({ id, category, name, status: empty ? 'not_tested' : bad.length ? 'warning' : 'pass', detail, evidenceIds: bad });
  };
  const readable = pages.filter(p => !p.error && p.status < 400);
  const reachErrors = pages.filter(p => p.error || p.status >= 400);
  const reachEvidence = reachErrors.map(p => addEvidence(p, p.error || `Navigation returned HTTP ${p.status}.`));
  if (reachEvidence.length) addFinding('discovery', 'Some inspected pages could not be reached', `${reachErrors.length} of ${pages.length} inspected pages returned an error or failed to load.`, 'An agent may be unable to reach information or start a workflow. Network and audit-environment failures remain possible.', ['html','browser'], reachEvidence, 'Inspect the recorded status and navigation error. Repair a broken route if confirmed, or provide an authorised access path for restricted content.', 'Open each affected URL from the intended agent environment and confirm the expected content is returned.', 'high');
  addCheck('reachability', 'discovery', 'Pages are reachable', reachEvidence, reachEvidence.length ? `${reachErrors.length} page(s) need investigation.` : `${pages.length} inspected page(s) loaded.`, !pages.length);

  const contextEvidence: string[] = [];
  for (const p of readable) if (!p.title.trim() || !p.headings.length) contextEvidence.push(addEvidence(p, `Page title: ${p.title || '(empty)'}. Visible headings: ${p.headings.length}.`));
  if (contextEvidence.length) addFinding('discovery', 'Give pages a clear identity', 'Some pages lack a title or visible headings.', 'A browser agent has fewer cues for its current location and the page’s purpose.', ['html','browser'], contextEvidence, 'Add a descriptive page title and headings that explain the page and its main sections.', 'Inspect the page text and semantic snapshot; the page purpose should be explicit.', 'low');
  addCheck('page-context','discovery','Page identity and headings',contextEvidence,contextEvidence.length ? 'Some page context is missing.' : 'Inspected pages have titles and visible headings.',!readable.length);

  const buttonEvidence: string[] = []; let buttonCount = 0;
  for (const p of readable) {
    const buttons = p.controls.filter(c => c.role === 'button' || c.tag === 'button' || ['submit','button','reset'].includes(c.type)); buttonCount += buttons.length;
    for (const c of buttons.filter(c => !c.name).slice(0, 6)) buttonEvidence.push(addEvidence(p, 'Visible button has no detected accessible name.', c.snippet, c.selector));
  }
  if (buttonEvidence.length) addFinding('interactions','Name controls by what they do',`${buttonEvidence.length} inspected button(s) have no detected accessible name.`, 'Text- and semantics-based agents may not know which action a control performs. Visual agents may behave differently.', ['browser'],buttonEvidence,'Use a native button with meaningful visible text or an accurate aria-label. Preserve the actual click handler.','Inspect the semantic tree, then attempt the relevant task with the tested browser agent.','high','<button type="button" aria-label="Open cart">\n  <CartIcon aria-hidden="true" />\n</button>');
  addCheck('button-names','interactions','Buttons have meaningful names',buttonEvidence,buttonCount ? `${buttonCount} visible button(s) inspected.` : 'No visible buttons were found.',!buttonCount);

  const fieldEvidence: string[] = []; let fieldCount = 0;
  for (const p of readable) {
    const fields = p.controls.filter(c => ['input','select','textarea'].includes(c.tag) && !['submit','button','reset','hidden'].includes(c.type)); fieldCount += fields.length;
    for (const c of fields.filter(c => !c.name).slice(0, 6)) fieldEvidence.push(addEvidence(p, `Form field lacks a detected associated label${c.text ? `; placeholder: ${c.text}` : ''}.`, c.snippet, c.selector));
  }
  if (fieldEvidence.length) addFinding('interactions','Label fields with their expected input',`${fieldEvidence.length} field(s) have no detected associated label.`, 'Agents may confuse fields or fail to understand what values belong in them. A placeholder is not a durable label.', ['browser'],fieldEvidence,'Associate a visible label with the input. Explain required values and associate validation messages using aria-describedby.','Confirm the semantic snapshot exposes each field name; submit synthetic data only in an authorised sandbox.','medium','<label htmlFor="work-email">Work email</label>\n<input id="work-email" name="email" type="email" required />');
  addCheck('form-labels','interactions','Form inputs are labelled',fieldEvidence,fieldCount ? `${fieldCount} field(s) inspected.` : 'No form inputs were found.',!fieldCount);

  const semanticEvidence: string[] = [];
  for (const p of readable) for (const c of p.controls.filter(c => c.role === 'generic').slice(0,6)) semanticEvidence.push(addEvidence(p,'A visible focusable or click-handled element exposes no interactive role.',c.snippet,c.selector));
  if (semanticEvidence.length) addFinding('interactions','Expose custom controls as real controls',`${semanticEvidence.length} candidate control(s) lack a detected interactive role.`, 'An agent using semantic controls may overlook an action or misunderstand its interaction pattern.', ['browser'],semanticEvidence,'Prefer native buttons, links and select elements. If a custom control is necessary, implement its role, name, state and keyboard behavior.','Inspect semantics and keyboard interaction, then verify the complete task.','medium','<!-- Prefer a real button over a clickable div. -->\n<button type="button" onClick={openOptions}>Choose options</button>');
  addCheck('control-semantics','interactions','Custom actions expose semantics',semanticEvidence,semanticEvidence.length ? 'Custom controls need a closer look.' : 'No unnamed generic action roles were detected.',!readable.length);

  const linkEvidence: string[] = []; let linkCount = 0;
  for (const p of readable) {
    const links = p.controls.filter(c => c.role === 'link'); linkCount += links.length;
    for (const c of links.filter(c => !c.name).slice(0, 5)) linkEvidence.push(addEvidence(p,'Navigation link has no detected accessible name.',c.snippet,c.selector));
  }
  if (linkEvidence.length) addFinding('discovery','Explain where navigation links lead',`${linkEvidence.length} inspected link(s) have no detected accessible name.`, 'Agents may have to guess from URLs instead of understanding a destination.', ['html','browser'],linkEvidence,'Provide descriptive link text or an accurate accessible name for icon-only links.','Confirm each relevant link exposes its destination’s purpose in the semantic snapshot.','low');
  addCheck('link-names','discovery','Navigation links are named',linkEvidence,`${linkCount} visible link(s) inspected.`,!linkCount);

  const renderingEvidence: string[] = [];
  for (const p of readable) if (p.renderedTextLength > 350 && p.rawTextLength < p.renderedTextLength * 0.3) renderingEvidence.push(addEvidence(p,`Initial HTML contains ${p.rawTextLength} text characters; rendered page contains ${p.renderedTextLength}. These counts indicate a rendering gap, not semantic coverage.`));
  if (renderingEvidence.length) addFinding('readability','Make essential content available before scripts run','Some inspected pages expose substantially more text after rendering.', 'HTTP-only readers may miss information that a JavaScript-capable browser agent can access.', ['html'],renderingEvidence,'Server-render essential product descriptions and prices, or publish a documented data interface. Keep interactive behavior for browser users.','Fetch the initial HTML without running JavaScript and verify the required information is present. Also test the browser path separately.','medium');
  addCheck('rendering-gap','readability','Initial HTML contains useful content',renderingEvidence,renderingEvidence.length ? 'Some content depends heavily on rendering.' : 'No large text-rendering gap was detected.',!readable.length);

  const structuredEvidence: string[] = []; let structuredCount = 0;
  for (const p of readable) {
    structuredCount += p.structuredData.valid + p.structuredData.invalid;
    if (p.structuredData.invalid) structuredEvidence.push(addEvidence(p,`${p.structuredData.invalid} published JSON-LD block(s) could not be parsed.`));
  }
  if (structuredEvidence.length) addFinding('readability','Repair malformed published structured data','At least one published JSON-LD block is invalid JSON.','Consumers of that structured data cannot reliably parse the affected block.', ['html','api'],structuredEvidence,'Correct the JSON syntax and verify that published values match visible product information.','Parse the JSON-LD successfully and check its values against the page.','medium');
  addCheck('structured-data','readability','Published structured data parses',structuredEvidence,structuredCount ? `${structuredCount} JSON-LD block(s) inspected. Schema correctness was not fully validated.` : 'No JSON-LD was found. This does not imply agent incompatibility.',!structuredCount);

  const errorEvidence: string[] = [];
  for (const p of readable) for (const error of [...p.consoleErrors, ...p.requestErrors].slice(0,4)) errorEvidence.push(addEvidence(p,error));
  if (errorEvidence.length) addFinding('interactions','Investigate errors observed during inspection',`${errorEvidence.length} runtime or network error(s) were recorded.`,'An error may affect a workflow, but its impact requires a task-level check. Blocked third-party requests can also reflect the inspection environment.', ['browser'],errorEvidence,'Inspect the related page and request. Prioritise errors affecting the product’s own content and actions; confirm task impact before changing code.','Rerun the affected workflow and independently check the expected outcome.','medium');
  addCheck('runtime-errors','interactions','Page loads without recorded errors',errorEvidence,errorEvidence.length ? 'Recorded errors need contextual review.' : 'No page exceptions or HTTP errors were captured.',!readable.length);

  const integrationLinks = readable.flatMap(p => p.links.filter(l => /\b(api|developers?|openapi|swagger|mcp|integrations?)\b/i.test(l.text + ' ' + l.href)).map(l => ({ p, l })));
  const integrationEvidence = integrationLinks.slice(0,6).map(({p,l}) => addEvidence(p,`Published integration link: ${l.text || l.href}`,l.href));
  checks.push({ id:'integration-discovery',category:'integrations',name:'Existing integration paths are discoverable',status:integrationLinks.length ? 'pass' : 'not_tested',detail:integrationLinks.length ? `${integrationLinks.length} candidate documentation or integration link(s) found. Endpoints and authentication were not exercised.` : 'No API or tool documentation links were discovered on the inspected pages. This does not establish that none exist.',evidenceIds:integrationEvidence });
  if (!integrationLinks.length && readable.length) {
    const ev = addEvidence(readable[0],`Inspected links on ${readable.length} page(s); no explicitly labelled API/tool documentation links were discovered.`);
    addFinding('integrations','Make existing developer access easy to find','No explicitly linked API or tool documentation was discovered within this scan’s page limit.','API-based agents need a discoverable, documented access path if your product offers one. Browser access may already be sufficient.', ['api'],[ev],'If an API or MCP service already exists, link its documentation from the product. Include authentication, permissions and operation descriptions. Do not add an interface solely to satisfy an audit.','Follow the published documentation as an authorised client and verify one intended operation.','info',undefined,'recommendation');
  }
  return { checks, findings, evidence };
}

export function summariseRules(audit: Audit): string {
  const issues = audit.findings.filter(f => f.kind === 'observed').length;
  const ready = audit.checks.filter(c => c.status === 'pass').length;
  return `${audit.pages.length} page${audit.pages.length === 1 ? '' : 's'} inspected. ${ready} checks passed; ${issues} observation${issues === 1 ? '' : 's'} need review. These are compatibility signals, not proof that every agent will succeed or fail.`;
}
