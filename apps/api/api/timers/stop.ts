import type { VercelRequest, VercelResponse } from '@vercel/node';
import { stopTimer } from '../../lib/clockwork-client';
import { sendBadRequest, sendInternalError, sendSuccess } from '../../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { timerId } = req.body as { timerId?: number };

  if (!timerId || typeof timerId !== 'number') {
    sendBadRequest(res, 'Missing required body field: timerId (number)');
    return;
  }

  try {
    const timer = await stopTimer(timerId);
    sendSuccess(res, { timer });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/timers/stop] Error:', err);
    sendInternalError(res, 'Failed to stop timer');
  }
}
