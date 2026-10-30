# Backend runbook

## Start locally

1. Use Node 24 and run `npm ci`.
2. Copy `.env.example` to `.env` without replacing an existing configured file.
3. Run `npm run browser:install`. Chromium is stored in the project-local `.cache/ms-playwright` directory unless `PLAYWRIGHT_BROWSERS_PATH` overrides it.
4. Run `npm run dev` and read `http://127.0.0.1:4173/api/health`.

The root URL serves the integrated React interface. Development uses Vite middleware; production serves the compiled `dist/client` output after `npm run build`.

## Configure NVIDIA inference

Set `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and the exact `NEBIUS_MODEL` identifier in `.env`. The key is server-only. It is never returned by health endpoints or placed in browser code.

Call `POST /api/connection/test`. A successful tool-call response changes health from `configured` to `verified`. Model availability and schema compatibility depend on the actual account. If the candidate model is unavailable, use another NVIDIA Nemotron model from the account's catalog and retest.

Missing or failed inference leaves deterministic audit findings available. Live browser trials require working model access. With no key and `OPENPATH_DEMO_MODE=true`, the controlled storefront supports a separate scripted trial of the standard blue, size-M cart task. Its model field is `openpath-demo-simulator`, and its explanation explicitly disclaims NVIDIA inference. Public-site and custom tasks do not use this script. A failed live call is never replaced with a scripted success.

## Validation commands

```bash
npm run typecheck
npm test
npm run build:server
npm run test:browser
```

`npm test` covers API authentication, request validation, private-network rejection, check interpretation, tool validation and independent evaluator behavior.

`npm run test:browser` uses real Chromium against a small backend fixture and the shipped storefront. It verifies real crawling, screenshots, detected changes, independent cart results, trace capture and blocked loopback access. The suite also checks that the scripted storefront flow progresses through selected options and identifies itself as scripted. Passing these tests does not establish live NVIDIA agent performance.

Browser tests use temporary artifact storage. The production entry point never mounts the test fixture.

### Credit-free production verification

```bash
npm run build
npm run verify:offline
npm run test:e2e
# Optional: also exercise public DNS, HTTP and browser egress.
npm run verify:offline -- --public-url https://example.com
```

The verifier launches the compiled server on an isolated port, with its own installation token and report directory. It sets `OPENPATH_AI_ENABLED=false`, so an existing key cannot trigger inference. It checks the server login, protected APIs, private-address rejection, localhost demo normalization, both audits, real screenshots, scripted cart outcomes, trace downloads, Markdown exports, comparisons, and persistence across a graceful restart.

Results and controlled-demo evidence remain under the ignored `data/verification/offline-*/` folder. Both scripted storefront tasks may pass; the report distinguishes a corrected static check from unchanged task success. The verifier leaves the normal development server and its data alone.

`npm run test:e2e` runs five real-browser UI workflows against a separate AI-disabled server on port 4175. It checks both comparisons, exports, reload recovery, duplicate-submit protection, responsive layout, focus, budget pause, custom assertions and error/session recovery. Set `OPENPATH_UI_TEST_PORT` if that port is already in use. Screenshots and failures are saved under the ignored `test-results/` folder; the HTML report is in `playwright-report/`.

For an explicitly offline installation, set `OPENPATH_AI_ENABLED=false`. Restore it to `true` before live model verification. `OPENPATH_DEMO_MODE` separately controls the scripted storefront fallback.

The `Verify OpenPath` GitHub Actions workflow repeats the build, unit/API/model tests, Chromium tests and offline production check on Ubuntu 22.04 with Node 24. It uses no provider secrets. Only generated controlled-demo reports, screenshots and Markdown briefs are uploaded, with three-day retention. A configured workflow is not a passing run; inspect the current commit's result.

### Live inference verification

After account activation and key configuration, start the built application in one terminal and run this from the repository root in another:

```bash
npm run verify:live
```

This command uses real Token Factory credits. It checks one structured connection response, audits both controlled storefront variants, and runs the same cart task against each with fresh browser contexts. It reads `PORT` and `APP_ACCESS_TOKEN` locally; no key or access token is printed. It refuses to claim a live result from missing keys, rule-only analysis, scripted decisions or a custom endpoint.

The first live production verification passed on 30 October 2026: see `LIVE_VERIFICATION.md`. Spending is guarded by `OPENPATH_AI_BUDGET_USD` (default and maximum USD 1). Each bounded paid call atomically reserves USD 0.02 in the persistent data directory before dispatch. Failed calls retain that reservation; automatic retries are off. `/api/budget` and authorized health show usage estimates and the stop state. Do not delete the ledger or change the data directory to reset the cap. This guard does not measure or constrain another app's account usage. The verifier records budget status before and after the run.

The command saves actual audits, task outcomes and inference metadata in the ignored `data/verification/` directory, or the configured `OPENPATH_DATA_DIR`. A broken variant may still succeed: report that outcome honestly. Exit code 1 indicates incomplete verification; exit code 2 means inference was recorded but the fixed storefront task did not pass. One paired attempt does not establish a success rate or a universal compatibility score.

`npm test` additionally exercises the real SDK against a local fake provider: required tools, malformed output, invented findings, credential changes, HTTP 401/429, timeouts and response metadata. These tests use fake credentials and are not evidence of live Nebius access.

## Frontend and demo handoff

Use `shared/types.ts` and `docs/API_CONTRACT.md`. Do not infer success from a job reaching its terminal status.

Rohinth supplies `demo-site/pages.ts` with the documented renderer. The backend supplies the cart API and session state. Health reports `demoAvailable: false` until that module exists.

The app's API and artifacts share the same origin. No browser-cloud account, external database or Redis setup is required.

## Hosting

The included Dockerfile builds the backend alone when the frontend is absent, and the complete application after frontend integration. Container startup runs as a non-root user. Use a host that supports Chromium sandboxing and its required Linux namespaces. Some container platforms need additional approved sandbox configuration; do not silently disable the sandbox to make deployment appear successful.

Set a strong `APP_ACCESS_TOKEN` of at least 16 characters before binding beyond loopback. Put the service behind HTTPS. `compose.yaml` binds the host port to loopback so a deliberate reverse-proxy setup controls exposure.

The server provides `/login` and an HTTP-only session; do not put the installation token in browser storage or public submission text. If a reverse proxy terminates HTTPS, set `TRUST_PROXY` to that proxy's exact addresses/CIDRs (for example `loopback` when a local reverse proxy connects directly to the Node server). Leave it empty for direct local use. The proxy must preserve the public Host header and set `X-Forwarded-Proto`. This enables secure cookies and correct same-installation demo URL mapping without trusting arbitrary forwarded headers.

Persist `/app/data`. It contains audit reports and captured page data. Keep this directory private and out of Git. The browser cache is separate from report storage.

```bash
docker compose build
docker compose up -d
```

Docker/runtime compatibility still requires verification on the chosen host. Creating deployment files is not evidence of a successful deployment.

The local Windows Node production flow has been verified. Docker Desktop did not expose a running engine on this development machine, so no successful container build or container runtime is claimed. A public hosting target is still required for release.

## Limits

- Four pages per audit; two jobs at a time; a bounded waiting queue.
- Browser attempts: 12 actions, a 120-second budget, a single invalid-action retry and repeated-state detection.
- Navigation and egress policies block private services and keep task navigation in scope.
- Public-site trials allow browsing only. Sandbox writes are limited to the controlled cart API.
- No login, CAPTCHA bypass, real payment or arbitrary code execution.
- Page content and exported excerpts are untrusted evidence.

## Useful failures

| Symptom | Check |
| --- | --- |
| Browser not installed | Run `npm run browser:install` using the same browser-path setting as the server. |
| Model configured but not verified | Run the connection test; inspect account access, endpoint and model ID. |
| Audit completed in rule mode | Read `model.note`; NVIDIA review was missing, disabled or failed. |
| Trial complete but not successful | Read `outcome` and independent `checks`, not just `status`. |
| Site relies on blocked capabilities | Read limitations; do not treat an inspection-policy limitation as a confirmed site defect. |
| Demo unavailable | Integrate `demo-site/pages.ts` and rebuild/restart as appropriate. |
