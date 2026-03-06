# Adaptive Window Height Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Tauri window auto-resize its height based on content, with worklog list capped at 7 items before scrolling.

**Architecture:** Remove fixed `h-full` height constraints from layout containers so content drives height. Use `ResizeObserver` + Tauri `WebviewWindow.setSize()` to sync window height to content. Worklog list gets a `max-height` cap.

**Tech Stack:** React (ResizeObserver hook), Tauri v2 WebviewWindow API, Tailwind CSS

---

### Task 1: Update CSS — remove fixed height from `.menubar-popover-content`

**Files:**
- Modify: `apps/tauri/src/index.css:63-66`

**Step 1: Edit CSS**

In `apps/tauri/src/index.css`, change `.menubar-popover-content`:

```css
/* BEFORE */
.menubar-popover-content {
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* AFTER — remove height: 100%, keep overflow: hidden for backdrop-filter */
.menubar-popover-content {
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/index.css
git commit -m "style: remove fixed height from menubar-popover-content"
```

---

### Task 2: Update AppShell — remove `h-full` from containers

**Files:**
- Modify: `apps/tauri/src/components/AppShell.tsx:22-24,81`

**Step 1: Edit AppShell.tsx**

Remove `h-full` from the three wrapper divs and `flex-1 min-h-0` from main. Content should drive height now.

Line 22 — outer frame div:
```tsx
// BEFORE
<div className="menubar-popover-frame h-full w-full p-2 pt-2">
// AFTER
<div className="menubar-popover-frame w-full p-2 pt-2">
```

Line 23 — popover div:
```tsx
// BEFORE
<div className="menubar-popover h-full w-full">
// AFTER
<div className="menubar-popover w-full">
```

Line 24 — content div:
```tsx
// BEFORE
<div className="menubar-popover-content flex h-full w-full flex-col bg-gray-50/96 text-gray-900">
// AFTER
<div className="menubar-popover-content flex w-full flex-col bg-gray-50/96 text-gray-900">
```

Line 81 — main element:
```tsx
// BEFORE
<main className="flex-1 min-h-0 overflow-hidden">{children}</main>
// AFTER
<main className="overflow-hidden">{children}</main>
```

**Step 2: Commit**

```bash
git add apps/tauri/src/components/AppShell.tsx
git commit -m "style: remove fixed height constraints from AppShell"
```

---

### Task 3: Update MainView — remove `h-full`, cap worklog scroll area

**Files:**
- Modify: `apps/tauri/src/views/MainView.tsx:58,83,130`

**Step 1: Edit MainView.tsx**

Line 58 — outer container, remove `h-full min-h-0`:
```tsx
// BEFORE
<div className="relative h-full min-h-0 flex flex-col divide-y divide-gray-100">
// AFTER
<div className="relative flex flex-col divide-y divide-gray-100">
```

Line 83 — worklogs section, remove `flex-1 min-h-0`:
```tsx
// BEFORE
<section className="flex min-h-0 flex-1 flex-col">
// AFTER
<section className="flex flex-col">
```

Line 130 — worklogs scroll container, remove `flex-1 min-h-0`, add `max-h-[280px]`:
```tsx
// BEFORE
<div className="worklogs-scroll min-h-0 flex-1 overflow-y-auto">
// AFTER
<div className="worklogs-scroll max-h-[280px] overflow-y-auto">
```

The `max-h-[280px]` caps the worklog area at ~7 items (each ~40px). When there are fewer items, it shrinks naturally. When there are more, it scrolls.

**Step 2: Commit**

```bash
git add apps/tauri/src/views/MainView.tsx
git commit -m "style: remove flex-fill from MainView, cap worklog scroll at 280px"
```

---

### Task 4: Update SettingsView — remove `h-full`

**Files:**
- Modify: `apps/tauri/src/views/SettingsView.tsx:103`

**Step 1: Edit SettingsView.tsx**

Line 103 — remove `h-full`:
```tsx
// BEFORE
<div className="h-full overflow-y-auto p-4">
// AFTER
<div className="overflow-y-auto p-4">
```

Note: SettingsView content may exceed max window height (700px). The `overflow-y-auto` handles scrolling within the capped height. The `useAdaptiveWindow` hook (Task 5) will clamp the window at `MAX_HEIGHT`, and the content will scroll within the AppShell's `overflow-hidden` main.

Actually, SettingsView needs a max-height too so it scrolls properly when the window is clamped. Add `max-h-[580px]` (700px max window - header ~52px - padding ~16px top/bottom - arrow ~10px ≈ ~580px usable):

```tsx
// AFTER (revised)
<div className="max-h-[580px] overflow-y-auto p-4">
```

**Step 2: Commit**

```bash
git add apps/tauri/src/views/SettingsView.tsx
git commit -m "style: remove fixed height from SettingsView, add max-height"
```

---

### Task 5: Create `useAdaptiveWindow` hook

