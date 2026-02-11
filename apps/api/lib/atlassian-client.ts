import { env } from './env.js';
import type { Issue, Project } from './types.js';

// ─── Raw Atlassian REST API types ─────────────────────────────────────────────

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
