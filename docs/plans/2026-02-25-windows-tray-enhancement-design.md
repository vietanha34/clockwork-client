# Windows Tray Icon Enhancement Design

## Goal

Improve the Windows tray icon experience with dynamic state indication, a daily progress bar in the main view, and a guide for pinning the icon to the taskbar.

## 1. Dynamic Tray Icon (Active/Inactive)

Two static icon files swapped based on timer state:
- `tray-idle.png` — monochrome/grey, no timer running
- `tray-active.png` — colored (green), timer active

**Rust backend:** New command `update_tray_icon_state(active: bool)` in `lib.rs` loads the appropriate icon and calls `tray.set_icon()`.

**Frontend:** In `useTrayTimer.ts` Windows path, invoke `update_tray_icon_state` based on whether `startedAt` is present.

## 2. Daily Progress Bar in MainView (Windows Only)

Since Windows tray icons cannot render dynamic bitmaps like macOS menu bar, add a `DailyProgressBar` component at the top of MainView:
- Thin horizontal bar (4px height), full-width, grey track with blue fill
- Small text label showing `{logged}h / 8h`
- Only rendered when `platform === 'windows'`
- Reuses `dailyProgress` already computed in App.tsx

## 3. Pin Icon Guide in Settings

When Windows is detected, show an info banner in SettingsView:
- Text: "Tip: Right-click the taskbar → Taskbar settings → Turn on Clockwork Menubar in system tray to always show the icon"
- Styled as a dismissible info banner (blue/gray)
- Dismiss state persisted in app settings so it doesn't reappear

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/icons/tray-idle.png` | New icon (idle state) |
| `src-tauri/icons/tray-active.png` | New icon (active state) |
| `src-tauri/src/lib.rs` | Add `update_tray_icon_state` command |
| `apps/tauri/src/hooks/useTrayTimer.ts` | Call `update_tray_icon_state` on Windows |
| `apps/tauri/src/components/DailyProgressBar.tsx` | New component |
| `apps/tauri/src/views/MainView.tsx` | Add DailyProgressBar (Windows only) |
| `apps/tauri/src/views/SettingsView.tsx` | Add pin icon guide banner |
| `apps/tauri/src/lib/types.ts` | Add `pinIconDismissed` to AppSettings |
