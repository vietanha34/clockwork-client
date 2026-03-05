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
| `REDIS_URL` | Redis connection URL (standard Redis protocol) | `redis://default:PASSWORD@HOST:6379` (Upstash or self-hosted) | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash dashboard → Database → REST API | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash dashboard → Database → REST API | ✅ |
| `CLOCKWORK_API_BASE_URL` | Clockwork Pro API base URL | `https://api.clockwork.report/v1` | ✅ |
| `CLOCKWORK_API_TOKEN` | Clockwork Pro API token | Clockwork Pro → Settings → API | ✅ |
| `ATLASSIAN_EMAIL` | Atlassian account email | Your Atlassian account email | ✅ |
| `ATLASSIAN_API_TOKEN` | Atlassian API token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) | ✅ |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` | ✅ |
| `JIRA_CLOUD_ID` | Jira Cloud ID | See [Getting Jira Cloud ID](#getting-jira-cloud-id) below | ✅ |
| `JIRA_WORKSPACE_ID` | Jira Workspace ID | See [Getting Jira Workspace ID](#getting-jira-workspace-id) below | ✅ |
| `JIRA_TENANT_SESSION_TOKEN` | Jira Tenant Session Token | Browser DevTools → Network → Cookie: `tenant.session.token=...` (value only) | ✅ |
| `JIRA_ACCOUNT_ID` | Your Atlassian Account ID | Optional. See [About JIRA_ACCOUNT_ID](#about-jira_account_id) | ❌ |
| `FORGE_EXTENSION_ID` | Clockwork Forge Extension ID | Fixed value, already has default | ❌ |

### `apps/inngest`

| Variable | Description | Where to get it | Required |
|---|---|---|---|
| `REDIS_URL` | Same Redis instance as `apps/api` | Upstash dashboard | ✅ |
| `UPSTASH_REDIS_REST_URL` | Same Redis instance as `apps/api` | Upstash dashboard | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Same Redis instance as `apps/api` | Upstash dashboard | ✅ |
| `JIRA_TENANT_SESSION_TOKEN` | Jira Tenant Session Token | Browser DevTools → Network → Cookie: `tenant.session.token=...` (value only) | ✅ |
| `JIRA_DOMAIN` | Jira instance domain | e.g. `your-org.atlassian.net` | ✅ |
| `JIRA_CLOUD_ID` | Jira Cloud ID | Same as above | ✅ |
| `JIRA_WORKSPACE_ID` | Jira Workspace ID | Same as above | ✅ |
| `JIRA_ACCOUNT_ID` | Your Atlassian Account ID | Optional. See [About JIRA_ACCOUNT_ID](#about-jira_account_id) | ❌ |
| `INNGEST_EVENT_KEY` | Inngest event key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Event Keys | ✅ |
| `INNGEST_SIGNING_KEY` | Inngest signing key | [app.inngest.com](https://app.inngest.com) → Your App → Manage → Signing Key | ✅ |

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
vercel env add REDIS_URL
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add CLOCKWORK_API_BASE_URL
vercel env add CLOCKWORK_API_TOKEN
vercel env add ATLASSIAN_EMAIL
vercel env add ATLASSIAN_API_TOKEN
vercel env add JIRA_DOMAIN
vercel env add JIRA_CLOUD_ID
vercel env add JIRA_WORKSPACE_ID
vercel env add JIRA_TENANT_SESSION_TOKEN
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
vercel env add REDIS_URL
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add JIRA_TENANT_SESSION_TOKEN
vercel env add JIRA_DOMAIN
vercel env add JIRA_CLOUD_ID
vercel env add JIRA_WORKSPACE_ID
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
- **Functions** → should show:
  - `sync-active-timers` - Syncs active timers from Clockwork
  - `adjust-lunch-worklogs` - Adjusts worklogs for lunch break (runs at 17:10 Mon-Fri)

---

## Redis Key Reference

| Key Pattern | TTL | Description |
|---|---|---|
| `clockwork:timers:<email>` | 10 min | Active timers cached per user email |
| `clockwork:timers:all` | 10 min | Global active timers list |
| `clockwork:active_users` | - | SET of user IDs with active timers |
| `clockwork:jwt` | ~14 min | Cached Clockwork JWT token for API calls |
| `clockwork:adjusted-worklogs` | 15 days | SET of worklog IDs already adjusted for lunch break |
| `jira:user:<accountId>` | 2 days | Jira user info (email, display name, avatar) keyed by Atlassian accountId |
| `jira:email:<email>` | 2 days | Email → Account ID mapping cache |
| `jira:issue:<idOrKey>` | 1 day | Jira issue details cache |
| `clockwork:forge:context-token` | ~14 min | Cached Forge context token |

The `jira:user:*` keys are populated automatically during each `sync-active-timers` run. They cache the result of `GET /rest/api/3/user?accountId=<id>` to avoid redundant Jira API calls across sync cycles.

The `clockwork:adjusted-worklogs` key tracks which worklogs have already been processed by the lunch break adjustment cron job to prevent double-adjustment.

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

## About JIRA_ACCOUNT_ID

The `JIRA_ACCOUNT_ID` is your Atlassian Account ID. It is **optional** and only used when acquiring a Clockwork Pro JWT token from the Atlassian Connect servlet.

### When do you need it?

| Use Case | Required? | Description |
|---|---|---|
| **Clockwork JWT Acquisition** | Optional | Used in the JWT request to Clockwork servlet. If not set, an empty value is sent (usually still works with tenant session token). |
| **Lunch Break Worklog Adjustment** | Not Required | The adjustment cron job (`adjust-lunch-worklogs`) processes worklogs for **ALL users** by default, not just one specific user. |

### How to get your Account ID

1. Open Jira in your browser
2. Click your **Profile** (avatar) → **Manage account**
3. Look at the URL: `https://id.atlassian.com/manage-profile/account`
4. The Account ID is shown in the profile or in the page content
   - Example: `61dfaa6949f1950069b0f94a`

