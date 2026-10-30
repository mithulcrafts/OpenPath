# Integration and release status — 30 October 2026

Tested milestones are integrated on `main` and `mithul/backend`. Use the latest branch commit rather than a hard-coded release hash in this document.

## Shipped and verified

- React/Vite interface served from `/` with URL submission, audit polling, evidence views, developer findings, qualified agent guidance and Markdown fix-kit export.
- Controlled broken/fixed storefront at `/demo/broken/` and `/demo/fixed/`.
- Real Playwright crawl, screenshots, evidence IDs, deterministic checks and bounded browser runner.
- Offline controlled-demo runner selects the intended options, writes through the real cart API and verifies server-owned cart state independently.
- Offline scripted runs explicitly disclose that no NVIDIA model was called.
- Public-site one-click trials are disabled until a browsing goal and independent URL/text assertion are supplied.
- The UI reports check counts in the inspected scope instead of presenting a universal readiness score.
- Actual SDK calls record provider, requested/returned model, response IDs, latency and reported token usage; scripted decisions have no inference records.
- Model settings remain stable throughout a job, so changing `.env` cannot relabel an old request as verification of new credentials.
- MIT license, setup instructions, Docker configuration and environment template are included.
- Server-owned installation login works in Chromium, including invalid tokens, HTTP-only sessions and reloads. HTTPS proxy trust is explicit.
- Audit and task comparison APIs return actual before/after checks, evidence and outcomes without treating missing coverage as a fix.
- Visible localhost/hosted demo URLs normalize to the controlled server sandbox.
- `npm run typecheck`, `npm run build`, 44 unit/API/model-protocol/budget tests and nine real-Chromium integration tests pass.
- The isolated offline production verifier passes through both audits and trials, image/trace/export downloads, comparisons, a public-site audit and restart persistence. No AI provider is called.

## Frontend integration still available to connect

The backend supplies `aiEnabled`, `trialMode`, `inference[]`, `/api/audits/:id/comparison` and `/api/runs/:id/comparison`. Rohinth can use these for pre-run mode labels, provider attribution, before/after views and the screenshot timeline. Grouped check states, agent profiles and history remain frontend presentation work; a functioning API is not evidence that these screens are complete.

## External release steps

Live connection, both NVIDIA reviews and both browser task attempts were verified locally on 30 October; see `LIVE_VERIFICATION.md`. The requested completion target is now local verification, with public hosting deferred until a service is selected. Spending protection caps this installation at USD 1 using persistent conservative reservations.

1. Keep `NEBIUS_API_KEY` in local `.env` and preserve `data/ai-budget.json`; never commit either.
2. Use the captured live evidence for submission. Do not repeat paid verification merely to obtain a preferred outcome.
3. Deploy with a strong `APP_ACCESS_TOKEN`, persistent `/app/data`, HTTPS and Chromium support.
4. Verify the public-site flow again on the selected host and run a live Nemotron browser trial; keep the controlled storefront available for the video.
5. Record the <=3-minute demo, publish the demo URL and keep the deployment available through judging.

The offline simulator is limited to the controlled storefront and is clearly labelled. It is a development/demo fallback, not evidence of NVIDIA inference quality.

Docker Desktop's local engine was unavailable. Local production startup is verified; container hosting and a public deployment remain unverified.

