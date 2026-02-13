import type { VercelRequest, VercelResponse } from '@vercel/node';
import { acquireClockworkJwt } from '../../src/lib/jira-jwt';
import { ClockworkReportApiError, stopTimerById } from '../../src/lib/clockwork-report';
import { env } from '../../src/lib/env';
import { deleteActiveTimers, getActiveTimers } from '../../src/lib/redis';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../src/lib/response';

interface StopTimerBody {
  issueKey?: string;
  accountId?: string;
  timerId?: number | string;
}

async function resolveTimerIdFromCache(
  issueKey: string,
  accountId?: string,
): Promise<number | null> {
  const keysToTry = [
    accountId && typeof accountId === 'string' ? accountId : null,
    'all',
  ].filter((value): value is string => Boolean(value));

  for (const key of keysToTry) {
    const cached = await getActiveTimers(key);
    const timer = cached?.timers.find((entry) => entry.issue.key === issueKey);
    if (timer?.id) return timer.id;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { issueKey, accountId, timerId } = req.body as StopTimerBody;
  const parsedTimerId =
    typeof timerId === 'number'
      ? timerId
      : typeof timerId === 'string'
        ? Number(timerId)
        : undefined;

  const hasIssueKey = typeof issueKey === 'string' && issueKey.length > 0;
  const hasTimerId = typeof parsedTimerId === 'number' && Number.isFinite(parsedTimerId);

  if (!hasIssueKey && !hasTimerId) {
    sendBadRequest(res, 'Missing required body field: timerId (number) or issueKey (string)');
    return;
  }

  try {
    let resolvedTimerId = hasTimerId ? parsedTimerId ?? null : null;
    if (!resolvedTimerId && hasIssueKey) {
      resolvedTimerId = await resolveTimerIdFromCache(issueKey, accountId);
    }

    if (!resolvedTimerId) {
      sendError(
        res,
        404,
        'TIMER_NOT_FOUND',
        'Could not find active timer id to stop. Please refresh timers and try again.',
      );
      return;
    }

    const jwt = await acquireClockworkJwt(env.JIRA_DOMAIN, env.JIRA_FULL_COOKIE);
    await stopTimerById(resolvedTimerId, jwt, env.JIRA_DOMAIN);

    // Immediately invalidate Redis cache so the next poll returns no timer.
    // Delete both the per-user key and the global 'all' key.
    const deletions: Promise<void>[] = [deleteActiveTimers('all')];
    if (accountId && typeof accountId === 'string') {
      deletions.push(deleteActiveTimers(accountId));
    }
    await Promise.all(deletions);

    sendSuccess(res, {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/timers/stop] Error:', err);
    if (err instanceof ClockworkReportApiError) {
      if (err.status === 422) {
        sendError(res, 422, 'STOP_TIMER_INVALID_STATE', err.message);
        return;
      }
      sendError(res, err.status, 'STOP_TIMER_FAILED', err.message);
      return;
    }
    sendInternalError(res, 'Failed to stop timer');
  }
}
