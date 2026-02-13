/**
 * Fetches active timer data from the Clockwork Report API
 * using a JWT token obtained via the Jira servlet.
 *
 * Endpoint: GET https://app.clockwork.report/timers.json
 */

const CLOCKWORK_REPORT_BASE = 'https://app.clockwork.report';

interface RawTimer {
  id: number;
  started_at: string;
  finished_at: string | null;
  error_messages: string[] | null;
  running_for: string;
  comment: string | null;
  started_within_working_hours: boolean | null;
  within_working_hours: boolean | null;
  issue: { key: string; id: number };
  author?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrl?: string;
  };
  till_now: number;
  worklog_count: number;
}

export interface ClockworkReportTimersResponse {
  timers: RawTimer[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
  page: number;
  pages: number;
  isFirst: boolean;
}

export class ClockworkReportApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ClockworkReportApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Fetch the active timers for the authenticated user.
 *
 * @param jwt - Clockwork JWT from the Jira servlet
 * @param jiraDomain - e.g. "vietanha34.atlassian.net" (used as xdm_e param)
 * @param page - page number (default 1)
 */
export async function fetchActiveTimers(
  jwt: string,
  jiraDomain: string,
  page = 1,
): Promise<ClockworkReportTimersResponse> {
  const params = new URLSearchParams([
    ['page', String(page)],
    ['xdm_e', `https://${jiraDomain}`],
  ]);

  const url = `${CLOCKWORK_REPORT_BASE}/timers.json?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `JWT ${jwt}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ClockworkReportApiError(
      res.status,
      `Clockwork Report API returned ${res.status}: ${text}`,
      text,
    );
  }

  return res.json() as Promise<ClockworkReportTimersResponse>;
}

interface StopTimerResponse {
  messages?: Array<{
    title?: string;
    body?: string;
    type?: string;
  }>;
  [key: string]: unknown;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const candidate = payload as {
    error_message?: unknown;
    message?: unknown;
    messages?: Array<{ title?: unknown; body?: unknown }>;
  };

  if (typeof candidate.error_message === 'string' && candidate.error_message.trim()) {
    return candidate.error_message;
  }
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message;
  }
  if (Array.isArray(candidate.messages) && candidate.messages.length > 0) {
    const first = candidate.messages[0];
    if (typeof first?.body === 'string' && first.body.trim()) return first.body;
    if (typeof first?.title === 'string' && first.title.trim()) return first.title;
  }
  return fallback;
}

/**
 * Stop a running timer by timer id using Clockwork Report API.
 */
export async function stopTimerById(
  timerId: number,
  jwt: string,
  jiraDomain: string,
): Promise<StopTimerResponse> {
  const params = new URLSearchParams([['xdm_e', `https://${jiraDomain}`]]);
  const url = `${CLOCKWORK_REPORT_BASE}/timers/${timerId}/stop.json?${params.toString()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${jwt}`,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Origin: CLOCKWORK_REPORT_BASE,
    },
    body: JSON.stringify({
      worklog: {
        comment: null,
        started: null,
        time_spent_seconds: null,
        attributes: null,
      },
    }),
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new ClockworkReportApiError(
      res.status,
      extractErrorMessage(body, `Clockwork Report stop timer failed (${res.status})`),
      body,
    );
  }

  return (body ?? {}) as StopTimerResponse;
}
