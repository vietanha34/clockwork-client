# Auto-start at Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure the Clockwork Menubar app to automatically start at system login on macOS, Windows, and Linux using `tauri-plugin-autostart`.

**Architecture:** Add the Tauri autostart plugin (Rust + JS), register it in the app setup, enable it by default on first run, and add a toggle in the Settings UI to let users control the behavior. The setting is persisted in the existing `AppSettings` JSON.

**Tech Stack:** tauri-plugin-autostart (Rust crate + JS package), Tauri 2, React

---

### Task 1: Install autostart plugin dependencies

**Files:**
- Modify: `apps/tauri/src-tauri/Cargo.toml`
- Modify: `apps/tauri/package.json`

**Step 1: Add Rust dependency**

Add to `[dependencies]` section of `apps/tauri/src-tauri/Cargo.toml`:

```toml
tauri-plugin-autostart = "2"
```

The full `[dependencies]` section should look like:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "macos-private-api", "image-png"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-http = "2.5.7"
tauri-plugin-os = "2"
tauri-plugin-autostart = "2"
```

**Step 2: Add JS dependency**

Run from project root:
```bash
cd apps/tauri && pnpm add @tauri-apps/plugin-autostart && cd ../..
```

**Step 3: Add autostart permission**

Add `"autostart:default"` to `apps/tauri/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "os:default",
    "autostart:default",
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://clockwork-client.vercel.app/*" }],
      "deny": []
    }
  ]
}
```

**Step 4: Verify it compiles**

Run from project root:
```bash
cd apps/tauri && pnpm tauri build --debug 2>&1 | tail -5
```

If compilation takes too long, just verify the Rust check passes:
```bash
cd apps/tauri/src-tauri && cargo check
```

**Step 5: Commit**

```bash
git add apps/tauri/src-tauri/Cargo.toml apps/tauri/package.json apps/tauri/src-tauri/capabilities/default.json pnpm-lock.yaml apps/tauri/src-tauri/Cargo.lock
git commit -m "chore: install tauri-plugin-autostart dependencies"
```

---

### Task 2: Register autostart plugin in Rust backend

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs:108-110`

**Step 1: Add import**

At the top of `apps/tauri/src-tauri/src/lib.rs`, add:

```rust
use tauri_plugin_autostart::MacosLauncher;
```

**Step 2: Register plugin in builder**

In the `run()` function, add the autostart plugin registration. The builder chain currently starts at line 109:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        None,
    ))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_os::init())
```

The `init()` takes two args:
- `MacosLauncher::LaunchAgent` — use LaunchAgent on macOS (works without code signing)
- `None` — no extra args to pass to the launched app

**Step 3: Enable autostart on first run**

Inside the existing `.setup(|app| { ... })` closure, add autostart initialization at the beginning (before the window code). This checks if the user has previously set the `launchAtStartup` preference. If not (first run), it enables autostart.

Add this block right after `let window = app.get_webview_window("main").expect("main window not found");`:

```rust
// Auto-start: enable on first run if not explicitly configured
{
    let settings = get_settings(app.handle().clone());
    // launchAtStartup defaults to true via serde default
    if settings.launch_at_startup {
        let manager = app.autolaunch();
        let _ = manager.enable();
    }
}
```

**Step 4: Add `launchAtStartup` field to AppSettings struct**

In `lib.rs`, add the new field to the `AppSettings` struct (around line 28):

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(rename = "jiraToken", default)]
    pub jira_token: String,
    #[serde(rename = "clockworkApiToken", default)]
    pub clockwork_api_token: String,
    #[serde(rename = "jiraUser", default)]
    pub jira_user: Option<JiraUserSettings>,
    #[serde(rename = "pinIconDismissed", default)]
    pub pin_icon_dismissed: bool,
    #[serde(rename = "launchAtStartup", default = "default_true")]
    pub launch_at_startup: bool,
}

fn default_true() -> bool {
    true
}
```

Note: `default = "default_true"` means when deserializing old settings.json files that don't have this field, it defaults to `true` (matching our "default ON" behavior).

**Step 5: Add the `autolaunch` import**

Add the `ManagerExt` trait import for `app.autolaunch()`:

```rust
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
```

**Step 6: Verify compilation**

```bash
cd apps/tauri/src-tauri && cargo check
```

