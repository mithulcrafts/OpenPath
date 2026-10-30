# Frontend/backend contract

This is the implemented backend contract. Shared TypeScript types are published under `shared/types.ts`.

## Common behavior

- Base path: `/api` on the application's origin.
- Requests use JSON, except artifact and Markdown downloads.
- Errors use `{ "error": "A readable explanation." }` with a suitable HTTP status.
- Send same-origin cookies. A hosted deployment may require a shared access token through `/api/auth`.
- Identifiers are opaque strings. Do not derive file paths from them in the UI.
- Poll active jobs approximately every 1–2 seconds; stop polling on terminal states.

## Health and connection

### `GET /api/health`

```json
{
  "version": "0.1.0",
  "model": "configured NVIDIA model identifier",
  "ai": "unconfigured",
  "aiMessage": "A readable connection status.",
  "aiEnabled": true,
  "trialMode": "scripted-demo",
  "browserInstalled": true,
  "demoUrl": "server-provided broken-demo URL",
  "fixedDemoUrl": "server-provided fixed-demo URL",
  "demoAvailable": false,
  "activeJobs": 0,
  "queuedJobs": 0,
  "needsAuth": false
}
```

`ai` is one of `unconfigured`, `configured`, `verified`, `error`. A present key is not a verified connection.

`aiEnabled: false` means the server explicitly disables model calls, even when a key exists. `trialMode` is `live` when a key is configured, `scripted-demo` when the no-key storefront fallback is enabled, or `unavailable`. A `live` mode is configured availability, not proof that inference works; inspect `ai` and actual run records.

`demoAvailable` is true only when the demo-page module is installed. Hide or disable demo actions when false.

### `POST /api/auth`

Body: `{ "token": "installation access token" }`. Success: `{ "ok": true }` and an HTTP-only session cookie. Do not log or persist the token in client storage.

Protected installations redirect `/` to a server-owned `/login` page. Its form establishes the session and opens the React application. HTTPS reverse proxies must be explicitly configured in `TRUST_PROXY` for secure cookies and correct request protocol handling.

### `POST /api/connection/test`

Runs a minimal live tool-calling check. Returns `{ "ok": true, "inference": [...] }` on verified success; otherwise the standard error response. Read health again for the updated state.

### `GET /api/budget`

Authenticated, read-only spending status: `{limitUsd, reservedUsd, estimatedUsageUsd, calls, blocked, message, scope}`. The same object appears as optional `health.budget` for authorized callers. `reservedUsd` is the conservative amount reserved before requests, not the provider bill; `estimatedUsageUsd` uses reported tokens and the checked rates. Missing usage stays fully reserved. The installation cap defaults to USD 1 and cannot be raised above USD 1 through the environment. See `LIVE_VERIFICATION.md` for scope and persistence requirements. Disable paid actions when `blocked`; reading reports and deterministic audits remains available. Never call the connection test automatically during polling.

### Inference record fields

Audits and task runs also include optional `inference[]`, populated only by actual SDK calls. Each record contains `provider` (`nebius` or `custom`), `endpointOrigin`, `requestedModel`, optional `responseModel`, response/request IDs when supplied, tool name, time, duration, status, optional reported token usage, and a sanitized error. See `InferenceRecord` in `shared/types.ts`.

These records never contain API keys, authorization headers, prompts or complete model responses. They are application observations, not independent provider attestations. Local mock tests are classified as `custom`; scripted runs have no inference records. Missing token usage is unknown, not zero.

Paid call records also include optional `reservedUsd`. Unknown external providers are rejected by the spending policy; loopback fake providers remain available for credit-free tests.

The queued model name is retained for each job. Credentials and endpoint settings are captured when execution starts and remain fixed during that job. Editing `.env` does not retroactively verify new credentials or change an in-progress run's model. A comparison still needs manual review of recorded provider/response-model metadata; matching requested model names alone do not establish equivalent provider deployments.

## Audits

### `POST /api/audits`

Body: `{ "url": "https://example.com", "compareWith": "optional previous audit ID" }`.

Response: `{ "id": "audit ID" }`, HTTP 202.

A controlled demo URL on the current installation's visible origin (including `localhost` or a configured HTTPS proxy) is normalized to the exact server-local demo origin. Other local/private targets remain blocked.

### `GET /api/audits/:id/comparison`

Uses this audit's stored `compareWith` link. Both audits must be complete. Returns `AuditComparison`: before/after IDs, page scope, `scopeMatched`, separate pass/warning/fail/untested counts, and stable check-ID transitions with evidence IDs from each audit.

Transitions are `improved`, `regressed`, `unchanged` or `unverified`. Missing pages, failed inspections or untested checks do not establish a fix. Only controlled broken/fixed paths receive automatic path equivalence; different public staging and production URLs remain unmatched. Markdown fix-kit exports include this comparison when available.

### `GET /api/runs/:id/comparison`

Uses the run's stored `compareWith` link. Both attempts must finish. Returns `RunComparison`: actual outcomes/checks, action counts, durations, model names, comparability reasons and a transition. Model settings, success conditions and recorded provider/deployment metadata must match. An inconclusive attempt cannot establish improvement. Two successful scripted attempts are reported as unchanged, with an explicit no-NVIDIA limitation.

Comparison endpoints return 404 when a linked record is missing and 409 while either record is unfinished. They are protected by the same installation authentication as report endpoints.

### `GET /api/audits`

