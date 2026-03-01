# Warning Merge & Settings Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four UX issues in the Tauri app: prevent main view flash when credentials are missing, merge two separate warning banners into one, fix cold-start false-positive warnings, and skip weekends in today's warning.

**Architecture:** Minimal targeted changes — modify `useWorklogNotification` for data-readiness guard and weekend skip, create a new `UnifiedWarning` component replacing `WorklogBanner` + `UnloggedDaysWarning`, wire everything in `App.tsx`, and add a skeleton loading gate.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Tailwind CSS v4, Biome (lint/format), Tauri v2

---

## Verification Commands

Run these from `apps/tauri/` after each task to confirm no regressions:

```bash
# Type check
pnpm type-check

# Lint
pnpm lint
```

---

### Task 1: Update `useWorklogNotification` — add `isDataReady` guard + weekend skip

**Files:**
- Modify: `apps/tauri/src/hooks/useWorklogNotification.ts`

**Step 1: Open the file and understand the structure**

Read `apps/tauri/src/hooks/useWorklogNotification.ts`. The `check()` function inside `useEffect` runs every 60s and immediately on mount. Two bugs:
1. If `isDataReady` is false (API not yet responded), `totalLoggedSeconds = 0` → shows banner falsely
2. No weekend guard — shows warning on Saturday/Sunday

**Step 2: Replace the file with the updated version**

Replace the entire file content:

```typescript
import { useEffect, useRef, useState } from 'react';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { formatSeconds } from '../lib/api-client';

const NOTIFICATION_HOUR = 17;
const WORKLOG_TARGET_SECONDS = 7.5 * 3600; // 27,000 seconds
const LOCAL_STORAGE_KEY = 'worklog-notification-last-date';

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface UseWorklogNotificationOptions {
  totalLoggedSeconds: number; // worklogs + running timer elapsed
  isDataReady: boolean; // true only after first successful API response
}

export function useWorklogNotification({
  totalLoggedSeconds,
  isDataReady,
}: UseWorklogNotificationOptions) {
  const [showBanner, setShowBanner] = useState(false);
  const [deficit, setDeficit] = useState(0);
  const hasNotifiedRef = useRef<string | null>(null);

  // Restore last-notified date from localStorage on mount
  useEffect(() => {
    try {
      hasNotifiedRef.current = localStorage.getItem(LOCAL_STORAGE_KEY);
    } catch {
      // localStorage not available (private browsing, quota exceeded)
      hasNotifiedRef.current = null;
    }
  }, []);

  // Check every 60 seconds
  useEffect(() => {
    const check = async () => {
      // Wait until API data is available — avoids cold-start false positives
      if (!isDataReady) return;

      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      // Skip weekends — no worklog requirement on Sat/Sun
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (showBanner) setShowBanner(false);
        return;
      }

      const currentHour = now.getHours();
      const todayKey = todayDateKey();

      // Only check at or after 17:00, and only once per day
      if (currentHour < NOTIFICATION_HOUR) {
        // Before 17:00 — hide any stale banner from yesterday
        if (showBanner) setShowBanner(false);
        setDeficit(0);
        return;
      }

      // Already notified today
      if (hasNotifiedRef.current === todayKey) {
        // Keep banner visible if still under target
        if (totalLoggedSeconds < WORKLOG_TARGET_SECONDS) {
          setShowBanner(true);
          setDeficit(WORKLOG_TARGET_SECONDS - totalLoggedSeconds);
        } else {
          setShowBanner(false);
        }
        return;
      }

      // Worklog sufficient — no notification needed
      if (totalLoggedSeconds >= WORKLOG_TARGET_SECONDS) {
        return;
      }

      // Insufficient worklog — send notification
      const remaining = WORKLOG_TARGET_SECONDS - totalLoggedSeconds;
      setDeficit(remaining);
      setShowBanner(true);

      // Mark as notified
      hasNotifiedRef.current = todayKey;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, todayKey);
      } catch {
        // localStorage not available (private browsing, quota exceeded)
      }

      // Send OS notification
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        if (granted) {
          sendNotification({
            title: 'Worklog Reminder',
            body: `You've logged ${formatSeconds(totalLoggedSeconds)} / ${formatSeconds(WORKLOG_TARGET_SECONDS)} today. ${formatSeconds(remaining)} remaining.`,
          });
        }
      } catch (error) {
        // Notification send failed — banner still shows as fallback
        console.error('Failed to send worklog notification:', error);
      }
    };

    // Run immediately on mount/update
    check();

    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [totalLoggedSeconds, isDataReady, showBanner]);

  return { showBanner, deficit, target: WORKLOG_TARGET_SECONDS, logged: totalLoggedSeconds };
}
```

**Step 3: Verify**

```bash
cd apps/tauri && pnpm type-check
```

Expected: no errors (the call site in App.tsx will error until Task 4 — that's expected here).

**Step 4: Commit**

```bash
git add apps/tauri/src/hooks/useWorklogNotification.ts
git commit -m "fix: guard worklog notification against cold start and weekends"
```

---

### Task 2: Create `UnifiedWarning` component

**Files:**
- Create: `apps/tauri/src/components/UnifiedWarning.tsx`

**Step 1: Understand what to merge**

- `WorklogBanner` (`components/WorklogBanner.tsx`): red banner, shows `logged / target — deficit remaining`. Rendered in `App.tsx` when `showBanner` is true.
- `UnloggedDaysWarning` (`components/UnloggedDaysWarning.tsx`): amber banner with expand/collapse list of previous weekdays + LogGuideModal. Rendered in `MainView.tsx`.

The new component combines both into one, with the amber section on top (previous days) and red section below (today), each shown independently based on props.

**Step 2: Create the file**

```typescript
import { useMemo, useState } from 'react';
import { formatSeconds } from '../lib/api-client';
import type { UnloggedDay } from '../lib/types';
import { LogGuideModal } from './LogGuideModal';