**Files:**
- Create: `apps/tauri/src/hooks/useAdaptiveWindow.ts`

**Step 1: Create the hook file**

```typescript
import { useEffect, useRef, type RefObject } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalSize } from '@tauri-apps/api/dpi';

const WINDOW_WIDTH = 302;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 700;
const DEBOUNCE_MS = 50;

export function useAdaptiveWindow(contentRef: RefObject<HTMLDivElement | null>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const sync = () => {
      const raw = el.scrollHeight;
      const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, raw));

      // Skip if height hasn't changed
      if (clamped === lastHeightRef.current) return;
      lastHeightRef.current = clamped;

      const win = getCurrentWebviewWindow();
      win.setSize(new PhysicalSize(WINDOW_WIDTH, clamped)).catch(() => {
        // Silently ignore — window may not be ready
      });
    };

    const debouncedSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sync, DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(debouncedSync);
    observer.observe(el);

    // Initial sync
    sync();

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [contentRef]);
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/hooks/useAdaptiveWindow.ts
git commit -m "feat: add useAdaptiveWindow hook for dynamic window resizing"
```

---

### Task 6: Mount `useAdaptiveWindow` in AppShell

**Files:**
- Modify: `apps/tauri/src/components/AppShell.tsx`

**Step 1: Add ref and hook to AppShell**

Add imports at top of file:
```typescript
import { useRef } from 'react';
import { useAdaptiveWindow } from '../hooks/useAdaptiveWindow';
```

Update the `AppShell` function — add ref + hook, attach ref to the outermost div:

```tsx
export function AppShell({
  children,
  onSettingsClick,
  showBackButton,
  onBackClick,
  userDisplayName,
}: AppShellProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  useAdaptiveWindow(frameRef);

  return (
    <div ref={frameRef} className="menubar-popover-frame w-full p-2 pt-2">
      {/* ... rest unchanged ... */}
    </div>
  );
}
```

Note: The `ref` goes on the outermost `.menubar-popover-frame` div. Its `scrollHeight` includes the padding (p-2) plus all content, which is exactly what we need for the window height.

**Step 2: Commit**

```bash
git add apps/tauri/src/components/AppShell.tsx
git commit -m "feat: mount useAdaptiveWindow in AppShell"
```

---

### Task 7: Update `tauri.conf.json` — lower initial height

**Files:**
- Modify: `apps/tauri/src-tauri/tauri.conf.json:20`

**Step 1: Change initial window height**

```json
// BEFORE
"height": 540,

// AFTER — start smaller, hook will resize to fit content
"height": 400,
```

The hook will immediately resize the window on first render to match actual content.

**Step 2: Commit**

```bash
git add apps/tauri/src-tauri/tauri.conf.json
git commit -m "config: lower initial window height for adaptive resize"
```

---

### Task 8: Update Rust tray positioning — use dynamic window height

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs:12-14,205-206`

**Step 1: Remove `WINDOW_HEIGHT` constant and use dynamic size**

Lines 12-14 — remove `WINDOW_HEIGHT`:
```rust
// BEFORE
const WINDOW_WIDTH: i32 = 302;
#[allow(dead_code)]
const WINDOW_HEIGHT: i32 = 540;

// AFTER
const WINDOW_WIDTH: i32 = 302;
```

Lines 204-206 — use `win.outer_size()` for Windows/Linux positioning:
```rust
// BEFORE
#[cfg(any(target_os = "windows", target_os = "linux"))]
let y = (position.y as i32) - WINDOW_HEIGHT;

// AFTER — use actual window height for positioning
#[cfg(any(target_os = "windows", target_os = "linux"))]
let y = {
    let height = win.outer_size().map(|s| s.height as i32).unwrap_or(400);
    (position.y as i32) - height
};
```

**Step 2: Verify Rust compiles**

Run: `cd apps/tauri/src-tauri && cargo check`
Expected: Compiles with no errors.

**Step 3: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "fix: use dynamic window height for tray positioning on Windows/Linux"
```

---

### Task 9: Verify end-to-end

**Step 1: Check TypeScript compiles**

Run: `cd apps/tauri && pnpm tsc --noEmit`
Expected: No type errors.

**Step 2: Run dev server**

Run: `cd apps/tauri && pnpm tauri dev`

**Step 3: Manual verification checklist**

- [ ] Window opens at a reasonable height (not 540px fixed)
- [ ] Window height changes when switching between timer states (active vs start form)
- [ ] Worklog list scrolls when there are more than 7 items
- [ ] Window shrinks when there are fewer worklogs
- [ ] Settings view displays properly
- [ ] Tab switch (list ↔ summary) adjusts window height
- [ ] Window doesn't exceed ~700px even with many worklogs
- [ ] Window doesn't shrink below ~300px with no content
- [ ] macOS: arrow pointer still visible and aligned
- [ ] Warning banner appears/disappears correctly adjusting height
