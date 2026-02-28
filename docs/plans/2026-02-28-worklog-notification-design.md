# Worklog Insufficient Notification

**Date**: 2026-02-28
**Status**: Approved

## Problem

Users forget to log enough work hours before leaving for the day. They need a reminder at end-of-day when their total logged time falls short of the 7.5h target.

## Requirements

- Trigger at 17:00 daily
- Target: 7.5 hours (27,000 seconds)
- Include running timer elapsed time in the total
- OS native notification (macOS/Windows/Linux) via `tauri-plugin-notification`
- In-app visual indicator (banner)
- No action buttons on notification — informational only
- Only notify once per day; skip if worklog already sufficient

## Approach: Frontend-Only Timer Check

The app already has autostart enabled and runs continuously. We add a React hook that checks worklog status at 17:00 using existing data from `useWorklogs` and `useActiveTimers`.

## Architecture

### New Hook: `useWorklogNotification`

Mounted in `App.tsx`. Responsibilities:

1. **Scheduling**: `setInterval(60_000)` checks every minute. When `currentTime >= 17:00` and not yet notified today, triggers the check.
2. **Calculation**: Sums `worklogs.totalTimeSpentSeconds` + `activeTimer.elapsed` (current session). Compares against 27,000s target.
3. **Notification**: If insufficient, calls `tauri-plugin-notification` for OS notification and sets in-app state.
4. **Dedup**: Stores `lastNotifiedDate` in `localStorage` to prevent repeat notifications on the same day.

### Components

| Component | Responsibility |
|---|---|
| `useWorklogNotification` hook | Scheduling, calculation, trigger |
| `tauri-plugin-notification` | OS native notification |
| In-app banner component | Visual indicator when worklog is short |
| `WORKLOG_TARGET_SECONDS` | 27,000 (7.5h) constant |

### Notification Content

```
Title: "Worklog Reminder"
Body: "You've logged 5h30m / 7h30m today. 2h00m remaining."
```

### In-App Indicator

A banner at the top of the app (similar to `UnloggedDaysWarning`) that appears after 17:00 when worklog is insufficient. Auto-hides when worklog reaches target or on the next day.

### Data Flow

```
setInterval (every 60s)
  → check time >= 17:00 && !notifiedToday
    → read worklogs + activeTimer elapsed
      → total < 27,000s?
        → YES: sendNotification() + showInAppBanner()
        → NO: do nothing
```

### Dependencies

- `tauri-plugin-notification` — new Tauri plugin for OS notifications
- Existing `useWorklogs` hook — provides today's logged seconds
- Existing `useActiveTimers` hook — provides running timer data

### Platform Behavior

- **macOS**: Native Notification Center notification
- **Windows**: Windows toast notification
- **Linux**: Desktop notification via libnotify/freedesktop

## Non-Goals

- Configurable notification time (hardcoded 17:00)
- Configurable target hours (hardcoded 7.5h)
- Notification action buttons
- Recurring reminders (only once at 17:00)
