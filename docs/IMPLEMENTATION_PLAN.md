# OpenPath implementation plan

Date: 30 October 2026. Team: Mithul and Rohinth. Target: a focused five-hour hackathon MVP, assisted by coding tools.

## 1. Product definition

Most web products are designed for people. OpenPath examines an existing product and explains how its design affects agents that read HTML, operate a browser, or use documented APIs.

The primary input is a website URL. The primary output is an evidence-backed compatibility report and a developer change brief. Users do not have to write test cases before obtaining an audit.

Task execution is a validation layer. An optional agent attempt establishes whether a suspected barrier affected a particular task. The product must not reduce to a generic browser-testing dashboard.

Dedica already claims static checks, real-agent testing and fix instructions. Our focus is transparent observations, agent-specific recommendations, and independently checked before/after comparisons. We do not claim market exclusivity.

## 2. Core user experience

1. Enter an authorised product URL.
2. Inspect the homepage and up to three relevant same-origin pages.
3. Show the product inventory and findings in four categories.
4. Explain each observation, affected agent type, likely impact and concrete change.
5. Offer one relevant browser task to validate a selected finding.
6. Export a Markdown brief for a developer or coding agent.
7. Inspect a changed version and, where applicable, repeat the same task under the same runner conditions.

### Four report categories

| Category | Questions |
| --- | --- |
| Find and access | Can agents reach relevant pages? Are links and destinations understandable? Are access requirements explicit? |
| Read and understand | Is product information readable? What changes between initial HTML and the rendered page? Does published structured data parse? |
| Use and complete | Do controls expose names, roles and states? Are fields labelled? Are there relevant interaction errors? |
| Connect directly | Does the site publish discoverable API or tool documentation? What was actually inspected? |

Agents have different capabilities. A JavaScript-heavy page may work for a browser agent while exposing little to an HTML reader. Missing MCP, OpenAPI or `llms.txt` is not automatically a defect.

## 3. MVP scope

### Must ship

- URL-first inspection with visible progress.
- A maximum of four inspected HTML pages and roughly ten deterministic checks.
- Page screenshots, precise observations and traceable evidence IDs.
- Four report sections with practical fixes and verification steps.
- NVIDIA Nemotron analysis through Nebius Token Factory.
- A bounded DOM-based browser trial with an independent completion check.
- Downloadable Markdown fix brief.
- A controlled before/after demo and an honest comparison of observed results.
- Error states for unreachable sites, missing model access and incomplete trials.

### Defer

- Universal agent certification or an invented readiness score.
- Large crawling jobs and a 125-check catalogue.
- Dedicated GPU or vision-model setup, fine-tuning and a multi-model leaderboard.
- Production login flows, CAPTCHA bypass and real transactions.
- Repository-wide automatic edits, autonomous deployments, billing and full account management.
- Generating a functioning API/MCP service from an arbitrary URL. That requires real operation and permission design.

## 4. Architecture

Use one TypeScript application:

- **React + Vite + CSS** for the interface. The delivered version uses the team's existing stylesheet rather than adding Tailwind.
- **Express** in a persistent Node process for HTTP endpoints and background jobs.
- **Playwright Chromium** for rendering, observations, screenshots and browser actions.
- **OpenAI JavaScript SDK** configured for Nebius Token Factory.
- **Zod** for request, action and model-response validation.
- **Local JSON and artifact files** on a persistent volume for the MVP.
- **An in-process queue**, with at most two active jobs.

The frontend polls progress. A screenshot timeline is sufficient; live browser streaming is outside scope. Avoid browser jobs inside short-lived serverless request handlers.

### Why this approach

A static-only scanner cannot establish task failure. A small custom Playwright runner provides explicit actions and evidence without integrating a larger browser-agent framework. Browser-use or Stagehand would be alternatives if an existing team integration were already working.

### Suggested layout

```text
server/          Mithul: API, crawler, model, checks, runner, reports, safety
shared/          Mithul: shared types and contracts
src/             Rohinth: React components and styles
public/          Rohinth: frontend assets
demo-site/       Rohinth: storefront presentation and broken/fixed pages
test/            Mithul: backend and evaluator tests
tests/ui/        Rohinth: UI and end-to-end tests
docs/            Plan, contracts and runbook
```

## 5. Inspection and recommendations

The crawler fetches initial HTML, renders the page and records visible text, headings, controls, links, errors and explicitly published integration resources. It follows observed navigation rather than guessing arbitrary routes.

Initial checks:

1. Inspected page reachability.
2. Page titles and visible headings.
3. Button accessible names.
4. Form label associations.
5. Semantics of visible custom controls.
6. Link names and purposes.
7. Large differences between initial HTML and rendered text.
8. Parseability of published JSON-LD.
9. Recorded runtime and network errors.
10. Discoverability of explicitly linked API/tool documentation.

Each finding contains its observation, evidence IDs, affected access method, likely impact, proposed change and verification condition. A failure to discover documentation means only that it was not found within the inspected scope.

