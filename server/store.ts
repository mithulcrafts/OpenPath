import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir } from './config.js';
import type { Audit, AuditSummary, TaskRun } from '../shared/types.js';

const writes = new Map<string, Promise<void>>();
export const newId = () => randomUUID();
export const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
export function artifactDir(id: string) {
  if (!validId(id)) throw new Error('Invalid run identifier.');
  return path.join(dataDir(), 'artifacts', id);
}

async function save(kind: string, id: string, value: unknown) {
  if (!validId(id)) throw new Error('Invalid identifier.');
  const filename = path.join(dataDir(), kind, `${id}.json`);
  const contents = JSON.stringify(value, null, 2);
  const work = (writes.get(filename) || Promise.resolve()).catch(() => {}).then(async () => {
    await mkdir(path.dirname(filename), { recursive: true });
    const temp = `${filename}.tmp`;
    await writeFile(temp, contents, 'utf8');
    await rename(temp, filename);
  });
  writes.set(filename, work);
  await work;
  if (writes.get(filename) === work) writes.delete(filename);
}

async function get<T>(kind: string, id: string): Promise<T | null> {
  if (!validId(id)) return null;
  try { return JSON.parse(await readFile(path.join(dataDir(), kind, `${id}.json`), 'utf8')) as T; }
  catch { return null; }
}
async function list<T>(kind: string): Promise<T[]> {
  let files: string[];
  try { files = await readdir(path.join(dataDir(), kind)); } catch { return []; }
  const items = await Promise.all(files.filter(f => f.endsWith('.json')).map(f => get<T>(kind, f.slice(0, -5))));
  return items.filter(item => item !== null) as T[];
}
export const saveAudit = (a: Audit) => save('audits', a.id, a);
export const getAudit = (id: string) => get<Audit>('audits', id);
export const saveRun = (r: TaskRun) => save('runs', r.id, r);
export const getRun = (id: string) => get<TaskRun>('runs', id);
export async function listRuns(auditId?: string) {
  return (await list<TaskRun>('runs')).filter(r => !auditId || r.auditId === auditId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function listAudits(): Promise<AuditSummary[]> {
  return (await list<Audit>('audits')).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(a => ({
    id: a.id, url: a.url, domain: a.domain, status: a.status, createdAt: a.createdAt, completedAt: a.completedAt,
    pageCount: a.pages.length, findingCount: a.findings.length, highCount: a.findings.filter(f => f.severity === 'high').length,
    isDemo: a.isDemo, modelMode: a.model.mode,
  }));
}

export async function recoverInterruptedJobs() {
  for (const a of await list<Audit>('audits')) {
    if (!['complete', 'failed'].includes(a.status)) {
      a.status = 'failed'; a.error = 'The server restarted during this audit. Start a new audit to retry.';
      a.completedAt = new Date().toISOString(); await saveAudit(a);
    }
  }
  for (const r of await list<TaskRun>('runs')) {
    if (r.status !== 'complete') {
      r.status = 'complete'; r.outcome = 'inconclusive'; r.cause = 'infrastructure';
      r.explanation = 'The server restarted during this attempt. No website failure was inferred.';
      r.completedAt = new Date().toISOString(); await saveRun(r);
    }
  }
}

class JobQueue {
  active = 0;
  private queue: (() => Promise<void>)[] = [];
  get pending() { return this.queue.length; }
  add(task: () => Promise<void>) {
    if (this.queue.length >= 12) throw new Error('The audit queue is full. Try again shortly.');
    this.queue.push(task); this.pump();
  }
  private pump() {
    while (this.active < 2 && this.queue.length) {
      const task = this.queue.shift()!; this.active++;
      void task().catch(error => console.error('Background task failed:', error instanceof Error ? error.message : 'Unknown error'))
        .finally(() => { this.active--; this.pump(); });
    }
  }
}
export const jobs = new JobQueue();
