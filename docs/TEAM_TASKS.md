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

The assistant working with Mithul should implement Mithul's tasks. Rohinth can work independently from the API contract. Neither workstream should overwrite the other's files.

## Mithul: implementation checklist

Status on 30 October 2026: the initial UI/demo is integrated and the full build passes, along with 17 unit/API tests and seven real-Chromium integration tests. NVIDIA review/action code is implemented but live inference is unverified until activated Nebius access and a key are available. Offline trials explicitly identify scripted decisions. Remaining frontend work is in `docs/INTEGRATION_STATUS.md`; public deployment remains unverified.

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

- [ ] Verify actual Nemotron tool calling on Nebius.
- [ ] Verify live structured product analysis and recommendations; implementation is ready.
- [x] Reject invented finding IDs and label model failures honestly in the implementation.
- [x] Export a Markdown fix brief with verification steps.
- [ ] Push the working inference/export milestone.

### M4. Browser trial and independent checks

- [x] Build the bounded rendered-DOM action loop.
- [x] Implement the sandbox cart API and independent evaluator.
- [x] Record screenshots, actions, errors, trace files and actual outcomes.
- [x] Handle stale IDs, action loops, timeouts, access blocks and invalid output in the implementation.
- [x] Support fresh-context reruns and reject mismatched goals, models and assertions in comparisons.
- [x] Push the tested trial milestone, with real browser mechanics and explicitly scripted offline decisions.

### M5. Integration and release

- [ ] Integrate Rohinth's work without overwriting it.
- [ ] Validate happy paths, failures, containment and exports.
- [ ] Build and deploy the combined application.
- [ ] Record live NVIDIA proof and verify submission links.
- [ ] Push the release milestone.

## Rohinth: implementation checklist

### R1. Interface foundation

- [ ] Build the responsive application shell and working navigation.
- [ ] Build URL entry with validation, loading and error states.
- [ ] Use shared types once published; use the API contract beforehand.
- [ ] Keep mock responses isolated to development/tests and visibly labelled.

### R2. Audit experience

- [ ] Poll progress and display inspected pages and actual activity.
- [ ] Build the four report categories and finding filters.
- [ ] Show each finding's observation, agent profile, impact, change and verification.
- [ ] Open evidence snippets and screenshots.
- [ ] Show passed, warning and untested checks without a fabricated universal score.
- [ ] Distinguish deterministic results from verified NVIDIA analysis.
- [ ] Wire Markdown export and audit history.

### R3. Demo site

- [ ] Provide broken/fixed storefront pages in `demo-site/**`.
- [ ] Expose the Everyday Tee with blue/M options and an add-to-cart flow.
- [ ] Clearly label intentional defects and the fixed variant.
- [ ] Use Mithul's cart API; do not invent a second backend state system.
- [ ] Show actual source changes or a transparent predefined fixed variant.

### R4. Trial and comparison experience

- [ ] Offer a controlled demo task or a browsing-only custom goal with an explicit success condition.
- [ ] Show step screenshots, action results and independent assertion results.
- [ ] Display completed, failed, blocked and inconclusive outcomes distinctly.
- [ ] Compare actual before/after results and show model/profile/budget settings.
- [ ] Disable live trials clearly when Nebius is not configured.

### R5. QA and submission

- [ ] Check desktop and mobile layouts, keyboard focus and readable contrast.
- [ ] Verify refresh/reload behavior, empty states and backend errors.
- [ ] Remove misleading mock data and dead buttons.
- [ ] Record the product walkthrough and prepare screenshots.
- [ ] Push tested UI milestones and hand off for integration.

## Branch and push workflow

1. Initial plan and contracts go on `main`.
2. Mithul works on `mithul/backend`; Rohinth works on `rohinth/frontend`.
3. Push after each working milestone. Use focused commits with the validation performed.
4. Read the other branch's changes before integration. Never force-push or reset another person's work.
5. Mithul owns shared configuration and contract changes. If Rohinth needs an API change, coordinate it before implementing both sides differently.
6. Merge reviewed, working milestones into `main`; resolve conflicts deliberately.

Do not wait until the final hour to integrate. Complete the first real URL-to-report path before expanding task coverage.
