import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import type { Duplex } from 'node:stream';
import ipaddr from 'ipaddr.js';
import { config, demoOrigin, isDemoUrl } from './config.js';

export class TargetError extends Error {}
export function isPublicIp(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export function parseTarget(input: string): URL {
  let url: URL;
  try { url = new URL(input.includes('://') ? input : `https://${input}`); }
  catch { throw new TargetError('Enter a valid http:// or https:// website URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new TargetError('Only HTTP and HTTPS websites are supported.');
  if (url.username || url.password) throw new TargetError('URLs containing login credentials are not accepted.');
  if (url.href.length > 2048) throw new TargetError('The URL is too long.');
  url.hash = '';
  return url;
}

export async function resolvePublicTarget(url: URL, allowDemo = false): Promise<{ address: string; family: number }> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (allowDemo && url.origin === demoOrigin() && url.pathname.startsWith('/demo/')) return { address: '127.0.0.1', family: 4 };
  if (url.port && !['80', '443'].includes(url.port)) throw new TargetError('Public targets must use port 80 or 443.');
  if (host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(host)) throw new TargetError('Private and local network targets are blocked.');
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new TargetError('Private and reserved network addresses are blocked.');
    return { address: host, family: net.isIP(host) };
  }
  const results = await lookup(host, { all: true, verbatim: true });
  if (!results.length || results.some(r => !isPublicIp(r.address))) throw new TargetError('This hostname resolves to a private or reserved network address.');
  return results.find(r => r.family === 4) || results[0];
}

export async function validateTarget(input: string): Promise<URL> {
  const url = parseTarget(input);
  if (isDemoUrl(url.href)) return url;
  const allowed = config().allowedHosts;
  if (allowed.length && !allowed.includes(url.hostname.toLowerCase())) throw new TargetError('This hostname is not in this installation’s allowed target list.');
  await resolvePublicTarget(url);
  return url;
}

export async function safeFetchText(input: string, hops = 0): Promise<{ url: string; status: number; text: string; contentType: string }> {
  if (hops > 5) throw new TargetError('Too many redirects.');
  const url = parseTarget(input);
  const resolved = await resolvePublicTarget(url, true);
  const result = await new Promise<{ status: number; text: string; location?: string; contentType: string }>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request({
      protocol: url.protocol, hostname: resolved.address, family: resolved.family,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      servername: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { Host: url.host, 'User-Agent': 'OpenPath/0.1 (agent-compatibility-audit)', Accept: 'text/html,application/json,text/plain;q=0.9', 'Accept-Encoding': 'identity' },
      timeout: 12000,
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 1_500_000) { req.destroy(new Error('Page exceeded the 1.5 MB inspection limit.')); return; }
        chunks.push(Buffer.from(chunk));
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8'), location: res.headers.location, contentType: String(res.headers['content-type'] || '') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Page request timed out.')));
    req.on('error', reject); req.end();
  });
  if ([301,302,303,307,308].includes(result.status) && result.location) {
    return safeFetchText(new URL(result.location, url).href, hops + 1);
  }
  return { url: url.href, status: result.status, text: result.text, contentType: result.contentType };
}

// Chromium uses this proxy so each connection targets a validated IP, not a
// hostname resolved again after validation. This prevents DNS-rebinding SSRF.
let proxyServer: http.Server | undefined;
let proxyUrl: string | undefined;
const sockets = new Set<Duplex>();
export async function startEgressProxy(): Promise<string> {
  if (proxyUrl) return proxyUrl;
  proxyServer = http.createServer(async (req, res) => {
    try {
      const target = parseTarget(req.url || '');
      const resolved = await resolvePublicTarget(target, true);
      const transport = target.protocol === 'https:' ? https : http;
      const { 'proxy-authorization': _auth, 'proxy-connection': _connection, ...headers } = req.headers;
      const upstream = transport.request({
        hostname: resolved.address, family: resolved.family, servername: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: req.method, path: target.pathname + target.search,
        headers: { ...headers, host: target.host }, timeout: 20000,
      }, upstreamRes => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Upstream connection failed.'); });
      upstream.on('timeout', () => upstream.destroy());
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    } catch { res.writeHead(403); res.end('Target blocked by the network policy.'); }
  });
  proxyServer.on('connect', (req, client, head) => {
    void (async () => {
      const target = parseTarget(`https://${req.url || ''}/`);
      const resolved = await resolvePublicTarget(target);
      if (target.port && target.port !== '443') throw new TargetError('Only HTTPS tunnels on port 443 are allowed.');
      const upstream = net.connect({ host: resolved.address, family: resolved.family, port: 443 });
      sockets.add(upstream);
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.on('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream); upstream.pipe(client);
      });
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => { sockets.delete(upstream); client.destroy(); });
    })().catch(() => { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
  });
  proxyServer.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>(resolve => proxyServer!.listen(0, '127.0.0.1', resolve));
  const address = proxyServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the browser network proxy.');
  proxyUrl = `http://127.0.0.1:${address.port}`;
  return proxyUrl;
}

export async function stopEgressProxy() {
  for (const socket of sockets) socket.destroy();
  if (proxyServer) await new Promise<void>(resolve => proxyServer!.close(() => resolve()));
  proxyServer = undefined; proxyUrl = undefined;
}
