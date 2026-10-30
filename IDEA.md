# OpenPath — make your product usable by AI agents

## The idea

OpenPath examines an existing website and explains what developers should change so AI agents can understand and operate it more reliably.

The developer enters a URL. We inspect the real pages, identify barriers, explain specific fixes, and optionally let an agent attempt a task. The report includes evidence instead of unsupported claims.

**One-line pitch:** “Your product works for people. Can an AI agent use it? OpenPath finds the barriers and shows your developers what to change.”

## Who needs it, and why?

Our first users are developers and product teams building websites, online stores and web apps. Their interfaces may depend on visual clues, unnamed icons, custom controls or hidden state that people understand but some agents cannot.

Different agents have different needs. An HTML reader cannot run JavaScript. A browser agent can operate rendered controls. An API client needs documented operations. We identify which type is affected rather than giving every website one universal score.

## What the user does

1. **Enter a product URL.** No repository upload or test script is required for the initial audit.
2. **Watch the inspection.** We inspect up to four linked pages and capture controls, page content, errors and screenshots.
3. **Read the findings.** Each finding explains what we observed, which agents it affects, the likely impact, and a concrete change.
4. **Try a task.** An optional browser agent attempts a declared task. Screenshots and actions show what happened. A separate checker decides whether the stated outcome occurred.
5. **Export the fixes.** Download a Markdown brief that a developer or coding agent can use to make changes.
6. **Check the improved version.** Repeat the inspection or task and compare recorded results under matching settings.

## A concrete example

A store lets shoppers choose a shirt colour using unnamed circles. A browser agent sees several controls without useful names.

OpenPath shows the affected control and screenshot, explains the ambiguity, and recommends labels such as “Blue” plus an explicit selected state. A developer applies that change.

For our controlled demo, the agent must add one blue, size-M Everyday Tee to the cart. The checker reads the demo's server-side cart. Saying “done” or displaying a success message cannot pass an incorrect cart.

The broken and fixed storefronts are transparent, predefined examples. We do not claim that OpenPath automatically repaired the source code. If the agent succeeds on the broken version, we show that result honestly.

## What makes this useful?

ChatGPT can suggest general best practices. OpenPath collects evidence from the actual product, ties changes to observed controls, records a browser attempt, and checks its result independently.

The product combines inspection, practical fixes and verification in one workflow. It is inspired by Dedica; we do not claim these capabilities are unique across the market.

## Where NVIDIA and Nebius fit

- **NVIDIA Nemotron:** interprets the inspected product, improves evidence-grounded recommendations, and chooses the browser agent's next action.
- **Nebius Token Factory:** serves those model calls through its API.
- **Playwright:** opens pages, observes controls, executes validated actions and captures evidence.
- **Our checks and evaluator:** establish observable facts and verify completion independently of the model.

Without a working Nebius key, rule-based inspections remain available. Live NVIDIA analysis and trials must be verified separately; scripted test decisions are never presented as live model results.

## What we are building for the hackathon

The MVP includes URL inspection, four report categories, about ten checks, screenshots, NVIDIA recommendations, a bounded browser trial, Markdown export, and a controlled before/after demonstration.

The four categories are **Find and access**, **Read and understand**, **Use and complete**, and **Connect directly**. Missing MCP, `llms.txt` or API documentation is not automatically a defect.

We are not building a universal agent certification service, unrestricted automation, automatic repository repair, login bypass or real checkout execution. Public-site trials are browsing-only; cart changes happen only in our demo.

## Team handoff

- **Mithul:** API, crawler, checks, evidence, NVIDIA integration, browser runner, evaluator and deployment infrastructure.
- **Rohinth:** interface, report screens, evidence viewer, trial timeline, comparisons and demo-storefront presentation.

Read [team tasks](docs/TEAM_TASKS.md), [API contract](docs/API_CONTRACT.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md) and [backend runbook](docs/BACKEND_RUNBOOK.md) for implementation details. The published types in `shared/types.ts` are the frontend/backend contract.
