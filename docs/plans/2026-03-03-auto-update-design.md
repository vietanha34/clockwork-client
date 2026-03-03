# Auto-Update Feature Design

**Date:** 2026-03-03
**Status:** Approved

## Goal

Add silent auto-update to Clockwork Menubar. The app checks for updates on startup and every 4 hours, downloads and installs silently in the background, then notifies the user to restart. Users can disable auto-update in Settings.

## Approach

Use `tauri-plugin-updater` (official Tauri v2 plugin) with GitHub Releases as the update endpoint. The `tauri-action` GitHub Action builds all platforms in CI, generates signed update artifacts, and publishes a `latest.json` manifest to GitHub Releases.

## Architecture

### Update Flow

```
App Start → Read settings → autoUpdate enabled?
  → Yes → check() against GitHub Releases latest.json
    → New version? → downloadAndInstall() silently
      → Done → Send notification "Update ready, restart to apply"
  → No → Skip

Every 4 hours → Same check flow (if autoUpdate enabled)
```

### Update Endpoint

`https://github.com/vietanha34/clockwork-client/releases/latest/download/latest.json`

Tauri updater calls this URL, parses the manifest, downloads the platform-appropriate binary, verifies the signature, and installs.

### Signing

- Generate keypair: `pnpm tauri signer generate -w ~/.tauri/clockwork.key`
- Public key stored in `tauri.conf.json` → shipped with app for verification
- Private key stored in GitHub Secrets → used by CI during build

## Components

### 1. Rust Backend

**New dependencies** (`Cargo.toml`):
- `tauri-plugin-updater = "2"`
- `tauri-plugin-process = "2"`

**Plugin registration** (`lib.rs`):
```rust
app.handle().plugin(tauri_plugin_updater::Builder::new().build());
app.handle().plugin(tauri_plugin_process::init());
```

**Capabilities** (`default.json`):
- `"updater:default"`, `"process:default"`

### 2. Tauri Config

**`tauri.conf.json` additions:**
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<GENERATED_PUBLIC_KEY>",
      "endpoints": [
        "https://github.com/vietanha34/clockwork-client/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### 3. Frontend

**New hook** (`useAutoUpdate.ts`):
- On mount: check settings, if `autoUpdate` enabled → `check()` for updates
- If update available → `downloadAndInstall()` silently
- On install complete → send notification via `tauri-plugin-notification`
- Setup 4-hour interval for periodic checks
- Cleanup interval on unmount

**New JS dependencies:**
- `@tauri-apps/plugin-updater`
- `@tauri-apps/plugin-process`

**Settings:**
- Add `autoUpdate: boolean` to `AppSettings` (default: `true`)
- Add toggle in `SettingsView.tsx`

### 4. Release Workflow

**Replace current workflow** with `tauri-action` based approach:
- Build all 3 platforms in GitHub Actions (including macOS on `macos-latest`)
- `tauri-action` handles: build → sign → create release → upload artifacts + `latest.json`
- Remove `scripts/release-macos.sh` (macOS now builds in CI)
- Update `.release-it.json` to remove macOS hook

**Build matrix:**
| Platform | Runner | Target | Artifacts |
|----------|--------|--------|-----------|
| macOS | macos-latest | aarch64-apple-darwin | .dmg, .app.tar.gz + .sig |
| Windows | windows-latest | x86_64-pc-windows-msvc | .exe (NSIS), .nsis.zip + .sig |
| Linux | ubuntu-22.04 | x86_64-unknown-linux-gnu | .deb, .rpm, .AppImage + .sig |

**GitHub Secrets required:**
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 5. Windows Install Mode

Use `"passive"` install mode (default) — shows progress bar, no user interaction required.

```json
{
  "plugins": {
    "updater": {
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

## Changes Summary

| File | Change |
|------|--------|
| `Cargo.toml` | Add updater + process plugins |
| `package.json` (tauri) | Add @tauri-apps/plugin-updater, plugin-process |
| `tauri.conf.json` | Add updater config + createUpdaterArtifacts |
| `capabilities/default.json` | Add updater:default, process:default |
| `lib.rs` | Register updater + process plugins |
| `types.ts` | Add autoUpdate to AppSettings |
| `SettingsView.tsx` | Add auto-update toggle |
| New: `useAutoUpdate.ts` | Update check/download/install logic |
| `App.tsx` | Mount useAutoUpdate hook |
| `.github/workflows/release.yml` | Rewrite with tauri-action + all platforms |
| `.release-it.json` | Remove macOS after:release hook |
| Delete: `scripts/release-macos.sh` | No longer needed |

## Sources

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [Tauri GitHub Actions Guide](https://v2.tauri.app/distribute/pipelines/github/)
- [tauri-action](https://github.com/tauri-apps/tauri-action)
