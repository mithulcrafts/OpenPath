# Live NVIDIA verification — 30 October 2026

The local production application completed a real Nebius Token Factory verification at 14:17 UTC with `nvidia/Nemotron-3_5-Lightning`. This was not the scripted demo or a mocked endpoint.

| Check | Observed result |
| --- | --- |
| Named structured tool call | Passed |
| Broken storefront review | Completed with NVIDIA recommendations; one deterministic warning |
| Fixed storefront review | Completed with NVIDIA recommendations; zero deterministic warnings |
| Broken storefront browser task | Completed; independent server-owned cart check passed; three model actions |
| Fixed storefront browser task | Completed; independent server-owned cart check passed; three model actions |
| Paired task comparison | Unchanged: both attempts succeeded |
| Browser action errors | Zero in both attempts |
| Requests | Nine total: one connection check, two reviews, six browser decisions |
| Provider-reported tokens | 11,491 input; 2,592 output |
| Usage estimate | USD 0.00131154 at the checked model rates |
| Conservative application reservation | USD 0.18 against a USD 1 cap |

The fixed run took 7,898 ms and the broken run 9,658 ms. One attempt per variant cannot establish a performance improvement. A static warning does not prove an agent cannot finish the task. Do not claim that the broken task failed or that OpenPath automatically repaired the source.

A subsequent public-site audit of `https://example.com` also completed with live NVIDIA review (1,716 input and 924 output tokens). Across these ten paid calls the usage estimate is USD 0.00163626, while the guard reserves USD 0.20. No further live calls are needed merely to repeat these passing checks.

The full local report is ignored by Git under `data/verification/live-1793369841284.json`. It contains the actual audit/run IDs, provider/model metadata, usage and comparison results. API keys and prompts are not included in inference metadata. Screenshot and trace files remain in the local data directory. Do not publish unrelated private-site audit data.

## Credit protection

- `OPENPATH_AI_BUDGET_USD` defaults to 1. Values above 1 are clamped to 1; lower values are allowed.
- Before each paid request, the server atomically reserves USD 0.02 in `data/ai-budget.json`. Reservations remain counted after errors, timeouts and restarts.
- Only the priced NVIDIA Lightning and Nano model IDs are allowed. Inputs are limited to 65,536 request bytes and outputs to 2,600 tokens, with smaller limits for actions and connection checks. Automatic SDK retries are disabled.
- Unknown models, corrupt/locked ledgers and exhausted budgets block calls. Deterministic audits and saved reports remain available.
- `GET /api/budget` reports the limit, conservative reservation, usage estimate and stop state. These totals cover this installation/data directory only. They cannot control another app's requests or account-wide charges.
- Keep the data directory and budget ledger. Do not delete the ledger, change data directories or run a second paid installation to reset the cap. A teammate using the same key must coordinate separate usage.
- Provider prices are from the [official catalogue](https://tokenfactory.nebius.com/model-catalog.md), checked 30 October 2026: USD 0.06/M input and USD 0.24/M output tokens. The usage figure is an estimate, not a billing statement or live remaining-credit balance.
