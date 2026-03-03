# Auto-Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add silent auto-update to Clockwork Menubar using `tauri-plugin-updater` with GitHub Releases as the update endpoint.

**Architecture:** The Tauri updater plugin checks a `latest.json` manifest hosted on GitHub Releases. When a new version is found, it silently downloads the signed binary, installs it, and notifies the user to restart. The release workflow is rebuilt around `tauri-action` which handles building, signing, and publishing for all 3 platforms in CI.

**Tech Stack:** tauri-plugin-updater v2, tauri-plugin-process v2, @tauri-apps/plugin-updater, @tauri-apps/plugin-process, tauri-action GitHub Action

---

### Task 1: Generate Signing Keys

This is a one-time manual step that must be done before any other task.

**Step 1: Generate the keypair**

Run locally:
```bash
cd apps/tauri
pnpm tauri signer generate -w ~/.tauri/clockwork.key
```

This outputs:
- Private key: `~/.tauri/clockwork.key`
- Public key: printed to stdout (copy this — it goes into `tauri.conf.json`)

**Step 2: Save private key to GitHub Secrets**

Go to: `https://github.com/vietanha34/clockwork-client/settings/secrets/actions`

Create two secrets:
- `TAURI_SIGNING_PRIVATE_KEY` — paste the full content of `~/.tauri/clockwork.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you chose (or empty string if none)

**Step 3: Note the public key**

Copy the public key string. It will be used in Task 2.

---

### Task 2: Install Rust Dependencies and Configure Tauri

**Files:**
- Modify: `apps/tauri/src-tauri/Cargo.toml`
- Modify: `apps/tauri/src-tauri/tauri.conf.json`
- Modify: `apps/tauri/src-tauri/capabilities/default.json`

**Step 1: Add Rust plugin dependencies**

In `apps/tauri/src-tauri/Cargo.toml`, add two lines after `tauri-plugin-notification = "2"`:

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

The `[dependencies]` section should end with:
```toml
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

**Step 2: Add updater config to tauri.conf.json**

