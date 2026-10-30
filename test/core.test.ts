import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page, BrowserContext } from 'playwright';
import { isPublicIp, parseTarget, resolvePublicTarget } from '../server/network.js';
import { inspectPages, parseHtml } from '../server/checks.js';
import { ActionSchema, readableModelError } from '../server/model.js';
import { evaluateAssertions, validateAction } from '../server/runner.js';
import { exportFixKit } from '../server/report.js';
import type { Audit, PageEvidence } from '../shared/types.js';

const page=(overrides:Partial<PageEvidence>={}):PageEvidence=>({id:'page-1',url:'https://example.com/',title:'Example product',status:200,rawTextLength:500,renderedTextLength:500,text:'An example product',headings:['Example product'],controls:[],links:[],structuredData:{valid:0,invalid:0,types:[]},consoleErrors:[],requestErrors:[],inspectedAt:new Date().toISOString(),...overrides});

test('network policy rejects private, metadata, reserved and mapped loopback addresses',async()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','fe80::1','fc00::1','::ffff:127.0.0.1'])assert.equal(isPublicIp(ip),false,ip);
  for(const ip of ['1.1.1.1','8.8.8.8','2001:4860:4860::8888'])assert.equal(isPublicIp(ip),true,ip);
  await assert.rejects(resolvePublicTarget(new URL('http://127.0.0.1/')),/blocked/);
  await assert.rejects(resolvePublicTarget(new URL('http://metadata.internal/')),/blocked/);
  assert.throws(()=>parseTarget('https://user:password@example.com/'),/credentials/);
  assert.throws(()=>parseTarget('file:///etc/passwd'),/HTTP/);
});

test('missing optional integration standards do not fail compatibility checks',()=>{
  const report=inspectPages([page()]);
  const integration=report.checks.find(c=>c.id==='integration-discovery')!;
  assert.equal(integration.status,'not_tested');
  const finding=report.findings.find(f=>f.category==='integrations')!;
  assert.equal(finding.kind,'recommendation');assert.equal(finding.severity,'info');
  assert.match(finding.observation,/within this scan/);
  assert.equal(report.checks.find(c=>c.id==='structured-data')!.status,'not_tested');
});

test('rendering gap affects HTML readers, not every browser agent',()=>{
  const report=inspectPages([page({rawTextLength:20,renderedTextLength:1500})]);
  const finding=report.findings.find(f=>f.category==='readability')!;
  assert.deepEqual(finding.profiles,['html']);
  assert.match(finding.impact,/JavaScript-capable browser agent/);
});

test('published invalid JSON is distinguished from absent structured data',()=>{
  const invalid=parseHtml('<html><body><h1>Product</h1><script type="application/ld+json">{"name":"Test",}</script></body></html>');
  assert.equal(invalid.structuredData.invalid,1);assert.equal(invalid.rawText,'Product');
  const valid=parseHtml('<html><body><script type="application/ld+json">{"@type":"Product","name":"Test"}</script></body></html>');
  assert.deepEqual(valid.structuredData.types,['Product']);assert.equal(valid.structuredData.valid,1);
});

test('tool validation rejects arbitrary execution, stale IDs and missing values',()=>{
  assert.equal(ActionSchema.safeParse({action:'evaluate',code:'fetch("secret")'}).success,false);
  assert.throws(()=>validateAction({action:'click',elementId:'old'},[{id:'new',disabled:false}]),/absent/);
  assert.throws(()=>validateAction({action:'fill',elementId:'new'},[{id:'new',disabled:false}]),/value/);
  assert.throws(()=>validateAction({action:'click',elementId:'new'},[{id:'new',disabled:true}]),/disabled/);
});

test('independent cart checks reject a success claim with wrong state',async()=>{
  process.env.PORT='4173';
  const fakePage={url:()=> 'http://127.0.0.1:4173/demo/fixed/product'} as Page;
  const fakeContext={request:{get:async()=>({json:async()=>({items:[{sku:'everyday-tee',color:'black',size:'M',quantity:1}]})})}} as unknown as BrowserContext;
  const result=await evaluateAssertions(fakePage,fakeContext,[{kind:'fixture_cart',sku:'everyday-tee',color:'blue',size:'M',quantity:1}]);
  assert.equal(result[0].passed,false);assert.match(result[0].actual,/black/);
});

test('model errors do not echo secret-bearing provider messages',()=>{
  assert.equal(readableModelError({status:401,message:'Authorization: secret'}).includes('secret'),false);
  assert.match(readableModelError({status:429}),/limits/);
});

test('fix export preserves evidence, limitations and untrusted-source boundaries',()=>{
  const parts=inspectPages([page()]);
  const audit={...parts,id:'test',url:'https://example.com/',createdAt:'2026-10-30',pages:[page()],summary:'Inspected one page.',model:{mode:'rules',name:'none',note:''},limitations:['One page only.']} as Audit;
  const report=exportFixKit(audit);
  assert.match(report,/Deterministic rules; no AI analysis claimed/);
  assert.match(report,/untrusted evidence/);
  assert.match(report,/One page only/);
  assert.match(report,/No repository filename or line number was inferred/);
});
