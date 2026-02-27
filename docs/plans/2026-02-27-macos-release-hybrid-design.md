# macOS Release Hybrid Design

**Date:** 2026-02-27
**Status:** Approved

## Problem

Currently GitHub Actions only builds for Ubuntu and Windows. macOS builds need to be added to the release pipeline. macOS GitHub Actions runners are expensive ($0.08/min) and the app doesn't use code signing, so a CI-only approach is wasteful.

## Decision

Hybrid approach: use `release-it` locally on macOS to orchestrate the entire release flow. release-it handles version bumping, git tagging, GitHub Release creation, and triggers a local macOS build + upload. GitHub Actions handles Ubuntu and Windows builds triggered by the tag push.

## Architecture

Only Apple Silicon (aarch64) is targeted. No code signing or notarization.

### Release Flow

```
pnpm release (local macOS)
  1. release-it bumps version in 4 files
  2. git commit "chore: release v${version}"
  3. git tag v${version}
  4. git push origin main --follow-tags
  5. release-it creates GitHub Release
  6. Hook: pnpm tauri build --target aarch64-apple-darwin
  7. Hook: gh release upload v${version} target/aarch64-apple-darwin/release/bundle/dmg/*.dmg

GitHub Actions (triggered by tag v*):
  8. Build Ubuntu → upload .deb, .AppImage, .rpm
  9. Build Windows → upload .exe
```

### File Changes

1. **`.release-it.json`** — release-it config with:
   - `npm.publish: false`
   - GitHub release plugin enabled
   - `hooks.after:bump` for syncing version to tauri.conf.json and Cargo.toml
   - `hooks.after:release` for macOS build + upload

2. **`.github/workflows/release.yml`** — Modify to not create new releases, only upload to existing release

3. **`scripts/release-macos.sh`** — Build Tauri for aarch64-apple-darwin and upload .dmg to GitHub release

4. **Root `package.json`** — Add `release-it` devDependency and `"release": "release-it"` script

### Version Bump Targets

- `package.json` (root) — bumped by release-it natively
- `apps/tauri/package.json` — bumped via release-it hook
- `apps/tauri/src-tauri/tauri.conf.json` — bumped via hook (JSON edit)
- `apps/tauri/src-tauri/Cargo.toml` — bumped via hook (TOML edit)

## Constraints

- macOS build must run on local Apple Silicon Mac
- No Apple Developer certificate (users bypass Gatekeeper manually)
- Only aarch64-apple-darwin target
- release-it creates the GitHub Release; CI only uploads artifacts to existing release
