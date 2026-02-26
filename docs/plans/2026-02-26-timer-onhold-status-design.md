# Timer "On Hold" Status Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

The Clockwork API returns `within_working_hours: false` for timers running outside business hours, but the frontend ignores this field entirely. Users have no visual indication that their timer is "on hold".

## Solution

Add "On Hold" as a derived timer status across the entire stack: API mapping, UI display, and tray icon (all platforms).

### API Layer

Map `within_working_hours` and `started_within_working_hours` from `RawTimer` into the `Timer` interface in `jira-user-resolver.ts`. Add both boolean fields to `Timer` type in both `apps/api` and `apps/tauri`.

### Timer Status Derivation

Create `lib/timer-utils.ts` with `getTimerStatus(timer)` returning `'running' | 'on_hold' | 'stopped'`:
- `finishedAt !== null` → `stopped`
- `withinWorkingHours === false` → `on_hold`
- Otherwise → `running`

### UI Changes (ActiveTimer Component)

| Status | Indicator | Card Style | Badge |
|--------|-----------|------------|-------|
| `running` | Green pulse dot | Default | None |
| `on_hold` | Amber pause icon (⏸) | `border-l-4 border-amber-400 bg-amber-50/50` | "On Hold" amber badge |

### Tray Icon - 3 States (All Platforms)

**macOS (canvas-rendered):** Change text/progress bar color to amber `#f59e0b` when on hold.

**Windows/Ubuntu (static icons):** Add third icon `tray-onhold.png` (amber). Rust command changes from `active: bool` to `state: String` accepting `"active"`, `"onhold"`, `"idle"`.

### Hook Changes

`useTrayTimer` receives new param `withinWorkingHours?: boolean` to determine tray state:
- No timer → `idle`
- Timer + `withinWorkingHours: true` → `active`
- Timer + `withinWorkingHours: false` → `onhold`
