# Clickable Issue Keys Design

## Goal

Make JIRA issue keys clickable in the UI so clicking opens the issue in the user's default browser.

## Scope

Two components display issue keys that need to become clickable:

- **ActiveTimer** (`apps/tauri/src/components/ActiveTimer.tsx`) — the running timer's issue key
- **WorklogList** (`apps/tauri/src/components/WorklogList.tsx`) — each worklog entry's issue key

## Approach

Construct the Jira issue URL from a hardcoded base URL constant and the issue key, then use `@tauri-apps/plugin-shell` `open()` to launch the browser.

URL pattern: `${JIRA_BASE_URL}/browse/${issueKey}`

## Changes

| File | Change |
|------|--------|
| `apps/tauri/src/lib/constants.ts` | Add `JIRA_BASE_URL` constant |
| `apps/tauri/src/lib/utils.ts` (new) | `openIssueInBrowser(issueKey)` helper |
| `apps/tauri/src/components/ActiveTimer.tsx` | Wrap issue key span with clickable button |
| `apps/tauri/src/components/WorklogList.tsx` | Wrap issue key span with clickable button |

## UI Behavior

- Issue keys retain current font, size, and color
- Add `cursor-pointer` and `hover:underline` to indicate interactivity
- No layout or sizing changes
- Uses `<button>` element for accessibility (keyboard focusable, screen reader friendly)
