import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('digest json', () => {
  it('returns the night as read, rows in job order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = (await res.json()) as {
      kind: string;
      rows: { job: string }[];
      badLines: number;
    };
    expect(res.status).toBe(200);
    expect(body.kind).toBe('read');
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    expect(body.badLines).toBe(1);
  });

  it('404s a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ kind: 'missing', night: '2026-01-01' });
  });
});
