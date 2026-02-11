# Deployment Guide

This guide covers deploying `apps/api` and `apps/inngest` to Vercel.

## Prerequisites

- [Vercel account](https://vercel.com) with CLI installed (`npm i -g vercel`)
- [Inngest account](https://app.inngest.com) — to get event key and signing key
- [Upstash account](https://upstash.com) — Redis database for active timer cache

---

## Environment Variables

### `apps/api`

| Variable | Description | Where to get it |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash dashboard → Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash dashboard → Database → REST API |
| `CLOCKWORK_API_BASE_URL` | Clockwork Pro API base URL | `https://api.clockwork.report/v1` |
| `CLOCKWORK_API_TOKEN` | Clockwork Pro API token | Clockwork Pro → Settings → API |
| `ATLASSIAN_EMAIL` | Atlassian account email | Your Atlassian account email |
| `ATLASSIAN_API_TOKEN` | Atlassian API token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` |

### `apps/inngest`

| Variable | Description | Where to get it |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Same Redis instance as `apps/api` | Upstash dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | Same Redis instance as `apps/api` | Upstash dashboard |
| `JIRA_FULL_COOKIE` | Full Cookie header from a Jira browser session | Browser DevTools → Network tab → any Jira request → `Cookie` header |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` |
| `INNGEST_EVENT_KEY` | Inngest event key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Event Keys |
| `INNGEST_SIGNING_KEY` | Inngest signing key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Signing Key |

---

## Deploying `apps/api`

### 1. Link the project

```bash
cd apps/api
vercel link
```

When prompted, select or create a new project. Set the **Root Directory** to `apps/api` if asked.

### 2. Set environment variables

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add CLOCKWORK_API_BASE_URL
vercel env add CLOCKWORK_API_TOKEN
vercel env add ATLASSIAN_EMAIL
vercel env add ATLASSIAN_API_TOKEN
vercel env add JIRA_DOMAIN
```

Set each for `production`, `preview`, and `development` as needed.

### 3. Deploy

```bash
vercel --prod
```

### 4. Verify

```bash
curl https://<your-api-url>/api/health
# Expected: {"status":"ok","service":"clockwork-menubar-api","timestamp":"..."}
```

---

## Deploying `apps/inngest`

### 1. Link the project

```bash
cd apps/inngest
vercel link
```

Create a separate Vercel project for the Inngest app. Set the **Root Directory** to `apps/inngest`.

### 2. Set environment variables

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add JIRA_FULL_COOKIE
vercel env add JIRA_DOMAIN
vercel env add INNGEST_EVENT_KEY
vercel env add INNGEST_SIGNING_KEY
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Register with Inngest

After deployment, register the Inngest app via the Inngest dashboard or CLI:

```bash
# Using Inngest CLI (npx inngest-cli@latest deploy)
npx inngest-cli@latest deploy --url https://<your-inngest-url>/api/inngest
```

Or navigate to [app.inngest.com](https://app.inngest.com) → Apps → Sync → enter your deployed URL `https://<your-inngest-url>/api/inngest`.

### 5. Verify

- **Inngest dashboard** → Apps → should show `clockwork-menubar` app registered
- **Functions** → should show `sync-active-timers` function listed

---

## Redis Key Reference

| Key Pattern | TTL | Description |
|---|---|---|
| `clockwork:timers:<email>` | 10 min | Active timers cached per user email |
| `clockwork:timers:all` | 10 min | Global active timers list |
| `jira:user:<accountId>` | 2 days | Jira user info (email, display name, avatar) keyed by Atlassian accountId |

The `jira:user:*` keys are populated automatically during each `sync-active-timers` run. They cache the result of `GET /rest/api/3/user?accountId=<id>` to avoid redundant Jira API calls across sync cycles.

---

## Monorepo Notes

Both apps are deployed as separate Vercel projects from the same monorepo. Vercel automatically detects `pnpm-workspace.yaml` and runs `pnpm install` from the repository root before building.

- `apps/api` → Vercel project for the API proxy
- `apps/inngest` → Vercel project for background Inngest functions

The Tauri client's **API Base URL** setting should point to the deployed `apps/api` URL (e.g. `https://your-api.vercel.app`).
