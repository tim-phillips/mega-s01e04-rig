// The night's run log, one row per job. Implemented in ./read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  // null when the log has no owner for the job; the view renders it as "—".
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  // The most recent error the job logged, even if a later run succeeded.
  lastError: string | null;
  // As written in the log, offset included; never converted to UTC.
  firstAt: string;
  lastAt: string;
};

// missing: no runs/<night>.jsonl, or night isn't YYYY-MM-DD. empty: the file has no lines.
// read: rows sorted by job, plus the count of lines that didn't parse (never thrown).
export type Night =
  | { kind: 'missing'; night: string }
  | { kind: 'empty'; night: string }
  | { kind: 'read'; night: string; rows: DigestRow[]; badLines: number };

export type ReadNight = (runsDir: string, night: string) => Night;
