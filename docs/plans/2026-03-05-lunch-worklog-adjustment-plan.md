# Lunch Break Worklog Adjustment - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically subtract 1.5h lunch break (12:00-13:30) from worklogs that overlap the lunch period, via an Inngest cron job at 17:10 Mon-Fri.

**Architecture:** Inngest cron job fetches updated worklogs from Jira REST API (`/worklog/updated` + `/worklog/list`), calculates time overlap with 12:00-13:30, acquires a Clockwork Pro JWT via the servlet endpoint, and updates affected worklogs via the Clockwork Pro PUT API. Redis SET tracks already-adjusted worklog IDs to prevent double-adjustment.

**Tech Stack:** Inngest (cron), Jira REST API v3 (Basic auth), Clockwork Pro API (JWT auth), Redis (tracking), TypeScript

---

### Task 1: Add Jira Worklog Client

**Files:**
- Create: `apps/api/src/lib/jira-worklog-client.ts`

**Step 1: Create the Jira worklog client**

This module fetches recently updated worklogs using Jira's bulk worklog APIs. It reuses the existing `atlassianFetch` pattern from `atlassian-client.ts` but needs POST support, so we add a standalone fetch helper.

```typescript
import { env } from './env';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorklogUpdatedResponse {
  values: Array<{ worklogId: number; updatedTime: number }>;
  lastPage: boolean;
  nextPage?: string;
}

interface JiraWorklogDetail {
  id: string;
  issueId: string;
  author: { accountId: string };
  started: string;           // e.g. "2026-03-05T09:00:00.000+0700"
  timeSpentSeconds: number;
  comment?: { content?: Array<{ content?: Array<{ text?: string }> }> };
}

interface WorklogListResponse {
  values: JiraWorklogDetail[];
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function getBasicAuthHeader(): string {
  const credentials = `${env.ATLASSIAN_EMAIL}:${env.ATLASSIAN_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function jiraFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `https://${env.JIRA_DOMAIN}/rest/api/3${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all worklog IDs updated since the given epoch timestamp.
 * Paginates automatically until lastPage=true.
 */
export async function getUpdatedWorklogIds(sinceMs: number): Promise<number[]> {
  const ids: number[] = [];
  let url: string | null = `/worklog/updated?since=${sinceMs}`;

  while (url) {
    const data = await jiraFetch<WorklogUpdatedResponse>(url);
    for (const entry of data.values) {
      ids.push(entry.worklogId);
    }
    url = data.lastPage ? null : (data.nextPage ?? null);
  }

  console.log(`[jira-worklog] Fetched ${ids.length} updated worklog IDs since ${sinceMs}`);
  return ids;
}

/**
 * Fetch full worklog details by IDs (max 1000 per request per Jira docs).
 */
export async function getWorklogsByIds(ids: number[]): Promise<JiraWorklogDetail[]> {
  if (ids.length === 0) return [];

  const results: JiraWorklogDetail[] = [];
  const chunkSize = 1000;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const data = await jiraFetch<WorklogListResponse>('/worklog/list', {
      method: 'POST',
      body: JSON.stringify({ ids: chunk }),
    });
    results.push(...data.values);
  }

  console.log(`[jira-worklog] Fetched ${results.length} worklog details`);
  return results;
}

export type { JiraWorklogDetail };
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors related to jira-worklog-client.ts

**Step 3: Commit**

```bash
git add apps/api/src/lib/jira-worklog-client.ts
git commit -m "feat: add Jira worklog client for bulk worklog fetching"
```

---

### Task 2: Add Clockwork JWT Acquisition

**Files:**
- Create: `apps/api/src/lib/clockwork-jwt.ts`
- Modify: `apps/api/src/lib/redis.ts` (add JWT cache functions)

**Step 1: Add Redis cache functions for Clockwork JWT**

Add to the end of `apps/api/src/lib/redis.ts`:

```typescript
// ─── Clockwork JWT Cache ─────────────────────────────────────────────────────

const CLOCKWORK_JWT_KEY = 'clockwork:jwt';
const CLOCKWORK_JWT_MAX_TTL_SECONDS = 840; // 14 minutes

export async function getCachedClockworkJwt(): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(CLOCKWORK_JWT_KEY);
  } catch (err) {
    console.error('Redis getCachedClockworkJwt error:', err);
    return null;
  }
}

