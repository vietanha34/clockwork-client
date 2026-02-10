/**
 * Fetches active timer data from the Clockwork Report API
 * using a JWT token obtained via the Jira servlet.
 *
 * Endpoint: GET https://app.clockwork.report/timers.json
 */

const CLOCKWORK_REPORT_BASE = "https://app.clockwork.report";

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
  page = 1
): Promise<ClockworkReportTimersResponse> {
  const params = new URLSearchParams([
    ["page", String(page)],
    ["xdm_e", `https://${jiraDomain}`],
  ]);

  const url = `${CLOCKWORK_REPORT_BASE}/timers.json?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `JWT ${jwt}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Clockwork Report API returned ${res.status}: ${text}`
    );
  }

  return res.json() as Promise<ClockworkReportTimersResponse>;
}
