import { fetch } from '@tauri-apps/plugin-http';
import type {
  ActiveTimersResponse,
  Issue,
  SearchIssuesResponse,
  SettingsValidationError,
  SettingsValidationField,
  Worklog,
  WorklogsResponse,
} from './types';

export class ApiValidationError extends Error {
  public readonly field: SettingsValidationField;

  constructor(message: string, field: SettingsValidationField) {
    super(message);
    this.name = 'ApiValidationError';
    this.field = field;
  }
}

// ─── Base Fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(apiBaseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}${path}`;
  console.log(`[API] Fetching: ${url}`, options);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    console.log(`[API] Response status: ${res.status}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`[API] Error body:`, body);
      throw new Error(
        (body as { message?: string }).message ?? `Request failed: ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();
    console.log(`[API] Success data:`, data);
    return data as T;
  } catch (error) {
    console.error(`[API] Fetch error:`, error);
    throw error;
  }
}

// ─── Timer Endpoints ──────────────────────────────────────────────────────────

export async function fetchActiveTimers(
  apiBaseUrl: string,
  accountId: string,
): Promise<ActiveTimersResponse> {
  return apiFetch<ActiveTimersResponse>(
    apiBaseUrl,
    `/api/timers/active?accountId=${encodeURIComponent(accountId)}`,
  );
}

export async function resolveUserAccountId(
  apiBaseUrl: string,
  email: string,
): Promise<{ accountId: string; emailAddress: string; displayName: string | null }> {
  return apiFetch(apiBaseUrl, `/api/users/resolve?email=${encodeURIComponent(email)}`);
}

export async function startTimer(
  apiBaseUrl: string,
  issueKey: string,
  comment?: string,
  clockworkApiToken?: string,
): Promise<void> {
  const body: { issueKey: string; comment?: string } = { issueKey };
  if (comment) body.comment = comment;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (clockworkApiToken) {
    headers['X-Clockwork-Token'] = clockworkApiToken;
  }

  await apiFetch<unknown>(apiBaseUrl, '/api/timers/start', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export async function stopTimer(
  apiBaseUrl: string,
  issueKey: string,
  accountId: string,
  timerId?: number,
): Promise<void> {
  await apiFetch<unknown>(apiBaseUrl, '/api/timers/stop', {
    method: 'POST',
    body: JSON.stringify({ issueKey, accountId, timerId }),
  });
}

export async function validateSettings(
  apiBaseUrl: string,
  payload: { accountId: string; clockworkApiToken: string },
): Promise<{
  valid: true;
  user: {
    accountId: string;
    displayName?: string;
    emailAddress?: string;
    avatarUrl?: string;
  };
}> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/api/settings/validate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errorBody = body as Partial<SettingsValidationError>;
    const field = errorBody.field ?? 'general';
    const message = errorBody.message ?? 'Settings validation failed';
    throw new ApiValidationError(message, field);
  }

  return (await res.json()) as {
    valid: true;
    user: {
      accountId: string;
      displayName?: string;
      emailAddress?: string;
      avatarUrl?: string;
    };
  };
}

// ─── Worklog Endpoints ────────────────────────────────────────────────────────

export async function fetchWorklogs(
  apiBaseUrl: string,
  accountId: string,
  date?: string,
): Promise<WorklogsResponse> {
  const params = new URLSearchParams({ accountId });
  if (date) params.set('date', date);
  return apiFetch<WorklogsResponse>(apiBaseUrl, `/api/worklogs?${params.toString()}`);
}

// ─── Issue Endpoints ──────────────────────────────────────────────────────────

export async function fetchIssue(apiBaseUrl: string, issueKey: string): Promise<Issue> {
  const res = await apiFetch<{ issue: Issue }>(
    apiBaseUrl,
    `/api/issues/${encodeURIComponent(issueKey)}`,
  );
  return res.issue;
}

export async function searchIssues(
  apiBaseUrl: string,
  query: string,
  accountId: string,
): Promise<Issue[]> {
  const params = new URLSearchParams({
    accountId,
    maxResults: '10',
  });

  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    params.set('q', trimmedQuery);
  }

  const res = await apiFetch<SearchIssuesResponse>(
    apiBaseUrl,
    `/api/issues/search?${params.toString()}`,
  );
  return res.issues;
}

// ─── Worklog helpers ──────────────────────────────────────────────────────────

export function todayDate(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function totalWorklogSeconds(worklogs: Worklog[]): number {
  return worklogs.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
}
