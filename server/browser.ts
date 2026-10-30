import './runtime.js';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { config, demoOrigin, isDemoUrl } from './config.js';
import { startEgressProxy } from './network.js';
import type { Control } from '../shared/types.js';

let browserPromise: Promise<Browser> | undefined;
export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const proxy = await startEgressProxy();
      const browser = await chromium.launch({
        headless: true,
        channel: 'chromium',
        chromiumSandbox: !config().noSandbox,
        proxy: { server: proxy, bypass: '<-loopback>' },
        args: ['--disable-quic', '--disable-webrtc', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', ...(config().noSandbox ? ['--no-sandbox'] : [])],
      });
      browser.on('disconnected', () => { browserPromise = undefined; });
      return browser;
    })().catch(error => { browserPromise = undefined; throw error; });
  }
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}

export async function makeContext(startUrl: string, sandboxWrites = false): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'UTC',
    serviceWorkers: 'block', acceptDownloads: false, permissions: [],
    userAgent: 'Mozilla/5.0 (compatible; OpenPath/0.1; agent-compatibility-audit) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36',
  });
  context.setDefaultTimeout(5000);
  context.setDefaultNavigationTimeout(16000);
  const target = new URL(startUrl);
  const demo = isDemoUrl(startUrl);
  await context.route('**/*', async route => {
    const req = route.request();
    try {
      const url = new URL(req.url());
      if (!['http:', 'https:'].includes(url.protocol)) return route.abort('blockedbyclient');
      const localDemo = url.origin === demoOrigin();
      if (localDemo && (!demo || !url.pathname.startsWith('/demo/'))) return route.abort('blockedbyclient');
      const sandboxPost = demo && sandboxWrites && localDemo && url.pathname.startsWith('/demo/api/') && req.method() === 'POST';
      if (!['GET', 'HEAD'].includes(req.method()) && !sandboxPost) return route.abort('blockedbyclient');
      // Page navigation stays inside the declared product. Public CDN resources
      // still pass through the IP-validating egress proxy.
      if (req.isNavigationRequest() && url.origin !== target.origin) return route.abort('blockedbyclient');
      if (['media', 'font'].includes(req.resourceType())) return route.abort('blockedbyclient');
      await route.continue();
    } catch { await route.abort('blockedbyclient'); }
  });
  await context.routeWebSocket('**/*', route => route.close());
  context.on('page', page => {
    page.on('dialog', dialog => void dialog.dismiss());
    page.on('download', download => void download.cancel());
  });
  return context;
}

// A JavaScript string keeps this browser-side code independent of TypeScript
// runtime transforms. Data attributes identify actions without adding labels.
const OBSERVE_SCRIPT = `(() => {
  const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
  const visible = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[inert]');
  };
  const name = element => {
    const labelled = element.getAttribute('aria-labelledby');
    if (labelled) return clean(labelled.split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
    if (element.hasAttribute('aria-label')) return clean(element.getAttribute('aria-label'));
    if (element.labels && element.labels.length) return clean(Array.from(element.labels).map(label => label.textContent).join(' '));
    if (element.tagName === 'INPUT' && ['submit','button','reset'].includes(element.type)) return clean(element.value || element.type);
    if (element.tagName === 'INPUT' && element.type === 'image') return clean(element.alt);
    if (!['INPUT','TEXTAREA','SELECT'].includes(element.tagName)) {
      const text = clean(element.innerText);
      if (text) return text;
      const alt = Array.from(element.querySelectorAll('img')).map(img => img.alt).filter(Boolean).join(' ');
      if (alt) return clean(alt);
    }
    return clean(element.getAttribute('title'));
  };
  const token = Date.now().toString(36);
  const candidates = Array.from(document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[role="combobox"],[role="checkbox"],[onclick],[tabindex="0"]')).filter(visible).slice(0, 150);
  const controls = candidates.map((element, index) => {
    const id = 'op-' + token + '-' + index;
    element.setAttribute('data-openpath-id', id);
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role') || ({button:'button',a:'link',select:'combobox',textarea:'textbox',input:element.type === 'checkbox' ? 'checkbox' : 'textbox'}[tag] || 'generic');
    const label = name(element);
    let selector = tag;
    if (element.id) selector += '#' + CSS.escape(element.id);
    else if (element.getAttribute('name')) selector += '[name="' + CSS.escape(element.getAttribute('name')) + '"]';
    else if (element.getAttribute('aria-label')) selector += '[aria-label="' + CSS.escape(element.getAttribute('aria-label')) + '"]';
    const result = {
      id, tag, role, name: label.slice(0, 180), text: clean(element.innerText || element.getAttribute('placeholder') || '').slice(0, 180),
      type: element.getAttribute('type') || '', disabled: !!element.disabled || element.getAttribute('aria-disabled') === 'true',
      required: !!element.required || element.getAttribute('aria-required') === 'true', selector,
      snippet: element.outerHTML.replace(/ data-openpath-id="[^"]*"/g, '').slice(0, 700),
    };
    if (element.href) result.href = element.href;
    if ('value' in element && element.type !== 'password') result.value = String(element.value).slice(0, 150);
    if (tag === 'select') result.options = Array.from(element.options).map(option => ({label: option.label, value: option.value}));
    return result;
  });
  const links = Array.from(document.querySelectorAll('a[href]')).filter(visible).slice(0, 120).map(a => ({text: clean(a.innerText || a.getAttribute('aria-label')), href:a.href})).filter(a => /^https?:/.test(a.href));
  return { title: document.title, text: (document.body?.innerText || '').slice(0, 26000), headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible).map(e => clean(e.innerText)).slice(0,30), controls, links };
})()`;

export interface Observation { title: string; text: string; headings: string[]; controls: Control[]; links: { text: string; href: string }[]; aria: string; }
export async function observePage(page: Page): Promise<Observation> {
  const data = await page.evaluate(OBSERVE_SCRIPT) as Omit<Observation, 'aria'>;
  const aria = await page.locator('body').ariaSnapshot({ timeout: 3000 }).catch(() => 'Semantic snapshot unavailable.');
  return { ...data, aria: aria.slice(0, 18000) };
}

export function redactError(value: string): string {
  return value.replace(/(authorization|api[_-]?key|token|password)[=: ]+[^\s&,;]+/gi, '$1=[redacted]').slice(0, 500);
}

export function watchErrors(page: Page) {
  const consoleErrors: string[] = [];
  const requestErrors: string[] = [];
  page.on('pageerror', error => { if (consoleErrors.length < 12) consoleErrors.push(redactError(error.message)); });
  page.on('response', response => {
    if (response.status() >= 400 && requestErrors.length < 12) {
      const u = new URL(response.url());
      requestErrors.push(`${response.status()} ${u.origin}${u.pathname}`);
    }
  });
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || '';
    if (failure.includes('BLOCKED_BY_CLIENT') || failure.includes('ABORTED')) return;
    if (requestErrors.length < 12) {
      try { const u = new URL(request.url()); requestErrors.push(`${u.origin}${u.pathname}: ${failure}`); } catch {}
    }
  });
  return { consoleErrors, requestErrors };
}
