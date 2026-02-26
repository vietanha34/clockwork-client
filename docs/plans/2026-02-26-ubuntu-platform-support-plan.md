# Ubuntu Platform Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Treat Ubuntu/Linux the same as Windows for tray icon, window toggle, and UI styling.

**Architecture:** Create a platform group abstraction (`macos` vs `desktop`) to avoid scattering `os === 'windows' || os === 'linux'` checks. Fix Linux tray click by adding a context menu. Window positioning on Linux matches Windows (above tray).

**Tech Stack:** TypeScript (React), Rust (Tauri 2), CSS

---

### Task 1: Create platform helper module

**Files:**
- Create: `apps/tauri/src/lib/platform.ts`

**Step 1: Create the platform helper**

```typescript
// apps/tauri/src/lib/platform.ts
import { platform } from '@tauri-apps/plugin-os';

export type PlatformGroup = 'macos' | 'desktop';

export function getPlatformGroup(): PlatformGroup {
  const os = platform();
  return os === 'macos' ? 'macos' : 'desktop';
}

export function isSquareTrayPlatform(): boolean {
  return getPlatformGroup() === 'desktop';
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/lib/platform.ts
git commit -m "feat: add platform group helper for macos vs desktop"
```

---

### Task 2: Refactor App.tsx to use platform helper

**Files:**
- Modify: `apps/tauri/src/App.tsx:1,26-29`

**Step 1: Replace platform import and usage**

In `apps/tauri/src/App.tsx`:

- Remove: `import { platform } from '@tauri-apps/plugin-os';`
- Add: `import { isSquareTrayPlatform } from './lib/platform';`
- Replace lines 26-29:

```typescript
// OLD
useEffect(() => {
  const os = platform();
  if (os === 'windows') {
    document.documentElement.classList.add('platform-windows');
  }
}, []);

// NEW
useEffect(() => {
  if (isSquareTrayPlatform()) {
    document.documentElement.classList.add('platform-desktop');
  }
}, []);
```

**Step 2: Commit**

```bash
git add apps/tauri/src/App.tsx
git commit -m "refactor: use platform helper in App.tsx"
```

---

### Task 3: Refactor useTrayTimer.ts to use platform helper

**Files:**
- Modify: `apps/tauri/src/hooks/useTrayTimer.ts:1-2,25-29,42-48`

**Step 1: Replace platform import and all checks**

In `apps/tauri/src/hooks/useTrayTimer.ts`:

- Remove: `import { platform } from '@tauri-apps/plugin-os';`
- Add: `import { isSquareTrayPlatform } from '../lib/platform';`

Replace the first useEffect (lines 24-30):

```typescript
// OLD
useEffect(() => {
  const os = platform();
  if (os === 'windows') {
    invoke('update_tray_icon_state', { active: Boolean(startedAt) }).catch(console.error);
  }
}, [startedAt]);

// NEW
useEffect(() => {
  if (isSquareTrayPlatform()) {
    invoke('update_tray_icon_state', { active: Boolean(startedAt) }).catch(console.error);
  }
}, [startedAt]);
```

In the render function inside the second useEffect, replace lines 42-48:

```typescript
// OLD
if (os === 'windows') {
  const tooltip = issueKey && startedAt
    ? `${issueKey}: ${timeStr}`
    : timeStr;
  invoke('update_tray_tooltip', { tooltip }).catch(console.error);
  return;
}

// NEW
if (isSquareTrayPlatform()) {
  const tooltip = issueKey && startedAt
    ? `${issueKey}: ${timeStr}`
    : timeStr;
  invoke('update_tray_tooltip', { tooltip }).catch(console.error);
  return;
}
```

Remove the `const os = platform();` line inside the second useEffect (line 33) since it's no longer needed.

**Step 2: Commit**

```bash
git add apps/tauri/src/hooks/useTrayTimer.ts
git commit -m "refactor: use platform helper in useTrayTimer"
```

---

### Task 4: Refactor MainView.tsx to use platform helper

**Files:**
- Modify: `apps/tauri/src/views/MainView.tsx:1,56,60`

**Step 1: Replace platform import and usage**

In `apps/tauri/src/views/MainView.tsx`:

- Remove: `import { platform } from '@tauri-apps/plugin-os';`
- Add: `import { isSquareTrayPlatform } from '../lib/platform';`
- Remove line 56: `const os = platform();`
- Replace line 60:

```typescript
// OLD
{os === 'windows' && typeof todayProgressSeconds === 'number' && (

// NEW
{isSquareTrayPlatform() && typeof todayProgressSeconds === 'number' && (
```

**Step 2: Commit**

```bash
git add apps/tauri/src/views/MainView.tsx
git commit -m "refactor: use platform helper in MainView"
```

---

### Task 5: Refactor SettingsView.tsx to use platform helper with Linux-specific text

**Files:**
- Modify: `apps/tauri/src/views/SettingsView.tsx:1,13,24,90-99`

