import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ClockworkApiError, stopTimer } from '../../src/lib/clockwork-client';
import { deleteActiveTimers } from '../../src/lib/redis';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../src/lib/response';

interface StopTimerBody {
  issueKey?: string;
  accountId?: string;
  timerId?: number | string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { issueKey, accountId } = req.body as StopTimerBody;
  const hasIssueKey = typeof issueKey === 'string' && issueKey.length > 0;
  if (!hasIssueKey) {
    sendBadRequest(res, 'Missing required body field: issueKey (string)');
    return;
  }

  const tokenHeader = req.headers['x-clockwork-token'];
  const clockworkToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  const normalizedToken = typeof clockworkToken === 'string' ? clockworkToken.trim() : '';

  try {
    await stopTimer(issueKey, normalizedToken || undefined);

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
    if (err instanceof ClockworkApiError) {
      if (err.status === 422) {
        sendError(res, 422, 'STOP_TIMER_INVALID_STATE', err.message);
        return;
      }
      if (err.status === 401 || err.status === 403) {
        sendError(res, err.status, 'STOP_TIMER_UNAUTHORIZED', err.message);
        return;
      }
      sendError(res, err.status, 'STOP_TIMER_FAILED', err.message);
      return;
    }
    sendInternalError(res, 'Failed to stop timer');
  }
}
