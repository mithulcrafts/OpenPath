import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { dataDir, env } from './config.js';
import type { BudgetStatus } from '../shared/types.js';

// Official catalogue checked 2026-10-30:
// https://tokenfactory.nebius.com/model-catalog.md
// These two models cost $0.06/M input and $0.24/M output tokens. Each bounded
// request reserves $0.02 before dispatch, with no refund for errors/timeouts.
// This deliberately exceeds twice the byte-based estimate plus 8,192 framing
// tokens. It is an application guard, not a provider-side account balance.
export const BUDGET_MODELS = new Set(['nvidia/Nemotron-3_5-Lightning', 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B']);
export const MAX_REQUEST_BYTES = 65536;
export const MAX_OUTPUT_TOKENS = 2600;
const RESERVATION_CENTS = 2;
const MAX_BUDGET_CENTS = 100;
const ledgerSchema = z.object({ version: z.literal(1), calls: z.number().int().min(0).max(50), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), reportedCostUsd: z.number().nonnegative(), halted: z.boolean() }).strict();
type Ledger = z.infer<typeof ledgerSchema>;
export class BudgetError extends Error {}
const newLedger = (): Ledger => ({ version: 1, calls: 0, inputTokens: 0, outputTokens: 0, reportedCostUsd: 0, halted: false });
const limitCents = () => {
  const limit = Number(env('OPENPATH_AI_BUDGET_USD', '1'));
  return Number.isFinite(limit) && limit >= 0 ? Math.min(MAX_BUDGET_CENTS, Math.floor(limit * 100)) : 0;
};

export class SpendGuard {
  private limit: number;
  constructor(private directory = dataDir(), limit = limitCents()) {
    this.limit = Number.isFinite(limit) ? Math.max(0, Math.min(MAX_BUDGET_CENTS, Math.floor(limit))) : 0;
  }
  private get filename() { return path.join(this.directory, 'ai-budget.json'); }
  private read(): Ledger {
    if (!existsSync(this.filename)) return newLedger();
    try { return ledgerSchema.parse(JSON.parse(readFileSync(this.filename, 'utf8'))); }
    catch { throw new BudgetError('AI spending ledger is unreadable. Paid calls are blocked; restore the ledger before retrying.'); }
  }
  private update(change: (ledger: Ledger) => void) {
    mkdirSync(this.directory, { recursive: true });
    const lock = this.filename + '.lock';
    let handle: number;
    try { handle = openSync(lock, 'wx'); }
    catch { throw new BudgetError('AI spending ledger is locked. Paid calls are blocked until the existing operation is resolved.'); }
    try {
      const ledger = this.read(); change(ledger);
      const temp = this.filename + '.tmp';
      writeFileSync(temp, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      renameSync(temp, this.filename);
    } finally { closeSync(handle); unlinkSync(lock); }
  }
  status(): BudgetStatus {
    try {
      const ledger = this.read();
      const reservedUsd = ledger.calls * RESERVATION_CENTS / 100;
      const blocked = existsSync(this.filename + '.lock') || ledger.halted || ledger.calls * RESERVATION_CENTS + RESERVATION_CENTS > this.limit;
      return { limitUsd: this.limit / 100, reservedUsd, estimatedUsageUsd: ledger.reportedCostUsd, calls: ledger.calls, blocked,
        message: blocked ? 'Paid calls paused by the application spending guard.' : 'Each bounded call reserves $0.02. This installation stops at $1 or the lower configured limit.',
        scope: 'This data directory only. Other apps, teammates, prior usage and provider billing are not included.' };
    } catch (error) {
      return { limitUsd: this.limit / 100, reservedUsd: 0, estimatedUsageUsd: 0, calls: 0, blocked: true, message: error instanceof Error ? error.message : 'Spending guard unavailable.', scope: 'Ledger unreadable; usage totals are unknown.' };
    }
  }
  reserve(model: string, requestBytes: number, outputTokens: number) {
    if (!BUDGET_MODELS.has(model)) throw new BudgetError('This model is not covered by the $1 spending guard. Select a supported NVIDIA Lightning or Nano model.');
    if (!Number.isInteger(requestBytes) || requestBytes < 0 || requestBytes > MAX_REQUEST_BYTES || !Number.isInteger(outputTokens) || outputTokens < 1 || outputTokens > MAX_OUTPUT_TOKENS) {
      throw new BudgetError('Model input/output exceeds the bounded spending policy. No paid request was sent.');
    }
    this.update(ledger => {
      if (ledger.halted || ledger.calls * RESERVATION_CENTS + RESERVATION_CENTS > this.limit) throw new BudgetError('Application AI budget reached. Paid calls are paused; deterministic audits and saved reports remain available.');
      ledger.calls++;
    });
    return RESERVATION_CENTS / 100;
  }
  recordUsage(usage?: { inputTokens: number; outputTokens: number }) {
    if (!usage) return; // The full reservation remains counted when usage is unknown.
    this.update(ledger => {
      const valid = [usage.inputTokens, usage.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0);
      if (!valid) { ledger.halted = true; return; }
      const cost = usage.inputTokens * 0.06 / 1_000_000 + usage.outputTokens * 0.24 / 1_000_000;
      ledger.inputTokens += usage.inputTokens; ledger.outputTokens += usage.outputTokens; ledger.reportedCostUsd += cost;
      // Fail closed if provider accounting ever contradicts our reservation.
      if (cost > RESERVATION_CENTS / 100 || usage.outputTokens > MAX_OUTPUT_TOKENS) ledger.halted = true;
    });
  }
}
export const budgetStatus = () => new SpendGuard().status();
