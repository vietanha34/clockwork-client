/**
 * Fetches timer data from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * Replaces the old JWT-based flow:
 *   Old: Jira cookie → Servlet → JWT → GET app.clockwork.report/timers.json
 *   New: Jira full cookie → POST /rest/internal/2/forge/context/token → context token
 *        → POST gateway/api/graphql → invokeExtension
 */

import type { RawClockworkTimer } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ForgeContextTokenResponse {
  extensionId: string;
  token: string;
  expiresAt: number;
  expiresIn: number;
}

interface ForgeTimersResponse {
  headers: Record<string, string[]>;
  status: number;
  body: {
    timers: RawClockworkTimer[];
    startAt: number;
    maxResults: number;
    total: number;
    isLast: boolean;
    page: number;
    pages: number;
    isFirst: boolean;
  };
}

interface ForgeInvokeResponse {
  data: {
    invokeExtension: {
      success: boolean;
      response: {
        body: ForgeTimersResponse;
      } | null;
      contextToken: {
        jwt: string;
        expiresAt: string;
      } | null;
      errors: Array<{
        message: string;
        extensions?: { errorType?: string; statusCode?: number };
      }> | null;
    };
  };
}

export interface ForgeTimersResult {
  timers: RawClockworkTimer[];
  total: number;
  contextToken: string | null;
  contextTokenExpiresAt: string | null;
}

export class ForgeApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ForgeApiError';
    this.status = status;
    this.details = details;
  }
}

// ─── GraphQL Query ───────────────────────────────────────────────────────────

const INVOKE_EXTENSION_MUTATION = `mutation forge_ui_invokeExtension($input: InvokeExtensionInput!) {
  invokeExtension(input: $input) {
    success
    response {
      body
      __typename
    }
    contextToken {
      jwt
      expiresAt
      __typename
    }
    errors {
      message
      extensions {
        errorType
        statusCode
        ... on InvokeExtensionPayloadErrorExtension {
          fields {
            authInfoUrl
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
`;

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch a Forge context token from Atlassian internal API.
 * This token is used to authenticate GraphQL extension invocations.
 *
 * @param jiraFullCookie - The full Jira cookie string (all cookies from browser)
 * @param jiraDomain - e.g. "thudojsc.atlassian.net"
 * @param cloudId - Jira cloud ID
 * @param workspaceId - Jira workspace ID
 * @param extensionId - Clockwork Forge extension ARI
 */