**Step 7: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "feat: register autostart plugin and enable on first run"
```

---

### Task 3: Add frontend type and setting support

**Files:**
- Modify: `apps/tauri/src/lib/types.ts:98-103`
- Modify: `apps/tauri/src/lib/settings.ts:4-9`

**Step 1: Add `launchAtStartup` to AppSettings type**

In `apps/tauri/src/lib/types.ts`, add the field to the `AppSettings` interface:

```typescript
export interface AppSettings {
  jiraToken: string;
  clockworkApiToken: string;
  jiraUser: ClockworkUser | null;
  pinIconDismissed?: boolean;
  launchAtStartup: boolean;
}
```

**Step 2: Update DEFAULT_SETTINGS**

In `apps/tauri/src/lib/settings.ts`, add the default value:

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  jiraToken: '',
  clockworkApiToken: '',
  jiraUser: null,
  pinIconDismissed: false,
  launchAtStartup: true,
};
```

**Step 3: Commit**

```bash
git add apps/tauri/src/lib/types.ts apps/tauri/src/lib/settings.ts
git commit -m "feat: add launchAtStartup to AppSettings type and defaults"
```

---

### Task 4: Add toggle UI in SettingsView

**Files:**
- Modify: `apps/tauri/src/views/SettingsView.tsx`

**Step 1: Add autostart imports**

At the top of `apps/tauri/src/views/SettingsView.tsx`, add:

```typescript
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
```

**Step 2: Add state for the toggle**

Inside the `SettingsView` component, after the existing `useState` calls (around line 24), add:

```typescript
const [launchAtStartup, setLaunchAtStartup] = useState(settings.launchAtStartup);
```

**Step 3: Add toggle handler**

Add this function inside the component, before the `handleSave` function:

```typescript
async function handleAutoStartToggle(checked: boolean) {
  setLaunchAtStartup(checked);
  try {
    if (checked) {
      await enable();
    } else {
      await disable();
    }
    await updateSettings({ ...settings, launchAtStartup: checked });
  } catch (err) {
    console.error('Failed to toggle autostart:', err);
    setLaunchAtStartup(!checked); // revert on error
  }
}
```

**Step 4: Add toggle UI**

Add this block in the JSX, right before the `<form>` tag (after the browser warning `div` and before line 134):

```tsx
<div className="flex items-center justify-between py-2 mb-4">
  <label htmlFor="launch-at-startup" className="text-xs font-medium text-gray-700">
    Launch at startup
  </label>
  <button
    id="launch-at-startup"
    type="button"
    role="switch"
    aria-checked={launchAtStartup}
    onClick={() => handleAutoStartToggle(!launchAtStartup)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
      launchAtStartup ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
        launchAtStartup ? 'translate-x-4.5' : 'translate-x-0.5'
      }`}
    />
  </button>
</div>
```

**Step 5: Also persist launchAtStartup in handleSave**

In the existing `handleSave` function, update the `updateSettings` call to include `launchAtStartup`:

Change:
```typescript
await updateSettings({
  jiraToken: accountId,
  clockworkApiToken: token,
  jiraUser: validation.user,
  pinIconDismissed: settings.pinIconDismissed,
});
```

To:
```typescript
await updateSettings({
  jiraToken: accountId,
  clockworkApiToken: token,
  jiraUser: validation.user,
  pinIconDismissed: settings.pinIconDismissed,
  launchAtStartup,
});
```

**Step 6: Verify frontend compiles**

```bash
cd apps/tauri && pnpm build
```

**Step 7: Commit**

```bash
git add apps/tauri/src/views/SettingsView.tsx
git commit -m "feat: add launch-at-startup toggle in settings UI"
```

---

### Task 5: Full build verification

**Step 1: Verify full Tauri build works**

```bash
cd apps/tauri && pnpm tauri build --debug 2>&1 | tail -10
```

Or if debug build is too slow, at minimum verify:
```bash
cd apps/tauri/src-tauri && cargo check
cd apps/tauri && pnpm build
```

**Step 2: Manual smoke test (optional)**

Run the dev server:
```bash
cd apps/tauri && pnpm tauri dev
```

Verify:
1. App starts normally
2. Open Settings — "Launch at startup" toggle is visible and ON by default
3. Toggle it OFF, close settings, reopen — it should remember OFF
4. Toggle it ON again

**Step 3: Final commit if any fixes needed**

If any fixes were required during verification, commit them.
