import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIssue } from '../../src/lib/atlassian-client';
import { sendBadRequest, sendInternalError, sendSuccess } from '../../src/lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { key } = req.query;

  if (!key || typeof key !== 'string') {
    sendBadRequest(res, 'Missing issue key in URL path');
    return;
  }

  try {
    const issue = await getIssue(key);
    sendSuccess(res, { issue });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[GET /api/issues/${key}] Error:`, err);
    sendInternalError(res, `Failed to fetch issue ${key}`);
  }
}
