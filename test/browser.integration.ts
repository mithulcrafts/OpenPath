import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from 'playwright';
import { createApp,errorHandler } from '../server/app.js';
import { executeAudit } from '../server/audit.js';
import { executeRun } from '../server/runner.js';
import { makeContext,observePage,closeBrowser } from '../server/browser.js';
import { startEgressProxy,stopEgressProxy } from '../server/network.js';
import { newId,artifactDir } from '../server/store.js';
import { exportFixKit } from '../server/report.js';
import type { Audit,TaskRun } from '../shared/types.js';

// Deliberately small backend verification fixture. This is not Rohinth's demo
// presentation and is never mounted by the production entry point.
function fixture(variant:string,page:string) {
  const fixed=variant==='fixed';
  return `<!doctype html><html lang="en"><head><title>Backend integration fixture</title><script type="application/ld+json">${fixed?'{"@type":"Product","name":"Everyday Tee"}':'{"@type":"Product",}'}</script></head><body><h1>Everyday Tee</h1><p>Backend integration fixture only. A blue tee in size M.</p><a href="/demo/${variant}/${page==='product'?'about':'product'}">${page==='product'?'About':'Product details'}</a><button ${fixed?'aria-label="Add blue medium tee to cart"':''} onclick="fetch('/demo/api/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku:'everyday-tee',color:'blue',size:'M',quantity:1})}).then(r=>r.json()).then(()=>document.querySelector('#result').textContent='Item added')">${fixed?'Add to cart':''}</button><p id="result" role="status"></p><label ${fixed?'for="email"':''}>Work email</label><input id="email" type="email" placeholder="you@example.com"></body></html>`;
}
let server:http.Server;let origin:string;let temp:string;
before(async()=>{
  temp=await mkdtemp(path.join(tmpdir(),'openpath-browser-tests-'));process.env.OPENPATH_DATA_DIR=temp;
  const app=createApp({demoRenderer:fixture});app.use(errorHandler);
  server=http.createServer((req,res)=>{
    if(req.url?.startsWith('/demo/')&&req.headers['user-agent']==='OpenPath/0.1 (agent-compatibility-audit)'){
      res.setHeader('Content-Type','text/html');res.end('<html><body>Alternative HTTP-client representation.</body></html>');return;
    }
    app(req,res);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address&&typeof address!=='string');
  process.env.PORT=String(address.port);origin=`http://127.0.0.1:${address.port}`;
  await startEgressProxy();
});
after(async()=>{
  await closeBrowser();await stopEgressProxy();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  const root=path.resolve(tmpdir());const target=path.resolve(temp);
  if(path.dirname(target)!==root||!path.basename(target).startsWith('openpath-browser-tests-'))throw new Error('Unsafe test cleanup path.');
  await rm(target,{recursive:true,force:true});
});
const audit=(variant:string):Audit=>({id:newId(),url:`${origin}/demo/${variant}/product`,domain:new URL(origin).host,status:'queued',createdAt:new Date().toISOString(),progress:0,events:[],pages:[],evidence:[],findings:[],checks:[],summary:'',model:{mode:'pending',name:'not-used-in-test',note:''},limitations:['Backend integration test; no real model is invoked.'],isDemo:true});
const run=():TaskRun=>({id:newId(),auditId:newId(),startUrl:`${origin}/demo/fixed/product`,goal:'Add one blue medium Everyday Tee to the cart.',assertions:[{kind:'fixture_cart',sku:'everyday-tee',color:'blue',size:'M',quantity:1}],status:'queued',createdAt:new Date().toISOString(),steps:[],checks:[],explanation:'',model:'test-only-decision-stub',profile:'rendered-dom',promptVersion:'backend-test',maxSteps:4,maxDurationMs:30000});

test('real Chromium observes named controls and ephemeral action IDs',async()=>{
  const context=await makeContext(`${origin}/demo/fixed/product`);try{
    const page=await context.newPage();await page.goto(`${origin}/demo/fixed/product`);
    const observation=await observePage(page);
    const button=observation.controls.find(c=>c.name==='Add blue medium tee to cart');assert(button);
    assert.match(button.id,/^op-/);assert.match(observation.aria,/Add blue medium tee/);
    assert.equal(observation.controls.find(c=>c.type==='email')?.name,'Work email');
  }finally{await context.close();}
});

test('real URL inspection finds defects and detects the corrected variant',async()=>{
  const beforeAudit=audit('broken');await executeAudit(beforeAudit,{useAI:false});
  assert.equal(beforeAudit.status,'complete',beforeAudit.error || 'Audit should complete');assert(beforeAudit.pages.length>=2);
  assert(beforeAudit.findings.some(f=>f.title==='Name controls by what they do'));
  assert(beforeAudit.findings.some(f=>f.title==='Repair malformed published structured data'));
  assert(beforeAudit.pages[0].screenshot);assert((await stat(path.join(artifactDir(beforeAudit.id),'page-1.png'))).size>1000);
  assert.equal(beforeAudit.pages[0].rawHtmlCaptured,true);
  assert.equal(beforeAudit.checks.find(c=>c.id==='rendering-gap')?.status,'pass');
  const afterAudit=audit('fixed');await executeAudit(afterAudit,{useAI:false});
  assert.equal(afterAudit.status,'complete',afterAudit.error || 'Audit should complete');
  assert(!afterAudit.findings.some(f=>f.title==='Name controls by what they do'));
  assert(!afterAudit.findings.some(f=>f.title==='Repair malformed published structured data'));
  assert(afterAudit.findings.length<beforeAudit.findings.length);
  assert.match(exportFixKit(beforeAudit),/aria-label/);
});

test('a premature agent finish cannot pass an empty cart',async()=>{
  const attempt=run();await executeRun(attempt,{decide:async()=>({action:'finish'})});
  assert.equal(attempt.outcome,'failed',attempt.explanation);assert(attempt.checks.some(c=>!c.passed));
});

test('a real browser action passes only after the server cart state matches',async()=>{
  const attempt=run();await executeRun(attempt,{decide:async(_goal,_url,observation)=>{
    const control=observation.controls.find(c=>c.name==='Add blue medium tee to cart');assert(control);return {action:'click',elementId:control.id};
  }});
  assert.equal(attempt.outcome,'completed',JSON.stringify({explanation:attempt.explanation,checks:attempt.checks,steps:attempt.steps}));assert(attempt.checks.every(c=>c.passed));
  assert(attempt.trace);assert((await stat(path.join(artifactDir(attempt.id),'trace.zip'))).size>1000);
});

test('browser egress cannot reach another loopback service',async()=>{
  let hits=0;const privateService=http.createServer((_req,res)=>{hits++;res.end('private');});
  await new Promise<void>(resolve=>privateService.listen(0,'127.0.0.1',resolve));
  const addr=privateService.address();assert(addr&&typeof addr!=='string');
  let context:BrowserContext|undefined;
  try{
    context=await makeContext(`${origin}/demo/fixed/product`);
    const page=await context.newPage();await page.goto(`${origin}/demo/fixed/product`);
    await page.evaluate(async url=>{try{await fetch(url);}catch{}},`http://127.0.0.1:${addr.port}/private`);
    assert.equal(hits,0);
  }finally{await context?.close();privateService.closeAllConnections();await new Promise<void>(resolve=>privateService.close(()=>resolve()));}
});
