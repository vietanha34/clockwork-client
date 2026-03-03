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
