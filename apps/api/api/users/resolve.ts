import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJiraUser, searchJiraUser } from '../../src/lib/atlassian-client';
import { getCachedEmailToAccountId, getCachedJiraUser, setCachedEmailToAccountId, setCachedJiraUser } from '../../src/lib/redis';
import { sendBadRequest, sendError, sendInternalError, sendSuccess } from '../../src/lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is allowed');
    return;
  }

  const query = typeof req.query.query === 'string' ? req.query.query.trim() : 
                typeof req.query.email === 'string' ? req.query.email.trim() : '';

  if (!query) {
    sendBadRequest(res, 'Missing required query parameter: query or email');
    return;
  }

  try {
    // 1. Check Email -> AccountId Cache (if query looks like email)
    const isEmail = query.includes('@');
    if (isEmail) {
      const cachedAccountId = await getCachedEmailToAccountId(query);
      if (cachedAccountId) {
        // Try to get full user details from User Cache
        const cachedUser = await getCachedJiraUser(cachedAccountId);
        if (cachedUser) {
          sendSuccess(res, cachedUser);
          return;
        }
        
        // If not in user cache, fetch by ID
        try {
          const user = await getJiraUser(cachedAccountId);
          await setCachedJiraUser(cachedAccountId, user);
          sendSuccess(res, user);
          return;
        } catch (e) {
          // If fetch by ID fails, fall through to search
          console.warn(`[resolve] Failed to fetch user by cached accountId ${cachedAccountId}, falling back to search.`);
        }
      }
    }

    // 2. Resolve via Jira user search
    const user = await searchJiraUser(query);
    if (!user) {
      sendError(res, 404, 'USER_NOT_FOUND', `No Jira user found for query: ${query}`);
      return;
    }

    // 3. Cache the result
    if (user.emailAddress) {
      await setCachedEmailToAccountId(user.emailAddress, user.accountId);
    }
    await setCachedJiraUser(user.accountId, user);

    sendSuccess(res, {
      accountId: user.accountId,
      emailAddress: user.emailAddress,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    console.error('[GET /api/users/resolve] Error:', err);
    sendInternalError(res, 'Failed to resolve user');
  }
}
