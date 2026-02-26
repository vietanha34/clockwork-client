# Timer "On Hold" Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the "On Hold" timer status when timers run outside working hours, across API, UI, and tray icon on all platforms.

**Architecture:** Map `within_working_hours` from Clockwork API through the Timer interface, derive status via utility function, update ActiveTimer UI with amber styling, and add third tray icon state for all platforms.

**Tech Stack:** TypeScript (React), Rust (Tauri 2), Canvas API (macOS tray)

**Depends on:** Ubuntu Platform Support track (for `isSquareTrayPlatform()` helper)

---

### Task 1: Add withinWorkingHours fields to Timer type (API package)

**Files:**
- Modify: `apps/api/src/lib/types.ts:10-20`

**Step 1: Add fields to Timer interface**

In `apps/api/src/lib/types.ts`, add two fields to the `Timer` interface after `worklogCount`:

```typescript
export interface Timer {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  comment: string | null;
  runningFor: string;
  tillNow: number; // seconds elapsed
  worklogCount: number;
  issue: TimerIssueRef;
  author?: ClockworkUser;
  withinWorkingHours: boolean;
  startedWithinWorkingHours: boolean;
}
```

**Step 2: Commit**

```bash
git add apps/api/src/lib/types.ts
git commit -m "feat: add withinWorkingHours fields to Timer type"
```

---

### Task 2: Map withinWorkingHours in API transformer

**Files:**
- Modify: `apps/api/src/lib/jira-user-resolver.ts:105-115`

**Step 1: Add field mapping in resolveTimerAuthors**

In `apps/api/src/lib/jira-user-resolver.ts`, add to the return object (after `issue` line ~113):

```typescript
return {
  id: t.id,
  startedAt: t.started_at,
  finishedAt: t.finished_at,
  comment: t.comment,
  runningFor: t.running_for,
  tillNow: t.till_now,
  worklogCount: t.worklog_count,
  issue: { key: t.issue.key, id: t.issue.id },
  author,
  withinWorkingHours: t.within_working_hours ?? true,
  startedWithinWorkingHours: t.started_within_working_hours ?? true,
};
```

**Step 2: Commit**

```bash
git add apps/api/src/lib/jira-user-resolver.ts
git commit -m "feat: map withinWorkingHours from raw Clockwork timer"
```

---

### Task 3: Add withinWorkingHours fields to Tauri Timer type

**Files:**
- Modify: `apps/tauri/src/lib/types.ts:15-24`

**Step 1: Add fields to Timer interface**

In `apps/tauri/src/lib/types.ts`, add two fields to the `Timer` interface after `issue`:

```typescript
export interface Timer {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  comment: string | null;
  runningFor: string;
  tillNow: number; // seconds elapsed
  worklogCount: number;
  issue: TimerIssueRef;
  withinWorkingHours: boolean;
  startedWithinWorkingHours: boolean;
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/lib/types.ts
git commit -m "feat: add withinWorkingHours to Tauri Timer type"
```

---

### Task 4: Create timer status utility

**Files:**
- Create: `apps/tauri/src/lib/timer-utils.ts`

**Step 1: Create the utility module**

```typescript
// apps/tauri/src/lib/timer-utils.ts
import type { Timer } from './types';

export type TimerStatus = 'running' | 'on_hold' | 'stopped';

export function getTimerStatus(timer: Timer): TimerStatus {
  if (timer.finishedAt) return 'stopped';
  if (!timer.withinWorkingHours) return 'on_hold';
  return 'running';
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/lib/timer-utils.ts
git commit -m "feat: add timer status derivation utility"
```

---

### Task 5: Update ActiveTimer UI with On Hold styling

**Files:**
- Modify: `apps/tauri/src/components/ActiveTimer.tsx:1-112`

**Step 1: Add import and derive status**

Add import at top of `apps/tauri/src/components/ActiveTimer.tsx`:

```typescript
import { getTimerStatus } from '../lib/timer-utils';
```

Inside the component, after `const activeTimer = data?.timers[0];` (line 27), add:

```typescript
const timerStatus = activeTimer ? getTimerStatus(activeTimer) : null;
const isOnHold = timerStatus === 'on_hold';
```

**Step 2: Update the card wrapper div (line 52)**

```tsx
// OLD
<div className="px-4 py-3 flex items-center justify-between gap-3">

// NEW
<div className={`px-4 py-3 flex items-center justify-between gap-3 ${isOnHold ? 'border-l-4 border-amber-400 bg-amber-50/50' : ''}`}>
```

**Step 3: Replace the green pulse dot (line 55)**

```tsx
// OLD
<span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />

// NEW
{isOnHold ? (
  <span className="text-amber-500 text-xs shrink-0 leading-none">⏸</span>
) : (
  <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
)}
```

**Step 4: Add On Hold badge after the issue key button (after line 63)**

```tsx
{isOnHold && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium whitespace-nowrap">
    On Hold
  </span>
)}
```

**Step 5: Commit**

```bash
git add apps/tauri/src/components/ActiveTimer.tsx
git commit -m "feat: add On Hold visual styling to ActiveTimer component"
```

---

### Task 6: Create tray-onhold.png icon

**Files:**
- Create: `apps/tauri/src-tauri/icons/tray-onhold.png`

**Step 1: Create amber tray icon**

Create a 32x32 PNG icon with amber/yellow color (`#f59e0b`) matching the style of existing `tray-active.png` (green) and `tray-idle.png` (grey). Use ImageMagick or similar:

