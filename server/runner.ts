import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import type { Assertion, AssertionResult, TaskRun } from '../shared/types.js';
import { artifactDir, saveRun } from './store.js';
import { makeContext, observePage, redactError } from './browser.js';
import { chooseAction, readableModelError, type AgentAction } from './model.js';
import { config, demoOrigin, isDemoUrl } from './config.js';
import { readDemoCart } from './demo-api.js';

export async function evaluateAssertions(page: Page, context: BrowserContext, assertions: Assertion[], options:{cartState?:typeof readDemoCart}={}): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];
  for (const assertion of assertions) {
    if (assertion.kind === 'url_contains') {
      results.push({ description:`URL contains “${assertion.value}”`,passed:page.url().includes(assertion.value),actual:page.url() });
    } else if (assertion.kind === 'visible_text') {
      const text = await page.locator('body').innerText({timeout:2000}).catch(() => '');
      results.push({description:`Visible page contains “${assertion.value}”`,passed:text.includes(assertion.value),actual:text.includes(assertion.value) ? 'Expected text is visible.' : 'Expected text was not found in visible page content.'});
    } else {
      if (!isDemoUrl(page.url())) { results.push({description:'Sandbox cart matches the requested item',passed:false,actual:'The browser is outside the controlled demo.'}); continue; }
      try {
        // Read server-owned state using the isolated browser session. This is
        // independent of page text, agent claims and the browser egress proxy.
        const cookies=await context.cookies(`${demoOrigin()}/demo/api/cart`);
        const session=cookies.find(cookie=>cookie.name==='op_demo')?.value;
        const items=(options.cartState||readDemoCart)(session);
        const item = items.find(i => i.sku === assertion.sku && i.color === assertion.color && i.size === assertion.size && i.quantity === assertion.quantity);
        results.push({description:`Cart contains ${assertion.quantity} × ${assertion.sku}, ${assertion.color}, size ${assertion.size}`,passed:!!item,actual:JSON.stringify(items)});
      } catch { results.push({description:'Sandbox cart matches the requested item',passed:false,actual:'The independent cart state could not be read.'}); }
    }
  }
  return results;
}

export function validateAction(action: AgentAction, controls: {id:string;disabled:boolean}[]) {
  if (['click','fill','select'].includes(action.action)) {
    const control = controls.find(c => c.id === action.elementId);
    if (!control) throw new Error('The selected element is absent from the current observation. Refresh and choose a current element ID.');
    if (control.disabled) throw new Error('The selected control is disabled.');
  }
  if (['fill','select'].includes(action.action) && action.value === undefined) throw new Error('This action requires a value.');
}

// A transparent, deterministic fallback keeps the controlled storefront demo
// runnable before a team configures a Nebius key. It is never used for public
// sites and the UI labels the resulting run as openpath-demo-simulator.
function demoDecide(_goal: string, url: string, observation: { controls: { id: string; tag: string; href?: string; name: string; type: string; disabled?: boolean; options?: { value: string }[] }[] }): AgentAction {
  const product = observation.controls.find(c => c.tag === 'a' && c.href?.includes('/product'));
  if (!/\/product(?:\/|$)/.test(new URL(url).pathname) && product) return { action: 'click', elementId: product.id };
  const color = observation.controls.find(c => c.tag === 'select' && c.name.toLowerCase().includes('colour'));
  if (color && !/blue/i.test(String(color.options?.[0]?.value))) return { action: 'select', elementId: color.id, value: 'blue' };
  const size = observation.controls.find(c => c.tag === 'select' && c.name.toLowerCase().includes('size'));
  if (size) return { action: 'select', elementId: size.id, value: 'M' };
  const buttons = observation.controls.filter(c => c.tag === 'button' && !c.disabled);
  const add = buttons.find(c => /add|cart/i.test(c.name)) || buttons.at(-1);
  if (add) return { action: 'click', elementId: add.id };
  return { action: 'finish' };
}

