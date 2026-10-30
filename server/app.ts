import './runtime.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { z } from 'zod';
import { config, demoOrigin, isDemoUrl, ROOT } from './config.js';
import { parseTarget, validateTarget, TargetError } from './network.js';
import { artifactDir, getAudit, getRun, jobs, listAudits, listRuns, newId, saveAudit, saveRun } from './store.js';
import { connectionStatus, readableModelError, verifyConnection } from './model.js';
import { executeAudit } from './audit.js';
import { executeRun } from './runner.js';
import { exportFixKit } from './report.js';
import { mountDemoApi } from './demo-api.js';
import { compareAudits, compareRuns, runSettingsMismatches } from './comparison.js';
import { accessPage } from './access.js';
import type { Assertion, Audit, Health, TaskRun } from '../shared/types.js';

const compareSecret=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const sessionValue=()=>createHmac('sha256',config().accessToken).update('openpath-browser-session-v1').digest('hex');
function authorised(req:Request) {
  const token=config().accessToken;if(!token)return true;
  const bearer=req.headers.authorization?.replace(/^Bearer /,'') || '';
  const cookie=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('op_session='))?.slice(11) || '';
  return (!!bearer&&compareSecret(bearer,token)) || (!!cookie&&compareSecret(cookie,sessionValue()));
}
const demoPath=()=>path.join(ROOT,process.env.NODE_ENV==='production'?'dist/demo-site/pages.js':'demo-site/pages.ts');
const auditSchema=z.object({url:z.string().trim().min(3).max(2048),compareWith:z.string().uuid().optional()}).strict();
const publicAssertion=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('url_contains'),value:z.string().min(1).max(200)}).strict(),
  z.object({kind:z.literal('visible_text'),value:z.string().min(1).max(300)}).strict(),
]);
const runSchema=z.object({auditId:z.string().uuid(),goal:z.string().trim().min(5).max(1000).optional(),assertions:z.array(publicAssertion).min(1).max(3).optional(),compareWith:z.string().uuid().optional()}).strict();

