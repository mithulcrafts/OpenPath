import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { BudgetError, SpendGuard, MAX_REQUEST_BYTES } from '../server/budget.js';

const model = 'nvidia/Nemotron-3_5-Lightning';
function fixture(run: (directory: string) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), 'openpath-budget-'));
  try { run(directory); }
  finally {
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('openpath-budget-')) throw new Error('Unsafe test cleanup path.');
    rmSync(target, { recursive: true });
  }
}

test('paid requests reserve before dispatch, survive restart and stop at the cap', () => fixture(directory => {
  const first = new SpendGuard(directory, 4);
  first.reserve(model, 1500, 600);
  first.recordUsage({ inputTokens: 100, outputTokens: 20 });
  const restarted = new SpendGuard(directory, 4);
  assert.equal(restarted.status().calls, 1);
  assert.equal(restarted.status().reservedUsd, 0.02);
  assert(restarted.status().estimatedUsageUsd < 0.02);
  restarted.reserve(model, 1500, 600);
  assert.throws(() => first.reserve(model, 1500, 600), BudgetError);
  assert.equal(restarted.status().calls, 2);
  assert.equal(restarted.status().blocked, true);
}));

test('unpriced models and oversized inputs are rejected without reserving or sending', () => fixture(directory => {
  const guard = new SpendGuard(directory);
  assert.throws(() => guard.reserve('unknown-expensive-model', 100, 600), /not covered/);
  assert.throws(() => guard.reserve(model, MAX_REQUEST_BYTES + 1, 600), /exceeds/);
  assert.throws(() => guard.reserve(model, 100, 2601), /exceeds/);
  assert.equal(guard.status().calls, 0);
}));

test('missing usage retains the complete reservation', () => fixture(directory => {
  const guard = new SpendGuard(directory);
  guard.reserve(model, 100, 600); guard.recordUsage();
  assert.equal(guard.status().reservedUsd, 0.02);
  assert.equal(guard.status().estimatedUsageUsd, 0);
}));

test('corrupt or locked ledgers fail closed instead of resetting the budget', () => fixture(directory => {
  const guard = new SpendGuard(directory);
  writeFileSync(path.join(directory, 'ai-budget.json'), 'corrupt');
  assert.equal(guard.status().blocked, true);
  assert.throws(() => guard.reserve(model, 100, 600), /unreadable/);
  writeFileSync(path.join(directory, 'ai-budget.json.lock'), '');
  assert.throws(() => guard.reserve(model, 100, 600), /locked/);
}));

test('unexpected provider usage halts later calls', () => fixture(directory => {
  const guard = new SpendGuard(directory);
  guard.reserve(model, 100, 600);
  guard.recordUsage({ inputTokens: 100, outputTokens: 3000 });
  assert.equal(guard.status().blocked, true);
  assert.throws(() => guard.reserve(model, 100, 600), /budget reached/);
}));

test('zero budget makes no reservation', () => fixture(directory => {
  const guard = new SpendGuard(directory, 0);
  assert.equal(guard.status().blocked, true);
  assert.throws(() => guard.reserve(model, 100, 600), BudgetError);
  assert.equal(guard.status().calls, 0);
}));

test('the lifetime cap cannot be raised above one dollar', () => fixture(directory => {
  const guard = new SpendGuard(directory, 2500);
  assert.equal(guard.status().limitUsd, 1);
  for (let index = 0; index < 50; index++) guard.reserve(model, 100, 128);
  assert.throws(() => guard.reserve(model, 100, 128), BudgetError);
  assert.equal(new SpendGuard(directory, 2500).status().reservedUsd, 1);
}));
