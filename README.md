# OpenPath

**Working name:** an agent-compatibility auditor for websites and web apps.

Enter a product URL. OpenPath inspects how agents can discover, understand and use the product, then produces evidence-backed changes for developers. Selected browser tasks validate the findings.

Built for the Nebius × NVIDIA Global AI Hackathon. NVIDIA Nemotron on Nebius Token Factory powers product interpretation, recommendations and the bounded browser agent.

## Start here

- [Product idea and teammate briefing](IDEA.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Mithul and Rohinth's task assignments](docs/TEAM_TASKS.md)
- [Frontend/backend API contract](docs/API_CONTRACT.md)
- [Backend setup, verification and deployment runbook](docs/BACKEND_RUNBOOK.md)

The backend workstream is on `mithul/backend`, with tested milestones integrated into `main`. It includes the API, shared types, audit checks, evidence storage, fix export, and bounded browser runner. Type checking, the server build, 16 unit/API tests and five real-Chromium integration tests passed on 30 October 2026. Browser tests use a declared decision stub; live NVIDIA calls still require a configured key and verification. Frontend/demo integration and deployment remain pending.

## Backend setup

Use Node.js 24, npm and Chromium dependencies supported by Playwright.

```bash
npm ci
cp .env.example .env
npm run browser:install
npm run dev
```

PowerShell: use `Copy-Item .env.example .env` in place of `cp` if needed. Set `NEBIUS_API_KEY` in `.env` for NVIDIA analysis. The backend reads that file on requests, so adding the key does not require editing source code.

Default address: `http://127.0.0.1:4173`. Check `/api/health`. Until Rohinth's frontend is integrated, `/` returns backend status rather than a product UI. Demo actions remain unavailable until `demo-site/pages.ts` exists.

```bash
npm run typecheck
npm test
npm run build:server
npm run test:browser
```

`npm run build` builds the complete product after frontend integration. Never commit `.env`. Set a strong `APP_ACCESS_TOKEN` before binding to a public interface.

## Collaboration

- **Mithul:** backend, audit engine, NVIDIA/Nebius integration, browser runner, independent verification and deployment infrastructure.
- **Rohinth:** frontend, report experience, demo-site presentation, responsive design and visual QA.

Use separate branches and the ownership rules in the task document. Never commit API keys, `.env` files, recorded private website content or unrelated research documents.
