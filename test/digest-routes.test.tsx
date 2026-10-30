import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: dir,
};
const app = createApp(config);

const line = (job: string, status: string, owner: string | null, at: string) =>
  JSON.stringify({ at, job, status, owner });

// Two jobs, one retry, one bad line; written out of job order to check the sort.
writeFileSync(
  join(dir, '2026-02-01.jsonl'),
  [
    line('zeta/sync', 'ok', 'rook', '2026-02-01T01:00:00+01:00'),
    line('alpha/backup', 'retry', null, '2026-02-01T01:05:00+01:00'),
    '{"at":"2026-02-01T01:06:00+01:00","job":"alp',
    line('alpha/backup', 'ok', null, '2026-02-01T01:10:00+01:00'),
    '',
  ].join('\n'),
);
writeFileSync(join(dir, '2026-02-02.jsonl'), '');
writeFileSync(
  join(dir, '2026-02-03.jsonl'),
  `${line('only/job', 'ok', 'rook', '2026-02-03T01:00:00+01:00')}\n`,
);

type Body = {
  kind: string;
  rows: { job: string; retries: number }[];
  badLines: number;
};

describe('GET /digest/:night', () => {
  it('renders a night that exists', async () => {
    const res = await app.request('/digest/2026-02-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('only/job');
    expect(html).not.toContain('could not be read');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('notes the bad line and shows — for a missing owner', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('<td>—</td>');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns a night that exists', async () => {
    const res = await app.request('/api/digest/2026-02-03');
    const body = (await res.json()) as Body;
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ kind: 'read', badLines: 0 });
    expect(body.rows.map((r) => r.job)).toEqual(['only/job']);
  });

  it('404s a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ kind: 'missing', night: '2026-01-01' });
  });

  it('returns kind empty with 200 for an empty night', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'empty', night: '2026-02-02' });
  });

  it('counts the bad line', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    const body = (await res.json()) as Body;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.find((r) => r.job === 'alpha/backup')?.retries).toBe(1);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const body = (await (
      await app.request('/api/digest/2026-02-01')
    ).json()) as Body;
    const html = await (await app.request('/digest/2026-02-01')).text();
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha/backup', 'zeta/sync']);
    const shown = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(shown).toEqual(jobs);
  });
});