function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

interface UnifiedWarningProps {
  unloggedDays: UnloggedDay[];
  showToday: boolean;
  todayLogged: number;
  todayTarget: number;
  todayDeficit: number;
}

export function UnifiedWarning({
  unloggedDays,
  showToday,
  todayLogged,
  todayTarget,
  todayDeficit,
}: UnifiedWarningProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const hasPreviousDays = unloggedDays.length > 0;

  const previousTitle = useMemo(() => {
    if (unloggedDays.length === 1) return '1 day needs extra logging';
    return `${unloggedDays.length} days need extra logging`;
  }, [unloggedDays.length]);

  if (!hasPreviousDays && !showToday) {
    return null;
  }

  return (
    <>
      {hasPreviousDays && (
        <section className="border-b border-amber-200 bg-amber-100/70 px-4 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Warning</p>
              <p className="text-xs font-medium text-amber-900">{previousTitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-2 space-y-1">
              <ul className="space-y-1">
                {unloggedDays.map((day) => (
                  <li key={day.date} className="text-xs text-amber-950">
                    {day.dayOfWeek} {day.date}: {formatHours(day.loggedSeconds)} /{' '}
                    {formatHours(day.requiredSeconds)}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="mt-1 rounded border border-amber-300 bg-amber-200/80 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              >
                Hướng dẫn log bù
              </button>
            </div>
          )}
        </section>
      )}

      {showToday && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-red-800">
              Worklog: {formatSeconds(todayLogged)} / {formatSeconds(todayTarget)}
            </span>
            <span className="text-sm text-red-600">
              — {formatSeconds(todayDeficit)} remaining
            </span>
          </div>
        </div>
      )}

      <LogGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
}
```

**Step 3: Verify**

```bash
cd apps/tauri && pnpm type-check
```

Expected: no errors from the new file itself (App.tsx import errors remain until Task 4).

**Step 4: Commit**

```bash
git add apps/tauri/src/components/UnifiedWarning.tsx
git commit -m "feat: add UnifiedWarning component merging amber and red warning banners"
```

---

### Task 3: Remove `UnloggedDaysWarning` from `MainView`

**Files:**
- Modify: `apps/tauri/src/views/MainView.tsx`

**Step 1: Remove three things from MainView**

1. Remove the import line:
   ```typescript
   import { UnloggedDaysWarning } from '../components/UnloggedDaysWarning';
   ```

2. Remove the hook call (line 51):
   ```typescript
   const { unloggedDays } = useUnloggedDays();
   ```
   And its import (line 12):
   ```typescript
   import { useUnloggedDays } from '../hooks/useUnloggedDays';
   ```

3. Remove the JSX render (line 64):
   ```tsx
   <UnloggedDaysWarning unloggedDays={unloggedDays} />
   ```

**Step 2: Verify the resulting file looks correct**

After edits, `MainView.tsx` imports should be:
```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveTimer } from '../components/ActiveTimer';
import { DailyProgressBar } from '../components/DailyProgressBar';
import { DateStrip } from '../components/DateStrip';
import { StartTimerForm } from '../components/StartTimerForm';
import { WeeklyChart } from '../components/WeeklyChart';
import { WorklogList } from '../components/WorklogList';
import { type WorklogTab, WorklogTabs } from '../components/WorklogTabs';
import { useActiveTimers } from '../hooks/useActiveTimers';
import { useToday } from '../hooks/useToday';
import { useWeeklyWorklogs } from '../hooks/useWeeklyWorklogs';
import { useWorklogs } from '../hooks/useWorklogs';
import { todayDate } from '../lib/api-client';
import { isSquareTrayPlatform } from '../lib/platform';
```

And the `return` JSX should no longer contain `<UnloggedDaysWarning ... />`.

**Step 3: Verify**

```bash
cd apps/tauri && pnpm type-check && pnpm lint
```

Expected: passes cleanly (no unused import warnings from biome).

**Step 4: Commit**

```bash
git add apps/tauri/src/views/MainView.tsx
git commit -m "refactor: move unlogged days warning out of MainView"
```

---

### Task 4: Wire `UnifiedWarning` + settings gate in `App.tsx`

**Files:**
- Modify: `apps/tauri/src/App.tsx`

**Step 1: Understand current state of App.tsx**

Current imports include `WorklogBanner`. Current `useWorklogs` call does not destructure `isSuccess`. Current `useWorklogNotification` call does not pass `isDataReady`. `view` starts as `'main'` with no loading gate.

**Step 2: Replace the entire `App.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { TimerSkeleton, WorklogSkeleton } from './components/Skeleton';
import { UnifiedWarning } from './components/UnifiedWarning';
import { useActiveTimers } from './hooks/useActiveTimers';
import { useToday } from './hooks/useToday';
import { useTrayTimer } from './hooks/useTrayTimer';
import { useUnloggedDays } from './hooks/useUnloggedDays';
import { useWorklogs } from './hooks/useWorklogs';
import { totalWorklogSeconds } from './lib/api-client';
import { isSquareTrayPlatform } from './lib/platform';
import { SettingsProvider, useSettings } from './lib/settings-context';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';
import { useWorklogNotification } from './hooks/useWorklogNotification';

type View = 'main' | 'settings';

function AppContent() {
  const [view, setView] = useState<View>('main');
  const { settings, isLoaded } = useSettings();
  const { data } = useActiveTimers();
  const today = useToday();
  const { data: worklogs, isSuccess: worklogsLoaded } = useWorklogs(today);
  const { unloggedDays } = useUnloggedDays();
  const activeTimer = data?.timers[0];

  useEffect(() => {
    if (isSquareTrayPlatform()) {
      document.documentElement.classList.add('platform-desktop');
    }
  }, []);

  // Count only today's running overlap from 08:00 local time.
  const currentSessionDuration = (() => {
    if (!activeTimer?.startedAt) return 0;

    const startedMs = new Date(activeTimer.startedAt).getTime();
    if (Number.isNaN(startedMs)) return 0;

    const nowMs = Date.now();
    const dayStart = new Date();
    dayStart.setHours(8, 0, 0, 0);

    const effectiveStartMs = Math.max(startedMs, dayStart.getTime());
    if (effectiveStartMs >= nowMs) return 0;

    return Math.floor((nowMs - effectiveStartMs) / 1000);
  })();
  const effectiveStartedAt = activeTimer
    ? new Date(new Date().getTime() - activeTimer.tillNow * 1000).toISOString()
    : undefined;

  // Always compute from worklog items so progress still works even when API `total` is stale/missing.
  const loggedSeconds = totalWorklogSeconds(worklogs?.worklogs ?? []);
  const totalSeconds = loggedSeconds + currentSessionDuration;
  const dailyProgress = totalSeconds / (8 * 3600);
  const hasUnloggedDays = unloggedDays.length > 0;
  const { showBanner, deficit, target, logged } = useWorklogNotification({
    totalLoggedSeconds: totalSeconds,
    isDataReady: worklogsLoaded,
  });

  useTrayTimer(
    effectiveStartedAt,
    activeTimer?.issue.key,
    dailyProgress,
    hasUnloggedDays,
    activeTimer?.withinWorkingHours,
  );

  // On first load, if no email is configured, redirect to settings
  useEffect(() => {
    if (isLoaded && (!settings.jiraToken || !settings.clockworkApiToken)) {
      setView('settings');
    }
  }, [isLoaded, settings.jiraToken, settings.clockworkApiToken]);

  // Show skeleton while settings are loading to avoid flash of main view
  if (!isLoaded) {
    return (
      <AppShell
        onSettingsClick={() => {}}
        showBackButton={false}
        onBackClick={() => {}}
      >
        <div className="divide-y divide-gray-100">
          <TimerSkeleton />
          <WorklogSkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      onSettingsClick={() => setView('settings')}
      showBackButton={view === 'settings'}
      onBackClick={() => setView('main')}
      userDisplayName={view === 'main' ? settings.jiraUser?.displayName : undefined}
    >
      <UnifiedWarning
        unloggedDays={unloggedDays}
        showToday={showBanner}
        todayLogged={logged}
        todayTarget={target}
        todayDeficit={deficit}
      />
      {view === 'main' && <MainView todayProgressSeconds={totalSeconds} />}
      {view === 'settings' && <SettingsView onClose={() => setView('main')} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
```

**Step 3: Verify**

```bash
cd apps/tauri && pnpm type-check && pnpm lint
```

Expected: passes with no errors. If biome complains about unused imports in files we haven't deleted yet, that's fine — Task 5 handles that.

**Step 4: Commit**

```bash
git add apps/tauri/src/App.tsx
git commit -m "feat: add settings gate skeleton and wire UnifiedWarning in App"
```

---

### Task 5: Delete `WorklogBanner.tsx` and `UnloggedDaysWarning.tsx`

**Files:**
- Delete: `apps/tauri/src/components/WorklogBanner.tsx`
- Delete: `apps/tauri/src/components/UnloggedDaysWarning.tsx`

**Step 1: Delete the files**

```bash
rm apps/tauri/src/components/WorklogBanner.tsx
rm apps/tauri/src/components/UnloggedDaysWarning.tsx
```

**Step 2: Final verification**

```bash
cd apps/tauri && pnpm type-check && pnpm lint
```

Expected: completely clean — no unused files, no broken imports.

**Step 3: Commit**

```bash
git add -u apps/tauri/src/components/WorklogBanner.tsx apps/tauri/src/components/UnloggedDaysWarning.tsx
git commit -m "chore: remove WorklogBanner and UnloggedDaysWarning replaced by UnifiedWarning"
```

---

## Manual Verification Checklist

After all tasks complete, test the following scenarios in the running app (`pnpm tauri dev` from repo root):

- [ ] **No credentials**: Clear `jiraToken` and `clockworkApiToken` from settings, restart app → skeleton shows briefly, then redirects to settings view automatically (no flash of main view)
- [ ] **With credentials**: Restart with credentials configured → skeleton shows, then main view appears (no settings redirect)
- [ ] **Previous days warning (amber)**: If current week has past weekdays with < 8h logged, amber warning appears in main view with expand/collapse
- [ ] **Today warning (red)**: After 17:00 on a weekday with < 7.5h logged, red section appears below amber (or alone if no previous days issue)
- [ ] **Weekend**: On Saturday or Sunday, no red "today" warning appears regardless of hours logged
- [ ] **Cold start**: Launch app after 17:00 on a weekday — red warning should NOT flash immediately if API hasn't responded yet; it should only appear once worklogs API call completes
- [ ] **Both warnings together**: If both previous days AND today are under target, both sections appear in one block (amber on top, red below)
- [ ] **Only today warning**: If previous days are all fine but today is under target after 17:00, only red section shows (no amber)
