import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type Run = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

function isStatus(s: unknown): s is RunStatus {
  return typeof s === 'string' && STATUSES.includes(s);
}

// Valid JSON of the wrong shape counts as a bad line too.
function parseRun(line: string): Run | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isStatus(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status, owner: o.owner, error: o.error ?? null };
}

export const readNight: ReadNight = (runsDir, night): Night => {
  // night comes from a URL; anything but a date never reaches the filesystem.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return { kind: 'missing', night };

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing', night };
    throw e;
  }

  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { kind: 'empty', night };

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  // The log is append-only, so file order is time order.
  for (const line of lines) {
    const run = parseRun(line);
    if (!run) {
      badLines++;
      continue;
    }
    const row = byJob.get(run.job);
    if (!row) {
      byJob.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }
    row.owner = run.owner;
    row.runs++;
    if (run.status === 'retry') row.retries++;
    row.lastStatus = run.status;
    row.lastError = run.error ?? row.lastError;
    row.lastAt = run.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { kind: 'read', night, rows, badLines };
};
