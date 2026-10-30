import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const require=createRequire(import.meta.url);
let local={};try{local=parse(readFileSync('.env'));}catch{}
const browserPath=process.env.PLAYWRIGHT_BROWSERS_PATH||local.PLAYWRIGHT_BROWSERS_PATH||path.join(process.cwd(),'.cache','ms-playwright');
const cli=path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js');
const result=spawnSync(process.execPath,[cli,'install','chromium','--no-shell',...process.argv.slice(2)],{
  stdio:'inherit',windowsHide:true,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:browserPath},
});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