export async function setCachedClockworkJwt(
  token: string,
  expiresAt?: number,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    let ttl = CLOCKWORK_JWT_MAX_TTL_SECONDS;
    if (expiresAt) {
      const secondsUntilExpiry = Math.floor((expiresAt * 1000 - Date.now()) / 1000) - 60;
      if (secondsUntilExpiry > 0) {
        ttl = Math.min(secondsUntilExpiry, CLOCKWORK_JWT_MAX_TTL_SECONDS);
      }
    }
    await redis.set(CLOCKWORK_JWT_KEY, token, { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedClockworkJwt error:', err);
  }
}
```

**Step 2: Create the Clockwork JWT client**

```typescript
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
```

**Step 3: Add `JIRA_ACCOUNT_ID` to env.ts**

Add after the `JIRA_WORKSPACE_ID` getter in `apps/api/src/lib/env.ts`:

```typescript
  get JIRA_ACCOUNT_ID(): string {
    return required('JIRA_ACCOUNT_ID');
  },
```

**Step 4: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/api/src/lib/clockwork-jwt.ts apps/api/src/lib/redis.ts apps/api/src/lib/env.ts
git commit -m "feat: add Clockwork JWT acquisition with Redis caching"
```

---

### Task 3: Add Worklog Adjuster

**Files:**
- Create: `apps/api/src/lib/worklog-adjuster.ts`
- Modify: `apps/api/src/lib/redis.ts` (add adjusted worklog tracking)

**Step 1: Add Redis functions for tracking adjusted worklogs**

Add to the end of `apps/api/src/lib/redis.ts`:

```typescript
// ─── Adjusted Worklog Tracking ───────────────────────────────────────────────

const ADJUSTED_WORKLOGS_KEY = 'clockwork:adjusted-worklogs';
const ADJUSTED_WORKLOGS_TTL_SECONDS = 15 * 24 * 60 * 60; // 15 days

export async function isWorklogAdjusted(worklogId: number): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    return await redis.sIsMember(ADJUSTED_WORKLOGS_KEY, String(worklogId));
  } catch (err) {
    console.error('Redis isWorklogAdjusted error:', err);
    return false;
  }
}

export async function markWorklogAdjusted(worklogId: number): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.sAdd(ADJUSTED_WORKLOGS_KEY, String(worklogId));
    // Refresh TTL on each addition
    await redis.expire(ADJUSTED_WORKLOGS_KEY, ADJUSTED_WORKLOGS_TTL_SECONDS);
  } catch (err) {
    console.error('Redis markWorklogAdjusted error:', err);
  }
}
```

**Step 2: Create the worklog adjuster module**

```typescript
// apps/api/src/lib/worklog-adjuster.ts
import { env } from './env';
import { getClockworkJwt } from './clockwork-jwt';
import { isWorklogAdjusted, markWorklogAdjusted } from './redis';
import type { JiraWorklogDetail } from './jira-worklog-client';

const LUNCH_START_HOUR = 12;
const LUNCH_START_MINUTE = 0;
const LUNCH_END_HOUR = 13;
const LUNCH_END_MINUTE = 30;
const LUNCH_DURATION_SECONDS = 90 * 60; // 1.5h
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

interface AdjustResult {
  worklogId: number;
  issueId: string;
  originalSeconds: number;
  overlapSeconds: number;
  adjustedSeconds: number;
}

/**
 * Calculate the overlap in seconds between a worklog's time range and lunch break.
 */
export function calculateLunchOverlap(started: string, timeSpentSeconds: number): number {
  // Parse started as a Date
  const startDate = new Date(started);

  // Get the date components in VN timezone
  const vnDate = new Date(startDate.toLocaleString('en-US', { timeZone: VN_TIMEZONE }));
  const year = vnDate.getFullYear();
  const month = vnDate.getMonth();
  const day = vnDate.getDate();

  // Build lunch start/end as timestamps in VN time
  // We use the same calendar day as the worklog start
  const lunchStartLocal = new Date(year, month, day, LUNCH_START_HOUR, LUNCH_START_MINUTE);
  const lunchEndLocal = new Date(year, month, day, LUNCH_END_HOUR, LUNCH_END_MINUTE);

  // Convert lunch times to UTC timestamps using the offset from the started timestamp
  // The offset between vnDate and startDate gives us the VN→UTC offset
  const vnToUtcOffsetMs = startDate.getTime() - vnDate.getTime();
  const lunchStartUtc = new Date(lunchStartLocal.getTime() + vnToUtcOffsetMs);
  const lunchEndUtc = new Date(lunchEndLocal.getTime() + vnToUtcOffsetMs);

  const worklogStart = startDate;
  const worklogEnd = new Date(startDate.getTime() + timeSpentSeconds * 1000);

  const overlapStart = Math.max(worklogStart.getTime(), lunchStartUtc.getTime());
  const overlapEnd = Math.min(worklogEnd.getTime(), lunchEndUtc.getTime());

  const overlapMs = Math.max(0, overlapEnd - overlapStart);
  return Math.floor(overlapMs / 1000);
}

/**
 * Extract plain text from Jira ADF comment structure.
 */
function extractCommentText(comment?: JiraWorklogDetail['comment']): string {
  if (!comment?.content) return '';
  return comment.content
    .flatMap((block) => block.content ?? [])
    .map((inline) => inline.text ?? '')
    .join('');
}

/**
 * Update a worklog's timeSpent via Clockwork Pro API.
 */
async function updateWorklogTime(
  worklogId: number,
  issueId: string,
  adjustedSeconds: number,
  started: string,
  comment: string,
): Promise<void> {
  // Need issue context for JWT - use a default project context
  // The JWT servlet needs an issue context, we use the worklog's issueId
  const jwt = await getClockworkJwt({
    issueId,
    issueKey: 'TL-1', // Placeholder - servlet only needs valid issueId
    projectId: '10545',
    projectKey: 'TL',
  });

  const adjustedMinutes = Math.max(1, Math.round(adjustedSeconds / 60));
  const timeSpent = `${adjustedMinutes}m`;

  const url = `https://app.clockwork.report/worklogs/${worklogId}.json?xdm_e=https://${env.JIRA_DOMAIN}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `JWT ${jwt}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://app.clockwork.report',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      adjust_estimate: 'new',
      new_estimate: '1m',
      expand: 'properties',
      issueId,
      timeSpent,
      comment,
      started,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockwork update worklog ${worklogId} failed ${res.status}: ${text}`);
  }

  console.log(`[worklog-adjuster] Updated worklog ${worklogId}: ${timeSpent}`);
}

/**
 * Process a list of worklogs: filter by accountId and date range,
 * calculate lunch overlap, and adjust via Clockwork API.
 */
export async function adjustWorklogs(
  worklogs: JiraWorklogDetail[],
  accountId: string,
  targetDates: string[], // YYYY-MM-DD array
): Promise<AdjustResult[]> {
  const results: AdjustResult[] = [];

  // Filter worklogs for target user and dates
  const candidates = worklogs.filter((w) => {
    if (w.author.accountId !== accountId) return false;

    // Extract date in VN timezone
    const startDate = new Date(w.started);
    const vnDateStr = startDate.toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE }); // YYYY-MM-DD
    return targetDates.includes(vnDateStr);
  });

  console.log(`[worklog-adjuster] Found ${candidates.length} candidate worklogs for ${accountId}`);

  for (const worklog of candidates) {
    const worklogId = Number(worklog.id);

    // Skip already adjusted
    if (await isWorklogAdjusted(worklogId)) {
      console.log(`[worklog-adjuster] Skipping already adjusted worklog ${worklogId}`);
      continue;
    }

    const overlap = calculateLunchOverlap(worklog.started, worklog.timeSpentSeconds);
    if (overlap <= 0) {
      console.log(`[worklog-adjuster] No lunch overlap for worklog ${worklogId}`);
      continue;
    }

    const adjustedSeconds = worklog.timeSpentSeconds - overlap;
    if (adjustedSeconds <= 0) {
      console.log(`[worklog-adjuster] Worklog ${worklogId} entirely within lunch, skipping`);
      continue;
    }

    console.log(
      `[worklog-adjuster] Adjusting worklog ${worklogId}: ${worklog.timeSpentSeconds}s - ${overlap}s = ${adjustedSeconds}s`,
    );

    await updateWorklogTime(
      worklogId,
      worklog.issueId,
      adjustedSeconds,
      worklog.started,
      extractCommentText(worklog.comment),
    );

    await markWorklogAdjusted(worklogId);

    results.push({
      worklogId,
      issueId: worklog.issueId,
      originalSeconds: worklog.timeSpentSeconds,
      overlapSeconds: overlap,
      adjustedSeconds,
    });
  }

  return results;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api/src/lib/worklog-adjuster.ts apps/api/src/lib/redis.ts
git commit -m "feat: add worklog adjuster with lunch overlap calculation"
```

---

### Task 4: Add Inngest Cron Function

**Files:**
- Create: `apps/api/src/inngest/adjust-lunch-worklogs.ts`
- Modify: `apps/api/api/inngest.ts` (register new function)

**Step 1: Create the Inngest cron function**

```typescript
// apps/api/src/inngest/adjust-lunch-worklogs.ts
import { env } from '../lib/env';
import { getUpdatedWorklogIds, getWorklogsByIds } from '../lib/jira-worklog-client';
import { adjustWorklogs } from '../lib/worklog-adjuster';
import { inngest } from './client';

/**
 * Inngest cron function: adjust-lunch-worklogs
 *
 * Runs at 17:10 VN time (10:10 UTC), Monday-Friday.
 * Scans worklogs updated today and yesterday, subtracts lunch break
 * overlap (12:00-13:30) from affected worklogs.
 */
export const adjustLunchWorklogs = inngest.createFunction(
  {
    id: 'adjust-lunch-worklogs',
    name: 'Adjust Lunch Break Worklogs',
    retries: 2,
  },
  [{ cron: 'TZ=Asia/Ho_Chi_Minh 10 17 * * 1-5' }],
  async ({ step }) => {
    const result = await step.run('adjust-worklogs', async () => {
      const accountId = env.JIRA_ACCOUNT_ID;

      // Calculate target dates (today + yesterday in VN timezone)
      const now = new Date();
      const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const today = vnNow.toLocaleDateString('en-CA'); // YYYY-MM-DD

      const vnYesterday = new Date(vnNow);
      vnYesterday.setDate(vnYesterday.getDate() - 1);
      const yesterday = vnYesterday.toLocaleDateString('en-CA');

      const targetDates = [yesterday, today];
      console.log(`[adjust-lunch] Target dates: ${targetDates.join(', ')}`);

      // Calculate since = 00:00 yesterday in VN time → epoch ms
      const sinceDate = new Date(vnYesterday);
      sinceDate.setHours(0, 0, 0, 0);
      // Adjust to UTC: VN is UTC+7, so subtract 7 hours
      const sinceMs = sinceDate.getTime() - 7 * 60 * 60 * 1000;

      console.log(`[adjust-lunch] Fetching worklogs updated since ${new Date(sinceMs).toISOString()}`);

      // 1. Get updated worklog IDs
      const worklogIds = await getUpdatedWorklogIds(sinceMs);
      if (worklogIds.length === 0) {
        console.log('[adjust-lunch] No updated worklogs found');
        return { adjusted: 0, skipped: 0, targetDates };
      }

      // 2. Get full worklog details
      const worklogs = await getWorklogsByIds(worklogIds);

      // 3. Adjust worklogs with lunch overlap
      const adjustResults = await adjustWorklogs(worklogs, accountId, targetDates);

      console.log(
        `[adjust-lunch] Done: ${adjustResults.length} adjusted, target dates: ${targetDates.join(', ')}`,
      );

      return {
        adjusted: adjustResults.length,
        details: adjustResults,
        targetDates,
        totalWorklogsScanned: worklogs.length,
      };
    });

    return result;
  },
);
```

**Step 2: Register the function in Inngest serve**

Modify `apps/api/api/inngest.ts`:

```typescript
import { serve } from 'inngest/node';
import { inngest } from '../src/inngest/client';
import { adjustLunchWorklogs } from '../src/inngest/adjust-lunch-worklogs';
import { syncActiveTimers } from '../src/inngest/sync-active-timers';

export default serve({
  client: inngest,
  functions: [syncActiveTimers, adjustLunchWorklogs],
});
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api/src/inngest/adjust-lunch-worklogs.ts apps/api/api/inngest.ts
git commit -m "feat: add Inngest cron job for lunch worklog adjustment (17:10 Mon-Fri)"
```

---

### Task 5: Add JIRA_ACCOUNT_ID to Environment

**Files:**
- Modify: `apps/api/.env.example` (if exists) or `.env.local`

**Step 1: Add the new env var**

Add `JIRA_ACCOUNT_ID` to the environment configuration. This is the accountId of the user whose worklogs should be adjusted.

Check if `.env.example` exists:
Run: `ls apps/api/.env*`

If `.env.example` exists, add:
```
JIRA_ACCOUNT_ID=61dfaa6949f1950069b0f94a
```

Also ensure the actual `.env` or `.env.local` has the value set.

**Step 2: Commit (only .env.example, never .env)**

```bash
git add apps/api/.env.example  # Only if it exists
git commit -m "chore: add JIRA_ACCOUNT_ID to env example"
```

---

### Task 6: End-to-End Verification

**Step 1: Verify all TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: Clean compilation, no errors

**Step 2: Verify Inngest function registration**

Run: `cd apps/api && npx inngest-cli dev` (or check via local dev server)

Verify the new `adjust-lunch-worklogs` function appears in the Inngest dashboard with cron schedule `TZ=Asia/Ho_Chi_Minh 10 17 * * 1-5`.

**Step 3: Manual smoke test (optional)**

You can trigger the function manually via the Inngest dashboard or by sending an event. Check logs for:
- `[jira-worklog] Fetched N updated worklog IDs since ...`
- `[worklog-adjuster] Found N candidate worklogs for ...`
- `[worklog-adjuster] Adjusting worklog ...: Xs - Ys = Zs`

---

## File Summary

| Action | File |
|--------|------|
| Create | `apps/api/src/lib/jira-worklog-client.ts` |
| Create | `apps/api/src/lib/clockwork-jwt.ts` |
| Create | `apps/api/src/lib/worklog-adjuster.ts` |
| Create | `apps/api/src/inngest/adjust-lunch-worklogs.ts` |
| Modify | `apps/api/src/lib/redis.ts` (add JWT cache + adjusted tracking) |
| Modify | `apps/api/src/lib/env.ts` (add JIRA_ACCOUNT_ID) |
| Modify | `apps/api/api/inngest.ts` (register new function) |
