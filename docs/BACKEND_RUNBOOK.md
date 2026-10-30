# Backend runbook

## Start locally

1. Use Node 24 and run `npm ci`.
2. Copy `.env.example` to `.env` without replacing an existing configured file.
3. Run `npm run browser:install`. Chromium is stored in the project-local `.cache/ms-playwright` directory unless `PLAYWRIGHT_BROWSERS_PATH` overrides it.
4. Run `npm run dev` and read `http://127.0.0.1:4173/api/health`.

Before frontend integration, the root URL returns backend status. The service will automatically mount Rohinth's frontend during development when `src/main.tsx` exists at startup. Restart after adding that entry point. Production serves `dist/client` when present.

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

## Frontend and demo handoff

Use `shared/types.ts` and `docs/API_CONTRACT.md`. Do not infer success from a job reaching its terminal status.

Rohinth supplies `demo-site/pages.ts` with the documented renderer. The backend supplies the cart API and session state. Health reports `demoAvailable: false` until that module exists.

The app's API and artifacts share the same origin. No browser-cloud account, external database or Redis setup is required.

## Hosting

The included Dockerfile builds the backend alone when the frontend is absent, and the complete application after frontend integration. Container startup runs as a non-root user. Use a host that supports Chromium sandboxing and its required Linux namespaces. Some container platforms need additional approved sandbox configuration; do not silently disable the sandbox to make deployment appear successful.

Set a strong `APP_ACCESS_TOKEN` of at least 16 characters before binding beyond loopback. Put the service behind HTTPS. `compose.yaml` binds the host port to loopback so a deliberate reverse-proxy setup controls exposure.

Persist `/app/data`. It contains audit reports and captured page data. Keep this directory private and out of Git. The browser cache is separate from report storage.

```bash
docker compose build
docker compose up -d
```

Docker/runtime compatibility still requires verification on the chosen host. Creating deployment files is not evidence of a successful deployment.

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
