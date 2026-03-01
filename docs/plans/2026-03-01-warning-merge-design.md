# Design: Warning Merge & Settings Gate

**Date**: 2026-03-01
**Status**: Approved

## Overview

Four targeted changes to the Tauri app:

1. Settings gate — prevent main view flash on cold start when credentials are missing
2. Merge two warning banners (`WorklogBanner` + `UnloggedDaysWarning`) into a single `UnifiedWarning` component
3. Cold start fix — only show today's warning after worklog API data is available
4. Skip weekends — today's warning does not appear on Saturday/Sunday

---

## Change 1: Settings Gate — No Flash

**Problem**: `view` initialises to `'main'`; settings load async via `loadSettings()`. If credentials are missing, a `useEffect` redirects to `'settings'`, but not before a brief render of `MainView` is visible (flash).

**Fix**: In `AppContent` (`App.tsx`), return a `<Skeleton />` until `isLoaded` is `true`. The existing redirect `useEffect` is kept unchanged.

```tsx
if (!isLoaded) {
  return <Skeleton />;
}
```

**Result**: Main view is never rendered before credentials are verified.

---

## Change 2: Unified Warning Component

**Problem**: Two separate warning UIs exist in different locations:
- `WorklogBanner` — red, today's deficit, rendered in `App.tsx`
- `UnloggedDaysWarning` — amber, previous weekdays, rendered inside `MainView.tsx`

**Fix**: Delete `WorklogBanner.tsx`. Create `UnifiedWarning.tsx` with two optional sections. Remove `UnloggedDaysWarning` from `MainView.tsx`. Render `UnifiedWarning` in `App.tsx` in place of `WorklogBanner`.

### Props

```ts
interface UnifiedWarningProps {
  unloggedDays: UnloggedDay[];   // previous weekdays with insufficient hours
  showToday: boolean;            // from useWorklogNotification
  todayLogged: number;           // seconds logged today
  todayTarget: number;           // target seconds (7.5h)
  todayDeficit: number;          // seconds remaining
}
```

### Visual Layout

```
┌─────────────────────────────────────┐
│ ⚠ WARNING              [Collapse]  │  ← amber header
│ Previous days: 2 days need logging  │
│  Mon 2026-02-24: 2h / 8h           │  ← amber section
│  Tue 2026-02-25: 6h / 8h           │
│  [Hướng dẫn log bù]                │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ 🔴 Today: 3h 30m / 7h 30m          │  ← red section (only after 17:00)
│    — 4h 00m remaining               │
└─────────────────────────────────────┘
```

### Display logic

- Both sections absent → `return null`
- Only previous days → amber section only (no divider)
- Only today → red section only (no divider)
- Both → amber + divider + red

---

## Change 3: Cold Start Fix — Loading-Aware Warning

**Problem**: On cold start `totalLoggedSeconds = 0` because the API has not yet responded. If the local clock is past 17:00, `useWorklogNotification` immediately sets `showBanner = true`, showing a false warning.

**Fix**: Add `isDataReady: boolean` to `useWorklogNotification`. The internal `check()` function returns early if `isDataReady` is `false`.

```ts
// useWorklogNotification.ts
const check = async () => {
  if (!isDataReady) return;
  // ... existing logic unchanged
};
```

In `App.tsx`, derive `isDataReady` from the worklog query's `isSuccess` flag:

```tsx
const { data: worklogs, isSuccess: worklogsLoaded } = useWorklogs(today);
const { showBanner, deficit, target, logged } = useWorklogNotification({
  totalLoggedSeconds: totalSeconds,
  isDataReady: worklogsLoaded,
});
```

**Result**: Warning never appears before the first successful API response.

---

## Change 4: Skip Weekends for Today's Warning

**Problem**: `useWorklogNotification` shows a warning on Saturday and Sunday when there is nothing to log.

**Note**: `useUnloggedDays` already skips weekends in `getWeekdaysUntilYesterday()` — no change needed there.

**Fix**: Add a weekend guard at the top of `check()`:

```ts
const now = new Date();
const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
if (dayOfWeek === 0 || dayOfWeek === 6) {
  if (showBanner) setShowBanner(false);
  return;
}
```

---

## Files Changed

| Action | File |
|--------|------|
| Modify | `apps/tauri/src/App.tsx` |
| Modify | `apps/tauri/src/views/MainView.tsx` |
| Modify | `apps/tauri/src/hooks/useWorklogNotification.ts` |
| Create | `apps/tauri/src/components/UnifiedWarning.tsx` |
| Delete | `apps/tauri/src/components/WorklogBanner.tsx` |
