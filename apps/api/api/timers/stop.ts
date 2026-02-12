import type { VercelRequest, VercelResponse } from '@vercel/node';
import { stopTimer } from '../../src/lib/clockwork-client';
import { deleteActiveTimers } from '../../src/lib/redis';
import { sendBadRequest, sendInternalError, sendSuccess } from '../../src/lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { issueKey, accountId } = req.body as { issueKey?: string; accountId?: string };

  if (!issueKey || typeof issueKey !== 'string') {
    sendBadRequest(res, 'Missing required body field: issueKey (string)');
    return;
  }

  try {
    await stopTimer(issueKey);

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
    sendInternalError(res, 'Failed to stop timer');
  }
}
