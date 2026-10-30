# Integration handoff — 30 October 2026

Rohinth's initial UI and storefront from commit `2745536` are integrated. Mithul's integration changes stay in backend files and tests; frontend presentation remains Rohinth's workstream.

## Verified

- The combined React/Express production build passes.
- 17 unit/API tests and seven Chromium integration tests pass.
- The actual broken storefront's decorative, unnamed add button is detected; its fixed counterpart has a name.
- The scripted demo selects the intended options, adds the item through the real cart API and passes the independent server-state check.
- Scripted runs disclose that no NVIDIA model was called. They cannot be paired with a live model run.

These checks do not establish live NVIDIA quality or completed UI acceptance. Nebius account activation, an API key and usable balance are still required for inference verification.

## Rohinth: frontend gaps found during integration

1. Replace the `AGENT READINESS /100` display with explicit check counts. Optional, untested checks must not reduce a universal readiness score.
2. Add installation login through `POST /api/auth` when health reports `needsAuth`; public hosting otherwise leaves the interface unable to call protected APIs.
3. Public-site trials need a goal and URL/text assertion. The current button sends only `auditId`, which works only for the built-in demo. Disable unavailable actions and show the reason before submission.
4. Show the scripted/live mode clearly before and during a trial. Display its model, prompt/budget settings, steps, screenshots and trace link. The backend also labels the final explanation.
5. Use the backend's `demoUrl` for demo audit submissions. `window.location.origin` may be `localhost` or a hosted address, while the controlled runner uses a precise server-local demo origin. Browser preview links can use `/demo/broken/` and `/demo/fixed/` on the UI's origin.
6. Finish the planned four-category report, affected-agent profiles, limitations, history, and before/after comparison. Current “Agent playbook” content is a list of checks, not a verified navigation procedure; describe it accordingly.
7. Label intentional broken/fixed storefront variants and disclose their predefined changes. The scripted demo can succeed on both; do not manufacture an agent failure.

## Mithul: remaining release work

- Verify a real NVIDIA tool call, review and browser task once Nebius access is available.
- Integrate remaining frontend changes and run UI acceptance checks.
- Verify deployment on the chosen host, then prepare real inference/submission evidence.

No additional paid service or GPU VM is required for the current local architecture. The needed external runtime dependency is NVIDIA inference served through Nebius Token Factory.
