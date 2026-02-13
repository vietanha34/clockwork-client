import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJiraUser } from '../../src/lib/atlassian-client';
import { ClockworkApiError, validateClockworkToken } from '../../src/lib/clockwork-client';
import { sendError } from '../../src/lib/response';

type ValidationField = 'accountId' | 'clockworkApiToken' | 'general';

function sendValidationError(
  res: VercelResponse,
  message: string,
  field: ValidationField,
  statusCode = 400,
): void {
  res.status(statusCode).json({
    error: 'VALIDATION_ERROR',
    message,
    statusCode,
    field,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed');
    return;
  }

  const body = (req.body ?? {}) as {
    accountId?: unknown;
    clockworkApiToken?: unknown;
  };

  const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
  const clockworkApiToken =
    typeof body.clockworkApiToken === 'string' ? body.clockworkApiToken.trim() : '';

  if (!accountId) {
    sendValidationError(res, 'Account ID is required', 'accountId');
    return;
  }
  if (!clockworkApiToken) {
    sendValidationError(res, 'Clockwork API token is required', 'clockworkApiToken');
    return;
  }

  try {
    const jiraUser = await getJiraUser(accountId);

    try {
      await validateClockworkToken(accountId, clockworkApiToken);
    } catch (error) {
      if (error instanceof ClockworkApiError && (error.status === 401 || error.status === 403)) {
        sendValidationError(
          res,
          'Clockwork API token is invalid or expired',
          'clockworkApiToken',
        );
        return;
      }
      sendValidationError(
        res,
        'Unable to validate Clockwork API token right now. Please try again.',
        'general',
      );
      return;
    }

    res.status(200).json({
      valid: true,
      user: {
        accountId: jiraUser.accountId,
        displayName: jiraUser.displayName,
        emailAddress: jiraUser.emailAddress,
        avatarUrl: jiraUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[POST /api/settings/validate] Validation error:', error);
    const message = error instanceof Error ? error.message : '';
    const statusMatch = message.match(/Atlassian API error (\d+)/);
    const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
    if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
      sendValidationError(
        res,
        'Jira accountId is invalid or could not be resolved',
        'accountId',
      );
      return;
    }
    sendValidationError(
      res,
      'Unable to validate Jira accountId right now. Please try again.',
      'general',
    );
  }
}
