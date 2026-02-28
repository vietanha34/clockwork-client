# Worklog Insufficient Notification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Notify users at 17:00 when their total logged time (worklogs + running timer) falls short of 7.5 hours, via OS native notification and in-app banner.

**Architecture:** Frontend-only approach using a new `useWorklogNotification` React hook mounted in `App.tsx`. The hook runs a 60-second interval check, calculates total logged time from existing hooks, and triggers `tauri-plugin-notification` for OS notifications plus an in-app banner component.

**Tech Stack:** React 18, Tauri v2, `tauri-plugin-notification`, `@tauri-apps/plugin-notification`, Tailwind CSS

---

### Task 1: Install tauri-plugin-notification

**Files:**
- Modify: `apps/tauri/src-tauri/Cargo.toml` (add dependency)
- Modify: `apps/tauri/src-tauri/capabilities/default.json` (add permission)
- Modify: `apps/tauri/src-tauri/src/lib.rs` (register plugin)
- Modify: `apps/tauri/package.json` (add JS package)

**Step 1: Add Rust dependency**

In `apps/tauri/src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-notification = "2"
```

**Step 2: Add notification permission to capabilities**

In `apps/tauri/src-tauri/capabilities/default.json`, add `"notification:default"` to the `permissions` array:

```json
"permissions": [
    "core:default",
    "shell:allow-open",
    "os:default",
    "autostart:default",
    "notification:default",
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://clockwork-client.vercel.app/*" }],
      "deny": []
    }
]
```

**Step 3: Register plugin in Rust**

In `apps/tauri/src-tauri/src/lib.rs`, add the notification plugin to the builder chain (after the existing `.plugin()` calls around line 121):

```rust
.plugin(tauri_plugin_notification::init())
```

**Step 4: Install JS package**

Run from `apps/tauri/`:

```bash
pnpm add @tauri-apps/plugin-notification
```

**Step 5: Verify compilation**

```bash
cd apps/tauri/src-tauri && cargo check
```

Expected: compiles with no errors (may have pre-existing warnings).

**Step 6: Commit**

```bash
git add apps/tauri/src-tauri/Cargo.toml apps/tauri/src-tauri/Cargo.lock apps/tauri/src-tauri/capabilities/default.json apps/tauri/src-tauri/src/lib.rs apps/tauri/package.json pnpm-lock.yaml
git commit -m "feat(notification): install tauri-plugin-notification for OS notifications"
```

---

### Task 2: Create useWorklogNotification hook

**Files:**
- Create: `apps/tauri/src/hooks/useWorklogNotification.ts`

**Step 1: Create the hook file**

Create `apps/tauri/src/hooks/useWorklogNotification.ts`:

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

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface UseWorklogNotificationOptions {
  totalLoggedSeconds: number; // worklogs + running timer elapsed
}

export function useWorklogNotification({ totalLoggedSeconds }: UseWorklogNotificationOptions) {
  const [showBanner, setShowBanner] = useState(false);
  const [deficit, setDeficit] = useState(0);
  const hasNotifiedRef = useRef<string | null>(null);

  // Restore last-notified date from localStorage on mount
  useEffect(() => {
    hasNotifiedRef.current = localStorage.getItem('worklog-notification-last-date');
  }, []);

  // Check every 60 seconds
  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayKey = todayDateKey();

      // Only check at or after 17:00, and only once per day
      if (currentHour < NOTIFICATION_HOUR) {
        // Before 17:00 — hide any stale banner from yesterday
        if (showBanner) setShowBanner(false);
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
      localStorage.setItem('worklog-notification-last-date', todayKey);

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
      } catch {
        // Notification send failed — banner still shows as fallback
      }
    };

    // Run immediately on mount/update
    check();

    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [totalLoggedSeconds, showBanner]);

  return { showBanner, deficit, target: WORKLOG_TARGET_SECONDS, logged: totalLoggedSeconds };
}
```

**Step 2: Verify TypeScript compilation**

```bash
cd apps/tauri && npx tsc --noEmit
```

Expected: no type errors.

**Step 3: Commit**

```bash
git add apps/tauri/src/hooks/useWorklogNotification.ts
git commit -m "feat(notification): add useWorklogNotification hook with scheduling and OS notification"
```

---

### Task 3: Create WorklogBanner in-app component

**Files:**
- Create: `apps/tauri/src/components/WorklogBanner.tsx`

**Step 1: Create the banner component**

Create `apps/tauri/src/components/WorklogBanner.tsx`:

```tsx
import { formatSeconds } from '../lib/api-client';

interface WorklogBannerProps {
  logged: number;
  target: number;
  deficit: number;
}

export function WorklogBanner({ logged, target, deficit }: WorklogBannerProps) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-red-800">
          Worklog: {formatSeconds(logged)} / {formatSeconds(target)}
        </span>
        <span className="text-sm text-red-600">
          — {formatSeconds(deficit)} remaining
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compilation**

```bash
cd apps/tauri && npx tsc --noEmit
```

Expected: no type errors.

**Step 3: Commit**

```bash
git add apps/tauri/src/components/WorklogBanner.tsx
git commit -m "feat(notification): add WorklogBanner in-app indicator component"
```

---

### Task 4: Integrate hook and banner in App.tsx

**Files:**
- Modify: `apps/tauri/src/App.tsx`

**Step 1: Add imports**

Add at the top of `apps/tauri/src/App.tsx` (after existing imports):

```typescript
import { useWorklogNotification } from './hooks/useWorklogNotification';
import { WorklogBanner } from './components/WorklogBanner';
```

**Step 2: Mount the hook**

In the `AppContent` function, after line 55 (`const hasUnloggedDays = unloggedDays.length > 0;`), add:

```typescript
const { showBanner, deficit, target, logged } = useWorklogNotification({
  totalLoggedSeconds: totalSeconds,
});
```

**Step 3: Render the banner**

In the JSX return, add the banner inside `<AppShell>` just before the view rendering (before line 79 `{view === 'main' && ...}`):

```tsx
{showBanner && (
  <WorklogBanner logged={logged} target={target} deficit={deficit} />
)}
```

**Step 4: Verify TypeScript compilation**

```bash
cd apps/tauri && npx tsc --noEmit
```

Expected: no type errors.

**Step 5: Build verification**

```bash
cd apps/tauri && pnpm build
```

Expected: production build succeeds.

**Step 6: Commit**

```bash
git add apps/tauri/src/App.tsx
git commit -m "feat(notification): integrate worklog notification hook and banner in App"
```

---

### Task 5: Manual testing verification

**Step 1: Run dev mode**

```bash
cd apps/tauri && pnpm tauri dev
```

**Step 2: Verify notification permission prompt**

On first run, the app should request notification permission from the OS.

**Step 3: Test banner visibility**

- If current time >= 17:00 and worklog < 7.5h: red banner should appear at top of app
- If current time < 17:00: no banner
- If worklog >= 7.5h: no banner even after 17:00

**Step 4: Test OS notification**

- If testing after 17:00 with insufficient worklog: OS notification should appear with title "Worklog Reminder"
- Notification should only appear once per day (refresh app, notification should not re-trigger)

**Step 5: Test dedup**

- Close and reopen app after notification fired — should NOT re-notify (check localStorage for `worklog-notification-last-date`)

**Step 6: Commit any fixes if needed**

If all working, no commit needed for this task.