In `apps/tauri/src-tauri/tauri.conf.json`, add `"createUpdaterArtifacts": true` inside `"bundle"` and add a `"plugins"` section at the top level:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": [...]
  },
  "plugins": {
    "updater": {
      "pubkey": "<PASTE_PUBLIC_KEY_FROM_TASK_1>",
      "endpoints": [
        "https://github.com/vietanha34/clockwork-client/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**Step 3: Add permissions to capabilities**

In `apps/tauri/src-tauri/capabilities/default.json`, add `"updater:default"` and `"process:default"` to the `"permissions"` array:

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "os:default",
    "autostart:default",
    "notification:default",
    "updater:default",
    "process:default",
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://clockwork-client.vercel.app/*" }],
      "deny": []
    }
  ]
}
```

**Step 4: Verify Rust compiles**

Run: `cd apps/tauri && cargo check`
Expected: Compiles with no errors.

**Step 5: Commit**

```bash
git add apps/tauri/src-tauri/Cargo.toml apps/tauri/src-tauri/Cargo.lock apps/tauri/src-tauri/tauri.conf.json apps/tauri/src-tauri/capabilities/default.json
git commit -m "feat(updater): add tauri-plugin-updater and process dependencies and config"
```

---

### Task 3: Register Plugins in Rust Backend

**Files:**
- Modify: `apps/tauri/src-tauri/src/lib.rs`

**Step 1: Add updater and process plugins to the plugin chain**

In `apps/tauri/src-tauri/src/lib.rs`, inside the `run()` function, add the two plugins after `.plugin(tauri_plugin_notification::init())` and before `.setup(|app| {`:

```rust
.plugin(tauri_plugin_notification::init())
.setup(|app| {
    #[cfg(desktop)]
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    // ... rest of setup
```

Also add `tauri_plugin_process::init()` as a regular plugin (not in setup):

```rust
.plugin(tauri_plugin_notification::init())
.plugin(tauri_plugin_process::init())
.setup(|app| {
```

The updater plugin needs to be in `.setup()` because it uses `Builder::new().build()` pattern, while process is a simple `.init()`.

**Step 2: Verify Rust compiles**

Run: `cd apps/tauri && cargo check`
Expected: Compiles with no errors.

**Step 3: Commit**

```bash
git add apps/tauri/src-tauri/src/lib.rs
git commit -m "feat(updater): register updater and process plugins in Rust backend"
```

---

### Task 4: Install JS Dependencies

**Files:**
- Modify: `apps/tauri/package.json`

**Step 1: Install the JS packages**

```bash
cd apps/tauri
pnpm add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

**Step 2: Verify packages are installed**

Check `apps/tauri/package.json` has both packages in `dependencies`:
- `@tauri-apps/plugin-updater`
- `@tauri-apps/plugin-process`

**Step 3: Commit**

```bash
git add apps/tauri/package.json pnpm-lock.yaml
git commit -m "feat(updater): install @tauri-apps/plugin-updater and plugin-process"
```

---

### Task 5: Add autoUpdate Setting

**Files:**
- Modify: `apps/tauri/src/lib/types.ts`
- Modify: `apps/tauri/src/lib/settings.ts`
- Modify: `apps/tauri/src-tauri/src/lib.rs`

**Step 1: Add autoUpdate to TypeScript AppSettings**

In `apps/tauri/src/lib/types.ts`, add `autoUpdate` to the `AppSettings` interface after `launchAtStartup`:

```typescript
export interface AppSettings {
  jiraToken: string;
  clockworkApiToken: string;
  jiraUser: ClockworkUser | null;
  pinIconDismissed?: boolean;
  launchAtStartup: boolean;
  autoUpdate: boolean;
}
```

**Step 2: Add default value**

In `apps/tauri/src/lib/settings.ts`, add `autoUpdate: true` to `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  jiraToken: '',
  clockworkApiToken: '',
  jiraUser: null,
  pinIconDismissed: false,
  launchAtStartup: true,
  autoUpdate: true,
};
```

**Step 3: Add autoUpdate to Rust AppSettings struct**

In `apps/tauri/src-tauri/src/lib.rs`, add the field to the `AppSettings` struct after `launch_at_startup`:

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
    #[serde(rename = "autoUpdate", default = "default_true")]
    pub auto_update: bool,
}
```

**Step 4: Add autoUpdate to handleSave in SettingsView.tsx**

In `apps/tauri/src/views/SettingsView.tsx`, update the `handleSave` function's `updateSettings` call to include `autoUpdate`:

Find:
```typescript
      await updateSettings({
        jiraToken: accountId,
        clockworkApiToken: token,
        jiraUser: validation.user,
        pinIconDismissed: settings.pinIconDismissed,
        launchAtStartup,
      });
```

Replace with:
```typescript
      await updateSettings({
        jiraToken: accountId,
        clockworkApiToken: token,
        jiraUser: validation.user,
        pinIconDismissed: settings.pinIconDismissed,
        launchAtStartup,
        autoUpdate: settings.autoUpdate,
      });
```

**Step 5: Verify TypeScript compiles**

Run: `cd apps/tauri && pnpm type-check`
Expected: No errors.

**Step 6: Commit**

```bash
git add apps/tauri/src/lib/types.ts apps/tauri/src/lib/settings.ts apps/tauri/src-tauri/src/lib.rs apps/tauri/src/views/SettingsView.tsx
git commit -m "feat(updater): add autoUpdate setting to frontend and backend"
```

---

### Task 6: Add Auto-Update Toggle to Settings UI

**Files:**
- Modify: `apps/tauri/src/views/SettingsView.tsx`

**Step 1: Add state and handler for autoUpdate toggle**

In `SettingsView.tsx`, add state after the `launchAtStartup` state line:

```typescript
const [autoUpdate, setAutoUpdate] = useState(settings.autoUpdate);
```

Add a handler after `handleAutoStartToggle`:

```typescript
async function handleAutoUpdateToggle(checked: boolean) {
  setAutoUpdate(checked);
  try {
    await updateSettings({ ...settings, autoUpdate: checked });
  } catch (err) {
    console.error('Failed to toggle auto-update:', err);
    setAutoUpdate(!checked);
  }
}
```

**Step 2: Add toggle UI after the "Launch at startup" toggle**

After the closing `</div>` of the launch-at-startup toggle block (line 172), add:

```tsx
<div className="flex items-center justify-between py-2 mb-4">
  <label htmlFor="auto-update" className="text-xs font-medium text-gray-700">
    Auto update
  </label>
  <button
    id="auto-update"
    type="button"
    role="switch"
    aria-checked={autoUpdate}
    onClick={() => handleAutoUpdateToggle(!autoUpdate)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
      autoUpdate ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
        autoUpdate ? 'translate-x-4.5' : 'translate-x-0.5'
      }`}
    />
  </button>
</div>
```

**Step 3: Update handleSave to use local autoUpdate state**

Replace `autoUpdate: settings.autoUpdate` with `autoUpdate` in the `handleSave` function:

```typescript
      await updateSettings({
        jiraToken: accountId,
        clockworkApiToken: token,
        jiraUser: validation.user,
        pinIconDismissed: settings.pinIconDismissed,
        launchAtStartup,
        autoUpdate,
      });
```

**Step 4: Verify TypeScript compiles**

Run: `cd apps/tauri && pnpm type-check`
Expected: No errors.

**Step 5: Commit**

```bash
git add apps/tauri/src/views/SettingsView.tsx
git commit -m "feat(updater): add auto-update toggle to settings UI"
```

---

### Task 7: Create useAutoUpdate Hook

**Files:**
- Create: `apps/tauri/src/hooks/useAutoUpdate.ts`

**Step 1: Create the hook**

Create `apps/tauri/src/hooks/useAutoUpdate.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function checkAndInstallUpdate() {
  try {
    const update = await check();
    if (!update) return;

    console.log(`[auto-update] Found update: v${update.version}`);

    await update.downloadAndInstall();

    console.log('[auto-update] Update installed, notifying user');

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      sendNotification({
        title: 'Clockwork Updated',
        body: `Version ${update.version} is ready. Restart to apply.`,
      });
    }

    // Relaunch after a short delay to let the notification show
    setTimeout(() => relaunch(), 3000);
  } catch (err) {
    console.error('[auto-update] Check failed:', err);
  }
}

export function useAutoUpdate(enabled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Check on startup (with a small delay to not block app init)
    const startupTimeout = setTimeout(() => checkAndInstallUpdate(), 5000);

    // Periodic check every 4 hours
    intervalRef.current = setInterval(() => checkAndInstallUpdate(), CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(startupTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/tauri && pnpm type-check`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/tauri/src/hooks/useAutoUpdate.ts
git commit -m "feat(updater): create useAutoUpdate hook with silent download and notification"
```

---

### Task 8: Mount useAutoUpdate in App

**Files:**
- Modify: `apps/tauri/src/App.tsx`

**Step 1: Import and use the hook**

In `apps/tauri/src/App.tsx`, add the import after the other hook imports:

```typescript
import { useAutoUpdate } from './hooks/useAutoUpdate';
```

**Step 2: Call the hook inside AppContent**

Inside the `AppContent` function, after `const { settings, isLoaded } = useSettings();`, add:

```typescript
useAutoUpdate(settings.autoUpdate);
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/tauri && pnpm type-check`
Expected: No errors.

**Step 4: Commit**

```bash
git add apps/tauri/src/App.tsx
git commit -m "feat(updater): mount useAutoUpdate hook in App component"
```

---

### Task 9: Rewrite Release Workflow with tauri-action

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.release-it.json`
- Delete: `scripts/release-macos.sh`

**Step 1: Rewrite the release workflow**

Replace the entire content of `.github/workflows/release.yml` with:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  publish-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: ubuntu-22.04
            args: '--target x86_64-unknown-linux-gnu'
          - platform: windows-latest
            args: '--target x86_64-pc-windows-msvc'

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }}

      - uses: swatinem/rust-cache@v2
        with:
          workspaces: 'apps/tauri/src-tauri -> target'

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt update
          sudo apt install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            libxdo-dev \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - name: Install frontend dependencies
        run: pnpm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          projectPath: apps/tauri
          tauriScript: pnpm tauri
          tagName: ${{ github.ref_name }}
          releaseName: ${{ github.ref_name }}
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: false
          prerelease: false
          includeUpdaterJson: true
          args: ${{ matrix.args }}
```

**Step 2: Update .release-it.json**

Remove the `after:release` hook (macOS is now built in CI):

```json
{
  "npm": {
    "publish": false
  },
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}",
    "push": true,
    "pushArgs": ["--follow-tags"]
  },
  "github": {
    "release": false
  },
  "plugins": {
    "@release-it/bumper": {
      "out": [
        {
          "file": "apps/tauri/package.json",
          "type": "application/json",
          "path": "version"
        },
        {
          "file": "apps/tauri/src-tauri/tauri.conf.json",
          "type": "application/json",
          "path": "version"
        },
        {
          "file": "apps/tauri/src-tauri/Cargo.toml",
          "type": "text/plain",
          "search": "version = \"{{currentVersion}}\"",
          "replace": "version = \"{{version}}\""
        }
      ]
    }
  },
  "hooks": {
    "after:bump": "cargo check && git add Cargo.lock"
  }
}
```

Key changes:
- `"github.release": false` — the release is now created by `tauri-action` in CI, not by release-it locally
- Removed `"after:release"` hook — no more local macOS build
- Kept `"after:bump"` hook — still need to update `Cargo.lock`

**Step 3: Delete release-macos.sh**

```bash
rm scripts/release-macos.sh
```

If the `scripts/` directory is now empty, delete it too:
```bash
rmdir scripts/ 2>/dev/null || true
```

**Step 4: Commit**

```bash
git add .github/workflows/release.yml .release-it.json
git rm scripts/release-macos.sh
git commit -m "feat(updater): rewrite release workflow with tauri-action and updater signing"
```

---

### Task 10: End-to-End Verification

**Step 1: Verify TypeScript compiles**

```bash
cd apps/tauri && pnpm type-check
```
Expected: No errors.

**Step 2: Verify Rust compiles**

```bash
cd apps/tauri && cargo check
```
Expected: No errors.

**Step 3: Verify dev server starts**

```bash
cd apps/tauri && pnpm tauri dev
```
Expected: App launches, opens in tray. Settings view shows "Auto update" toggle. No console errors related to updater (updater check will fail in dev mode — that's expected since there's no `latest.json` to check against).

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(updater): address issues found during verification"
```

---

## Release Workflow (Post-Implementation)

After all tasks are done, the release process becomes:

1. `pnpm release` (runs release-it) → bumps version, commits, creates tag, pushes
2. Tag push triggers GitHub Actions → `tauri-action` builds all 3 platforms
3. `tauri-action` creates GitHub Release with all artifacts + `latest.json`
4. Existing app installations automatically detect the new version via `latest.json`

## Files Changed Summary

| File | Action |
|------|--------|
| `apps/tauri/src-tauri/Cargo.toml` | Add updater + process deps |
| `apps/tauri/src-tauri/tauri.conf.json` | Add updater config |
| `apps/tauri/src-tauri/capabilities/default.json` | Add permissions |
| `apps/tauri/src-tauri/src/lib.rs` | Register plugins + add setting |
| `apps/tauri/package.json` | Add JS deps |
| `apps/tauri/src/lib/types.ts` | Add autoUpdate field |
| `apps/tauri/src/lib/settings.ts` | Add default |
| `apps/tauri/src/views/SettingsView.tsx` | Add toggle UI |
| `apps/tauri/src/hooks/useAutoUpdate.ts` | **New** — update logic |
| `apps/tauri/src/App.tsx` | Mount hook |
| `.github/workflows/release.yml` | Rewrite with tauri-action |
| `.release-it.json` | Remove macOS hook + GitHub release |
| `scripts/release-macos.sh` | **Delete** |
