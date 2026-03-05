# Lunch Break Worklog Adjustment - Design

## Problem

Team has a fixed 1.5h lunch break (12:00-13:30). Clockwork Pro does not automatically subtract lunch time from worklogs. Worklogs that span the lunch period include inflated time.

## Solution

An Inngest cron job that runs at 17:10 Mon-Fri, scans worklogs from today and yesterday via Jira REST API, identifies worklogs overlapping with lunch (12:00-13:30), and adjusts their `timeSpent` via the Clockwork Pro update API.

## Trigger

- **Inngest cron**: 17:10 UTC+7, Monday-Friday (`10 10 * * 1-5` UTC)
- Scans **today + yesterday** (yesterday as safety net if previous job failed)
- Each worklog adjusted only once (tracked in Redis)

## Flow

```
Inngest cron (17:10 Mon-Fri)
  1. Calculate `since` = epoch_ms of 00:00 yesterday
  2. GET /rest/api/3/worklog/updated?since={since}
     - Auth: Basic (email + API token from env)
     - Paginate until lastPage=true
     - Collect all worklogIds
  3. POST /rest/api/3/worklog/list { ids: [...] }
     - Get full detail: started, timeSpentSeconds, issueId, author, comment
  4. Filter:
     - author.accountId == target accountId
     - started falls within today or yesterday
     - worklogId NOT in Redis adjusted set
     - overlap with 12:00-13:30 > 0
  5. For each worklog to adjust:
     - Calculate overlap seconds
     - Acquire Clockwork JWT (cached by exp claim)
     - PUT /worklogs/{id}.json → timeSpent minus overlap
     - Add worklogId to Redis adjusted set
  6. Log results (adjusted count, skipped count)
```

## Overlap Calculation

```
worklog_start = parsed `started` timestamp
worklog_end   = worklog_start + timeSpentSeconds
lunch_start   = 12:00 same day (UTC+7)
lunch_end     = 13:30 same day (UTC+7)

overlap = max(0, min(worklog_end, lunch_end) - max(worklog_start, lunch_start))
adjusted_time = timeSpentSeconds - overlap
```

Only adjust when `overlap > 0`.

## JWT Acquisition

```
POST https://thudojsc.atlassian.net/plugins/servlet/ac/clockwork-cloud/log-work-dialog
Cookie: tenant.session.token={TENANT_SESSION_TOKEN from env}
Body: plugin-key=clockwork-cloud&key=log-work-dialog&...&ac.issueId={issueId}

Response → contextJwt field
Cache until JWT exp claim
```

## Update Worklog API

```
PUT https://app.clockwork.report/worklogs/{worklogId}.json?xdm_e=https://thudojsc.atlassian.net
Authorization: JWT {contextJwt}
Content-Type: application/json
Body: {
  "adjust_estimate": "new",
  "new_estimate": "1m",
  "expand": "properties",
  "issueId": "{issueId}",
  "timeSpent": "{adjusted_minutes}m",
  "comment": "{original comment}",
  "started": "{original started}"
}
```

## Redis Tracking

```
Key:  clockwork:adjusted-worklogs
Type: SET
Members: worklog IDs that have been adjusted
TTL: 15 days (auto cleanup)
```

## Architecture

```
apps/api/src/lib/jira-worklog-client.ts        -- Jira REST API (updated + list)
apps/api/src/lib/clockwork-jwt.ts              -- JWT acquisition + cache
apps/api/src/lib/worklog-adjuster.ts           -- Overlap calc + Clockwork update
apps/api/src/inngest/adjust-lunch-worklogs.ts  -- Inngest cron orchestration
```

## No Frontend Changes

Lunch break time is hardcoded (12:00-13:30) per team rule. No settings UI needed.
