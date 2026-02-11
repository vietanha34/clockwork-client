# Design: Switch Primary Key from Email to accountId

**Date:** 2026-02-11
**Status:** Approved
**Track:** accountid-primary-key_20260211 (pending)

## Problem

The system currently uses `emailAddress` as the primary key for user identity across:
- Redis cache keys: `clockwork:timers:<email>`
- API query params: `?userEmail=<email>`
- Inngest timer grouping: `author.emailAddress`

Jira Cloud's profile privacy settings prevent the service account from reading `emailAddress` for other users via `GET /rest/api/3/user?accountId=<id>`. This breaks timer grouping and caching for all team members who are not the service account.

The `running_for` field returned by Clockwork Report API always contains the Jira `accountId` — it is never affected by privacy settings.

## Solution

Replace `emailAddress` with `accountId` as the primary key throughout the system.

## Architecture

### Redis Key Change

```
BEFORE: clockwork:timers:<email>
AFTER:  clockwork:timers:<accountId>
```

Additional cache key for email → accountId resolution:
```
NEW: jira:email:<email>   TTL: 2 days
```

### New API Endpoint

```
GET /api/users/resolve?email=<email>
```

Response:
```json
{
  "accountId": "557058:abc123...",
  "emailAddress": "user@example.com",
  "displayName": "Nguyen Van A"
}
```

Server flow:
1. Check Redis `jira:email:<email>` cache
2. Cache miss → call Jira `GET /rest/api/3/user/search?query=<email>&maxResults=1`
3. Find exact email match → return user info
4. Cache result in Redis (TTL 2 days)

### Inngest Sync Change

```typescript
// BEFORE: group by author.emailAddress (may be empty)
const byUser: Record<string, Timer[]> = {};
for (const entry of allEntries) {
  if (entry.author?.emailAddress) { ... }
}

// AFTER: group by running_for (accountId, always present)
const byUser: Record<string, Timer[]> = {};
for (const entry of allEntries) {
  const accountId = entry.runningFor;
  if (accountId) { ... }
}
```

### Client Settings Change

```typescript
// BEFORE
interface AppSettings {
  userEmail: string;
  apiBaseUrl: string;
}

// AFTER
interface AppSettings {
  userEmail: string;
  apiBaseUrl: string;
  userAccountId: string; // resolved once on settings save
}
```

**Settings save flow:**
1. User enters email + API base URL → Save
2. Client calls `GET /api/users/resolve?email=<email>`
3. Store returned `accountId` in settings
4. All subsequent queries use `accountId`

### API Endpoint Change

```
GET /api/timers/active?accountId=<accountId>   (replaces ?userEmail=<email>)
```

## Files Affected

| File | Change |
|------|--------|
| `apps/api/src/lib/atlassian-client.ts` | Add `searchJiraUserByEmail(email)` |
| `apps/api/src/lib/redis.ts` | Add email→accountId cache helpers; update timer key prefix |
| `apps/api/api/timers/active.ts` | Change query param `userEmail` → `accountId` |
| `apps/api/api/users/resolve.ts` | New endpoint |
| `apps/api/src/inngest/sync-active-timers.ts` | Group by `runningFor` instead of `author.emailAddress` |
| `apps/tauri/src/lib/types.ts` | Add `userAccountId` to `AppSettings` |
| `apps/tauri/src/lib/api-client.ts` | Use `accountId` param for `fetchActiveTimers` |
| `apps/tauri/src/components/SettingsView.tsx` | Resolve + save accountId on settings save |
| `apps/tauri/src-tauri/src/lib.rs` | Add `user_account_id` field to Rust settings struct |

## Migration Strategy

No data migration script required. Redis keys with 10-minute TTL self-expire.

**Deploy order:**
1. Deploy `apps/api` (new `/api/users/resolve` endpoint, updated `/api/timers/active`)
2. Deploy `apps/inngest` (sync by accountId)
3. Users re-save Settings in Tauri app to resolve and store their `accountId`

**Transition window:** ~10 minutes after deploy where active timers may appear empty. Acceptable for internal tool.

## Risk Items

- **Worklogs**: `GET /api/worklogs?userEmail=<email>` currently passes email directly to Clockwork Pro API. Clockwork Pro API may require email (not accountId) for worklog queries. Verify before implementation — may need to keep email for worklog endpoint specifically, or resolve accountId → email server-side for that call.

## Graceful Fallback

If `userAccountId` is empty in client settings (user hasn't re-saved after update):
- App shows a nudge: "Please re-save your settings to enable full functionality"
- Active timers show empty state rather than error
