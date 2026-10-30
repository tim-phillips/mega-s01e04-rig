import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};
const jobs = [
  'digest/render',
  'fixtures/refresh',
  'lane/sync',
  'notes/backup',
  'rig/rotate-logs',
];

describe('digest page', () => {
  it('renders the night as a table, with — for a missing owner', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of jobs) expect(html).toContain(job);
    expect(html).toContain('<td>—</td>');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2020-01-01');
    expect(res.status).toBe(404);
  });
});
