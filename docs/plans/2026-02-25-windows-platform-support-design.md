# Windows Platform Support Design

**Date**: 2026-02-25
**Status**: Approved

## Problem

Clockwork menubar app is designed for macOS. On Windows:
1. **Window positioning**: Popover appears below tray icon, gets cut off by taskbar (bottom of screen)
2. **Tray icon bitmap**: Canvas-drawn timer text uses macOS fonts/sizing, Windows tray icon is a small square (16x16 or 24x24) — too small for text
3. **Popover style**: CSS arrow points up (macOS style), not appropriate for Windows

## Platforms

- **macOS**: No changes (current behavior)
- **Ubuntu/Linux**: Same as macOS (tray on top)
- **Windows**: Custom handling (taskbar on bottom only)

## Design

### 1. Window Positioning (Rust — `lib.rs`)

Branch tray click handler by OS:

- **macOS/Linux**: `y = tray_y + 1` (below tray, existing behavior)
- **Windows**: `y = tray_y - WINDOW_HEIGHT - 1` (above tray)

Extract `WINDOW_WIDTH = 302` and `WINDOW_HEIGHT = 540` as constants to avoid hardcoded values in positioning math.

```rust
#[cfg(target_os = "windows")]
let y = (position.y as i32) - WINDOW_HEIGHT - 1;

#[cfg(not(target_os = "windows"))]
let y = (position.y as i32) + 1;
```

### 2. Tray Icon — Static Icon + Tooltip (Rust + TypeScript)

**Windows**: Don't call `update_tray_bitmap`. Keep static icon from `icons/icon.png`. Update tooltip instead.

New Rust command:
```rust
#[tauri::command]
fn update_tray_tooltip(app: AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&text));
    }
}
```

TypeScript (`useTrayTimer.ts`): detect platform, branch between bitmap update (macOS/Linux) and tooltip update (Windows).

Tooltip format: `"TL-50: 01:23:45"` (issue key + elapsed time).

### 3. Popover Visual Style (CSS)

Add `platform-windows` class to `<html>` element on Windows.

Windows overrides:
- `border-radius: 8px` (instead of 20px)
- Hide CSS arrow pseudo-elements (::before/::after)
- Shadow style consistent with Windows notification panel

### 4. Platform Detection (TypeScript — `App.tsx`)

Use `@tauri-apps/plugin-os` to detect platform once on mount:
```ts
import { platform } from '@tauri-apps/plugin-os';
if (platform() === 'windows') {
  document.documentElement.classList.add('platform-windows');
}
```

## Files Changed

| File | Change |
|------|--------|
| `apps/tauri/src-tauri/src/lib.rs` | Window positioning branch, constants, `update_tray_tooltip` command |
| `apps/tauri/src/hooks/useTrayTimer.ts` | Platform branch: bitmap vs tooltip |
| `apps/tauri/src/index.css` | Windows popover overrides |
| `apps/tauri/src/App.tsx` | Platform detection + CSS class |
| `apps/tauri/package.json` | Add `@tauri-apps/plugin-os` |
| `apps/tauri/src-tauri/Cargo.toml` | Potentially add os plugin feature |

## Scope

Single conductor track, ~3 phases, ~8-9 tasks total.
