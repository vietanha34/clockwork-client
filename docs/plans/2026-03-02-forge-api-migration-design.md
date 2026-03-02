# Forge API Migration Design

**Date:** 2026-03-02
**Status:** Approved
**Scope:** Migrate timer fetching from Clockwork Report API (JWT) to Atlassian Forge GraphQL Gateway

## Problem

Clockwork v3.7.0 migrated to the Atlassian Forge platform. The old JWT acquisition endpoint (`/plugins/servlet/ac/clockwork-cloud/clockwork-timers`) returns 404. The Inngest `sync-active-timers` function can no longer fetch active timers.

## New API

Clockwork now exposes timer data through the Atlassian Forge GraphQL Gateway:

- **Endpoint:** `POST https://{domain}/gateway/api/graphql`
- **Operation:** `mutation forge_ui_invokeExtension`
- **Authentication:** Atlassian `tenant.session.token` cookie (replaces Jira servlet JWT exchange)
- **Timer path:** `/my_recently_destroyed_timers.json` (returns both active and recently stopped timers)
- **contextToken:** Auto-refreshed in each response; must be cached and reused for subsequent calls

### Key differences from old API

| Aspect | Old (`/timers.json`) | New (Forge gateway) |
|--------|---------------------|---------------------|
| Auth | Jira cookie → Servlet → JWT | Atlassian session token directly |
| Endpoint | `app.clockwork.report/timers.json` | `{domain}/gateway/api/graphql` |
| Data | Active timers only | Active + recently stopped |
| `within_working_hours` | `boolean` | `null` (not computed server-side) |

### Response shape

```
data.invokeExtension.response.body.payload.body.timers[]
  ├── id: number
  ├── started_at: string (ISO)
  ├── finished_at: string | null  (null = active)
  ├── running_for: string (accountId)
  ├── comment: string | null
  ├── within_working_hours: null
  ├── started_within_working_hours: null
  └── issue: { key: string, id: number }
```

contextToken returned at `data.invokeExtension.contextToken.jwt` with `expiresAt`.

## Approach: Replace fetch layer in Inngest sync

Keep existing architecture (server-side Inngest sync → Redis cache → client polling). Only replace the JWT acquisition and timer fetching steps.

### What changes

1. **New module: `forge-client.ts`**
   - `fetchTimersViaForge(sessionToken, jiraDomain, contextToken?)` → `{ timers, newContextToken }`
   - Constructs Forge GraphQL mutation with `invokeExtension`
   - Filters response: only `finished_at === null`, deduplicated by `id`

2. **Modified: `sync-active-timers.ts`**
   - Replace `acquireClockworkJwt()` + `fetchActiveTimers()` with `fetchTimersViaForge()`
   - Cache contextToken in Redis (`clockwork:forge:context-token`, TTL 14min)

3. **Modified: `env.ts`**
   - Remove: `JIRA_FULL_COOKIE`
   - Add: `ATLASSIAN_SESSION_TOKEN` (value of `tenant.session.token` cookie)
   - Add: `FORGE_EXTENSION_ID` (Clockwork Forge extension ARI)
   - Add: `JIRA_CLOUD_ID` (for workspace ARI construction)
   - Add: `JIRA_WORKSPACE_ID` (for contextIds ARI)

4. **Deleted: `jira-jwt.ts`** (entire file)

5. **Deleted: `stopTimerById()` from `clockwork-report.ts`** (dead code)

6. **Deleted or gutted: `clockwork-report.ts`** (fetchActiveTimers no longer needed; RawTimer interface moves to forge-client.ts or types.ts)

### What stays the same

- `clockwork-client.ts` (Pro API for start/stop/worklogs — still works with Token auth)
- `atlassian-client.ts` (Jira REST API)
- `redis.ts` (add 1 key for contextToken cache)
- `jira-user-resolver.ts` (adapt if RawTimer interface changes)
- Frontend (no changes needed)
- All other API endpoints (`/api/timers/start`, `/api/timers/stop`, `/api/worklogs`, etc.)

### Environment variables

| Variable | Action | Description |
|----------|--------|-------------|
| `JIRA_FULL_COOKIE` | Remove | No longer needed |
| `ATLASSIAN_SESSION_TOKEN` | Add | `tenant.session.token` cookie value |
| `FORGE_EXTENSION_ID` | Add | `ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages` |
| `JIRA_CLOUD_ID` | Add | `afde6ffd-9c34-4257-a163-36336cf8d953` |
| `JIRA_WORKSPACE_ID` | Add | `fefd8a92-e020-4606-8adf-3139353b0663` |
| `JIRA_DOMAIN` | Keep | e.g. `thudojsc.atlassian.net` |

### contextToken lifecycle

1. First call: use initial contextToken from env or generate from Forge (the gateway issues one even without prior token)
2. Each response includes a fresh `contextToken.jwt` with `expiresAt`
3. Cache in Redis with TTL = min(token expiry - now - 60s, 14 minutes)
4. Next Inngest run reads cached token; if expired/missing, call without contextToken (gateway issues new one)