async function fetchForgeContextToken(
  jiraFullCookie: string,
  jiraDomain: string,
  cloudId: string,
  workspaceId: string,
  extensionId: string,
): Promise<{ token: string; expiresAt: number }> {
  const url = `https://${jiraDomain}/rest/internal/2/forge/context/token`;

  const body = JSON.stringify({
    extension: {
      scopes: [
        'access-email-addresses:connect-jira',
        'act-as-user:connect-jira',
        'admin:connect-jira',
        'delete:connect-jira',
        'manage:jira-configuration',
        'manage:jira-project',
        'project-admin:connect-jira',
        'read:app-global-channel:realtime',
        'read:app-system-token',
        'read:app-user-token',
        'read:connect-jira',
        'read:email-address:jira',
        'read:jira-user',
        'read:jira-work',
        'read:permission:jira',
        'write:connect-jira',
        'write:jira-work',
      ],
      type: 'jira:globalBackgroundScript',
      id: extensionId,
      environmentId: extensionId.split('/').pop()?.split('/')[0] ?? '',
      environmentKey: 'production',
      environmentType: 'PRODUCTION',
      installationId: 'cef0eeca-8dc4-4811-99d1-9c841a75de87',
      appVersion: '3.7.0',
      consentUrl: `https://id.atlassian.com/outboundAuth/start?containerId=${extensionId.replace(/:/g, '_')}&serviceKey=atlassian-token-service-key&cloudId=${cloudId}&isAccountBased=true`,
      properties: {
        key: 'global-background-script',
        resolver: { endpoint: 'clockwork-endpoint' },
        resource: 'global-bg',
        type: 'jira:globalBackgroundScript',
      },
      userAccess: { hasAccess: true, enabled: false },
      license: {
        active: true,
        type: 'commercial',
        trialEndDate: '2026-03-26T00:00:00Z',
        subscriptionEndDate: '2026-03-26T00:00:00Z',
        isEvaluation: true,
        billingPeriod: 'MONTHLY',
      },
      moduleId: extensionId,
    },
    extensionData: {
      type: 'jira:globalBackgroundScript',
      jira: { isNewNavigation: true },
    },
    useWorkspaceAri: true,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json,text/javascript,*/*',
      Cookie: jiraFullCookie,
      Origin: `https://${jiraDomain}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ForgeApiError(
      res.status,
      `Failed to fetch Forge context token: ${res.status}: ${text}`,
      text,
    );
  }

  const json = (await res.json()) as ForgeContextTokenResponse;

  if (!json.token) {
    throw new ForgeApiError(500, 'Forge context token response missing token', json);
  }

  return {
    token: json.token,
    expiresAt: json.expiresAt,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch timers from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * This function:
 * 1. Fetches a context token using the Jira full cookie
 * 2. Uses the context token to invoke the Forge extension via GraphQL
 * 3. Returns active timers and the new context token for caching
 *
 * @param jiraFullCookie - The full Jira cookie string
 * @param jiraDomain - e.g. "thudojsc.atlassian.net"
 * @param cloudId - Jira cloud ID (e.g. "afde6ffd-9c34-4257-a163-36336cf8d953")
 * @param workspaceId - Jira workspace ID (e.g. "fefd8a92-e020-4606-8adf-3139353b0663")
 * @param extensionId - Clockwork Forge extension ARI
 * @param cachedContextToken - Optional cached context token to reuse
 */
export async function fetchTimersViaForge(
  jiraFullCookie: string,
  jiraDomain: string,
  cloudId: string,
  workspaceId: string,
  extensionId: string,
  cachedContextToken?: string,
): Promise<ForgeTimersResult> {
  // 1. Get context token (use cached one if available, otherwise fetch new)
  let contextToken: string;
  let contextTokenExpiresAt: string | null = null;

  if (cachedContextToken) {
    contextToken = cachedContextToken;
  } else {
    const tokenResult = await fetchForgeContextToken(
      jiraFullCookie,
      jiraDomain,
      cloudId,
      workspaceId,
      extensionId,
    );
    contextToken = tokenResult.token;
    contextTokenExpiresAt = String(tokenResult.expiresAt);
  }

  // 2. Invoke GraphQL extension
  const url = `https://${jiraDomain}/gateway/api/graphql`;
  const contextIds = [`ari:cloud:jira:${cloudId}:workspace/${workspaceId}`];

  const payload: Record<string, unknown> = {
    call: {
      method: 'GET',
      path: '/timers.json?page=1',
      invokeType: 'ui-remote-fetch',
    },
    context: {
      cloudId,
      localId: extensionId,
      environmentId: extensionId.split('/').pop()?.split('/')[0] ?? '',
      environmentType: 'PRODUCTION',
      moduleKey: 'global-pages',
      siteUrl: `https://${jiraDomain}`,
      appVersion: '3.7.0',
      extension: {
        type: 'jira:globalPage',
        jira: { isNewNavigation: true },
      },
    },
    contextToken,
    entryPoint: 'resolver',
  };

  const body = JSON.stringify({
    operationName: 'forge_ui_invokeExtension',
    variables: {
      input: {
        contextIds,
        extensionId,
        payload,
      },
    },
    query: INVOKE_EXTENSION_MUTATION,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      Origin: `https://${jiraDomain}`,
      'apollographql-client-name': 'GATEWAY',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ForgeApiError(
      res.status,
      `Forge GraphQL gateway returned ${res.status}: ${text}`,
      text,
    );
  }

  const json = (await res.json()) as ForgeInvokeResponse;

  const invocation = json.data?.invokeExtension;
  if (!invocation?.success) {
    const errorMessages =
      invocation?.errors?.map((e) => e.message).join('; ') ?? 'Unknown Forge error';
    throw new ForgeApiError(500, `Forge invocation failed: ${errorMessages}`, invocation?.errors);
  }

  const responseBody = invocation.response?.body;
  if (!responseBody || responseBody.status !== 200 || !responseBody.body?.timers) {
    throw new ForgeApiError(
      responseBody?.status ?? 500,
      'Forge response did not contain timer data',
      responseBody,
    );
  }

  const allTimers = responseBody.body.timers;
  const total = responseBody.body.total;

  // Filter: only active timers (finished_at === null), deduplicate by id
  const seen = new Set<number>();
  const activeTimers: RawClockworkTimer[] = [];
  for (const timer of allTimers) {
    if (timer.finished_at === null && !seen.has(timer.id)) {
      seen.add(timer.id);
      activeTimers.push(timer);
    }
  }

  return {
    timers: activeTimers,
    total,
    contextToken: invocation.contextToken?.jwt ?? null,
    contextTokenExpiresAt: invocation.contextToken?.expiresAt ?? contextTokenExpiresAt,
  };
}
