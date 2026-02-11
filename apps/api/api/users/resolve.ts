import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchJiraUserByEmail } from '../../src/lib/atlassian-client';
import { getCachedEmailToAccountId, setCachedEmailToAccountId } from '../../src/lib/redis';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../src/lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is allowed');
    return;
  }

  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  if (!email) {
    sendBadRequest(res, 'Missing required query parameter: email');
    return;
  }

  try {
    // 1. Check Redis cache first
    const cached = await getCachedEmailToAccountId(email);
    if (cached) {
      sendSuccess(res, { accountId: cached, emailAddress: email, displayName: null });
      return;
    }

    // 2. Resolve via Jira user search
    const user = await searchJiraUserByEmail(email);
    if (!user) {
      sendError(res, 404, 'USER_NOT_FOUND', `No Jira user found for email: ${email}`);
      return;
    }

    // 3. Cache the result
    await setCachedEmailToAccountId(email, user.accountId);

    sendSuccess(res, {
      accountId: user.accountId,
      emailAddress: user.emailAddress,
      displayName: user.displayName,
    });
  } catch (err) {
    console.error('[GET /api/users/resolve] Error:', err);
    sendInternalError(res, 'Failed to resolve user accountId');
  }
}
