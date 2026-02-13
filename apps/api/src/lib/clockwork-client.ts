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

export class ClockworkApiError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly responseText: string;

  constructor(status: number, path: string, responseText: string) {
    super(`Clockwork API error ${status} on ${path}: ${responseText}`);
    this.name = 'ClockworkApiError';
    this.status = status;
    this.path = path;
    this.responseText = responseText;
  }
}

interface ClockworkFetchOptions {
  token?: string;
  allowEnvFallback?: boolean;
}

async function clockworkFetch<T>(
  path: string,
  options: RequestInit = {},
  fetchOptions: ClockworkFetchOptions = {},
): Promise<T> {
  const url = `${env.CLOCKWORK_API_BASE_URL}${path}`;
  const { token, allowEnvFallback = true } = fetchOptions;
  const resolvedToken = token || (allowEnvFallback ? env.CLOCKWORK_API_TOKEN : '');
  if (!resolvedToken) {
    throw new Error('Clockwork token is required');
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${resolvedToken}`,
      ...options.headers,
    },
  });

  // Print full curl for the current request
  const curlCmd = [
    'curl',
    '-X', options.method || 'GET',
    '-H', 'Content-Type: application/json',
    '-H', `Authorization: Token ${resolvedToken}`,
    ...(options.body ? ['-d', options.body as string] : []),
    `"${url}"`,
  ].join(' ');
  
  console.log(curlCmd);

  if (!res.ok) {
    const text = await res.text();
    throw new ClockworkApiError(res.status, path, text);
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

export async function validateClockworkToken(
  accountId: string,
  token: string,
  date?: string,
): Promise<void> {
  const targetDate =
    date ?? new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10);
  const params = new URLSearchParams([
    ['account_id', accountId],
    ['starting_at', targetDate],
    ['ending_at', targetDate],
  ]);

  await clockworkFetch<RawWorklog[]>(
    `/worklogs?${params.toString()}`,
    undefined,
    { token, allowEnvFallback: false },
  );
}

/**
 * Start a new timer for the given issue.
 */
export async function startTimer(issueKey: string, comment?: string, token?: string): Promise<void> {
  const payload = { issue_key: issueKey, ...(comment ? { comment } : {}) };

  await clockworkFetch<unknown>('/start_timer', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { token });
}

/**
 * Stop a running timer by issue key.
 */
export async function stopTimer(issueKey: string, token?: string): Promise<void> {
  await clockworkFetch<unknown>('/stop_timer', {
    method: 'POST',
    body: JSON.stringify({ issue_key: issueKey }),
  }, { token });
}
