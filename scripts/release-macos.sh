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
