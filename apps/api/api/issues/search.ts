import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchIssues } from '../../src/lib/atlassian-client';
import type { SearchIssuesResponse } from '../../src/lib/types';
import { sendBadRequest, sendInternalError, sendSuccess } from '../../src/lib/response';

const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 10;

function escapeJqlValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeQueryParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const accountId = normalizeQueryParam(req.query.accountId).trim();
  const query = normalizeQueryParam(req.query.q).trim();

  if (!accountId) {
    sendBadRequest(res, 'Missing required query param: accountId');
    return;
  }

  const maxResultsParam = normalizeQueryParam(req.query.maxResults).trim();
  const parsedMaxResults = Number.parseInt(maxResultsParam, 10);
  const maxResults = Number.isFinite(parsedMaxResults)
    ? Math.min(Math.max(parsedMaxResults, 1), MAX_RESULTS_LIMIT)
    : DEFAULT_MAX_RESULTS;

  const escapedAccountId = escapeJqlValue(accountId);
  const escapedQuery = escapeJqlValue(query);
  const uppercaseQuery = escapedQuery.toUpperCase();

  const jql = query
    ? `(issuekey = "${uppercaseQuery}" OR text ~ "${escapedQuery}" OR summary ~ "${escapedQuery}") ORDER BY updated DESC`
    : `assignee = "${escapedAccountId}" AND status = "In Progress" ORDER BY updated DESC`;

  try {
    const issues = await searchIssues(jql, maxResults);
    const body: SearchIssuesResponse = { issues };
    sendSuccess(res, body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/issues/search] Error:', err);
    sendInternalError(res, 'Failed to search issues');
  }
}
