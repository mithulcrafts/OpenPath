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

function inspectionUrlKey(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

/** Keep a bounded product inspection focused instead of following global nav first. */
export function nextInspectionLinks(page: PageEvidence, origin: string, focusUrl = page.url): string[] {
  const focusPath = new URL(focusUrl).pathname.replace(/\/+$/, '');
  const current = inspectionUrlKey(page.url);
  const candidates = new Map<string, { url: string; rank: number; order: number }>();
  for (const [order, link] of page.links.entries()) {
    try {
      const url = new URL(link.href, page.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) continue;
      const pathname = decodeURIComponent(url.pathname);
      if (/\.(?:pdf|zip|tar|gz|rar|7z|png|jpe?g|gif|svg|webp|ico|mp[34]|webm|mov|wav|exe|dmg|apk|docx?|xlsx?|pptx?|json|xml|woff2?)$/i.test(pathname)) continue;
      if (/log[-_]?out|sign[-_]?out|delete|remove|unsubscribe|checkout|payment/i.test(pathname)) continue;
      url.hash = '';
      const key = inspectionUrlKey(url.href);
      if (key === current) continue;
      const scoped = !!focusPath && pathname.startsWith(`${focusPath}/`);
      const signal = `${link.text} ${pathname}`;
      const intent = /\b(?:compar(?:e|ison)|pricing|plans|specs|specifications)\b/i.test(signal) ? 40
        : /\b(?:products?|features?|docs|documentation|api|developers?|integrations?)\b/i.test(signal) ? 20
        : /\b(?:shop|store|catalog(?:ue)?)\b/i.test(signal) ? 10
        : /\b(?:contact|about)\b/i.test(signal) ? 5 : 0;
      const rank = (scoped ? 100 : 0) + intent;
      const previous = candidates.get(key);
      if (!previous || rank > previous.rank) candidates.set(key, { url: url.href, rank, order: previous?.order ?? order });
    } catch { /* Malformed URLs and encodings are not inspection candidates. */ }
  }
  return [...candidates.values()].sort((a, b) => b.rank - a.rank || a.order - b.order).map(item => item.url);
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
      if (visited.has(inspectionUrlKey(url))) continue;
      visited.add(inspectionUrlKey(url));
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
          visited.add(inspectionUrlKey(data.url));
          const filename = `page-${index}.png`;
          await page.screenshot({ path:path.join(dir,filename), fullPage:false, timeout:5000 });
          data.screenshot = `/api/artifacts/${audit.id}/${filename}`;
          await writeFile(path.join(dir,`page-${index}-observation.json`),JSON.stringify({url:data.url, ...observation},null,2));
          queue.push(...nextInspectionLinks(data, origin, first.url).filter(link => !visited.has(inspectionUrlKey(link)) && !queue.some(queued => inspectionUrlKey(queued) === inspectionUrlKey(link))));
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
