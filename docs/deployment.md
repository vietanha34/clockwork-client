# Deployment Guide

This guide covers deploying `apps/api` and `apps/inngest` to Vercel.

## Prerequisites

- [Vercel account](https://vercel.com) with CLI installed (`npm i -g vercel`)
- [Inngest account](https://app.inngest.com) — to get event key and signing key
- [Upstash account](https://upstash.com) — Redis database for active timer cache

---

## Environment Variables

### `apps/api`

| Variable | Description | Where to get it | Required |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash dashboard → Database → REST API | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash dashboard → Database → REST API | ✅ |
| `CLOCKWORK_API_BASE_URL` | Clockwork Pro API base URL | `https://api.clockwork.report/v1` | ✅ |
| `CLOCKWORK_API_TOKEN` | Clockwork Pro API token | Clockwork Pro → Settings → API | ✅ |
| `ATLASSIAN_EMAIL` | Atlassian account email | Your Atlassian account email | ✅ |
| `ATLASSIAN_API_TOKEN` | Atlassian API token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) | ✅ |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` | ✅ |
| `JIRA_CLOUD_ID` | Jira Cloud ID | See [Getting Jira Cloud ID](#getting-jira-cloud-id) below | ✅ |
| `JIRA_WORKSPACE_ID` | Jira Workspace ID | See [Getting Jira Workspace ID](#getting-jira-workspace-id) below | ✅ |
| `FORGE_EXTENSION_ID` | Clockwork Forge Extension ID | Fixed value, already has default | ❌ |
| `JIRA_FULL_COOKIE` | Full Cookie from Jira session | Browser DevTools → Network → any Jira request | ✅ |

### `apps/inngest`

| Variable | Description | Where to get it | Required |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Same Redis instance as `apps/api` | Upstash dashboard | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Same Redis instance as `apps/api` | Upstash dashboard | ✅ |
| `JIRA_FULL_COOKIE` | Full Cookie header from a Jira browser session | Browser DevTools → Network tab → any Jira request → `Cookie` header | ✅ |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` | ✅ |
| `JIRA_CLOUD_ID` | Jira Cloud ID | Same as above | ✅ |
| `JIRA_WORKSPACE_ID` | Jira Workspace ID | Same as above | ✅ |
| `INNGEST_EVENT_KEY` | Inngest event key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Event Keys | ✅ |
| `INNGEST_SIGNING_KEY` | Inngest signing key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Signing Key | ✅ |

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

---

## Getting Jira Cloud ID

The `JIRA_CLOUD_ID` is a unique identifier for your Jira Cloud instance.

### Method 1: From Browser DevTools (Recommended)

1. Open Jira in your browser (`https://your-org.atlassian.net`)
2. Open **DevTools** → **Network** tab
3. Look for any request to `/gateway/api/graphql` or `/rest/api/3/`
4. Check the **Request Headers** for `atlWorkspaceAri` or URL parameters
5. The Cloud ID is the UUID after `ari:cloud:jira:`
   - Example: `ari:cloud:jira:afde6ffd-9c34-4257-a163-36336cf8d953:workspace/...`
   - Cloud ID: `afde6ffd-9c34-4257-a163-36336cf8d953`

### Method 2: From Admin Settings

1. Go to Jira → **Settings** (gear icon) → **System** → **System info**
2. Look for "Cloud ID" field

### Method 3: From JavaScript Console

Open browser console on Jira page and run:
```javascript
// Method 1: From global variable
window.ADMIN_CLOUD_ID

// Method 2: From meta tags
document.querySelector('meta[name="cloud-id"]')?.content

// Method 3: From any network request
// Look for cloudId in request payload
```

---

## Getting Jira Workspace ID

The `JIRA_WORKSPACE_ID` identifies your Jira workspace within the Cloud instance.

### Method 1: From GraphQL Requests

1. Open Jira in your browser
2. Open **DevTools** → **Network** tab
3. Filter for requests to `/gateway/api/graphql`
4. Click on any request and check the **Request Payload**
5. Look for `contextIds` array, it contains:
   ```json
   "contextIds": ["ari:cloud:jira:CLOUD_ID:workspace/WORKSPACE_ID"]
   ```
6. Extract the `WORKSPACE_ID` part after `workspace/`
   - Example: `ari:cloud:jira:afde6ffd-9c34-4257-a163-36336cf8d953:workspace/fefd8a92-e020-4606-8adf-3139353b0663`
   - Workspace ID: `fefd8a92-e020-4606-8adf-3139353b0663`

### Method 2: From Project URL

1. Go to any Jira project
2. Look at the URL: `/jira/software/projects/ACV2/`
3. Make a request to `/rest/api/3/project/ACV2`
4. In the response, look for `entityId` or check the `self` URL

---

## About FORGE_EXTENSION_ID

The `FORGE_EXTENSION_ID` is the Atlassian Resource Identifier (ARI) for the Clockwork Pro Forge extension.

**Default value (fixed for Clockwork Pro):**
```
ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages
```

**Format breakdown:**
- `2f4dbb6a-b1b8-4824-94b1-42a64e507a09` = Clockwork Pro App ID
- `725dad32-d2c5-4b58-a141-a093d70c8d34` = Production Environment ID
- `global-pages` = Module key (Jira Global Pages)

This value is **optional** — if not provided, the app will use the default Clockwork Pro extension ID.

---

## Monorepo Notes

Both apps are deployed as separate Vercel projects from the same monorepo. Vercel automatically detects `pnpm-workspace.yaml` and runs `pnpm install` from the repository root before building.

- `apps/api` → Vercel project for the API proxy
- `apps/inngest` → Vercel project for background Inngest functions

The Tauri client's **API Base URL** setting should point to the deployed `apps/api` URL (e.g. `https://your-api.vercel.app`).
