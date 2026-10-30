import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28', () => {
  const night = readNight('runs', '2026-10-28');
  if (night.kind !== 'read') throw new Error(`expected a read night, got ${night.kind}`);

  it('has 5 jobs sorted by job and counts the truncated line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('folds a job into runs, retries, last status and last error, times as logged', () => {
    expect(night.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night.rows.find((r) => r.job === 'lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });
    expect(night.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('keeps a job whose owner is null', () => {
    expect(night.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, lastError: null });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reports a night with no file as missing', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ kind: 'missing', night: '2026-01-01' });
  });

  it('treats a night that is not a date as missing', () => {
    expect(readNight('runs', '../package')).toEqual({ kind: 'missing', night: '../package' });
  });

  it('reports an empty file as empty', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ kind: 'empty', night: '2026-01-02' });
  });

  it('counts valid JSON of the wrong shape as a bad line', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n{"job":"a","status":"maybe"}\n[]\n',
    );
    const night = readNight(dir, '2026-01-03');
    expect(night).toMatchObject({ kind: 'read', badLines: 2 });
    if (night.kind === 'read') expect(night.rows).toHaveLength(1);
  });
});