Nemotron receives a bounded, structured inventory and evidence. It interprets the product and refines recommendations. Its response must refer only to known finding IDs. Do not invent filenames, line numbers, APIs, measurements or completed tests.

Without a working API key, deterministic findings remain usable and must be clearly labelled. Never present a canned response as live NVIDIA output.

## 6. Browser trial and independent verification

Use one rendered-DOM agent profile. The model receives current text, semantic observations and temporary IDs for visible controls.

Permitted actions: click, fill, select, scroll, back and finish. Validate every action and regenerate element IDs after each observation. Do not expose arbitrary JavaScript, shell commands or unrestricted navigation to the model.

Initial bounds: 12 actions, 120 seconds, one invalid-action retry and repeated-state detection. Tune these limits using actual runs.

The acting model cannot determine its own success. Verify outcomes with declared URL/text conditions or the controlled demo's server-side cart state. Do not show hidden evaluator selectors or answers to the model.

Distinguish:

- **Observed warning:** a detected property, such as an unnamed control.
- **Observed task failure:** this runner did not complete this task within its budget.
- **Suspected cause:** an explanation supported by evidence, not a proven universal defect.
- **Blocked:** the task requires an unavailable or prohibited action.
- **Inconclusive:** the environment or evidence cannot support a verdict.
- **Verified improvement:** a recorded change improves the same independently checked task under matching settings.

Keep the goal, model, prompt version, browser settings and budgets fixed for paired comparisons. Use fresh contexts and new agent decisions. Report actual attempt counts, not general reliability percentages from tiny samples.

## 7. NVIDIA and Nebius

Server-only settings:

```text
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_MODEL=nvidia/Nemotron-3_5-Lightning
```

The model above is an initial catalog candidate. Confirm account availability and an actual tool-call response before depending on it. Keep the identifier configurable. A successful model-list request alone does not verify inference access.

NVIDIA performs product interpretation, recommendation reasoning and browser action selection. Nebius serves these model calls. This is central functionality, not a decorative report summary.

Do not depend on Nano Omni public inference for this MVP; current Nebius documentation lists it as dedicated-only. Screenshots are human-readable evidence unless a separate vision path is implemented and tested.

## 8. Controlled demo

Build a small storefront with explicitly labelled broken and fixed variants. Suggested defects include unnamed colour controls, non-semantic size selectors and unclear field labels. An optional obstructing overlay can demonstrate a reproducible interaction failure; disclose that it may affect people too.

Flagship task: add one Everyday Tee in blue, size M, to the cart. The independent evaluator checks SKU, colour, size and quantity in server-side state.

The fixed variant must correspond to visible source changes. A prebuilt fixed variant is a controlled comparison, not an automatically generated repair. If the agent succeeds on the broken version, report that honestly.

## 9. Security and containment

- Restrict inspection to public HTTP(S) resources and the explicitly controlled demo.
- Reject private/reserved addresses and revalidate redirect destinations. Pin outbound connections to validated addresses to address DNS rebinding.
- Guard browser egress, service workers, WebSockets and state-changing requests.
- Keep task navigation within its declared product scope. Limit writes to the controlled sandbox.
- Treat page content as untrusted evidence, not instructions.
- Keep API keys server-side. Redact sensitive errors and restrict artifact access.
- Require access protection before exposing the service publicly. Bound request bodies, job queues and action budgets.

## 10. Five-hour delivery sequence

| Time | Mithul | Rohinth |
| --- | --- | --- |
| 0:00–0:20 | Confirm contracts, model/tool call and browser setup | Review contracts, scaffold interface |
| 0:20–1:40 | URL inspection, rules, evidence and progress API | URL entry, progress, report layout; demo-site presentation |
| 1:40–2:40 | Integrate model analysis and fix export | Connect real API; evidence views, filtering and downloads |
| 2:40–3:40 | Browser trial, evaluator and comparison data | Task timeline, comparison UI and fixed demo variant |
| 3:40–4:20 | Backend verification and deployment | Responsive/accessibility checks and deployed UI QA |
| 4:20–5:00 | Freeze features; record technical proof and final verification | Record product walkthrough and prepare submission assets |

If time slips, retain the URL report and one complete validation task. Cut extra tasks, more checks and animation first.

## 11. Definition of done

- An entered URL produces a real bounded inspection and an evidence-backed report.
- Every recommendation exposes its basis and affected agent profile.
- A configured Nebius key performs a real NVIDIA inference call.
- A task trial cannot pass solely because the model says it succeeded.
- A missing key, blocked target, timeout or model error produces an honest state.
- The fix brief downloads and contains no invented source locations.
- The before/after demonstration records real observations.
- The repository contains setup instructions and no secrets or private research.

## References

- [Dedica maker description](https://www.producthunt.com/products/dedica)
- [Hackathon requirements](https://nebiusglobalaihackathon.devpost.com/)
- [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart)
- [Nebius Nemotron availability](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
