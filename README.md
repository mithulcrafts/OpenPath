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

The `mithul/backend` branch contains the complete local demo: API, shared types, audit checks, evidence storage, fix export, bounded browser runner, React report UI and controlled broken/fixed storefront. Type checking and the production build pass. Browser tests use a declared decision stub; live NVIDIA calls require a configured key and verification. Keep the hosted deployment available through judging once a public endpoint is selected.

## Backend setup

Use Node.js 24, npm and Chromium dependencies supported by Playwright.

```bash
npm ci
cp .env.example .env
npm run browser:install
npm run dev
```

PowerShell: use `Copy-Item .env.example .env` in place of `cp` if needed. Set `NEBIUS_API_KEY` in `.env` for NVIDIA analysis. The backend reads that file on requests, so adding the key does not require editing source code.

Default address: `http://127.0.0.1:4173`. Check `/api/health`. The product UI is served at `/`, and the controlled storefront is available at `/demo/broken/` and `/demo/fixed/`.

```bash
npm run typecheck
npm test
npm run build:server
npm run test:browser
```

`npm run build` builds the complete product. Never commit `.env`. Set a strong `APP_ACCESS_TOKEN` before binding to a public interface.

## Collaboration

- **Mithul:** backend, audit engine, NVIDIA/Nebius integration, browser runner, independent verification and deployment infrastructure.
- **Rohinth:** frontend, report experience, demo-site presentation, responsive design and visual QA.

Use separate branches and the ownership rules in the task document. Never commit API keys, `.env` files, recorded private website content or unrelated research documents.
