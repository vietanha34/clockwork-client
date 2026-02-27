# Auto-start at Login Design

**Date:** 2026-02-27
**Status:** Approved

## Problem

The Clockwork Menubar app needs to automatically start when the user logs in on all 3 supported platforms (macOS, Windows, Ubuntu/Linux).

## Decision

Use `tauri-plugin-autostart` (Tauri 2 official plugin) which handles all 3 platforms natively:
- macOS: LaunchAgent plist
- Windows: Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Linux: XDG autostart `.desktop` file

Default behavior: ON (auto-enable on first run), with a toggle in Settings to disable.

## Architecture

### Backend Changes

**Cargo.toml:** Add `tauri-plugin-autostart = "2"` dependency.

**lib.rs:**
- Register plugin: `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))`
- In `setup()`: check if `launchAtStartup` setting exists. If not (first run), call autostart enable and save setting as `true`.

### Frontend Changes

**types.ts:** Add `launchAtStartup: boolean` to `AppSettings` interface.

**settings.ts:** Set `launchAtStartup: true` in `DEFAULT_SETTINGS`.

**SettingsView.tsx:** Add a "Launch at startup" toggle. On change:
1. Call `enable()` or `disable()` from `@tauri-apps/plugin-autostart`
2. Update `launchAtStartup` in settings
3. Persist settings

### Tauri Config

Add autostart permissions to the app's capabilities.

### Flow

```
First run:
  → launchAtStartup not set → default true
  → setup() enables autostart via plugin
  → Next boot → app starts automatically

User disables in settings:
  → Toggle OFF → JS calls disable() + saves launchAtStartup=false
  → Next boot → app does not start

User re-enables:
  → Toggle ON → JS calls enable() + saves launchAtStartup=true
```

## Constraints

- No special OS permissions needed (plugin handles platform differences)
- macOS uses LaunchAgent (not LoginItem) for compatibility without code signing
- Setting persisted in existing AppSettings JSON file