Response: `{ "audits": [...] }`. Each summary contains `id`, `url`, `domain`, `status`, `createdAt`, optional `completedAt`, `pageCount`, `findingCount`, `highCount`, `isDemo`, and `modelMode`.

### `GET /api/audits/:id`

Returns an Audit object directly:

- Identity: `id`, `url`, `domain`, `isDemo`, optional `compareWith`.
- State: `status`, `createdAt`, optional `completedAt`, `progress`, optional `error`.
- `status`: `queued`, `crawling`, `analyzing`, `complete`, or `failed`.
- Activity: `events[]` with `time` and `message`.
- Evidence: `pages[]` and `evidence[]`.
- Results: `findings[]`, `checks[]`, `summary`, optional `suggestedTask`, `limitations[]`.
- Model: `{ mode: 'pending' | 'rules' | 'nemotron', name, note }`.

Each page includes `rawHtmlCaptured`, indicating whether the initial document response from the browser navigation was available for comparison. A failed capture is not evidence of a JavaScript rendering barrier.

Categories: `discovery`, `readability`, `interactions`, `integrations`.

Finding fields: `id`, `category`, `severity`, `title`, `observation`, `impact`, `profiles[]`, `kind`, `evidenceIds[]`, `fix`, optional `code`, `verification`, `source`.

- Severity: `high`, `medium`, `low`, `info`.
- Profiles: `html`, `browser`, `api`.
- Kind: `observed` or `recommendation`.
- Source: `rule` or `nemotron`.

Check fields: `id`, `category`, `name`, `status`, `detail`, `evidenceIds[]`.

- Check status: `pass`, `warning`, `fail`, `not_tested`.

Evidence fields: `id`, `pageId`, `url`, `description`, optional `snippet`, `selector`, `screenshot`.

Never render page snippets, model text or code examples as raw HTML. Screenshots use server-provided artifact URLs.

### `GET /api/audits/:id/fix-kit`

Download a UTF-8 Markdown file. The endpoint includes scope, findings, evidence, proposed changes and verification steps.

Optional query: `?capability=compare-products&profile=browser`. Capability IDs come from `getCapabilities(audit)` in `shared/capabilities.ts`; profiles are `html`, `browser` and `api`. This exports the selected capability's observed route, scoped evidence, unknowns, proposed changes and verification plan. Unrecognized IDs or profiles return 400. Omitting the query preserves the full inspection export.

## Browser trials

### `POST /api/runs`

Body:

```json
{
  "auditId": "existing audit ID",
  "goal": "Open the pricing page.",
  "assertions": [{ "kind": "url_contains", "value": "/pricing" }],
  "compareWith": "optional previous run ID"
}
```

Response: `{ "id": "run ID" }`, HTTP 202.

Public-site assertions: `url_contains` or `visible_text`, with a nonempty `value`. They verify only the stated condition. Do not label a payment or business process complete based merely on a URL match.

For the built-in demo, the backend can provide the fixed cart task and independent `fixture_cart` assertion. Omit `goal` and `assertions` to request that demo task. This shortcut is not accepted for arbitrary sites.

When no key is configured and `OPENPATH_DEMO_MODE=true`, only that standard demo task can use the scripted fallback. These runs identify themselves with `model: openpath-demo-simulator` and `promptVersion: openpath-demo-v1`. Show “Scripted demo — no model called” before and during the run as well as in results. Never compare this run with a live NVIDIA run as evidence of model improvement. Paired comparisons require the same model, prompt version, profile, action/time budgets, goal and assertions.

### `GET /api/runs?auditId=...`

Response: `{ "runs": [...] }`.

### `GET /api/runs/:id`

Returns a TaskRun directly:

- Identity: `id`, `auditId`, `startUrl`, `goal`, optional `compareWith`.
- Status: `queued`, `running`, `complete`.
- Outcome: `completed`, `failed`, `blocked`, `inconclusive` after completion.
- Explanation: `explanation`, optional `cause`.
- Evidence: `steps[]`, `checks[]`, optional `trace` URL.
- Settings: `model`, `profile`, `promptVersion`, `maxSteps`, `maxDurationMs`.
- Timing: `createdAt`, optional `completedAt`, `durationMs`.

Step fields: `index`, `time`, `url`, `action`, optional `target`, `result`, optional `screenshot`, optional `error`, `durationMs`.

Independent check fields: `description`, `passed`, `actual`.

Do not equate `status: complete` with success. Only `outcome: completed` indicates the independent conditions passed.

## Artifacts

### `GET /api/artifacts/:id/:name`

Serves an authorised screenshot, observation file or trace. Use the exact returned URL. Do not enumerate the artifact directory.

## Demo-site integration

`demo-site/pages.ts` exports:

```ts
export function renderDemoPage(
  variant: 'broken' | 'fixed',
  page: 'home' | 'product' | 'about' | 'developers'
): string;
```

Return a complete HTML document. Keep demo navigation under `/demo/{variant}/`. The demo can use inline CSS and JavaScript, with no external credentials or services.

The backend mounts those pages and implements:

- `GET /demo/api/cart`: `{ "items": [...] }` for the current HTTP-only session.
- `POST /demo/api/cart`: accepts `{ "sku": "everyday-tee", "color": "blue", "size": "M", "quantity": 1 }` and returns the cart state.
- `POST /demo/api/cart/reset`: empties the current sandbox cart.

The UI must send real requests and display actual returned state. The evaluator reads server-side state independently. Missing demo pages should be labelled unavailable, never replaced with fake success.
