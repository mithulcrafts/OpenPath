# OpenPath

OpenPath helps developers make websites usable by AI agents. Enter a URL to inspect real pages, find compatibility barriers, and get changes backed by captured evidence. Run a browser task to check what an agent can actually complete.

## What it does

- Inspects up to four same-origin pages for discovery, readability, interaction and integration issues.
- Suggests product capabilities from captured content and maps their observed page links, unknowns and proposed changes.
- Connects findings to page excerpts, controls and screenshots, with fixes scoped to HTML readers, browser agents or API clients.
- Exports an implementation brief for a selected capability and agent profile, while keeping the full inspection available.
- Runs bounded browser tasks and checks their outcomes independently of the model's own claims.
- Saves reports and task timelines, compares recorded results, and exports a Markdown change brief.

## Run locally

Requires Node.js 24 and npm.

```bash
npm ci
cp .env.example .env
npm run browser:install
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env` for the copy step. Keep an existing configured `.env` rather than replacing it.

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Add `NEBIUS_API_KEY` to `.env` for live model analysis and browser trials. Rule-based inspections work without a key.

For a production build:

```bash
npm run build
npm start
```

### Try the controlled storefront

Audit `http://127.0.0.1:4173/demo/broken/`, review its findings, then run the cart task. Compare it with `/demo/fixed/`. The evaluator checks the server-owned cart rather than trusting a success message.

With no key and `OPENPATH_DEMO_MODE=true`, this storefront uses an explicitly labelled scripted simulator. It makes no model calls. Public-site trials require live inference.

### Real-world demo: NVIDIA

For a live public-site walkthrough, enter `https://www.nvidia.com/` in the URL field and click **Run audit**. OpenPath follows same-origin links, captures rendered-page evidence, and sends the observed findings to `nvidia/Nemotron-3_5-Lightning` through Nebius. The public-site task panel is browsing-only: provide a goal and an independent visible-text or URL condition, and do not use login, forms, checkout or payments. Results can vary as the public site changes; use the saved report from the run when presenting the demo.

## NVIDIA and Nebius

The backend calls `nvidia/Nemotron-3_5-Lightning` through the OpenAI-compatible Nebius Token Factory API. Nemotron reviews observed findings and chooses browser actions; Playwright collects evidence and executes validated actions. Separate checks determine task success.

Token Factory provides managed inference; the project does not provision GPU servers or fine-tune a model. See the [live verification results](docs/LIVE_VERIFICATION.md) for measured outcomes and limitations.

Capability suggestions use deterministic signals from captured pages. A map shows inspected hyperlinks, not a completed agent task. The **Verify** workspace runs a separately declared task and checks its expected URL, visible text or controlled storefront state.

## Limits and spending

Browser trials allow up to 12 actions within 120 seconds. Public-site trials are browsing-only; cart writes are restricted to the built-in storefront. Private-network targets, login, CAPTCHA and real payments are outside the supported workflow.

Paid calls use a persistent conservative spending guard, capped at USD 1 per installation. Keep `data/ai-budget.json` across restarts. This guard does not control other applications using the same Nebius account. Set `OPENPATH_AI_ENABLED=false` to disable paid calls.

Reports and captured evidence stay in the local `data/` directory. Never commit `.env` or private report data. Before exposing the server publicly, configure `APP_ACCESS_TOKEN`, HTTPS and trusted proxy settings as described in the runbook.

## Verification

```bash
npm run build
npm test
npm run test:browser
npm run verify:offline
npm run test:e2e
```

These checks use no model credits. GitHub Actions runs the same checks for pushes and pull requests to `main`. `npm run verify:live` separately verifies actual Nebius inference and consumes credits.

## Documentation

- [Setup, configuration and deployment](docs/BACKEND_RUNBOOK.md)
- [API reference](docs/API_CONTRACT.md)
- [Live inference results and spending controls](docs/LIVE_VERIFICATION.md)
- [Portable test build](submission/openpath-test-build.zip)

## License

[MIT](LICENSE).