Alternatively, check any Jira API response - the `accountId` field appears in user objects.

---

## Lunch Break Worklog Adjustment

The system includes an automated Inngest cron job (`adjust-lunch-worklogs`) that runs at **17:10 (5:10 PM) Monday-Friday** (VN time, UTC+7) to automatically subtract the lunch break period (12:00-13:30) from worklogs.

### How it works

1. **Trigger**: Cron job runs at `TZ=Asia/Ho_Chi_Minh 10 17 * * 1-5`
2. **Scope**: Processes worklogs for **ALL users** (not filtered by account)
3. **Target**: Worklogs from today and yesterday (as a safety net)
4. **Logic**: 
   - Calculates overlap between worklog time and lunch period (12:00-13:30)
   - Subtracts overlapping time from `timeSpent`
   - Uses Clockwork Pro API to update worklogs
   - Tracks adjusted worklogs in Redis to prevent double-adjustment

### Required Configuration

The feature requires these environment variables:
- `JIRA_TENANT_SESSION_TOKEN` - For Clockwork JWT acquisition
- `REDIS_URL` - For tracking already-adjusted worklogs

### Redis Keys Used

| Key | TTL | Description |
|---|---|---|
| `clockwork:adjusted-worklogs` | 15 days | SET of worklog IDs that have been adjusted |
| `clockwork:jwt` | ~14 min | Cached Clockwork JWT token |

---

## Monorepo Notes

Both apps are deployed as separate Vercel projects from the same monorepo. Vercel automatically detects `pnpm-workspace.yaml` and runs `pnpm install` from the repository root before building.

- `apps/api` → Vercel project for the API proxy
- `apps/inngest` → Vercel project for background Inngest functions

The Tauri client's **API Base URL** setting should point to the deployed `apps/api` URL (e.g. `https://your-api.vercel.app`).