```bash
# Generate amber version from tray-active.png by shifting hue
# If ImageMagick is available:
cd apps/tauri/src-tauri/icons
convert tray-active.png -modulate 100,100,60 tray-onhold.png
```

If ImageMagick is not available, manually create a 32x32 amber circle PNG, or copy `tray-active.png` and note it needs manual color adjustment.

**Step 2: Commit**

```bash
git add apps/tauri/src-tauri/icons/tray-onhold.png
git commit -m "feat: add amber tray-onhold.png icon"
```

---

### Task 7: Update Rust tray icon command to support 3 states

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs:88-97,171`

**Step 1: Change update_tray_icon_state to accept string state**

Replace the `update_tray_icon_state` function in `lib.rs`:

```rust
// OLD
#[tauri::command]
fn update_tray_icon_state(app: AppHandle, active: bool) {
    if let Some(tray) = app.tray_by_id("main") {
        let icon = if active {
            tauri::image::Image::from_bytes(include_bytes!("../icons/tray-active.png")).unwrap()
        } else {
            tauri::image::Image::from_bytes(include_bytes!("../icons/tray-idle.png")).unwrap()
        };
        let _ = tray.set_icon(Some(icon));
    }
}

// NEW
#[tauri::command]
fn update_tray_icon_state(app: AppHandle, state: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let icon_bytes: &[u8] = match state.as_str() {
            "active" => include_bytes!("../icons/tray-active.png"),
            "onhold" => include_bytes!("../icons/tray-onhold.png"),
            _ => include_bytes!("../icons/tray-idle.png"),
        };
        let _ = tray.set_icon(Some(tauri::image::Image::from_bytes(icon_bytes).unwrap()));
    }
}
```

**Step 2: Verify build**

Run: `cd apps/tauri && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "feat: support 3 tray icon states (active/onhold/idle)"
```

---

### Task 8: Update useTrayTimer hook with withinWorkingHours param

**Files:**
- Modify: `apps/tauri/src/hooks/useTrayTimer.ts`

**Step 1: Add withinWorkingHours parameter and update tray logic**

Update the function signature:

```typescript
// OLD
export function useTrayTimer(
  startedAt?: string,
  issueKey?: string,
  progress?: number,
  hasUnloggedDays?: boolean,
)

// NEW
export function useTrayTimer(
  startedAt?: string,
  issueKey?: string,
  progress?: number,
  hasUnloggedDays?: boolean,
  withinWorkingHours?: boolean,
)
```

Replace the first useEffect that handles square tray icon state:

```typescript
// OLD
useEffect(() => {
  if (isSquareTrayPlatform()) {
    invoke('update_tray_icon_state', { active: Boolean(startedAt) }).catch(console.error);
  }
}, [startedAt]);

// NEW
useEffect(() => {
  if (isSquareTrayPlatform()) {
    const state = !startedAt ? 'idle' : withinWorkingHours === false ? 'onhold' : 'active';
    invoke('update_tray_icon_state', { state }).catch(console.error);
  }
}, [startedAt, withinWorkingHours]);
```

**Step 2: Update canvas-rendered tray (macOS) colors for on-hold state**

In the render function, after `const timeStr = ...` line, add on-hold color logic:

```typescript
const isOnHold = startedAt && withinWorkingHours === false;
```

Replace the text color (line ~107):

```typescript
// OLD
ctx.fillStyle = 'rgba(255, 255, 255, 1)';

// NEW
ctx.fillStyle = isOnHold ? '#f59e0b' : 'rgba(255, 255, 255, 1)';
```

Replace progress bar fill color (line ~99):

```typescript
// OLD
ctx.fillStyle = 'rgba(255, 255, 255, 1)';

// NEW
ctx.fillStyle = isOnHold ? '#f59e0b' : 'rgba(255, 255, 255, 1)';
```

Update the dependency array of the second useEffect:

```typescript
// OLD
}, [startedAt, issueKey, progress, hasUnloggedDays]);

// NEW
}, [startedAt, issueKey, progress, hasUnloggedDays, withinWorkingHours]);
```

**Step 3: Commit**

```bash
git add apps/tauri/src/hooks/useTrayTimer.ts
git commit -m "feat: add On Hold tray state with amber color"
```

---

### Task 9: Pass withinWorkingHours from App.tsx to useTrayTimer

**Files:**
- Modify: `apps/tauri/src/App.tsx:23,58`

**Step 1: Extract withinWorkingHours from active timer and pass to hook**

In `apps/tauri/src/App.tsx`, after `const activeTimer = data?.timers[0];` (line 23):

```typescript
const withinWorkingHours = activeTimer?.withinWorkingHours;
```

Update the `useTrayTimer` call (line 58):

```typescript
// OLD
useTrayTimer(effectiveStartedAt, activeTimer?.issue.key, dailyProgress, hasUnloggedDays);

// NEW
useTrayTimer(effectiveStartedAt, activeTimer?.issue.key, dailyProgress, hasUnloggedDays, withinWorkingHours);
```

**Step 2: Commit**

```bash
git add apps/tauri/src/App.tsx
git commit -m "feat: pass withinWorkingHours to tray timer hook"
```

---

### Task 10: Final verification

**Step 1: Run TypeScript type check**

Run: `cd apps/tauri && npx tsc --noEmit`
Expected: No type errors

**Step 2: Run lint**

Run: `cd apps/tauri && npx biome check src/`
Expected: No errors

**Step 3: Run API type check**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No type errors

**Step 4: Create final commit if any fixes needed**

```bash
git add -A
git commit -m "feat: timer On Hold status with amber UI and tray icon support"
```
