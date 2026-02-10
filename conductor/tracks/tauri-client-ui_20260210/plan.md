# Implementation Plan: Tauri Client UI

**Track ID:** tauri-client-ui_20260210
**Spec:** [spec.md](./spec.md)
**Created:** 2026-02-10
**Status:** [ ] Not Started

## Overview

Build the Tauri client UI in layers: install dependencies and configure tooling first, then implement Rust-side tray/window management, then the app shell with settings, then the API data-fetching layer, then the core UI components (active timer, worklogs, start timer), and finally integration polish.

## Phase 1: Project Setup & Dependencies

Install UI dependencies and configure Tailwind CSS, React Query provider, and shared TypeScript types.

### Tasks

- [x] Task 1.1: Install dependencies — `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `clsx`
- [x] Task 1.2: Configure Tailwind CSS — add `@tailwindcss/vite` plugin to `vite.config.ts`, replace `index.css` with Tailwind `@import "tailwindcss"` directive
- [x] Task 1.3: Create `apps/tauri/src/lib/types.ts` — mirror API response types (`Timer`, `Worklog`, `Issue`, `ActiveTimersResponse`, `WorklogsResponse`, etc.)
- [x] Task 1.4: Create `apps/tauri/src/lib/query-provider.tsx` — React Query client with defaults, wrap `App` in provider in `main.tsx`

### Verification

- [ ] `pnpm --filter tauri type-check` passes
- [ ] Tailwind classes render in dev (`pnpm --filter tauri dev`)

## Phase 2: Rust System Tray & Window Management

Implement Rust-side logic for tray icon click → toggle popover window, positioning, and hide-on-blur.

### Tasks

- [x] Task 2.1: Update `lib.rs` — add tray icon event handler: left-click toggles main window visibility, positions window near tray icon (macOS)
- [x] Task 2.2: Add `hide-on-blur` behavior — listen for window `blur` event via Tauri and hide the window
- [x] Task 2.3: Create Tauri command `get_settings` / `save_settings` in `lib.rs` — read/write a JSON settings file (`settings.json`) in the Tauri app data directory
- [x] Task 2.4: Register commands in `invoke_handler` and update `capabilities/default.json` if needed

### Verification

- [ ] Cargo builds: `cd apps/tauri/src-tauri && cargo check`
- [ ] Tray icon click shows/hides window (manual test with `pnpm tauri dev`)

## Phase 3: App Shell, Navigation & Settings

Build the app layout frame, simple view navigation, and settings screen.

### Tasks

- [x] Task 3.1: Create `apps/tauri/src/components/AppShell.tsx` — fixed header with app title and settings gear icon, scrollable content area, Tailwind styling matching 380px width
- [x] Task 3.2: Create `apps/tauri/src/lib/settings.ts` — TypeScript helpers to invoke `get_settings`/`save_settings` Tauri commands, type `AppSettings { userEmail: string; apiBaseUrl: string }`
- [x] Task 3.3: Create `apps/tauri/src/views/SettingsView.tsx` — form with email input, API base URL input, save button; reads/writes via settings helpers
- [x] Task 3.4: Create simple view router in `App.tsx` — state-based navigation between `MainView` and `SettingsView`, pass settings context down
- [x] Task 3.5: Create `apps/tauri/src/lib/settings-context.tsx` — React context providing `settings` and `updateSettings` to the component tree

### Verification

- [ ] Type-check passes
- [ ] Settings screen renders, saves, and loads user email (manual test)

## Phase 4: API Client Layer & React Query Hooks

Create typed fetch wrappers and React Query hooks for all API endpoints.

### Tasks

- [x] Task 4.1: Create `apps/tauri/src/lib/api-client.ts` — base fetch helper using `apiBaseUrl` from settings, typed functions: `fetchActiveTimers(userEmail)`, `fetchWorklogs(userEmail, date?)`, `startTimer(issueKey, comment?)`, `stopTimer(timerId)`, `fetchIssue(issueKey)`
- [x] Task 4.2: Create `apps/tauri/src/hooks/useActiveTimers.ts` — React Query hook wrapping `fetchActiveTimers`, polling every 5 seconds via `refetchInterval`, enabled only when `userEmail` is set
- [x] Task 4.3: Create `apps/tauri/src/hooks/useWorklogs.ts` — React Query hook wrapping `fetchWorklogs` for today's date
- [x] Task 4.4: Create `apps/tauri/src/hooks/useTimerActions.ts` — React Query mutation hooks for `startTimer` and `stopTimer`, with cache invalidation of active timers query on success

### Verification

- [ ] Type-check passes
- [ ] Hooks return correct loading/error/data states (verified via React DevTools or console in Tauri dev)

## Phase 5: Core UI Components

Build the three main UI sections: active timer display, worklog list, and start timer form.

### Tasks

- [x] Task 5.1: Create `apps/tauri/src/components/ActiveTimer.tsx` — displays issue key, project name (fetched via `fetchIssue`), live-updating elapsed time (computed from `startedAt`), and a stop button; shows "No active timer" empty state
- [x] Task 5.2: Create `apps/tauri/src/components/ElapsedTime.tsx` — small component using `useEffect` + `setInterval` (1s) to display live `HH:MM:SS` from a `startedAt` timestamp
- [x] Task 5.3: Create `apps/tauri/src/components/WorklogList.tsx` — renders today's worklogs as a list (issue key, time spent formatted, comment preview), total time at top; shows "No worklogs today" empty state
- [x] Task 5.4: Create `apps/tauri/src/components/StartTimerForm.tsx` — input for issue key, optional comment, start button; calls `startTimer` mutation, shows success/error feedback
- [x] Task 5.5: Create `apps/tauri/src/views/MainView.tsx` — composes `ActiveTimer`, `WorklogList`, and `StartTimerForm` into the main popover view with section dividers

### Verification

- [ ] Type-check passes
- [ ] All components render with mock/empty data (manual test)
- [ ] Elapsed time ticks live when a timer is active

## Phase 6: Integration & Polish

Wire everything together, add loading skeletons and error states, final verification.

### Tasks

- [ ] Task 6.1: Add loading skeleton components — `TimerSkeleton`, `WorklogSkeleton` displayed while queries are loading
- [ ] Task 6.2: Add error state component — `ErrorCard.tsx` with retry button, used across all sections
- [ ] Task 6.3: Final integration in `App.tsx` — ensure settings flow (first-run prompts for email), main view shows data, all mutations work end-to-end
- [ ] Task 6.4: Style polish — consistent spacing, typography, colors; ensure content fits within 380x560 without scrollbar issues

### Verification

- [ ] `pnpm turbo type-check` — 0 errors
- [ ] `pnpm turbo lint` — 0 errors
- [ ] Manual test: tray click → popover → active timer with live time → stop → start new → worklogs update

## Final Verification

- [ ] All acceptance criteria met
- [ ] `pnpm turbo type-check` — 0 errors
- [ ] `pnpm turbo lint` — 0 errors
- [ ] Popover opens on tray click, hides on blur
- [ ] Active timer displays live-updating elapsed time
- [ ] Timer start/stop works via API
- [ ] Worklogs display correctly
- [ ] Settings persist across app restarts
- [ ] Ready for deployment track

---

_Generated by Conductor. Tasks will be marked [~] in progress and [x] complete._
