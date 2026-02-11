import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getActiveTimers } from '../../lib/redis.js';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../lib/response.js';
import type { ActiveTimersResponse } from '../../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is allowed');
    return;
  }

  const userEmail = typeof req.query.userEmail === 'string' ? req.query.userEmail : 'all';

  try {
    const cached = await getActiveTimers(userEmail);

    const response: ActiveTimersResponse = {
      timers: cached?.timers ?? [],
      cachedAt: cached?.cachedAt ?? null,
      userEmail,
    };

    sendSuccess(res, response);
  } catch (err) {
    console.error('[GET /api/timers/active] Error:', err);
    sendInternalError(res, 'Failed to fetch active timers');
  }
}