**Step 1: Replace platform import and update pin guide**

In `apps/tauri/src/views/SettingsView.tsx`:

- Remove: `import { platform } from '@tauri-apps/plugin-os';`
- Add: `import { platform } from '@tauri-apps/plugin-os';` (keep for OS-specific text)
- Add: `import { isSquareTrayPlatform } from '../lib/platform';`

Replace line 24:

```typescript
// OLD
const showPinGuide = os === 'windows' && !settings.pinIconDismissed;

// NEW
const showPinGuide = isSquareTrayPlatform() && !settings.pinIconDismissed;
```

Replace the guide text (lines 90-99) with OS-conditional content:

```tsx
<h4 className="text-xs font-semibold text-blue-800 mb-1">Tip: Keep Icon Visible</h4>
<p className="text-xs text-blue-700 leading-relaxed">
  {os === 'linux' ? (
    <>
      On Ubuntu/GNOME, tray icons may be hidden by default. Install the
      {' '}<strong>AppIndicator</strong> extension to see Clockwork in the top bar.
    </>
  ) : (
    <>
      Windows hides tray icons by default. To keep Clockwork visible:
      <br />
      1. Right-click Taskbar → <strong>Taskbar settings</strong>
      <br />
      2. Expand <strong>Other system tray icons</strong>
      <br />
      3. Toggle <strong>On</strong> for Clockwork Menubar
    </>
  )}
</p>
```

**Step 2: Commit**

```bash
git add apps/tauri/src/views/SettingsView.tsx
git commit -m "refactor: use platform helper in SettingsView with Linux-specific text"
```

---

### Task 6: Rename CSS class from platform-windows to platform-desktop

**Files:**
- Modify: `apps/tauri/src/index.css:88-102`

**Step 1: Replace all `.platform-windows` with `.platform-desktop`**

In `apps/tauri/src/index.css`, replace lines 88-102:

```css
/* Desktop Platform Overrides (Windows + Linux) */
.platform-desktop .menubar-popover {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.platform-desktop .menubar-popover::before,
.platform-desktop .menubar-popover::after {
  display: none;
}

.platform-desktop .menubar-popover-content {
  border-radius: 8px;
}
```

**Step 2: Commit**

```bash
git add apps/tauri/src/index.css
git commit -m "refactor: rename platform-windows CSS to platform-desktop"
```

---

### Task 7: Fix Rust window positioning for Linux

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs:141-145`

**Step 1: Group Linux with Windows for window positioning**

In `apps/tauri/src-tauri/src/lib.rs`, replace lines 141-145:

```rust
// OLD
#[cfg(target_os = "windows")]
let y = (position.y as i32) - WINDOW_HEIGHT;

#[cfg(not(target_os = "windows"))]
let y = (position.y as i32) + 1;

// NEW
#[cfg(any(target_os = "windows", target_os = "linux"))]
let y = (position.y as i32) - WINDOW_HEIGHT;

#[cfg(target_os = "macos")]
let y = (position.y as i32) + 1;
```

**Step 2: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "fix: position window above tray on Linux (same as Windows)"
```

---

### Task 8: Add Linux tray context menu with Show/Hide and Quit

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs:124-155`

**Step 1: Add menu imports and context menu for Linux**

Add to imports at top of `lib.rs`:

```rust
use tauri::menu::{MenuBuilder, MenuItemBuilder};
```

After the `tray.set_icon_as_template(true);` line (line 125), add Linux-specific menu:

```rust
#[cfg(target_os = "linux")]
{
    let app_handle = app.handle().clone();
    let toggle_item = MenuItemBuilder::with_id("toggle", "Show/Hide").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&toggle_item)
        .item(&quit_item)
        .build()?;
    tray.set_menu(Some(menu))?;
    tray.set_show_menu_on_left_click(true);

    let win_menu = app_handle.get_webview_window("main").expect("main window not found");
    tray.on_menu_event(move |_app, event| {
        match event.id().as_ref() {
            "toggle" => {
                if win_menu.is_visible().unwrap_or(false) {
                    let _ = win_menu.hide();
                } else {
                    let _ = win_menu.show();
                    let _ = win_menu.set_focus();
                }
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        }
    });
}
```

**Step 2: Verify build**

Run: `cd apps/tauri && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation succeeds (on macOS it will compile but Linux-specific code is behind `#[cfg]`)

**Step 3: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "feat: add tray context menu for Linux (Show/Hide + Quit)"
```

---

### Task 9: Final verification and integration commit

**Step 1: Run TypeScript type check**

Run: `cd apps/tauri && npx tsc --noEmit`
Expected: No type errors

**Step 2: Run lint**

Run: `cd apps/tauri && npx biome check src/`
Expected: No errors

**Step 3: Create integration commit if any fixes were needed**

```bash
git add -A
git commit -m "feat: Ubuntu platform support - treat Linux same as Windows for tray"
```
