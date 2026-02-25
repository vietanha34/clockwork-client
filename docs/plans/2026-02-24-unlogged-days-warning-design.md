# Unlogged Days Warning - Design Document

**Date:** 2026-02-24
**Status:** Approved

## Problem

Users sometimes forget to log enough hours on previous workdays. Currently the app only shows today's progress via the tray icon progress bar. There is no warning for past days with insufficient logged time.

## Requirements

- Warn when any weekday (Mon-Fri) from the current week has less than 8 hours logged
- Check range: Monday of current week through yesterday (today is excluded since it's still in progress)
- Display warning as: (1) in-app banner at top of MainView, (2) red dot on tray icon
- Provide a "Resolve" action that shows a guide modal with instructions for logging time via CLI tools or Clockwork web
- Check triggers: on app mount + after stopping a timer

## Approach

**Client-side only** using existing `GET /api/worklogs?accountId=&date=` API. No backend changes needed. Parallel fetch for each unchecked weekday (max 4 requests).

## Design

### 1. Data Layer - `useUnloggedDays` Hook

```typescript
interface UnloggedDay {
  date: string;           // "2026-02-23"
  dayOfWeek: string;      // "T2"
  loggedSeconds: number;  // actual logged seconds
  requiredSeconds: number; // 28800 (8h)
}

// Hook return
{
  unloggedDays: UnloggedDay[];
  isLoading: boolean;
}
```

**Logic:**
1. Compute weekdays (Mon-Fri) from start of week to yesterday
2. Use `useQueries` to fetch `fetchWorklogs(accountId, date)` for each day
3. Filter days where `total < 28800` (8 hours)
4. Cache: `staleTime: 5min`, `gcTime: 30min`, no refetch on window focus

### 2. Warning Banner - `UnloggedDaysWarning` Component

- Position: top of MainView, above Active Timer section
- Style: amber background (`amber-500/10`), amber border
- Content: list of days with `dayName date: loggedTime / 8h00`
- Collapsible (local state, default expanded)
- Hidden when `unloggedDays.length === 0`
- Button: "Huong dan log bu" opens guide modal

### 3. Guide Modal

Overlay/modal with markdown content explaining how to log time:
- Using Claude Code CLI
- Using Clockwork web interface
- Dismissible

### 4. Tray Icon Warning

- Red dot indicator at top-right corner of tray icon bitmap
- Drawn in `useTrayTimer` canvas when `hasUnloggedDays === true`
- Does not interfere with existing progress bar or timer text

### 5. Triggers & Refetch

- **App mount:** `useUnloggedDays` fetches immediately
- **After stop timer:** Invalidate worklog queries for previous days to re-check
- Previous days' worklogs are stable, so aggressive caching is safe

## Files to Modify/Create

| File | Action |
|------|--------|
| `apps/tauri/src/hooks/useUnloggedDays.ts` | Create - new hook |
| `apps/tauri/src/components/UnloggedDaysWarning.tsx` | Create - banner component |
| `apps/tauri/src/components/LogGuideModal.tsx` | Create - guide modal |
| `apps/tauri/src/views/MainView.tsx` | Modify - add banner |
| `apps/tauri/src/App.tsx` | Modify - pass `hasUnloggedDays` to tray timer |
| `apps/tauri/src/hooks/useTrayTimer.ts` | Modify - draw red dot |
| `apps/tauri/src/hooks/useTimerActions.ts` | Modify - invalidate on stop |
