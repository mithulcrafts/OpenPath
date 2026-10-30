import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext } from 'playwright';
import type { Audit, PageEvidence } from '../shared/types.js';
import { config, isDemoUrl } from './config.js';
import { artifactDir, saveAudit } from './store.js';
import { makeContext, observePage, watchErrors } from './browser.js';
import { parseHtml, inspectPages, summariseRules } from './checks.js';
import { safeFetchText } from './network.js';
import { createModelSession, modelEndpoint, readableModelError, reviewAudit } from './model.js';

export async function auditEvent(audit: Audit, progress: number, message: string) {
  audit.progress = progress; audit.events.push({ time: new Date().toISOString(), message }); await saveAudit(audit);
}

function nextLinks(page: PageEvidence, origin: string) {
  return page.links.filter(l => {
    try {
      const u = new URL(l.href);
      return u.origin === origin && !/\.(pdf|zip|png|jpe?g|gif|svg|mp4|exe)$/i.test(u.pathname) && !/logout|signout|delete|remove|unsubscribe|checkout|payment/i.test(u.pathname);
    } catch { return false; }
  }).map(l => ({ ...l, rank: /pricing|product|shop|features/i.test(l.text+' '+l.href) ? 3 : /docs|api|developer|contact|about/i.test(l.text+' '+l.href) ? 2 : 1 }))
    .sort((a,b) => b.rank-a.rank).map(l => { const u = new URL(l.href); u.hash = ''; return u.href; });
}

export async function executeAudit(audit: Audit, options: { useAI?: boolean } = {}) {
  const session = createModelSession(audit.model.name, record => (audit.inference ||= []).push(record));
  let context: BrowserContext | undefined;
  const dir = artifactDir(audit.id);
  const deadline = Date.now() + 150_000;
  try {
    audit.status = 'crawling';
    await mkdir(dir, { recursive: true });
    await auditEvent(audit, 5, 'Checking the website and preparing an isolated browser.');
    const first = await safeFetchText(audit.url);
    context = await makeContext(first.url);
    const queue = [first.url]; const visited = new Set<string>();
    const origin = new URL(first.url).origin;
    while (queue.length && audit.pages.length < config().maxPages && Date.now() < deadline) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      const index = audit.pages.length + 1;
      await auditEvent(audit, 10 + index * 12, `Inspecting page ${index}: ${new URL(url).pathname}`);
      const page = await context.newPage();
      const errors = watchErrors(page);
      const data: PageEvidence = { id:`page-${index}`,url,title:'',status:0,rawTextLength:0,rawHtmlCaptured:false,renderedTextLength:0,text:'',headings:[],controls:[],links:[],structuredData:{valid:0,invalid:0,types:[]},consoleErrors:[],requestErrors:[],inspectedAt:new Date().toISOString() };
      try {
        const raw = url === first.url ? first : await safeFetchText(url);
        if (!/text\/html|application\/xhtml/i.test(raw.contentType)) {
          data.status = raw.status; data.error = 'This URL did not return an HTML page. API/document resources are recorded as links only.';
        } else {
          const response = await page.goto(url, { waitUntil:'domcontentloaded' });
          // Compare rendering against this navigation's own document response.
          // A separate HTTP client can receive another locale, bot policy or
          // experiment variant; that difference is not evidence of JavaScript.
          if(response){
            try{
              const parsed=parseHtml(await response.text());
              data.rawTextLength=parsed.rawText.length;data.rawHtmlCaptured=true;data.structuredData=parsed.structuredData;
            }catch{audit.limitations.push(`Initial document HTML could not be captured for ${url}; its rendering comparison is unverified.`);}
          }
          await page.waitForLoadState('networkidle', {timeout:2500}).catch(() => {});
          const observation = await observePage(page);
          Object.assign(data, { url:page.url(),title:observation.title,text:observation.text,headings:observation.headings,controls:observation.controls,links:observation.links,renderedTextLength:observation.text.length,status:response?.status() || raw.status });
          const filename = `page-${index}.png`;
          await page.screenshot({ path:path.join(dir,filename), fullPage:false, timeout:5000 });
          data.screenshot = `/api/artifacts/${audit.id}/${filename}`;
          await writeFile(path.join(dir,`page-${index}-observation.json`),JSON.stringify({url:data.url, ...observation},null,2));
          queue.push(...nextLinks(data, origin).filter(l => !visited.has(l)));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Page inspection failed.';
        data.error = message.split('\n')[0].slice(0,300);
      } finally {
        data.consoleErrors = errors.consoleErrors; data.requestErrors = errors.requestErrors;
        audit.pages.push(data); await page.close().catch(() => {}); await saveAudit(audit);
      }
    }
    await context.close(); context = undefined;
    Object.assign(audit, inspectPages(audit.pages));
    audit.summary = summariseRules(audit);
    audit.status = 'analyzing';
    await auditEvent(audit, 72, 'Checking discovery, readable content, controls and integration paths.');
    if (options.useAI !== false && session.settings.key && audit.pages.some(p => !p.error)) {
      await auditEvent(audit, 83, 'Nemotron is reviewing the evidence and proposing changes.');
      try {
        const review = await reviewAudit(audit, session);
        audit.summary = review.overview;
        audit.suggestedTask = review.suggestedTask;
        for (const suggestion of review.recommendations) {
          const finding = audit.findings.find(f => f.id === suggestion.findingId)!;
          finding.impact = suggestion.impact; finding.fix = suggestion.fix; finding.verification = suggestion.verification; finding.source = 'nemotron';
        }
        audit.model = { mode:'nemotron',name:session.settings.model,note:`Recommendations reviewed by ${session.settings.model} on ${modelEndpoint(session.settings).provider === 'nebius' ? 'Nebius' : 'the configured custom endpoint'}. Observations and check results come from the scanner.` };
      } catch (error) {
        audit.model = {mode:'rules',name:session.settings.model,note:`Evidence-based rule results are shown. NVIDIA review was unavailable: ${readableModelError(error)}`};
      }
    } else {
      audit.model = {mode:'rules',name:session.settings.model,note:options.useAI === false ? 'Deterministic checks only. NVIDIA review was explicitly disabled for this internal verification run.' : session.settings.key ? 'No successfully rendered page was available for NVIDIA review.' : 'Deterministic checks only. Configure a Nebius key to add NVIDIA analysis and browser task trials.'};
    }
    if (isDemoUrl(audit.url)) audit.suggestedTask = 'Add the Everyday Tee in blue, size M, to the cart. Stop once the cart shows one item.';
    audit.status = 'complete'; audit.completedAt = new Date().toISOString();
    await auditEvent(audit,100,'Inspection complete. Review evidence before applying recommendations.');
  } catch (error) {
    audit.status = 'failed'; audit.completedAt = new Date().toISOString();
    audit.error = error instanceof Error ? error.message.split('\n')[0].slice(0,400) : 'The audit could not be completed.';
    if (/Executable doesn't exist|browserType.launch/.test(audit.error)) audit.error = 'Chromium is not installed. Run npm run browser:install on the server.';
    await saveAudit(audit);
  } finally { await context?.close().catch(() => {}); }
}
