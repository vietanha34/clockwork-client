import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIssue } from '../src/lib/atlassian-client';
import { getWorklogs } from '../src/lib/clockwork-client';
import { getCachedIssue, setCachedIssue } from '../src/lib/redis';
import { sendBadRequest, sendInternalError, sendSuccess } from '../src/lib/response';
import type { Issue, Worklog, WorklogsResponse } from '../src/lib/types';

async function resolveIssueById(issueId: number): Promise<Issue | null> {
  const cacheKey = String(issueId);
  const cached = await getCachedIssue(cacheKey);
  if (cached) return cached;

  try {
    // Jira API accepts issue key or numeric issue id.
    const issue = await getIssue(cacheKey);
    await Promise.all([
      setCachedIssue(cacheKey, issue),
      setCachedIssue(issue.key, issue),
    ]);
    return issue;
  } catch (err) {
    console.error(`[worklogs] Failed to resolve issue ${cacheKey}:`, err);
    return null;
  }
}

async function enrichWorklogsWithIssueDetails(worklogs: Worklog[]): Promise<Worklog[]> {
  const issueIds = [...new Set(worklogs.map((w) => w.issueId))];
  const issueEntries = await Promise.all(
    issueIds.map(async (issueId) => [issueId, await resolveIssueById(issueId)] as const),
  );
  const issueMap = new Map<number, Issue | null>(issueEntries);

  return worklogs.map((worklog) => {
    const issue = issueMap.get(worklog.issueId);
    if (!issue) return worklog;

    return {
      ...worklog,
      issueKey: issue.key,
      issueName: issue.summary,
      projectName: issue.project.name,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { accountId, date } = req.query;

  if (!accountId || typeof accountId !== 'string') {
    sendBadRequest(res, 'Missing required query parameter: accountId');
    return;
  }

  const targetDate =
    typeof date === 'string' ? date : (new Date().toISOString().split('T')[0] ?? '');

  try {
    const rawWorklogs = await getWorklogs(accountId, targetDate);
    const worklogs = await enrichWorklogsWithIssueDetails(rawWorklogs);
    const total = worklogs.reduce((sum, worklog) => sum + worklog.timeSpentSeconds, 0);

    const response: WorklogsResponse = {
      worklogs,
      total,
      date: targetDate,
      accountId,
    };

    sendSuccess(res, response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/worklogs] Error:', err);
    sendInternalError(res, 'Failed to fetch worklogs');
  }
}
