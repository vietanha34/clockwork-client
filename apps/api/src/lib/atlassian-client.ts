import { env } from './env';
import type { ClockworkUser, Issue, Project } from './types';

// ─── Raw Atlassian REST API types ─────────────────────────────────────────────

interface RawJiraUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  avatarUrls?: { '48x48': string };
}

interface RawJiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority: { name: string } | null;
    assignee: {
      accountId: string;
      emailAddress: string;
      displayName: string;
      avatarUrls?: { '48x48': string };
    } | null;
    project: {
      id: string;
      key: string;
      name: string;
      avatarUrls?: { '48x48': string };
    };
  };
}

interface RawSearchIssuesResponse {
  issues: RawJiraIssue[];
}

// ─── Base HTTP helper ─────────────────────────────────────────────────────────

function getBasicAuthHeader(): string {
  const credentials = `${env.ATLASSIAN_EMAIL}:${env.ATLASSIAN_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function atlassianFetch<T>(path: string): Promise<T> {
  const url = `https://${env.JIRA_DOMAIN}/rest/api/3${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlassian API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Data transformers ────────────────────────────────────────────────────────

function transformIssue(raw: RawJiraIssue): Issue {
  const project: Project = {
    id: raw.fields.project.id,
    key: raw.fields.project.key,
    name: raw.fields.project.name,
    avatarUrl: raw.fields.project.avatarUrls?.['48x48'],
  };

  return {
    key: raw.key,
    id: raw.id,
    summary: raw.fields.summary,
    status: raw.fields.status.name,
    project,
    assignee: raw.fields.assignee
      ? {
          accountId: raw.fields.assignee.accountId,
          emailAddress: raw.fields.assignee.emailAddress,
          displayName: raw.fields.assignee.displayName,
          avatarUrl: raw.fields.assignee.avatarUrls?.['48x48'],
        }
      : null,
    priority: raw.fields.priority?.name ?? null,
    url: `https://${env.JIRA_DOMAIN}/browse/${raw.key}`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch issue details from Atlassian Jira.
 * @param issueKey - e.g. "KAN-9" or "SAM1-6"
 */
export async function getIssue(issueKey: string): Promise<Issue> {
  const fields = 'summary,status,priority,assignee,project';
  const data = await atlassianFetch<RawJiraIssue>(`/issue/${issueKey}?fields=${fields}`);
  return transformIssue(data);
}

export async function searchIssues(jql: string, maxResults = 10): Promise<Issue[]> {
  const fields = 'summary,status,priority,assignee,project';
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields,
  });

  const data = await atlassianFetch<RawSearchIssuesResponse>(`/search?${params.toString()}`);
  return data.issues.map(transformIssue);
}

/**
 * Search for a Jira user by email or name.
 * Returns the first match, or null if not found.
 * @param query - User's email or name
 */
export async function searchJiraUser(query: string): Promise<ClockworkUser | null> {
  const data = await atlassianFetch<RawJiraUser[]>(
    `/user/search?query=${encodeURIComponent(query)}&maxResults=1`,
  );
  // If query is email, try to find exact match first
  console.log('searchJiraUser: ', JSON.stringify(query), JSON.stringify(data));
  const exactMatch = data.find((u) => u.emailAddress === query);
  const user = exactMatch ?? data[0] ?? null;
  
  if (!user) return null;
  return {
    accountId: user.accountId,
    emailAddress: user.emailAddress,
    displayName: user.displayName,
    avatarUrl: user.avatarUrls?.['48x48'],
  };
}

/**
 * Search for a Jira user by email address.
 * @deprecated Use searchJiraUser instead
 */
export async function searchJiraUserByEmail(email: string): Promise<ClockworkUser | null> {
  return searchJiraUser(email);
}

/**
 * Fetch user details from Atlassian Jira by accountId.
 * @param accountId - Jira accountId (e.g. from running_for field)
 */
export async function getJiraUser(accountId: string): Promise<ClockworkUser> {
  const data = await atlassianFetch<RawJiraUser>(
    `/user?accountId=${encodeURIComponent(accountId)}`,
  );
  return {
    accountId: data.accountId,
    emailAddress: data.emailAddress,
    displayName: data.displayName,
    avatarUrl: data.avatarUrls?.['48x48'],
  };
}

/**
 * Fetch details for multiple users from Atlassian Jira.
 * @param accountIds - List of Jira accountIds
 */
export async function getJiraUsersBulk(accountIds: string[]): Promise<ClockworkUser[]> {
  if (accountIds.length === 0) return [];

  // Jira bulk API might have limits, so chunking is good practice
  const chunkSize = 50;
  const chunks = [];
  
  for (let i = 0; i < accountIds.length; i += chunkSize) {
    chunks.push(accountIds.slice(i, i + chunkSize));
  }

  const results: ClockworkUser[] = [];

  for (const chunk of chunks) {
    const params = new URLSearchParams();
    chunk.forEach((id) => params.append('accountId', id));
    params.append('maxResults', chunk.length.toString());

    const response = await atlassianFetch<{ values: RawJiraUser[] }>(
      `/user/bulk?${params.toString()}`,
    );
    
    if (response.values) {
      results.push(
        ...response.values.map((u) => ({
          accountId: u.accountId,
          emailAddress: u.emailAddress,
          displayName: u.displayName,
          avatarUrl: u.avatarUrls?.['48x48'],
        }))
      );
    }
  }

  return results;
}