export interface AppOptions {
  // Explicit dependency injection for backend integration fixtures. Production
  // uses Rohinth's demo-site module; remote requests cannot set this option.
  demoRenderer?: (variant:string,page:string)=>string;
}
export function createApp(options:AppOptions={}) {
  const app=express();app.disable('x-powered-by');
  if(config().trustProxy)app.set('trust proxy',config().trustProxy.split(',').map(value=>value.trim()).filter(Boolean));
  app.use(express.json({limit:'32kb'}));
  app.use((req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
    if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin) {
      try{if(new URL(req.headers.origin).host!==req.headers.host){res.status(403).json({error:'Cross-origin changes are not allowed.'});return;}}
      catch{res.status(403).json({error:'Invalid request origin.'});return;}
    }
    next();
  });
  app.get('/login',(req,res)=>{if(authorised(req)){res.redirect('/');return;}res.setHeader('Cache-Control','no-store');res.type('html').send(accessPage);});
  app.get('/',(req,res,next)=>{if(!authorised(req)){res.redirect('/login');return;}next();});
  const rates=new Map<string,{start:number;count:number}>();
  app.use('/api',(req,res,next)=>{
    if(req.method!=='POST'){next();return;}
    const now=Date.now();const key=req.ip||'local';
    for(const [id,value] of rates)if(now-value.start>60000)rates.delete(id);
    const rate=rates.get(key)||{start:now,count:0};rate.count++;rates.set(key,rate);
    if(rate.count>20){res.status(429).json({error:'Too many requests. Please wait a minute.'});return;}next();
  });
  app.get('/api/health',(req,res)=>{
    const c=config();const health:Health={version:'0.1.0',model:c.model,...connectionStatus(),aiEnabled:c.aiEnabled,trialMode:c.key?'live':c.demoMode?'scripted-demo':'unavailable',browserInstalled:existsSync(chromium.executablePath()),demoUrl:`${demoOrigin()}/demo/broken/`,fixedDemoUrl:`${demoOrigin()}/demo/fixed/`,demoAvailable:!!options.demoRenderer||existsSync(demoPath()),activeJobs:jobs.active,queuedJobs:jobs.pending,needsAuth:!authorised(req)};
    res.json(health);
  });
  app.post('/api/auth',(req,res)=>{
    const body=z.object({token:z.string().max(500)}).safeParse(req.body);
    if(!body.success||!config().accessToken||!compareSecret(body.data.token,config().accessToken)){res.status(401).json({error:'Invalid installation access token.'});return;}
    res.cookie('op_session',sessionValue(),{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:8*3600000,path:'/'});res.json({ok:true});
  });
  app.use('/api',(req,res,next)=>{if(!authorised(req)){res.status(401).json({error:'This installation requires its access token.'});return;}next();});
  app.post('/api/connection/test',async(_req,res)=>{
    if(!config().key){res.status(409).json({error:'Add NEBIUS_API_KEY to the server environment or .env file first.'});return;}
    try{res.json(await verifyConnection());}catch(error){res.status(502).json({error:readableModelError(error)});}
  });
  app.get('/api/audits',async(_req,res)=>res.json({audits:await listAudits()}));
  app.post('/api/audits',async(req,res)=>{
    const body=auditSchema.parse(req.body);
    if(jobs.pending>=12){res.status(429).json({error:'The audit queue is full. Retry shortly.'});return;}
    // Accept this installation's visible demo URL behind localhost or an HTTPS
    // proxy, then use the exact server-local sandbox origin for the audit.
    let submitted=body.url;
    const entered=parseTarget(body.url);
    if(entered.origin===`${req.protocol}://${req.get('host')}`&&/^\/demo\/(broken|fixed)(\/|$)/.test(entered.pathname))submitted=demoOrigin()+entered.pathname+entered.search;
    const target=await validateTarget(submitted);
    if(body.compareWith&&!await getAudit(body.compareWith)){res.status(404).json({error:'The comparison audit was not found.'});return;}
    if(isDemoUrl(target.href)&&!options.demoRenderer&&!existsSync(demoPath())){res.status(409).json({error:'The demo-site pages are not integrated yet. Inspect a public website, or add demo-site/pages.ts.'});return;}
    const audit:Audit={id:newId(),url:target.href,domain:target.host,status:'queued',createdAt:new Date().toISOString(),progress:0,events:[{time:new Date().toISOString(),message:'Website inspection queued.'}],pages:[],evidence:[],findings:[],checks:[],summary:'',model:{mode:'pending',name:config().model,note:''},isDemo:isDemoUrl(target.href),compareWith:body.compareWith,limitations:[
      'At most four linked HTML pages are inspected. Findings apply to that scope only.',
      'The scanner compares initial HTML and rendered DOM. It does not certify every commercial agent.',
      'Public-page inspection blocks state-changing requests, downloads, service workers and WebSockets; some apps may need these capabilities.',
      'No login, CAPTCHA bypass or real transaction is attempted. Existing API links are discovered, not fully tested.',
      'Canvas interfaces, cross-origin frames and complex shadow DOM may not be represented by the observation profile.',
      'A static warning is not proof of task failure. Proposed changes need review and a task-level verification.',
    ]};
    await saveAudit(audit);jobs.add(()=>executeAudit(audit));res.status(202).json({id:audit.id});
  });
  app.get('/api/audits/:id',async(req,res)=>{const audit=await getAudit(String(req.params.id));if(!audit){res.status(404).json({error:'Audit not found.'});return;}res.json(audit);});
  app.get('/api/audits/:id/comparison',async(req,res)=>{
    const audit=await getAudit(String(req.params.id));const before=audit?.compareWith ? await getAudit(audit.compareWith) : null;
    if(!audit||!before){res.status(404).json({error:'The audit or its linked comparison was not found.'});return;}
    if(audit.status!=='complete'||before.status!=='complete'){res.status(409).json({error:'Complete both audits before comparing them.'});return;}
    res.json(compareAudits(before,audit));
  });
  app.get('/api/audits/:id/fix-kit',async(req,res)=>{
    const audit=await getAudit(String(req.params.id));if(!audit){res.status(404).json({error:'Audit not found.'});return;}
    if(!['complete','failed'].includes(audit.status)){res.status(409).json({error:'Wait for the audit to finish before exporting.'});return;}
    const before=audit.compareWith ? await getAudit(audit.compareWith) : null;
    const comparison=before?.status==='complete'&&audit.status==='complete' ? compareAudits(before,audit) : undefined;
    res.type('text/markdown; charset=utf-8').attachment(`openpath-${audit.id.slice(0,8)}-fix-kit.md`).send(exportFixKit(audit,await listRuns(audit.id),comparison));
  });
  app.get('/api/runs',async(req,res)=>res.json({runs:await listRuns(typeof req.query.auditId==='string'?req.query.auditId:undefined)}));
  app.get('/api/runs/:id',async(req,res)=>{const run=await getRun(String(req.params.id));if(!run){res.status(404).json({error:'Run not found.'});return;}res.json(run);});
  app.get('/api/runs/:id/comparison',async(req,res)=>{
    const run=await getRun(String(req.params.id));const before=run?.compareWith ? await getRun(run.compareWith) : null;
    if(!run||!before){res.status(404).json({error:'The attempt or its linked comparison was not found.'});return;}
    if(run.status!=='complete'||before.status!=='complete'){res.status(409).json({error:'Complete both attempts before comparing them.'});return;}
    res.json(compareRuns(before,run));
  });
  app.post('/api/runs',async(req,res)=>{
    const body=runSchema.parse(req.body);const audit=await getAudit(body.auditId);
    if(!audit){res.status(404).json({error:'Audit not found.'});return;}
    if(audit.status!=='complete'){res.status(409).json({error:'Complete the audit before starting a trial.'});return;}
    if(!config().key && !(config().demoMode && isDemoUrl(audit.url))){res.status(409).json({error:'Configure a Nebius key to run a live NVIDIA browser trial. Demo mode is only available for the controlled storefront.'});return;}
    const demo=isDemoUrl(audit.url);
    const scripted=!config().key && config().demoMode && demo;
    if(scripted && (body.goal || body.assertions)){res.status(400).json({error:'The scripted demo supports only the standard blue, size-M cart task. Configure Nebius for custom trials.'});return;}
    if(!demo&&(!body.goal||!body.assertions)){res.status(400).json({error:'Provide a browsing goal and an independent URL or visible-text success condition.'});return;}
    if(!!body.goal!==!!body.assertions){res.status(400).json({error:'Provide both a goal and its success conditions, or omit both for the standard demo task.'});return;}
    if(jobs.pending>=12){res.status(429).json({error:'The run queue is full. Retry shortly.'});return;}
    const goal=body.goal||'Add the Everyday Tee in blue, size M, to the cart. Stop once the cart contains one matching item.';
    const assertions:Assertion[]=body.assertions||[{kind:'fixture_cart',sku:'everyday-tee',color:'blue',size:'M',quantity:1}];
    const model=scripted ? 'openpath-demo-simulator' : config().model;
    const promptVersion=scripted ? 'openpath-demo-v1' : 'openpath-dom-v1';
    if(body.compareWith){
      const before=await getRun(body.compareWith);
      if(!before){res.status(404).json({error:'The comparison run was not found.'});return;}
      if(runSettingsMismatches(before,{goal,model,promptVersion,profile:'rendered-dom',maxSteps:12,maxDurationMs:120000,assertions}).length){res.status(400).json({error:'A paired comparison must use the same goal, model, runner settings and success conditions.'});return;}
    }
    const run:TaskRun={id:newId(),auditId:audit.id,startUrl:audit.url,goal,assertions,status:'queued',createdAt:new Date().toISOString(),steps:[],checks:[],explanation:scripted?'Scripted demo only; no NVIDIA model will be called.':'',model,profile:'rendered-dom',promptVersion,maxSteps:12,maxDurationMs:120000,compareWith:body.compareWith};
    await saveRun(run);jobs.add(()=>executeRun(run));res.status(202).json({id:run.id});
  });
  app.get('/api/artifacts/:id/:name',async(req,res)=>{
    const id=String(req.params.id);const name=String(req.params.name);
    if(!/^((page|step)-\d+\.png|page-\d+-observation\.json|trace\.zip)$/.test(name)){res.status(400).json({error:'Invalid artifact name.'});return;}
    if(!await getAudit(id)&&!await getRun(id)){res.status(404).json({error:'Artifact owner not found.'});return;}
    const filename=path.join(artifactDir(id),name);
    if(!existsSync(filename)){res.status(404).json({error:'Artifact not found.'});return;}
    if(name.endsWith('.zip'))res.attachment(name);
    res.sendFile(filename);
  });
  mountDemoApi(app);
  app.get(['/demo/:variant/','/demo/:variant/:page'],async(req,res)=>{
    const variant=String(req.params.variant);const page=String(req.params.page||'home');
    if(!['broken','fixed'].includes(variant)||!['home','product','about','developers'].includes(page)){res.status(404).send('Demo page not found.');return;}
    if(options.demoRenderer){res.type('html').send(options.demoRenderer(variant,page));return;}
    if(!existsSync(demoPath())){res.status(503).type('text/plain').send('Demo presentation is not integrated yet. See docs/API_CONTRACT.md.');return;}
    const demo=await import(pathToFileURL(demoPath()).href) as {renderDemoPage:(variant:string,page:string)=>string};
    res.type('html').send(demo.renderDemoPage(variant,page));
  });
  return app;
}

export function errorHandler(error:unknown,_req:Request,res:Response,_next:NextFunction) {
  if(res.headersSent)return;
  if(error instanceof z.ZodError){res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')||'request'}: ${i.message}`).join('; ').slice(0,600)});return;}
  if(error instanceof TargetError){res.status(400).json({error:error.message});return;}
  if((error as {type?:string})?.type==='entity.too.large'){res.status(413).json({error:'The request body is too large.'});return;}
  if((error as {type?:string})?.type==='entity.parse.failed'){res.status(400).json({error:'The request body is not valid JSON.'});return;}
  console.error('Request failed:',error instanceof Error?error.message:'Unknown error');
  res.status(500).json({error:'The request could not be completed. Check the server logs and try again.'});
}
