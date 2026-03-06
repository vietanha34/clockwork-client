# Adaptive Window Height Design

## Problem

The window is fixed at 302×540px. Content may not fit (many worklogs) or leave excessive empty space (no timer, few worklogs). The layout should auto-adapt to content.

## Solution

Use a `ResizeObserver` on the content container to measure actual height, then call Tauri's `WebviewWindow.setSize()` to resize the window dynamically.

## Key Decisions

- **Width**: Fixed at 302px (unchanged)
- **Min height**: ~300px (header + minimal content)
- **Max height**: ~700px (screen constraint)
- **Worklog list**: Capped at 7 visible items (~280px max-height), scrolls beyond that
- **Resize style**: Instant (no animation)
- **Timer state**: Window shrinks when showing StartTimerForm vs ActiveTimer

## Architecture

```
Content DOM changes
  → ResizeObserver fires
  → measure contentHeight
  → add padding/frame offsets
  → clamp(minHeight, maxHeight)
  → WebviewWindow.setSize(302, newHeight)
  → debounce 50ms
```

### Hook: `useAdaptiveWindow`

- Mounted in `AppShell` or `App.tsx`
- Attaches `ResizeObserver` to the content wrapper
- Calls `getCurrentWebviewWindow().setSize()` on height change
- Debounced at 50ms to avoid excessive native calls

### Layout Changes

**Remove fixed height constraints:**
- `AppShell`: Remove `h-full` from outer containers, let content drive height
- `MainView`: Remove `h-full`, worklog section gets `max-height` instead of `flex-1`

**Worklog list cap:**
- `WorklogList` wrapper: `max-height: 280px` with `overflow-y: auto`
- This allows ~7 worklog items before scrolling
- The rest of the content (header, timer, tabs, date strip) renders at natural height

### Tauri Config Changes

- `tauri.conf.json`: Set initial `height` to a reasonable default (e.g. 400), keep `resizable: false`
- No `minHeight`/`maxHeight` in config — handled by frontend clamp logic

### Rust Changes

- Update `WINDOW_HEIGHT` usage for Windows/Linux tray positioning to use dynamic window size
- Use `window.outer_size()` at position time instead of the constant

## When Window Resizes

| Event | Effect |
|-------|--------|
| Worklogs loaded | Height adjusts to actual worklog count (max 7 visible) |
| Day changed | Different worklog count → different height |
| Timer started/stopped | ActiveTimer vs StartTimerForm have different heights |
| Tab switch (list ↔ summary) | Chart vs list have different heights |
| Settings view | Different content height than MainView |
| Warning banner shown/hidden | Adds/removes height |

## Unchanged

- Width stays 302px
- Scrollbar styling (`.worklogs-scroll`)
- Platform-specific styling (macOS arrow, desktop square corners)
- All existing component internals
