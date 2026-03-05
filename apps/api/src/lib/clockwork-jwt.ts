// apps/api/src/lib/clockwork-jwt.ts
import { env } from './env';
import { getCachedClockworkJwt, setCachedClockworkJwt } from './redis';

interface ServletResponse {
  contextJwt: string;
}

/**
 * Acquire a Clockwork Pro JWT via the Atlassian Connect servlet.
 * Caches the JWT in Redis until expiry.
 *
 * @param issueId - Jira issue ID (numeric) for the product context
 * @param issueKey - Jira issue key (e.g. "TL-146")
 * @param projectId - Jira project ID (numeric)
 * @param projectKey - Jira project key (e.g. "TL")
 */
export async function getClockworkJwt(context: {
  issueId: string;
  issueKey: string;
  projectId: string;
  projectKey: string;
}): Promise<string> {
  // Check cache first
  const cached = await getCachedClockworkJwt();
  if (cached) {
    console.log('[clockwork-jwt] Using cached JWT');
    return cached;
  }

  console.log('[clockwork-jwt] Fetching fresh JWT via servlet...');

  const body = new URLSearchParams({
    'plugin-key': 'clockwork-cloud',
    'product-context': JSON.stringify({
      'project.key': context.projectKey,
      'project.id': context.projectId,
      'issue.id': context.issueId,
      'issue.key': context.issueKey,
      'issuetype.id': '10006',
    }),
    'key': 'log-work-dialog',
    'width': '100%',
    'height': '100%',
    'classifier': 'json',
    'ac.issueId': context.issueId,
    'ac.isDescriptionRequired': 'false',
    'ac.isClockworkActive': 'false',
    'ac.pluginKey': 'clockwork-cloud',
    'ac.hostBaseUrl': `https://${env.JIRA_DOMAIN}`,
    'ac.projectId': context.projectId,
    'ac.currentAccountId': env.JIRA_ACCOUNT_ID,
    'ac.type': 'EDIT_WORKLOG',
  });

  const url = `https://${env.JIRA_DOMAIN}/plugins/servlet/ac/clockwork-cloud/log-work-dialog`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `tenant.session.token=${env.JIRA_TENANT_SESSION_TOKEN}`,
      'Origin': `https://${env.JIRA_DOMAIN}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockwork JWT servlet error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ServletResponse;
  const jwt = data.contextJwt;

  if (!jwt) {
    throw new Error('Clockwork JWT servlet returned no contextJwt');
  }

  // Parse JWT exp claim for cache TTL
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64').toString());
  const exp = payload.exp as number | undefined;

  await setCachedClockworkJwt(jwt, exp);
  console.log('[clockwork-jwt] Fresh JWT cached');

  return jwt;
}