export async function executeRun(run: TaskRun, options: { decide?: typeof chooseAction } = {}) {
  const decide = options.decide || (!config().key && config().demoMode && isDemoUrl(run.startUrl) ? demoDecide : chooseAction);
  let context: BrowserContext | undefined;
  const started = Date.now();
  const deadline = started + run.maxDurationMs;
  const dir = artifactDir(run.id);
  try {
    run.status = 'running'; await saveRun(run); await mkdir(dir,{recursive:true});
    const sandbox = isDemoUrl(run.startUrl);
    context = await makeContext(run.startUrl,sandbox);
    await context.tracing.start({screenshots:true,snapshots:true});
    const page = await context.newPage();
    await page.goto(run.startUrl,{waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle',{timeout:2000}).catch(() => {});
    await page.screenshot({path:path.join(dir,'step-0.png'),timeout:3000});
    run.steps.push({index:0,time:new Date().toISOString(),url:page.url(),action:'Open website',result:'Fresh browser context created.',screenshot:`/api/artifacts/${run.id}/step-0.png`,durationMs:Date.now()-started});
    await saveRun(run);
    let repeated = 0; let previousState = ''; let malformed = 0;
    for (let index = 1; index <= run.maxSteps && Date.now() < deadline; index++) {
      run.checks = await evaluateAssertions(page,context,run.assertions);
      if (run.checks.length && run.checks.every(c => c.passed)) {
        run.outcome='completed'; run.explanation='The independent completion checks passed.'; break;
      }
      const observation = await observePage(page);
      if (/verify (that )?you are (a )?human|checking your browser|complete the captcha/i.test(observation.text) && observation.text.length < 4000) {
        run.outcome='blocked';run.explanation='An access challenge was detected. The runner stopped without attempting to bypass it.';break;
      }
      const stepStarted = Date.now();
      let action: AgentAction;
      try {
        action = await decide(run.goal,page.url(),observation,run.steps.map(s => ({action:s.action,result:s.result})),deadline-Date.now());
        validateAction(action,observation.controls);
      } catch (error) {
        const invalid = error instanceof Error && /selected element|requires a value|disabled/.test(error.message);
        if (invalid && malformed++ === 0) {
          run.steps.push({index,time:new Date().toISOString(),url:page.url(),action:'Rejected invalid action',result:redactError((error as Error).message),durationMs:Date.now()-stepStarted});
          await saveRun(run); continue;
        }
        run.outcome='inconclusive';run.cause=invalid?'agent':'infrastructure';
        run.explanation=invalid ? 'The agent repeatedly selected invalid actions. This does not prove a website defect.' : readableModelError(error);
        break;
      }
      if (action.action === 'finish') {
        run.outcome='failed';run.cause='unknown';
        run.explanation='The agent stopped before the independent completion checks passed. Inspect the trace to distinguish site barriers from agent limitations.';break;
      }
      const control = observation.controls.find(c => c.id === action.elementId);
      const repeatedState = JSON.stringify([page.url(),action.action,control?.name,action.value,observation.text.slice(0,5000)]);
      repeated = repeatedState === previousState ? repeated+1 : 0; previousState = repeatedState;
      if (repeated >= 2) { run.outcome='failed';run.cause='agent';run.explanation='The agent repeated an action without observable progress. The runner stopped the loop.';break; }
      if (!sandbox && ['fill','select'].includes(action.action)) { run.outcome='blocked';run.explanation='Data entry is limited to the controlled demo. This public-site trial only supports browsing.';break; }
      if (!sandbox && control?.href && /logout|signout|delete|remove|unsubscribe|checkout|payment/i.test(new URL(control.href).pathname)) { run.outcome='blocked';run.explanation='The requested action falls outside this trial’s browsing-only scope.';break; }
      const locator = action.elementId ? page.locator(`[data-openpath-id="${action.elementId}"]`) : undefined;
      if (!sandbox && action.action === 'click' && locator && control?.tag !== 'a') {
        const inForm = await locator.evaluate(el => !!el.closest('form')).catch(() => true);
        if (inForm) { run.outcome='blocked';run.explanation='Form actions on public websites are outside the browsing-only trial scope.';break; }
      }
      let result='Action executed.'; let errorMessage: string | undefined;
      try {
        if (action.action === 'click') await locator!.click({timeout:5000});
        else if (action.action === 'fill') await locator!.fill(action.value!,{timeout:5000});
        else if (action.action === 'select') await locator!.selectOption(action.value!,{timeout:5000});
        else if (action.action === 'scroll') await page.mouse.wheel(0,action.direction === 'up' ? -600 : 600);
        else if (action.action === 'back') await page.goBack({waitUntil:'domcontentloaded',timeout:8000});
        await page.waitForLoadState('networkidle',{timeout:1000}).catch(() => {});
      } catch (error) {
        errorMessage=redactError(error instanceof Error ? error.message : 'Browser action failed.');result=errorMessage;
      }
      const filename=`step-${index}.png`;
      const screenshot = await page.screenshot({path:path.join(dir,filename),timeout:3000}).then(() => `/api/artifacts/${run.id}/${filename}`).catch(() => undefined);
      run.steps.push({index,time:new Date().toISOString(),url:page.url(),action:action.action,target:control?.name || control?.selector,result,screenshot,error:errorMessage,durationMs:Date.now()-stepStarted});
      run.checks = await evaluateAssertions(page,context,run.assertions);
      const settleDeadline=Math.min(deadline,Date.now()+1200);
      while(run.checks.some(check=>!check.passed)&&Date.now()<settleDeadline){
        await new Promise(resolve=>setTimeout(resolve,100));
        run.checks=await evaluateAssertions(page,context,run.assertions);
      }
      await saveRun(run);
      if (run.checks.length && run.checks.every(c => c.passed)) {run.outcome='completed';run.explanation='The independent completion checks passed after this action.';break;}
    }
    if (!run.outcome) {run.outcome='failed';run.cause='unknown';run.explanation='The task did not complete within the action or time budget. This is an outcome for this runner, not a universal website verdict.';}
    run.checks = await evaluateAssertions(page,context,run.assertions);
    await context.tracing.stop({path:path.join(dir,'trace.zip')});
    run.trace=`/api/artifacts/${run.id}/trace.zip`;
  } catch (error) {
    run.outcome='inconclusive';run.cause='infrastructure';
    run.explanation=error instanceof Error ? error.message.split('\n')[0].slice(0,350) : 'The browser run could not complete.';
  } finally {
    await context?.close().catch(() => {});
    run.status='complete';run.completedAt=new Date().toISOString();run.durationMs=Date.now()-started;await saveRun(run);
  }
}
