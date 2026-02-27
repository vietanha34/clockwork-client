# macOS Hybrid Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up release-it to orchestrate versioning, GitHub Release creation, and local macOS .dmg build+upload, while CI handles Ubuntu and Windows builds.

**Architecture:** release-it runs locally on macOS, bumps version across 4 files, commits, tags, pushes, creates GitHub Release, then builds macOS .dmg and uploads it. GitHub Actions triggers on the tag, builds Ubuntu/Windows artifacts, and uploads them to the existing release.

**Tech Stack:** release-it, @release-it/bumper (for JSON/TOML version sync), gh CLI, Tauri CLI, pnpm

---

### Task 1: Install release-it and bumper plugin

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

Run:
```bash
pnpm add -Dw release-it @release-it/bumper
```

**Step 2: Add release script to root package.json**

Add `"release": "release-it"` to the `scripts` section of `package.json`:

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "turbo format",
    "check": "biome check .",
    "clean": "turbo clean",
    "release": "release-it"
  }
}
```

**Step 3: Verify installation**

Run:
```bash
pnpm release-it --version
```
Expected: prints release-it version number

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install release-it and bumper plugin"
```

---

### Task 2: Create release-it configuration

**Files:**
- Create: `.release-it.json`

**Step 1: Create `.release-it.json`**

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
    "release": true,
    "releaseName": "v${version}"
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
    "after:release": "bash scripts/release-macos.sh v${version}"
  }
}
```

Key details:
- `npm.publish: false` — this is a private monorepo, no npm publish
- `@release-it/bumper` plugin syncs version to 3 additional files beyond root package.json
- Cargo.toml uses text search/replace since it's TOML, not JSON
- `after:release` hook triggers macOS build after GitHub Release is created
- The hook passes the tag name (e.g. `v0.1.0`) as argument to the script

**Step 2: Dry-run to verify config parses**

Run:
```bash
pnpm release-it --dry-run --no-git --no-github
```
Expected: shows what version bump would happen, no errors about config parsing

**Step 3: Commit**

```bash
git add .release-it.json
git commit -m "chore: add release-it configuration with version sync"
```

---

### Task 3: Create macOS build and upload script

**Files:**
- Create: `scripts/release-macos.sh`

**Step 1: Create scripts directory and script**

```bash
#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?Usage: release-macos.sh <tag>}"
TARGET="aarch64-apple-darwin"

echo "==> Building Tauri for macOS ($TARGET)..."
cd apps/tauri
pnpm tauri build --target "$TARGET"
cd ../..

echo "==> Uploading .dmg to GitHub release $TAG..."
gh release upload "$TAG" \
  target/"$TARGET"/release/bundle/dmg/*.dmg \
  --clobber

echo "==> macOS release assets uploaded successfully!"
```

Key details:
- `set -euo pipefail` — fail fast on any error
- `--clobber` — overwrite if re-running (idempotent)
- Expects `gh` CLI to be authenticated (user's local env)
- Paths match Tauri's default output structure for macOS dmg bundles

**Step 2: Make script executable**

Run:
```bash
chmod +x scripts/release-macos.sh
```

**Step 3: Commit**

```bash
git add scripts/release-macos.sh
git commit -m "chore: add macOS build and upload script"
```

---

### Task 4: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/release.yml`

**Step 1: Modify release.yml**

The current workflow uses `softprops/action-gh-release@v2` which creates a release if it doesn't exist, or uploads to an existing one. Since release-it now creates the release first, CI just needs to upload artifacts to the existing release. `softprops/action-gh-release@v2` handles this automatically — if a release for the tag already exists, it appends files to it.

No actual change is needed to the upload steps — they already work correctly with an existing release. However, add a retry/wait mechanism in case CI runs before release-it finishes creating the release (unlikely but possible race condition).

Update the workflow to add a wait step before uploading:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - platform: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - uses: pnpm/action-setup@v4

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

      - name: Build Tauri
        working-directory: apps/tauri
        run: pnpm tauri build --target ${{ matrix.target }}

      - name: Wait for GitHub Release to exist
        run: |
          for i in $(seq 1 30); do
            if gh release view "${{ github.ref_name }}" >/dev/null 2>&1; then
              echo "Release ${{ github.ref_name }} found"
              exit 0
            fi
            echo "Waiting for release... attempt $i/30"
            sleep 10
          done
          echo "Release not found after 5 minutes, uploading will create it"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload release assets (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        uses: softprops/action-gh-release@v2
        with:
          files: |
            target/${{ matrix.target }}/release/bundle/deb/*.deb
            target/${{ matrix.target }}/release/bundle/rpm/*.rpm
            target/${{ matrix.target }}/release/bundle/appimage/*.AppImage

      - name: Upload release assets (Windows)
        if: matrix.platform == 'windows-latest'
        uses: softprops/action-gh-release@v2
        with:
          files: |
            target/${{ matrix.target }}/release/bundle/nsis/*.exe
```

Changes from current:
- Added "Wait for GitHub Release to exist" step that polls up to 5 minutes for the release to appear (created by release-it locally). Falls through gracefully if not found (softprops will create it as fallback).

**Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add wait step for release-it created releases"
```

---

### Task 5: End-to-end dry-run verification

**Step 1: Verify release-it dry-run works end-to-end**

Run:
```bash
pnpm release-it --dry-run
```

Expected output should show:
- Version bump from 0.0.0 to 0.0.1 (or whatever increment)
- Files that would be bumped (root package.json + 3 via bumper)
- Git commit and tag that would be created
- GitHub Release that would be created
- Hook `bash scripts/release-macos.sh v0.0.1` that would run

**Step 2: Verify script exists and is executable**

Run:
```bash
test -x scripts/release-macos.sh && echo "OK: script is executable" || echo "FAIL: script not executable"
```

**Step 3: Verify gh CLI is authenticated**

Run:
```bash
gh auth status
```
Expected: shows authenticated user

**Step 4: Final commit with all changes**

```bash
git status
```

If any uncommitted changes remain, commit them. Otherwise, all tasks are complete.

---

## Release Usage

Once implemented, the release flow is:

```bash
# From local macOS machine
pnpm release          # interactive: choose version bump
pnpm release --ci     # non-interactive: auto patch bump
pnpm release minor    # bump minor version
```

This will:
1. Bump version in 4 files
2. Commit + tag + push
3. Create GitHub Release
4. Build macOS .dmg locally and upload
5. CI picks up the tag and uploads Ubuntu + Windows artifacts
