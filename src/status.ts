import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { DigestRow } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

// ok / fail: jobs by their last status. retry: retry lines, summed over jobs.
export type Counts = { ok: number; retry: number; fail: number };

// empty: the file has no lines. unreadable: no counts to show; the view renders "—".
export type NightCounts =
  | { kind: 'counts'; counts: Counts }
  | { kind: 'empty' }
  | { kind: 'unreadable' };

export type NightSummary = { night: string; counts: NightCounts };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function countRows(rows: DigestRow[]): Counts {
  return {
    ok: rows.filter((r) => r.lastStatus === 'ok').length,
    retry: rows.reduce((n, r) => n + r.retries, 0),
    fail: rows.filter((r) => r.lastStatus === 'fail').length,
  };
}

function summarize(runsDir: string, night: string): NightSummary {
  try {
    const n = readNight(runsDir, night);
    if (n.kind === 'empty') return { night, counts: { kind: 'empty' } };
    if (n.kind === 'read') return { night, counts: { kind: 'counts', counts: countRows(n.rows) } };
  } catch {
    // an unreadable night keeps its link
  }
  return { night, counts: { kind: 'unreadable' } };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarize(config.runsDir, n)),
  };
}
