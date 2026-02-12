import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';

function formatDuration(startedAt: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function useTrayTimer(startedAt?: string, issueKey?: string) {
  useEffect(() => {
    if (!startedAt) {
      invoke('update_tray_title', { title: 'No timer' }).catch(console.error);
      return;
    }

    const update = () => {
        const timeStr = formatDuration(startedAt);
        const title = issueKey ? `${timeStr} - ${issueKey}` : timeStr;
        invoke('update_tray_title', { title }).catch(console.error);
    };

    update(); // Initial update
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [startedAt, issueKey]);
}
