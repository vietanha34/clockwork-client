# Forge API Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace broken JWT-based timer fetching with Atlassian Forge GraphQL Gateway in the Inngest sync function.

**Architecture:** Keep existing server-side Inngest sync → Redis cache → client polling architecture. Only replace the fetch layer: swap `acquireClockworkJwt()` + `fetchActiveTimers()` with a single `fetchTimersViaForge()` call that hits the Forge GraphQL gateway using an Atlassian session token cookie.

**Tech Stack:** TypeScript, Vercel serverless, Inngest, Redis, Atlassian Forge GraphQL API

**Design doc:** `docs/plans/2026-03-02-forge-api-migration-design.md`

---

### Task 1: Update env.ts — replace JIRA_FULL_COOKIE with new Forge env vars

**Files:**
- Modify: `apps/api/src/lib/env.ts`

**Step 1: Replace JIRA_FULL_COOKIE with new env vars**

In `apps/api/src/lib/env.ts`, replace the `JIRA_FULL_COOKIE` getter (line 54-56) with four new getters:

```typescript
  // Atlassian Forge Gateway
  get ATLASSIAN_SESSION_TOKEN(): string {
    return required('ATLASSIAN_SESSION_TOKEN');
  },
  get FORGE_EXTENSION_ID(): string {
    return required('FORGE_EXTENSION_ID');
  },
  get JIRA_CLOUD_ID(): string {
    return required('JIRA_CLOUD_ID');
  },
  get JIRA_WORKSPACE_ID(): string {
    return required('JIRA_WORKSPACE_ID');
  },
```

Remove:
```typescript
  get JIRA_FULL_COOKIE(): string {
    return required('JIRA_FULL_COOKIE');
  },
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -30`

