import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getActiveTimers } from '../../src/lib/redis';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../src/lib/response';
import type { ActiveTimersResponse } from '../../src/lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is allowed');
    return;
  }

  const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : 'all';

  try {
    const cached = await getActiveTimers(accountId);

    const response: ActiveTimersResponse = {
      timers: cached?.timers ?? [],
      cachedAt: cached?.cachedAt ?? null,
      accountId,
    };

    sendSuccess(res, response);
  } catch (err) {
    console.error('[GET /api/timers/active] Error:', err);
    sendInternalError(res, 'Failed to fetch active timers');
  }
}
