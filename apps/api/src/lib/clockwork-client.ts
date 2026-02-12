import { env } from './env';
import type { Worklog } from './types';

// ─── Raw Clockwork Pro REST API types ─────────────────────────────────────────

interface RawWorklog {
  id: string;
  issueId: string;
  timeSpentSeconds: number;
  started: string;
  comment?: string;
  author: {
    accountId: string;
  };
}

// ─── Base HTTP helper ─────────────────────────────────────────────────────────

async function clockworkFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${env.CLOCKWORK_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${env.CLOCKWORK_API_TOKEN}`,
      ...options.headers,
    },
  });

  // Print full curl for the current request
  const curlCmd = [
    'curl',
    '-X', options.method || 'GET',
    '-H', 'Content-Type: application/json',
    '-H', `Authorization: Token ${env.CLOCKWORK_API_TOKEN}`,
    ...(options.body ? ['-d', options.body as string] : []),
    `"${url}"`,
  ].join(' ');
  
  console.log(curlCmd);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockwork API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Data transformers ────────────────────────────────────────────────────────

function transformWorklog(raw: RawWorklog): Worklog {
  return {
    id: Number(raw.id),
    issueId: Number(raw.issueId),
    timeSpentSeconds: raw.timeSpentSeconds,
    started: raw.started,
    comment: raw.comment ?? null,
    author: { accountId: raw.author.accountId },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch today's worklogs for a user.
 * @param accountId - The user's accountId (used to filter by author)
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 */
export async function getWorklogs(accountId: string, date?: string): Promise<Worklog[]> {
  const targetDate =
    date ?? new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10);
  const params = new URLSearchParams([
    ['account_id', accountId],
    ['starting_at', targetDate],
    ['ending_at', targetDate],
  ]);

  const data = await clockworkFetch<RawWorklog[]>(`/worklogs?${params.toString()}`);

  return data.map(transformWorklog);
}

/**
 * Start a new timer for the given issue.
 */
export async function startTimer(issueKey: string, comment?: string): Promise<void> {
  const payload = { issue_key: issueKey, ...(comment ? { comment } : {}) };

  await clockworkFetch<unknown>('/start_timer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Stop a running timer by issue key.
 */
export async function stopTimer(issueKey: string): Promise<void> {
  await clockworkFetch<unknown>('/stop_timer', {
    method: 'POST',
    body: JSON.stringify({ issue_key: issueKey }),
  });
}