Expected: Compile errors in `sync-active-timers.ts` referencing `JIRA_FULL_COOKIE` (that's fine, we fix it in Task 3). No errors in `env.ts` itself.

**Step 3: Commit**

```bash
git add apps/api/src/lib/env.ts
git commit -m "refactor: replace JIRA_FULL_COOKIE with Forge gateway env vars in env.ts"
```

---

### Task 2: Create forge-client.ts — Forge GraphQL timer fetcher

**Files:**
- Create: `apps/api/src/lib/forge-client.ts`
- Reference: `apps/api/src/lib/types.ts` (for `RawClockworkTimer`)

**Step 1: Create the forge-client module**

Create `apps/api/src/lib/forge-client.ts` with the following content:

```typescript
/**
 * Fetches timer data from Clockwork via the Atlassian Forge GraphQL Gateway.
 *
 * Replaces the old JWT-based flow:
 *   Old: Jira cookie → Servlet → JWT → GET app.clockwork.report/timers.json
 *   New: Atlassian session token → POST {domain}/gateway/api/graphql → invokeExtension
 */

import type { RawClockworkTimer } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ForgeTimerPayload {
  status: number;
  body: {
    timers: RawClockworkTimer[];
  };
}

interface ForgeInvokeResponse {
  data: {
    invokeExtension: {
      success: boolean;
      response: {
        body: {
          success: boolean;
          payload: ForgeTimerPayload;
        };
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
      path: '/my_recently_destroyed_timers.json',
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
  if (!responseBody?.success || !responseBody.payload?.body?.timers) {
    throw new ForgeApiError(
      responseBody?.payload?.status ?? 500,
      'Forge response did not contain timer data',
      responseBody,
    );
  }

  const allTimers = responseBody.payload.body.timers;

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
    contextToken: invocation.contextToken?.jwt ?? null,
    contextTokenExpiresAt: invocation.contextToken?.expiresAt ?? null,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | grep forge-client`

Expected: No errors in `forge-client.ts`.

**Step 3: Commit**

```bash
git add apps/api/src/lib/forge-client.ts
git commit -m "feat: add forge-client.ts for Forge GraphQL timer fetching"
```

---

### Task 3: Add Redis helpers for contextToken caching

**Files:**
- Modify: `apps/api/src/lib/redis.ts`

**Step 1: Add contextToken cache functions**

Add the following at the end of `apps/api/src/lib/redis.ts` (before the closing of the file, after the Issue Cache section):

```typescript
// ─── Forge Context Token Cache ───────────────────────────────────────────────

const FORGE_CONTEXT_TOKEN_KEY = 'clockwork:forge:context-token';
const FORGE_CONTEXT_TOKEN_MAX_TTL_SECONDS = 840; // 14 minutes

export async function getCachedForgeContextToken(): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(FORGE_CONTEXT_TOKEN_KEY);
  } catch (err) {
    console.error('Redis getCachedForgeContextToken error:', err);
    return null;
  }
}

export async function setCachedForgeContextToken(
  token: string,
  expiresAtMs?: string,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    let ttl = FORGE_CONTEXT_TOKEN_MAX_TTL_SECONDS;
    if (expiresAtMs) {
      const expiresAt = Number(expiresAtMs);
      const secondsUntilExpiry = Math.floor((expiresAt - Date.now()) / 1000) - 60;
      if (secondsUntilExpiry > 0) {
        ttl = Math.min(secondsUntilExpiry, FORGE_CONTEXT_TOKEN_MAX_TTL_SECONDS);
      }
    }
    await redis.set(FORGE_CONTEXT_TOKEN_KEY, token, { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedForgeContextToken error:', err);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | grep redis`

Expected: No errors in `redis.ts`.

**Step 3: Commit**

```bash
git add apps/api/src/lib/redis.ts
git commit -m "feat: add Forge contextToken cache helpers to redis.ts"
```

---

### Task 4: Update jira-user-resolver.ts — use RawClockworkTimer from types.ts

**Files:**
- Modify: `apps/api/src/lib/jira-user-resolver.ts`

**Step 1: Change import to use types.ts instead of clockwork-report.ts**

In `apps/api/src/lib/jira-user-resolver.ts`, change line 2:

From:
```typescript
import type { ClockworkReportTimersResponse } from './clockwork-report';
```

To:
```typescript
import type { RawClockworkTimer } from './types';
```

And change line 37, the parameter type:

From:
```typescript
  rawTimers: ClockworkReportTimersResponse['timers'],
```

To:
```typescript
  rawTimers: RawClockworkTimer[],
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | grep jira-user-resolver`

Expected: No errors. The `RawClockworkTimer` interface in `types.ts` has the same shape as the `RawTimer` in `clockwork-report.ts`.

**Step 3: Commit**

```bash
git add apps/api/src/lib/jira-user-resolver.ts
git commit -m "refactor: use RawClockworkTimer from types.ts in jira-user-resolver"
```

---

### Task 5: Rewrite sync-active-timers.ts — use Forge client

**Files:**
- Modify: `apps/api/src/inngest/sync-active-timers.ts`

**Step 1: Replace the entire sync function**

Replace the full content of `apps/api/src/inngest/sync-active-timers.ts` with:

```typescript
import { env } from '../lib/env';
import { fetchTimersViaForge } from '../lib/forge-client';
import { resolveTimerAuthors } from '../lib/jira-user-resolver';
import {
  deleteActiveTimers,
  getActiveUserIds,
  getCachedForgeContextToken,
  setActiveTimers,
  setActiveUserIds,
  setCachedForgeContextToken,
} from '../lib/redis';
import type { Timer } from '../lib/types';
import { inngest } from './client';

interface SyncTimersEvent {
  data: {
    userEmail?: string;
    jiraDomain?: string;
  };
}

/**
 * Inngest function: sync-active-timers
 *
 * Triggered by:
 *  - event: "clockwork/timers.sync.requested"
 *  - cron: every minute 7:00-19:59 Mon-Sat (VN time)
 *
 * Steps:
 *   1. Fetch active timers via Atlassian Forge GraphQL Gateway
 *   2. Resolve timer authors via Jira user cache
 *   3. Cache per-user and global timers to Redis
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: 'sync-active-timers',
    name: 'Sync Active Clockwork Timers',
    retries: 2,
  },
  [
    { event: 'clockwork/timers.sync.requested' },
    { cron: 'TZ=Asia/Ho_Chi_Minh * 7-19 * * 1-6' },
  ],
  async ({ event, step }) => {
    const eventData = (event as SyncTimersEvent).data;
    const jiraDomain = eventData?.jiraDomain ?? env.JIRA_DOMAIN;

    const result = await step.run('sync-process', async () => {
      console.log(`[sync-process] Starting sync for domain: ${jiraDomain}`);

      // 1. Fetch timers via Forge GraphQL Gateway
      console.log('[sync-process] Fetching timers via Forge GraphQL Gateway...');
      const cachedContextToken = await getCachedForgeContextToken() ?? undefined;
      const forgeResult = await fetchTimersViaForge(
        env.ATLASSIAN_SESSION_TOKEN,
        jiraDomain,
        env.JIRA_CLOUD_ID,
        env.JIRA_WORKSPACE_ID,
        env.FORGE_EXTENSION_ID,
        cachedContextToken,
      );

      // Cache the new context token for next run
      if (forgeResult.contextToken) {
        await setCachedForgeContextToken(
          forgeResult.contextToken,
          forgeResult.contextTokenExpiresAt ?? undefined,
        );
      }

      const timers = forgeResult.timers;
      console.log(`[sync-process] Fetched ${timers.length} active timers.`);

      // 2. Resolve timer authors via Jira user cache
      console.log('[sync-process] Resolving timer authors via Jira user cache...');
      const allEntries = await resolveTimerAuthors(timers);
      console.log(`[sync-process] Author resolution complete for ${allEntries.length} timers.`);

      // 3. Group by user
      const byUser: Record<string, Timer[]> = {};
      for (const entry of allEntries) {
        const accountId = entry.runningFor;
        if (accountId) {
          if (!byUser[accountId]) byUser[accountId] = [];
          byUser[accountId].push(entry);
        }
      }

      const usersCount = Object.keys(byUser).length;
      console.log(`[sync-process] Grouped timers into ${usersCount} users.`);

      // 4. Cache to Redis
      console.log('[sync-process] Caching to Redis...');

      const oldActiveUsers = await getActiveUserIds();
      const currentActiveUsers = Object.keys(byUser);

      const usersToClear = oldActiveUsers.filter(
        (userId) => !currentActiveUsers.includes(userId),
      );

      if (usersToClear.length > 0) {
        console.log(
          `[sync-process] Clearing cache for ${usersToClear.length} users with stopped timers...`,
        );
        await Promise.all(
          usersToClear.map((userId) => deleteActiveTimers(userId)),
        );
      }

      await setActiveUserIds(currentActiveUsers);

      await Promise.all(
        Object.entries(byUser).map(([accountId, userTimers]) =>
          setActiveTimers(accountId, userTimers),
        ),
      );

      await setActiveTimers('all', allEntries);
      console.log('[sync-process] Caching complete.');

      return {
        success: true,
        jiraDomain,
        timersCount: timers.length,
        cachedUsers: usersCount,
      };
    });

    return result;
  },
);
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors (or only unrelated warnings).

**Step 3: Commit**

```bash
git add apps/api/src/inngest/sync-active-timers.ts
git commit -m "feat: migrate sync-active-timers to Forge GraphQL Gateway"
```

---

### Task 6: Delete dead code — jira-jwt.ts and clockwork-report.ts

**Files:**
- Delete: `apps/api/src/lib/jira-jwt.ts`
- Delete: `apps/api/src/lib/clockwork-report.ts`

**Step 1: Verify no remaining imports**

Run: `cd apps/api && grep -r "jira-jwt\|clockwork-report" src/ --include="*.ts"`

Expected: No results (all imports were already replaced in Tasks 4 and 5).

**Step 2: Delete the files**

```bash
rm apps/api/src/lib/jira-jwt.ts
rm apps/api/src/lib/clockwork-report.ts
```

**Step 3: Verify TypeScript still compiles**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -20`

Expected: Clean compile. No errors.

**Step 4: Commit**

```bash
git add -A apps/api/src/lib/jira-jwt.ts apps/api/src/lib/clockwork-report.ts
git commit -m "chore: delete jira-jwt.ts and clockwork-report.ts (replaced by forge-client.ts)"
```

---

### Task 7: Update environment variables in deployment

**Files:**
- No code changes — deployment configuration only

**Step 1: Set new env vars in Vercel (or wherever deployed)**

Add these environment variables:

| Variable | Value |
|----------|-------|
| `ATLASSIAN_SESSION_TOKEN` | Value of `tenant.session.token` cookie from Atlassian browser session |
| `FORGE_EXTENSION_ID` | `ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages` |
| `JIRA_CLOUD_ID` | `afde6ffd-9c34-4257-a163-36336cf8d953` |
| `JIRA_WORKSPACE_ID` | `fefd8a92-e020-4606-8adf-3139353b0663` |

**Step 2: Remove old env var**

Remove `JIRA_FULL_COOKIE` from the deployment environment.

**Step 3: Verify the Inngest function runs**

Trigger a sync by calling the start/stop timer endpoint or wait for the next cron run. Check Inngest dashboard logs for:
- `[sync-process] Fetching timers via Forge GraphQL Gateway...`
- `[sync-process] Fetched N active timers.`
- No errors about missing env vars or failed fetch

---

### Task 8: Final type-check and verification

**Step 1: Full type-check**

Run: `cd apps/api && npx tsc --noEmit`

Expected: Clean. Zero errors.

**Step 2: Verify no dangling references to old modules**

Run: `grep -r "acquireClockworkJwt\|JIRA_FULL_COOKIE\|clockwork-report\|jira-jwt" apps/api/src/ --include="*.ts"`

Expected: No results.

**Step 3: Commit any remaining changes**

If any cleanup was needed:
```bash
git add -A
git commit -m "chore: final cleanup after Forge API migration"
```
