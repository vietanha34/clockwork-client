import { useEffect, useRef, useState } from 'react';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { formatSeconds } from '../lib/api-client';

const NOTIFICATION_HOUR = 17;
const WORKLOG_TARGET_SECONDS = 7.5 * 3600; // 27,000 seconds

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface UseWorklogNotificationOptions {
  totalLoggedSeconds: number; // worklogs + running timer elapsed
}

export function useWorklogNotification({ totalLoggedSeconds }: UseWorklogNotificationOptions) {
  const [showBanner, setShowBanner] = useState(false);
  const [deficit, setDeficit] = useState(0);
  const hasNotifiedRef = useRef<string | null>(null);

  // Restore last-notified date from localStorage on mount
  useEffect(() => {
    hasNotifiedRef.current = localStorage.getItem('worklog-notification-last-date');
  }, []);

  // Check every 60 seconds
  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayKey = todayDateKey();

      // Only check at or after 17:00, and only once per day
      if (currentHour < NOTIFICATION_HOUR) {
        // Before 17:00 — hide any stale banner from yesterday
        if (showBanner) setShowBanner(false);
        return;
      }

      // Already notified today
      if (hasNotifiedRef.current === todayKey) {
        // Keep banner visible if still under target
        if (totalLoggedSeconds < WORKLOG_TARGET_SECONDS) {
          setShowBanner(true);
          setDeficit(WORKLOG_TARGET_SECONDS - totalLoggedSeconds);
        } else {
          setShowBanner(false);
        }
        return;
      }

      // Worklog sufficient — no notification needed
      if (totalLoggedSeconds >= WORKLOG_TARGET_SECONDS) {
        return;
      }

      // Insufficient worklog — send notification
      const remaining = WORKLOG_TARGET_SECONDS - totalLoggedSeconds;
      setDeficit(remaining);
      setShowBanner(true);

      // Mark as notified
      hasNotifiedRef.current = todayKey;
      localStorage.setItem('worklog-notification-last-date', todayKey);

      // Send OS notification
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        if (granted) {
          sendNotification({
            title: 'Worklog Reminder',
            body: `You've logged ${formatSeconds(totalLoggedSeconds)} / ${formatSeconds(WORKLOG_TARGET_SECONDS)} today. ${formatSeconds(remaining)} remaining.`,
          });
        }
      } catch {
        // Notification send failed — banner still shows as fallback
      }
    };

    // Run immediately on mount/update
    check();

    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [totalLoggedSeconds, showBanner]);

  return { showBanner, deficit, target: WORKLOG_TARGET_SECONDS, logged: totalLoggedSeconds };
}
