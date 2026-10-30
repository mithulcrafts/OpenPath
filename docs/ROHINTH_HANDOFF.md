# Rohinth: remaining frontend integration

**Status: completed in the integrated application on 30 October 2026.** Mithul requested a final review and takeover of unfinished items after Rohinth's latest push. Rohinth supplied the initial history, category filter, evidence details, timeline and storefront labels. Mithul completed URL/reload restoration, real comparison API integration, saved/paired attempts, grouped checks, remaining filters, inference attribution, spending controls and five automated UI workflows. No additional implementation work is currently assigned to Rohinth. The original assignment below remains for traceability; current ownership is in `TEAM_TASKS.md`.

Assigned by Mithul on 30 October 2026 after reviewing the latest pushed UI (`99716f5`) and current `main`. These complete R2/R4/R5 in `TEAM_TASKS.md`; they are not additional product scope. Mithul is handling live inference, spending controls and backend validation. Keep ownership of `src/**`, `demo-site/**` and UI tests.

## Priority 1: show the full before/after story

- Add an audit history view using `GET /api/audits`. Opening a previous audit must restore its saved report without starting a new paid audit. Preserve the selected audit/run in the URL so reload works.
- Add **Compare after changes**. Submit `{url, compareWith: originalAudit.id}` to `POST /api/audits`. For the controlled demo, offer the predefined fixed variant explicitly; never claim automatic source repair.
- After completion, render `GET /api/audits/:id/comparison`: actual check states, changes, scope match and limitations. Do not turn untested/missing coverage into improvements.
- List saved attempts with `GET /api/runs?auditId=...`. For paired trials, send `compareWith: originalRun.id` and preserve the goal/assertions/model settings. Render `GET /api/runs/:id/comparison`, including non-comparable reasons and independent checks. One paired attempt is not a reliability benchmark.

## Priority 2: make results inspectable

- Show `run.steps` as an expandable screenshot timeline with action, target, result/error and duration. Link the real `run.trace` download.
- Group checks into all four `CATEGORY_META` categories; show pass/warning/fail/not_tested. Add category/severity/profile filters to developer findings.
- Open each finding's evidence snippet, selector and screenshot. Show affected `finding.profiles` and audit limitations.
- Display all trial outcomes distinctly: completed, failed, blocked and inconclusive.

## Priority 3: honest status and paid-action controls

- Use `health.trialMode` before starting a trial. Label scripted mode before and after a run. Disable unavailable trials and duplicate submissions while a run is queued/running.
- Derive verified provider attribution from successful `inference[]`, not `model.mode` alone. Show `model.note` when analysis falls back to rules. Refresh health after work completes.
- Mithul is adding `GET /api/budget` and optional `Health.budget`: USD 1 application cap, conservative reserved amount, recorded usage estimate, call count and blocked reason. This is installation-level accounting, not the account's live credit balance. Never launch paid tests automatically on page load.
- Public trials: expose a browsing goal plus an explicit URL/visible-text assertion (backend already supports these); no data entry, payments or login. Keep the standard demo task available.

## Acceptance and handoff

- Check keyboard use and desktop/mobile widths. Verify reload, empty history, expired login, backend errors and busy buttons.
- Add real UI tests under `tests/ui/**` or a dedicated UI integration test. Use `OPENPATH_AI_ENABLED=false` or mocked model responses, never the live key. Avoid shared root config changes without coordination.
- Push a focused frontend milestone to `main` or `rohinth/frontend`, with tested commands and remaining gaps. Do not edit Mithul's in-progress `server/**`, `shared/**`, budget tests or root configuration.
- Local verification is the current release target. Public hosting is not yet selected.

API definitions: `shared/types.ts` and `docs/API_CONTRACT.md`. This file is the assignment and should be marked with actual completed work, not merely planned screens.
