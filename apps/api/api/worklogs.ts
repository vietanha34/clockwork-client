import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWorklogs } from '../src/lib/clockwork-client';
import { sendBadRequest, sendInternalError, sendSuccess } from '../src/lib/response';
import type { WorklogsResponse } from '../src/lib/types';

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
    const worklogs = await getWorklogs(accountId, targetDate);

    const response: WorklogsResponse = {
      worklogs,
      total: worklogs.length,
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
