# Frontend/backend contract

This is the initial implementation contract. Shared TypeScript types will be published under `shared/types.ts`. Mithul owns contract changes; Rohinth owns the consuming UI.

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

`demoAvailable` is true only when the demo-page module is installed. Hide or disable demo actions when false.

### `POST /api/auth`

Body: `{ "token": "installation access token" }`. Success: `{ "ok": true }` and an HTTP-only session cookie. Do not log or persist the token in client storage.

### `POST /api/connection/test`

Runs a minimal live tool-calling check. Return `{ "ok": true }` on verified success; otherwise the standard error response. Read health again for the updated state.

## Audits

### `POST /api/audits`

Body: `{ "url": "https://example.com", "compareWith": "optional previous audit ID" }`.

Response: `{ "id": "audit ID" }`, HTTP 202.

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

Rohinth provides `demo-site/pages.ts` exporting:

```ts
export function renderDemoPage(
  variant: 'broken' | 'fixed',
  page: 'home' | 'product' | 'about' | 'developers'
): string;
```

Return a complete HTML document. Keep demo navigation under `/demo/{variant}/`. The demo can use inline CSS and JavaScript, with no external credentials or services.

Mithul mounts those pages and implements:

- `GET /demo/api/cart`: `{ "items": [...] }` for the current HTTP-only session.
- `POST /demo/api/cart`: accepts `{ "sku": "everyday-tee", "color": "blue", "size": "M", "quantity": 1 }` and returns the cart state.
- `POST /demo/api/cart/reset`: empties the current sandbox cart.

The UI must send real requests and display actual returned state. The evaluator reads server-side state independently. Missing demo pages should be labelled unavailable, never replaced with fake success.
