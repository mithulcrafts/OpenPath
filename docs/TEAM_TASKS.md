# Team tasks: Mithul and Rohinth

## Ownership

| Area | Owner | Files |
| --- | --- | --- |
| Shared types and API contracts | Mithul | `shared/**`, `docs/API_CONTRACT.md` |
| Server, crawling and compatibility checks | Mithul | `server/**` |
| NVIDIA/Nebius, browser runner and evaluator | Mithul | `server/**`, `test/**` |
| Package scripts, environment and deployment | Mithul | Root configuration, Docker files, `.env.example` |
| React interface and styling | Rohinth | `src/**`, `public/**`, `index.html` |
| Demo storefront presentation | Rohinth | `demo-site/**` |
| UI tests and visual QA | Rohinth | `tests/ui/**` |
| Demo story and submission | Both | Coordinate before editing the same document |

The original split is recorded above. On 30 October, Mithul requested that the assistant integrate Rohinth's latest commits and finish any remaining work, including frontend integration and UI tests. Those gaps are now completed on Mithul's workstream while preserving the storefront and existing design. No further implementation tasks are assigned to Rohinth.

## Mithul: implementation checklist

Status on 30 October 2026: Rohinth's published UI/demo milestones are integrated, and Mithul completed the remaining frontend integration. The full build, 44 unit/API/model-protocol/budget tests, nine Chromium integration tests and five UI workflows pass. Public deployment and final video/submission links remain external release steps.

### M1. Backend foundation

- [x] Publish shared TypeScript types and the API skeleton.
- [x] Set up a persistent Node/Express service, local artifact storage and a bounded job queue.
- [x] Add configuration, honest health status and access protection for public hosting.
- [x] Install Chromium and verify a controlled navigation.
- [x] Validate targets and guard outbound connections and redirects.
- [x] Push the working foundation and publish the endpoint handoff in the API contract.

### M2. URL-first compatibility audit

- [x] Inspect initial HTML and rendered pages, up to four pages.
- [x] Collect screenshots, semantic controls, page errors and evidence IDs.
- [x] Implement the ten checks in the plan.
- [x] Return a complete report with four categories and clear limitations.
- [x] Preserve deterministic results when model access is unavailable.
- [x] Push a tested end-to-end audit milestone.

### M3. NVIDIA recommendations and developer export

- [x] Verify actual Nemotron tool calling on Nebius.
- [x] Verify live structured product analysis and recommendations; see `LIVE_VERIFICATION.md`.
- [x] Reject invented finding IDs and label model failures honestly in the implementation.
- [x] Export a Markdown fix brief with verification steps.
- [x] Push the working inference/export milestone.

### M4. Browser trial and independent checks

- [x] Build the bounded rendered-DOM action loop.
- [x] Implement the sandbox cart API and independent evaluator.
- [x] Record screenshots, actions, errors, trace files and actual outcomes.
- [x] Handle stale IDs, action loops, timeouts, access blocks and invalid output in the implementation.
- [x] Support fresh-context reruns and reject mismatched goals, models and assertions in comparisons.
- [x] Push the tested trial milestone, with real browser mechanics and explicitly scripted offline decisions.

### M5. Integration and release

- [x] Integrate Rohinth's published milestones without overwriting his frontend files.
- [x] Validate offline happy paths, failures, containment, comparisons and exports.
- [x] Build and verify the combined application in local production mode.
- [ ] Deploy and verify the combined application on the chosen public host.
- [x] Capture live NVIDIA inference proof and document measured results.
- [ ] Record the final video and verify public submission links.
- [x] Complete the tested local implementation milestone.

## Rohinth: implementation checklist

Review on 30 October: Rohinth's published frontend included basic report history, category filters, evidence details, trial step timelines and explicit demo-variant labels. Mithul completed URL restoration, server comparisons, saved and paired trials, remaining filters, paid-action controls and automated UI verification. The checklist below describes the combined result, not work attributed solely to Rohinth. Remaining submission work is video recording and public deployment.

### R1. Interface foundation

- [x] Build the responsive application shell and working navigation.
- [x] Build URL entry with validation, loading and error states.
- [x] Use shared types once published; use the API contract beforehand.
- [x] Keep mock responses isolated to development/tests and visibly labelled.

### R2. Audit experience

- [x] Poll progress and display inspected pages and actual activity.
- [x] Build the four report categories and finding filters.
- [x] Show each finding's observation, agent profile, impact, change and verification.
- [x] Open evidence snippets and screenshots.
- [x] Show passed, warning and untested checks without a fabricated universal score.
- [x] Distinguish deterministic results from verified NVIDIA analysis.
- [x] Wire Markdown export and audit history.

### R3. Demo site

- [x] Provide broken/fixed storefront pages in `demo-site/**`.
- [x] Expose the Everyday Tee with blue/M options and an add-to-cart flow.
- [x] Clearly label intentional defects and the fixed variant.
- [x] Use Mithul's cart API; do not invent a second backend state system.
- [x] Show actual source changes or a transparent predefined fixed variant.

### R4. Trial and comparison experience

- [x] Offer a controlled demo task or a browsing-only custom goal with an explicit success condition.
- [x] Show step screenshots, action results and independent assertion results.
- [x] Display completed, failed, blocked and inconclusive outcomes distinctly.
- [x] Compare actual before/after results and show model/profile/budget settings.
- [x] Disable live trials clearly when Nebius is not configured.

### R5. QA and submission

- [x] Check desktop and mobile layouts, keyboard focus and readable contrast.
- [x] Verify refresh/reload behavior, empty states and backend errors.
- [x] Remove misleading mock data and dead buttons.
- [x] Prepare the product walkthrough script and screenshot checklist in `docs/DEMO_SCRIPT.md`; recording remains an external submission step.
- [x] Push tested UI milestones and hand off for integration.

## Branch and push workflow

1. Initial plan and contracts go on `main`.
2. Mithul works on `mithul/backend`; Rohinth works on `rohinth/frontend`.
3. Push after each working milestone. Use focused commits with the validation performed.
4. Read the other branch's changes before integration. Never force-push or reset another person's work.
5. Mithul owns shared configuration and contract changes. If Rohinth needs an API change, coordinate it before implementing both sides differently.
6. Merge reviewed, working milestones into `main`; resolve conflicts deliberately.

Do not wait until the final hour to integrate. Complete the first real URL-to-report path before expanding task coverage.


