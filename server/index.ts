import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp, errorHandler } from './app.js';
import { config, ROOT } from './config.js';
import { recoverInterruptedJobs } from './store.js';
import { startEgressProxy, stopEgressProxy } from './network.js';
import { closeBrowser } from './browser.js';

const settings=config();
if(!['127.0.0.1','localhost','::1'].includes(settings.host)&&settings.accessToken.length<16){
  throw new Error('Set APP_ACCESS_TOKEN to at least 16 characters before binding to a public interface.');
}
await recoverInterruptedJobs();
await startEgressProxy();
const app=createApp();
const server=http.createServer(app);
if(process.env.NODE_ENV!=='production'&&existsSync(path.join(ROOT,'src','main.tsx'))){
  const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true,hmr:{server}},appType:'spa'});
  app.use(vite.middlewares);
}else if(existsSync(path.join(ROOT,'dist','client','index.html'))){
  app.use(express.static(path.join(ROOT,'dist','client')));
  app.get('/{*path}',(req,res)=>{
    if(req.path.startsWith('/api/')||req.path.startsWith('/demo/')){res.status(404).json({error:'Route not found.'});return;}
    res.sendFile(path.join(ROOT,'dist','client','index.html'));
  });
}else{
  app.get('/',(_req,res)=>res.json({name:'OpenPath',status:'Backend ready; frontend integration pending.',health:'/api/health',contract:'docs/API_CONTRACT.md'}));
}
app.use(errorHandler);
server.listen(settings.port,settings.host,()=>console.log(`OpenPath listening on http://${settings.host}:${settings.port}`));

let stopping=false;
async function shutdown(){
  if(stopping)return;stopping=true;
  server.close();await closeBrowser().catch(()=>{});await stopEgressProxy().catch(()=>{});process.exit(0);
}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
