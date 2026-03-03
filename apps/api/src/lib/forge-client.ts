/**
 * Fetches timer data from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * Flow:
 *   1. POST /rest/internal/2/forge/context/token → get context token
 *   2. POST /gateway/api/graphql → invokeExtension with context token → get timers
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
  success: boolean;
  payload: {
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
  };
}

interface ForgeInvokeResponse {
  data?: {
    invokeExtension: {
      success: boolean;
      response?: {
        body: ForgeTimersResponse;
      };
      contextToken?: {
        jwt: string;
        expiresAt: string;
      };
      errors?: Array<{
        message: string;
        extensions?: unknown;
      }>;
    };
  };
  errors?: Array<{
    message: string;
    extensions?: unknown;
  }>;
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
}`;

export interface ForgeConfig {
  extensionId: string;
  environmentId: string;
  installationId: string;
  appVersion: string;
  resourceUploadId: string;
}

const DEFAULT_FORGE_CONFIG: ForgeConfig = {
  extensionId:
    'ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages',
  environmentId: '725dad32-d2c5-4b58-a141-a093d70c8d34',
  installationId: 'cef0eeca-8dc4-4811-99d1-9c841a75de87',
  appVersion: '3.10.0',
  resourceUploadId: 'b5a795d6-748a-4e93-96b9-971eb084c639',
};

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch a Forge context token from Atlassian internal API.
 */
