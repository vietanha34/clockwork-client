import { env } from './env';
import type { RawClockworkTimer, RawClockworkTimersResponse, Timer, Worklog } from './types';

// ─── Raw Clockwork Pro REST API types ─────────────────────────────────────────

interface RawWorklog {
  id: number;
  issue: { key: string; id: number };
  timeSpentSeconds: number;
  started: string;
  comment: string | null;
  author: {
    accountId: string;
    emailAddress: string;
    displayName: string;
    avatarUrls?: { '48x48': string };
  };
}

interface RawWorklogsResponse {
  results: RawWorklog[];
  startAt: number;
  maxResults: number;
  total: number;
}

interface StartTimerPayload {
  issueKey: string;
  comment?: string;
}

// ─── Base HTTP helper ─────────────────────────────────────────────────────────

async function clockworkFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${env.CLOCKWORK_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Clockwork-Token': env.CLOCKWORK_API_TOKEN,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockwork API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Data transformers ────────────────────────────────────────────────────────

function transformTimer(raw: RawClockworkTimer): Timer {
  return {
    id: raw.id,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    comment: raw.comment,
    runningFor: raw.running_for,
    tillNow: raw.till_now,
    worklogCount: raw.worklog_count,
    issue: { key: raw.issue.key, id: raw.issue.id },
  };
}

function transformWorklog(raw: RawWorklog): Worklog {
  return {
    id: raw.id,
    issueKey: raw.issue.key,
    issueId: raw.issue.id,
    timeSpentSeconds: raw.timeSpentSeconds,
    started: raw.started,
    comment: raw.comment,
    author: {
      accountId: raw.author.accountId,
      emailAddress: raw.author.emailAddress,
      displayName: raw.author.displayName,
      avatarUrl: raw.author.avatarUrls?.['48x48'],
    },
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
    ['accountId', accountId],
    ['from', targetDate],
    ['to', targetDate],
  ]);

  const data = await clockworkFetch<RawWorklogsResponse>(`/worklogs?${params.toString()}`);

  return data.results.map(transformWorklog);
}

/**
 * Start a new timer for the given issue.
 */
export async function startTimer(issueKey: string, comment?: string): Promise<Timer> {
  const payload: StartTimerPayload = { issueKey, ...(comment ? { comment } : {}) };

  const data = await clockworkFetch<RawClockworkTimersResponse>('/timers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const timer = data.timers[0];
  if (!timer) {
    throw new Error('No timer returned from Clockwork API start response');
  }

  return transformTimer(timer);
}

/**
 * Stop a running timer by its ID.
 */
export async function stopTimer(timerId: number): Promise<Timer> {
  const data = await clockworkFetch<{ timer: RawClockworkTimer }>(`/timers/${timerId}/stop`, {
    method: 'POST',
  });

  return transformTimer(data.timer);
}
