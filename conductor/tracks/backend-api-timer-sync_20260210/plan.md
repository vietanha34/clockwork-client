# Implementation Plan: Backend API & Inngest Timer Sync

**Track ID:** backend-api-timer-sync_20260210
**Spec:** [spec.md](./spec.md)
**Created:** 2026-02-10
**Status:** [ ] Not Started

## Overview

Build the Vercel API route handlers and the Inngest background function that powers the active timer sync. Work in layers: shared types/utilities first, then the Redis cache layer, then the Clockwork/Atlassian client wrappers, then the Vercel API routes, then the Inngest function implementation, and finally environment setup.

## Phase 1: Shared Types & Utilities

Define TypeScript types for all API entities and shared utility functions used across `apps/api` and `apps/inngest`.

### Tasks

- [x] Task 1.1: Define shared types: `Timer`, `Worklog`, `Issue`, `Project`, `ClockworkUser` in `apps/api/lib/types.ts`
- [x] Task 1.2: Create `apps/api/lib/env.ts` — typed environment variable accessors with validation
- [x] Task 1.3: Create `apps/api/lib/response.ts` — standard success/error response helpers

### Verification

- [x] Type-check passes: `pnpm --filter api type-check`

## Phase 2: Redis Cache Layer

Implement the Upstash Redis client and cache read/write helpers for timer data.

### Tasks

- [x] Task 2.1: Create `apps/api/lib/redis.ts` — initialize `@upstash/redis` client from env vars
- [x] Task 2.2: Implement `getActiveTimers(userEmail)` — read cached timers from Redis key `clockwork:timers:{userEmail}`
- [x] Task 2.3: Implement `setActiveTimers(userEmail, timers, ttl?)` — write timer data to Redis
- [x] Task 2.4: Create `GET /api/timers/active` route — reads from Redis, returns cached timer data

### Verification

- [x] `GET /api/timers/active?userEmail=test@example.com` returns `200` with empty/cached data
- [x] Type-check passes

## Phase 3: Clockwork Pro API Client

Implement the HTTP client wrapper for the Clockwork Pro REST API.

### Tasks

- [x] Task 3.1: Create `apps/api/lib/clockwork-client.ts` — base fetch wrapper with `X-Clockwork-Token` auth header and `CLOCKWORK_API_BASE_URL`
- [x] Task 3.2: Implement `getWorklogs(userEmail, date)` — fetch today's worklogs via Clockwork API
- [x] Task 3.3: Implement `startTimer(issueKey, comment?)` — start a new timer
- [x] Task 3.4: Implement `stopTimer(timerId)` — stop a running timer
- [x] Task 3.5: Create `GET /api/worklogs` route — calls `getWorklogs`, returns formatted list
- [x] Task 3.6: Create `POST /api/timers/start` route — calls `startTimer`
- [x] Task 3.7: Create `POST /api/timers/stop` route — calls `stopTimer`

### Verification

- [x] `GET /api/worklogs?userEmail=x&date=today` returns worklog data
- [x] `POST /api/timers/start` and `/stop` return `200`
- [x] Type-check passes

## Phase 4: Atlassian API Client

Implement the HTTP client wrapper for the Atlassian REST API.

### Tasks

- [x] Task 4.1: Create `apps/api/lib/atlassian-client.ts` — base fetch wrapper with Basic auth (`ATLASSIAN_EMAIL:ATLASSIAN_API_TOKEN` base64), `JIRA_DOMAIN` env var
- [x] Task 4.2: Implement `getIssue(issueKey)` — fetch issue details (summary, project, assignee)
- [x] Task 4.3: Create `GET /api/issues/[key]` route — calls `getIssue`, returns formatted issue data

### Verification

- [x] `GET /api/issues/KAN-9` returns issue details with project info
- [x] Type-check passes

## Phase 5: Inngest Sync Function

Implement the `sync-active-timers` Inngest function with full JWT acquisition and timer fetch logic.

### Tasks

- [x] Task 5.1: Create `apps/inngest/src/lib/jira-jwt.ts` — POST to Jira servlet endpoint to exchange `JIRA_FULL_COOKIE` for Clockwork `contextJwt`
- [x] Task 5.2: Create `apps/inngest/src/lib/clockwork-report.ts` — GET `timers.json` from `app.clockwork.report` using JWT
- [x] Task 5.3: Create `apps/inngest/src/lib/redis.ts` — `@upstash/redis` client for inngest app
- [x] Task 5.4: Implement the full `sync-active-timers` function in `apps/inngest/src/inngest/sync-active-timers.ts`:
  - Step 1: `acquire-jwt` — call `jira-jwt.ts`
  - Step 2: `fetch-timers` — call `clockwork-report.ts` with JWT
  - Step 3: `cache-timers` — write results to Redis via `setActiveTimers`

### Verification

- [ ] Inngest dev server starts: `pnpm --filter inngest dev`
- [ ] Trigger `clockwork/timers.sync.requested` event — function runs all 3 steps
- [ ] Redis key `clockwork:timers:{userEmail}` is populated after function run

## Phase 6: Environment Setup

Document and validate all required environment variables.

### Tasks

- [x] Task 6.1: Create `apps/api/.env.example` with all required vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CLOCKWORK_API_BASE_URL`, `CLOCKWORK_API_TOKEN`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_DOMAIN`
- [x] Task 6.2: Create `apps/inngest/.env.example` with required vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JIRA_FULL_COOKIE`, `JIRA_DOMAIN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- [x] Task 6.3: Update root `.gitignore` to ensure `.env` files are excluded

### Verification

- [x] `.env.example` files document all required variables
- [x] No secrets committed to git

## Final Verification

- [ ] All acceptance criteria met
- [ ] `pnpm turbo type-check` — 0 errors
- [ ] `pnpm turbo lint` — 0 errors
- [ ] All 5 API routes respond correctly in local dev
- [ ] Inngest sync function completes all 3 steps successfully
- [ ] Ready for Tauri client integration

---

_Generated by Conductor. Tasks will be marked [~] in progress and [x] complete._