export async function fetchForgeContextToken(
  jiraFullCookie: string,
  jiraDomain: string,
  cloudId: string,
  config: Partial<ForgeConfig> = {},
): Promise<{ token: string; expiresAt: number }> {
  const { extensionId, environmentId, installationId, appVersion, resourceUploadId } = {
    ...DEFAULT_FORGE_CONFIG,
    ...config,
  };

  const url = `https://${jiraDomain}/rest/internal/2/forge/context/token`;

  const body = JSON.stringify({
    extension: {
      hiddenBy: null,
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
      type: 'jira:globalPage',
      id: extensionId,
      environmentId,
      environmentKey: 'production',
      environmentType: 'PRODUCTION',
      installationId,
      appVersion,
      consentUrl: `https://id.atlassian.com/outboundAuth/start?containerId=${extensionId.split('/')[4]}_${environmentId}&serviceKey=atlassian-token-service-key&cloudId=${cloudId}&isAccountBased=true&scopes=read%3Aapp-global-channel%3Arealtime+read%3Aconnect-jira+write%3Aconnect-jira+delete%3Aconnect-jira+act-as-user%3Aconnect-jira+project-admin%3Aconnect-jira+admin%3Aconnect-jira+access-email-addresses%3Aconnect-jira+read%3Ajira-user+read%3Ajira-work+write%3Ajira-work+manage%3Ajira-project+manage%3Ajira-configuration+read%3Aemail-address%3Ajira+read%3Apermission%3Ajira+offline_access`,
      properties: {
        displayConditions: { isLoggedIn: true },
        icon: `https://icon.cdn.prod.atlassian-dev.net/${extensionId.split('/')[4]}/${environmentId}/${resourceUploadId}/assets/clockwork-icon.png`,
        key: 'global-pages',
        layout: 'blank',
        pages: [
          { route: 'my-work', title: 'My Work' },
          { route: 'timesheet', title: 'Timesheet' },
          { route: 'reports', title: 'Reports' },
          { route: 'teams-and-users', title: 'Teams and Users' },
          { route: 'billing-periods', title: 'Billing Periods' },
          { route: 'timers', title: 'Timers' },
          { route: 'settings', title: 'Settings' },
          { route: 'api-tokens', title: 'API Tokens' },
          { route: 'help', title: 'Help' },
        ],
        resolver: { endpoint: 'clockwork-endpoint' },
        resource: 'global-pages',
        resourceUploadId,
        title: 'Clockwork Pro',
        type: 'jira:globalPage',
      },
      userAccess: { hasAccess: true, enabled: false },
      egress: [
        {
          addresses: ['https://app.clockwork.report'],
          type: 'FETCH_BACKEND_SIDE',
          category: null,
          inScopeEUD: null,
        },
        {
          addresses: [
            '*.ingest.sentry.io',
            '*.ingest.us.sentry.io',
            '*.mixpanel.com',
            '*.sentry-cdn.com',
            'cdn.mxpnl.com',
          ],
          type: 'FETCH_CLIENT_SIDE',
          category: 'ANALYTICS',
          inScopeEUD: true,
        },
        {
          addresses: ['*.ingest.sentry.io'],
          type: 'FETCH_BACKEND_SIDE',
          category: 'ANALYTICS',
          inScopeEUD: true,
        },
      ],
      installationConfig: null,
      license: {
        active: true,
        type: 'commercial',
        supportEntitlementNumber: null,
        trialEndDate: '2026-03-26T00:00:00Z',
        subscriptionEndDate: '2026-03-26T00:00:00Z',
        isEvaluation: true,
        billingPeriod: 'MONTHLY',
        ccpEntitlementId: '8916611a-9ba1-348f-b654-de66cc9b7ce1',
        ccpEntitlementSlug: 'E-44E-HFS-BQS-5U5',
        capabilitySet: null,
      },
      moduleId:
        'ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages',
    },
    extensionData: {
      type: 'jira:globalPage',
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
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
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
 */
export async function fetchTimersViaForge(
  jiraFullCookie: string,
  jiraDomain: string,
  cloudId: string,
  workspaceId: string,
  cachedContextToken?: string,
  config: Partial<ForgeConfig> = {},
): Promise<ForgeTimersResult> {
  const { extensionId, environmentId, appVersion } = { ...DEFAULT_FORGE_CONFIG, ...config };

  // 1. Resolve context token: use cached if available, otherwise bootstrap via internal API
  let contextToken: string | undefined;
  let contextTokenExpiresAt: string | null = null;

  if (cachedContextToken) {
    contextToken = cachedContextToken;
  } else {
    // Bootstrap: fetch initial context token from Atlassian internal API
    try {
      const tokenResult = await fetchForgeContextToken(jiraFullCookie, jiraDomain, cloudId, config);
      contextToken = tokenResult.token;
      contextTokenExpiresAt = String(tokenResult.expiresAt);
    } catch (err) {
      // If internal API fails, proceed without contextToken —
      // the invokeExtension mutation may still work with cookie auth alone
      console.warn('Failed to fetch Forge context token, proceeding without:', err);
    }
  }

  // 2. Invoke GraphQL extension
  const url = `https://${jiraDomain}/gateway/api/graphql`;
  const contextIds = [`ari:cloud:jira:${cloudId}:workspace/${workspaceId}`];

  // Construct the payload object (inside 'input.payload')
  const extensionPayload: Record<string, unknown> = {
    call: {
      method: 'GET',
      path: '/timers.json?page=1',
      invokeType: 'ui-remote-fetch',
    },
    context: {
      cloudId,
      localId: extensionId,
      environmentId,
      environmentType: 'PRODUCTION',
      moduleKey: 'global-pages',
      siteUrl: `https://${jiraDomain}`,
      appVersion,
      extension: {
        type: 'jira:globalPage',
        jira: { isNewNavigation: true },
      },
    },
  };

  // Only include contextToken in payload if we have one
  if (contextToken) {
    extensionPayload.contextToken = contextToken;
  }

  // Construct the input object (inside 'variables.input')
  const inputVariables: Record<string, unknown> = {
    contextIds,
    extensionId,
    payload: extensionPayload,
    entryPoint: 'resolver',
  };

  const body = JSON.stringify({
    operationName: 'forge_ui_invokeExtension',
    variables: {
      input: inputVariables,
    },
    query: INVOKE_EXTENSION_MUTATION,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      Cookie: jiraFullCookie,
      Origin: `https://${jiraDomain}`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
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

  if (json.errors && json.errors.length > 0) {
    const errorMessages = json.errors.map((e) => e.message).join('; ');
    console.error('Forge invocation failed (GraphQL errors):', {
      json,
      hadContextToken: !!contextToken,
    });
    throw new ForgeApiError(500, `Forge GraphQL error: ${errorMessages}`, json.errors);
  }

  const invocation = json.data?.invokeExtension;
  if (!invocation?.success) {
    const errorMessages =
      invocation?.errors?.map((e) => e.message).join('; ') ?? 'Unknown Forge error';
    console.error('Forge invocation failed (Extension errors):', {
      json,
      hadContextToken: !!contextToken,
      contextTokenPrefix: contextToken?.substring(0, 40),
    });
    throw new ForgeApiError(500, `Forge invocation failed: ${errorMessages}`, invocation?.errors);
  }

  // Parse response - note the nested structure
  const responseWrapper = invocation.response?.body;

  if (!responseWrapper || !responseWrapper.success || !responseWrapper.payload?.body?.timers) {
    throw new ForgeApiError(
      responseWrapper?.payload?.status ?? 500,
      'Forge response did not contain timer data',
      responseWrapper,
    );
  }

  const allTimers = responseWrapper.payload.body.timers;
  const total = responseWrapper.payload.body.total;

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
