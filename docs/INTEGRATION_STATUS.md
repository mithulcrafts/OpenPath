# Integration handoff — 30 October 2026

Rohinth's initial UI/storefront (`2745536`) and scope/trial improvements (`99716f5`) are integrated. Mithul's integration changes stay in backend files and tests; frontend presentation remains Rohinth's workstream.

## Verified

- The combined React/Express production build passes.
- 26 unit/API/model-protocol tests and eight Chromium integration tests pass.
- The actual broken storefront's decorative, unnamed add button is detected; its fixed counterpart has a name.
- The scripted demo selects the intended options, adds the item through the real cart API and passes the independent server-state check.
- Scripted runs disclose that no NVIDIA model was called. They cannot be paired with a live model run.
- Actual SDK calls now record provider, requested/returned model, response IDs, latency and reported token usage. Scripted decisions have no inference records, and local test providers are labelled `custom`.
- Model settings remain stable throughout a job. Changing `.env` cannot label an old request as verification of the new credentials.

`npm run verify:live` is ready for activated Nebius access. It saves real connection, review and paired-trial results locally without exposing credentials. No successful NVIDIA call is claimed before that check passes.

These checks do not establish live NVIDIA quality or completed UI acceptance. Nebius account activation, an API key and usable balance are still required for inference verification.

## Rohinth: frontend gaps found during integration

The latest frontend commit replaces the universal score with check counts, disables public-site trials that lack explicit assertions, and labels scripted runs while they execute. These changes address the first integration report's most visible misleading states.

1. Separate passed, warning/failed and untested counts. The new check count is better than a universal readiness score; optional untested checks should still be identified clearly.
2. Add installation login through `POST /api/auth` when health reports `needsAuth`; public hosting otherwise leaves the interface unable to call protected APIs.
3. Public-site trials are now disabled with an explanation. To enable them later, add a goal and URL/text assertion; `auditId` alone works only for the built-in demo.
4. Scripted/live mode is now displayed during and after a trial. Add the mode before starting and display prompt/budget settings, steps, screenshots and trace links. The backend supplies optional `inference[]` with actual model-call metadata for a truthful sponsor-usage panel.
5. Use the backend's `demoUrl` for demo audit submissions. `window.location.origin` may be `localhost` or a hosted address, while the controlled runner uses a precise server-local demo origin. Browser preview links can use `/demo/broken/` and `/demo/fixed/` on the UI's origin.
6. Finish the planned four-category report, affected-agent profiles, limitations, history, and before/after comparison. Current “Agent playbook” content is still a list of checks; the added qualification helps, but it should not be described as an executable navigation contract.
7. Label intentional broken/fixed storefront variants and disclose their predefined changes. The scripted demo can succeed on both; do not manufacture an agent failure.
8. Use `model.note` and inference provider metadata for analysis attribution. `mode: nemotron` is a legacy model-assisted state; a deliberately configured custom endpoint must not be labelled “Nebius verified.”

## Mithul: remaining release work

- Verify a real NVIDIA tool call, review and browser task once Nebius access is available.
- Integrate remaining frontend changes and run UI acceptance checks.
- Verify deployment on the chosen host, then prepare real inference/submission evidence.

No additional paid service or GPU VM is required for the current local architecture. The needed external runtime dependency is NVIDIA inference served through Nebius Token Factory.
