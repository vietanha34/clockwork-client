import { env } from './env';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorklogUpdatedResponse {
  values: Array<{ worklogId: number; updatedTime: number }>;
  lastPage: boolean;
  nextPage?: string;
}

interface JiraWorklogDetail {
  id: string;
  issueId: string;
  author: { accountId: string };
  started: string;           // e.g. "2026-03-05T09:00:00.000+0700"
  timeSpentSeconds: number;
  comment?: { content?: Array<{ content?: Array<{ text?: string }> }> };
}

// Note: Jira /worklog/list returns array directly, not { values: [...] }
type WorklogListResponse = JiraWorklogDetail[];

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function getBasicAuthHeader(): string {
  const credentials = `${env.ATLASSIAN_EMAIL}:${env.ATLASSIAN_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function jiraFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `https://${env.JIRA_DOMAIN}/rest/api/3${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all worklog IDs updated since the given epoch timestamp.
 * Paginates automatically until lastPage=true.
 */
export async function getUpdatedWorklogIds(sinceMs: number): Promise<number[]> {
  const ids: number[] = [];
  let url: string | null = `/worklog/updated?since=${sinceMs}`;

  while (url) {
    const data: WorklogUpdatedResponse = await jiraFetch<WorklogUpdatedResponse>(url);
    for (const entry of data.values) {
      ids.push(entry.worklogId);
    }
    url = data.lastPage ? null : (data.nextPage ?? null);
  }

  console.log(`[jira-worklog] Fetched ${ids.length} updated worklog IDs since ${sinceMs}`);
  return ids;
}

/**
 * Fetch full worklog details by IDs (max 1000 per request per Jira docs).
 */
export async function getWorklogsByIds(ids: number[]): Promise<JiraWorklogDetail[]> {
  if (ids.length === 0) return [];

  const results: JiraWorklogDetail[] = [];
  const chunkSize = 1000;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const data: WorklogListResponse = await jiraFetch<WorklogListResponse>('/worklog/list', {
      method: 'POST',
      body: JSON.stringify({ ids: chunk }),
    });
    results.push(...data);
  }

  console.log(`[jira-worklog] Fetched ${results.length} worklog details`);
  return results;
}

export type { JiraWorklogDetail };
