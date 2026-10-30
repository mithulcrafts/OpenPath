# OpenPath

OpenPath is an agent-compatibility auditor for websites and web apps. Enter a public URL and it inspects how an agent can discover, understand and use the product, then produces an evidence-backed navigation playbook and a developer change brief.

## Demo flow

The controlled storefront is available at `http://127.0.0.1:4173/demo/broken/`. Run an audit against that URL, review the findings, then launch the task trial. The trial uses a fresh browser and independently checks the server-owned sandbox cart. `OPENPATH_DEMO_MODE=true` enables the transparent deterministic simulator for this controlled storefront when no Nebius key is configured; public-site trials still require a live key.

## Product run

```powershell
npm ci
Copy-Item .env.example .env
npm run browser:install
npm run dev
```

Open `http://127.0.0.1:4173/`. Set `NEBIUS_API_KEY` in `.env` to enable NVIDIA Nemotron recommendations and live browser task trials through Nebius Token Factory. The deterministic scanner remains available without a key.

The implementation is intentionally bounded: it inspects up to four same-origin HTML pages, blocks private-address rebinding and state-changing requests, stores evidence artifacts locally, and never attempts login, CAPTCHA or payment actions.

**Working name:** an agent-compatibility auditor for websites and web apps.

Enter a product URL. OpenPath inspects how agents can discover, understand and use the product, then produces evidence-backed changes for developers. Selected browser tasks validate the findings.

Built for the Nebius × NVIDIA Global AI Hackathon. NVIDIA Nemotron on Nebius Token Factory powers product interpretation, recommendations and the bounded browser agent.

## Start here

- [Product idea and teammate briefing](IDEA.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Mithul and Rohinth's task assignments](docs/TEAM_TASKS.md)
- [Frontend/backend API contract](docs/API_CONTRACT.md)
- [Backend setup, verification and deployment runbook](docs/BACKEND_RUNBOOK.md)
- [Integration status and remaining frontend handoff](docs/INTEGRATION_STATUS.md)

The backend workstream is on `mithul/backend`, with tested milestones integrated into `main`. Rohinth's frontend, storefront and scope/trial improvements are integrated alongside the API, shared types, audit checks, evidence storage, fix export and bounded browser runner. The full production build, 26 unit/API/model-protocol tests and eight real-Chromium integration tests passed on 30 October 2026. Offline browser checks use declared scripted decisions; live NVIDIA calls still require activated Nebius access, a configured key and verification. Actual SDK calls record model/provider metadata, latency and reported tokens. Run `npm run verify:live` after configuring access to capture genuine connection, review and paired-trial results. Remaining frontend integration gaps are recorded in the integration handoff. Deployment is not yet verified. Keep the hosted deployment available through judging once a public endpoint is selected.

## Backend setup

Use Node.js 24, npm and Chromium dependencies supported by Playwright.

```bash
npm ci
cp .env.example .env
npm run browser:install
npm run dev
```

PowerShell: use `Copy-Item .env.example .env` in place of `cp` if needed. Set `NEBIUS_API_KEY` in `.env` for NVIDIA analysis. The backend reads that file on requests, so adding the key does not require editing source code.

Default address: `http://127.0.0.1:4173`. Check `/api/health`. The root serves the interface, and `/demo/broken/` and `/demo/fixed/` serve the controlled storefronts. Use this exact loopback address for local testing.

```bash
npm run typecheck
npm test
npm run build:server
npm run test:browser
```

`npm run build` builds the combined frontend and backend. Never commit `.env`. Set a strong `APP_ACCESS_TOKEN` before binding to a public interface; the frontend's installation-login flow remains on the integration checklist.

## Collaboration

- **Mithul:** backend, audit engine, NVIDIA/Nebius integration, browser runner, independent verification and deployment infrastructure.
- **Rohinth:** frontend, report experience, demo-site presentation, responsive design and visual QA.

Use separate branches and the ownership rules in the task document. Never commit API keys, `.env` files, recorded private website content or unrelated research documents.
