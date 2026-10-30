import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp,errorHandler } from '../server/app.js';

let server:http.Server;let origin:string;let temp:string;
const token='test-only-openpath-access-token';
before(async()=>{
  temp=await mkdtemp(path.join(tmpdir(),'openpath-api-tests-'));process.env.OPENPATH_DATA_DIR=temp;process.env.APP_ACCESS_TOKEN=token;
  const app=createApp();app.use(errorHandler);server=http.createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;
});
after(async()=>{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  const root=path.resolve(tmpdir());const target=path.resolve(temp);
  if(path.dirname(target)!==root||!path.basename(target).startsWith('openpath-api-tests-'))throw new Error('Unsafe test cleanup path.');
  await rm(target,{recursive:true,force:true});
});
const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};

test('health distinguishes authentication from model connectivity',async()=>{
  const response=await fetch(origin+'/api/health');assert.equal(response.status,200);
  const health=await response.json();assert.equal(health.needsAuth,true);assert.equal(typeof health.demoAvailable,'boolean');
  assert(['unconfigured','configured','verified','error'].includes(health.ai));
});
test('unauthenticated report access is rejected',async()=>{assert.equal((await fetch(origin+'/api/audits')).status,401);});
test('protected installations present a server-owned login page before the report UI',async()=>{
  const response=await fetch(origin+'/',{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/login');
  const page=await fetch(origin+'/login');assert.equal(page.status,200);assert.match(await page.text(),/Installation access token/);
  assert.equal(page.headers.get('cache-control'),'no-store');
});
test('valid installation login issues an HTTP-only session',async()=>{
  const response=await fetch(origin+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/);
  const reports=await fetch(origin+'/api/audits',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(reports.status,200);assert.deepEqual(await reports.json(),{audits:[]});
});
test('private URL inspection is blocked before queueing',async()=>{
  const response=await fetch(origin+'/api/audits',{method:'POST',headers,body:JSON.stringify({url:'http://169.254.169.254/latest/meta-data/'})});
  assert.equal(response.status,400);assert.match((await response.json()).error,/blocked/);
});
test('invalid request bodies produce validation errors',async()=>{
  const response=await fetch(origin+'/api/audits',{method:'POST',headers,body:JSON.stringify({url:'',untrustedOption:true})});assert.equal(response.status,400);
  const malformed=await fetch(origin+'/api/audits',{method:'POST',headers,body:'{bad json'});assert.equal(malformed.status,400);
});
test('cross-origin mutations are rejected',async()=>{
  const response=await fetch(origin+'/api/audits',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:JSON.stringify({url:'https://example.com'})});assert.equal(response.status,403);
});
test('unknown runs and artifacts return readable errors',async()=>{
  assert.equal((await fetch(origin+'/api/runs/00000000-0000-4000-8000-000000000000',{headers})).status,404);
  assert.equal((await fetch(origin+'/api/artifacts/00000000-0000-4000-8000-000000000000/secret.txt',{headers})).status,400);
});

test('forwarded HTTPS headers cannot create a secure session unless a proxy is explicitly trusted',async()=>{
  const response=await fetch(origin+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-Proto':'https'},body:JSON.stringify({token})});
  assert.equal(response.status,200);assert(!/; Secure(?:;|$)/.test(response.headers.get('set-cookie')!));
});

test('an explicitly trusted local HTTPS proxy produces a secure session cookie',async()=>{
  const previous=process.env.TRUST_PROXY;process.env.TRUST_PROXY='loopback';
  const proxyApp=createApp();proxyApp.use(errorHandler);const proxyServer=http.createServer(proxyApp);
  await new Promise<void>(resolve=>proxyServer.listen(0,'127.0.0.1',resolve));
  const address=proxyServer.address();assert(address&&typeof address!=='string');
  try{
    const response=await fetch(`http://127.0.0.1:${address.port}/api/auth`,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-Proto':'https'},body:JSON.stringify({token})});
    assert.equal(response.status,200);assert.match(response.headers.get('set-cookie')!,/; Secure(?:;|$)/);
  }finally{proxyServer.closeAllConnections();await new Promise<void>(resolve=>proxyServer.close(()=>resolve()));if(previous===undefined)delete process.env.TRUST_PROXY;else process.env.TRUST_PROXY=previous;}
});
