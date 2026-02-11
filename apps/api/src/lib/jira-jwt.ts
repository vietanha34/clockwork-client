/**
 * Acquires a Clockwork JWT by exchanging a Jira session cookie
 * via the Jira servlet endpoint.
 *
 * The servlet acts as a token exchange:
 *   Jira cookie (session) → Clockwork contextJwt
 *
 * Endpoint: POST https://{JIRA_DOMAIN}/plugins/servlet/ac/clockwork-cloud/clockwork-timers
 */

const SERVLET_PATH =
  '/plugins/servlet/ac/clockwork-cloud/clockwork-timers?classifier=json&project.id=10001&project.key=KAN';

interface ServletResponse {
  contextJwt?: string;
  [key: string]: unknown;
}

/**
 * Exchange a Jira full cookie string for a Clockwork contextJwt.
 *
 * @param jiraDomain - e.g. "vietanha34.atlassian.net"
 * @param jiraFullCookie - full cookie header value from Jira browser session
 * @returns The contextJwt string
 * @throws If the JWT cannot be extracted from the response
 */
export async function acquireClockworkJwt(
  jiraDomain: string,
  jiraFullCookie: string,
): Promise<string> {
  const url = `https://${jiraDomain}${SERVLET_PATH}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Cookie: jiraFullCookie,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira servlet returned ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ServletResponse;

  if (!data.contextJwt || typeof data.contextJwt !== 'string') {
    throw new Error(
      `contextJwt not found in servlet response. Keys: ${Object.keys(data).join(', ')}`,
    );
  }

  return data.contextJwt;
}
