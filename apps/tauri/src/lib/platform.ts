import { type Platform, platform } from '@tauri-apps/plugin-os';

export type PlatformGroup = 'macos' | 'desktop';

/**
 * Returns the platform group:
 * - 'macos' for macOS (menu bar with canvas-rendered icons)
 * - 'desktop' for Windows and Linux (system tray with static icons)
 */
export function getPlatformGroup(): PlatformGroup {
  const os = platform();
  if (os === 'macos') {
    return 'macos';
  }
  // Windows and Linux both use desktop-style system tray
  return 'desktop';
}

/**
 * Check if the current platform uses square tray icons
 * (Windows and Linux with AppIndicator)
 */
export function isSquareTrayPlatform(): boolean {
  const os = platform();
  return os === 'windows' || os === 'linux';
}

/**
 * Get the raw platform identifier
 */
export function getPlatform(): Platform {
  return platform();
}
