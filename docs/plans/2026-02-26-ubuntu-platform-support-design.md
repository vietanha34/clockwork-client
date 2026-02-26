# Ubuntu Platform Support Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

Ubuntu tray icon is limited to square dimensions (same as Windows), and left-click on tray icon does not open the window due to AppIndicator limitations on GNOME/Ubuntu.

## Solution

Treat Ubuntu/Linux as the same platform group as Windows ("desktop") for tray behavior, UI overrides, and window positioning.

### Platform Detection Refactor

Create `lib/platform.ts` helper with `getPlatformGroup()` returning `'macos' | 'desktop'` and `isSquareTrayPlatform()`. Replace all `os === 'windows'` checks with platform group helpers.

### Changes by File

| File | Change |
|------|--------|
| `lib/platform.ts` | New file: `getPlatformGroup()`, `isSquareTrayPlatform()` |
| `App.tsx` | Use `isSquareTrayPlatform()` to add `platform-desktop` CSS class |
| `useTrayTimer.ts` | Use `isSquareTrayPlatform()` for static icon + tooltip path |
| `MainView.tsx` | Show daily progress bar for `desktop` group |
| `SettingsView.tsx` | Show pin guide for `desktop` group, platform-specific text |
| `index.css` | Rename `.platform-windows` to `.platform-desktop` |
| `src-tauri/src/lib.rs` | Add context menu for Linux, fix window positioning |

### Tray Click Fix (Linux)

Add context menu with "Show/Hide" and "Quit" items for Linux via `MenuBuilder`. Use `menuOnLeftClick` workaround to attempt left-click support. Window positioning on Linux uses same logic as Windows (show above tray).

### Rust Changes

```rust
// Window positioning: group linux with windows
#[cfg(any(target_os = "windows", target_os = "linux"))]
let y = (position.y as i32) - WINDOW_HEIGHT;

#[cfg(target_os = "macos")]
let y = (position.y as i32) + 1;

// Context menu for Linux
#[cfg(target_os = "linux")]
{
    let toggle = MenuItemBuilder::new("Show/Hide").id("toggle").build(app)?;
    let quit = MenuItemBuilder::new("Quit").id("quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&toggle, &quit]).build()?;
    tray.set_menu(Some(menu))?;
}
```
