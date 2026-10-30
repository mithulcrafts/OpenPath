# Integration and release status — 30 October 2026

OpenPath is integrated on `main` and `mithul/backend` as the shared release commit `c000e9c`.

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
- `npm run typecheck`, `npm run build`, 26 unit/API/model-protocol tests and eight real-Chromium integration tests pass.

## External release steps

1. Set `NEBIUS_API_KEY` and the exact available NVIDIA Nemotron model in `.env`.
2. Run `npm run verify:live` and capture the genuine connection, review and paired-trial evidence for submission.
3. Deploy with a strong `APP_ACCESS_TOKEN`, persistent `/app/data`, HTTPS and Chromium support.
4. Exercise one real public-site audit and one live Nemotron browser trial; keep the controlled storefront available for the video.
5. Record the <=3-minute demo, publish the demo URL and keep the deployment available through judging.

The offline simulator is limited to the controlled storefront and is clearly labelled. It is a development/demo fallback, not evidence of NVIDIA inference quality.

