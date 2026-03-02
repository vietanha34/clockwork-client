/**
 * Fetches timer data from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * Replaces the old JWT-based flow:
 *   Old: Jira cookie → Servlet → JWT → GET app.clockwork.report/timers.json
 *   New: Atlassian session token → POST {domain}/gateway/api/graphql → invokeExtension
 */

import type { RawClockworkTimer } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch timers from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * @param sessionToken - Value of the `tenant.session.token` cookie
 * @param jiraDomain - e.g. "thudojsc.atlassian.net"
 * @param cloudId - Jira cloud ID (e.g. "afde6ffd-9c34-4257-a163-36336cf8d953")
 * @param workspaceId - Jira workspace ID (e.g. "fefd8a92-e020-4606-8adf-3139353b0663")
 * @param extensionId - Clockwork Forge extension ARI
 * @param contextToken - Optional context token from a previous call (for session continuity)
 */
export async function fetchTimersViaForge(
  sessionToken: string,
  jiraDomain: string,
  cloudId: string,
  workspaceId: string,
  extensionId: string,
  contextToken?: string,
): Promise<ForgeTimersResult> {
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
    entryPoint: 'resolver',
  };

  if (contextToken) {
    payload.contextToken = contextToken;
  }

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
      Cookie: `tenant.session.token=${sessionToken}`,
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
    contextTokenExpiresAt: invocation.contextToken?.expiresAt ?? null,
  };
}
