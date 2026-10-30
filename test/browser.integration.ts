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
import { renderDemoPage } from '../demo-site/pages.js';

// Deliberately small backend verification fixture. This is not Rohinth's demo
// presentation and is never mounted by the production entry point.
function fixture(variant:string,page:string) {
  const fixed=variant==='fixed';
  return `<!doctype html><html lang="en"><head><title>Backend integration fixture</title><script type="application/ld+json">${fixed?'{"@type":"Product","name":"Everyday Tee"}':'{"@type":"Product",}'}</script></head><body><h1>Everyday Tee</h1><p>Backend integration fixture only. A blue tee in size M.</p><a href="/demo/${variant}/${page==='product'?'about':'product'}">${page==='product'?'About':'Product details'}</a><button ${fixed?'aria-label="Add blue medium tee to cart"':''} onclick="fetch('/demo/api/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku:'everyday-tee',color:'blue',size:'M',quantity:1})}).then(r=>r.json()).then(()=>document.querySelector('#result').textContent='Item added')">${fixed?'Add to cart':''}</button><p id="result" role="status"></p><label ${fixed?'for="email"':''}>Work email</label><input id="email" type="email" placeholder="you@example.com"></body></html>`;
}
let server:http.Server;let origin:string;let temp:string;
let useStorefront=false;
before(async()=>{
  temp=await mkdtemp(path.join(tmpdir(),'openpath-browser-tests-'));process.env.OPENPATH_DATA_DIR=temp;
  const app=createApp({demoRenderer:(variant,page)=>useStorefront?renderDemoPage(variant,page):fixture(variant,page)});app.use(errorHandler);
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

test('semantic observations exclude decorative duplicate overlays and hidden ancestors',async()=>{
  const context=await makeContext(`${origin}/demo/fixed/product`);
  try {
    const page=await context.newPage();
    await page.goto(`${origin}/demo/fixed/product`);
    await page.setContent('<h1>Product</h1><a href="/details">Read product details</a><a href="/details" aria-hidden="true" tabindex="-1" style="display:block;width:100px;height:100px"></a><div aria-hidden="true"><button>Decorative duplicate</button></div><button><span aria-hidden="true">★</span></button>');
    const observation=await observePage(page);
    assert.equal(observation.controls.filter(control=>control.role==='link').length,1);
    assert.equal(observation.links.length,1);
    assert(!observation.controls.some(control=>control.name==='Decorative duplicate'));
    assert(observation.controls.some(control=>control.role==='button'&&!control.name),'A real unnamed control remains a finding even when its icon is decorative.');
  } finally { await context.close(); }
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

test('the default browser runner calls the SDK with its queued model and persists inference metadata',async()=>{
  const saved={NEBIUS_API_KEY:process.env.NEBIUS_API_KEY,NEBIUS_BASE_URL:process.env.NEBIUS_BASE_URL,NEBIUS_MODEL:process.env.NEBIUS_MODEL};
  const models:string[]=[];
  const provider=http.createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const body=JSON.parse(Buffer.concat(chunks).toString());models.push(body.model);
    const observation=JSON.parse(body.messages[1].content) as {controls:{id:string;name:string}[]};
    const button=observation.controls.find(control=>control.name==='Add blue medium tee to cart');
    assert(button,'The model must receive the current semantic controls.');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({id:'local-browser-test',model:body.model,choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'local-action',type:'function',function:{name:'browser_action',arguments:JSON.stringify({action:'click',elementId:button.id})}}]}}]}));
  });
  await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
  const address=provider.address();assert(address&&typeof address!=='string');
  try{
    process.env.NEBIUS_API_KEY='local-browser-test-key';
    process.env.NEBIUS_BASE_URL=`http://127.0.0.1:${address.port}/v1/`;
    process.env.NEBIUS_MODEL='nvidia/model-changed-after-queueing';
    const attempt=run();attempt.model='nvidia/model-selected-at-queueing';
    await executeRun(attempt);
    assert.equal(attempt.outcome,'completed',attempt.explanation);
    assert.deepEqual(models,['nvidia/model-selected-at-queueing']);
    assert.equal(attempt.inference?.[0].status,'succeeded');
    assert.equal(attempt.inference?.[0].provider,'custom');
    assert.equal(attempt.inference?.[0].responseId,'local-browser-test');
    assert.equal(attempt.inference?.[0].usage,undefined,'Missing usage must not be invented.');
  }finally{
    provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));
    for(const [name,value] of Object.entries(saved)){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});

test('the shipped storefront exposes an unnamed decorative button and the fixed variant names it',async()=>{
  useStorefront=true;
  try{
    const beforeAudit=audit('broken');await executeAudit(beforeAudit,{useAI:false});
    assert.equal(beforeAudit.status,'complete',beforeAudit.error||'Broken storefront audit should complete');
    assert(beforeAudit.findings.some(f=>f.title==='Name controls by what they do'));
    const afterAudit=audit('fixed');await executeAudit(afterAudit,{useAI:false});
    assert.equal(afterAudit.status,'complete',afterAudit.error||'Fixed storefront audit should complete');
    assert(!afterAudit.findings.some(f=>f.title==='Name controls by what they do'));
  }finally{useStorefront=false;}
});

test('the shipped offline demo completes the real cart flow and explicitly disclaims model inference',async()=>{
  useStorefront=true;
  try{
    const attempt=run();attempt.startUrl=`${origin}/demo/fixed/`;
    attempt.model='openpath-demo-simulator';attempt.promptVersion='openpath-demo-v1';
    await executeRun(attempt);
    assert.equal(attempt.outcome,'completed',JSON.stringify({explanation:attempt.explanation,steps:attempt.steps}));
    assert.match(attempt.explanation,/Scripted demo only; no NVIDIA model was called/);
    assert.equal(attempt.inference?.length||0,0,'Scripted runs must not fabricate inference records.');
    assert(attempt.checks.every(check=>check.passed));
  }finally{useStorefront=false;}
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
