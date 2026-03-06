import { useEffect, useRef, type RefObject } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalSize } from '@tauri-apps/api/dpi';

const WINDOW_WIDTH = 302;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 700;
const DEBOUNCE_MS = 50;

export function useAdaptiveWindow(contentRef: RefObject<HTMLDivElement | null>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const sync = () => {
      const raw = el.scrollHeight;
      const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, raw));

      // Skip if height hasn't changed
      if (clamped === lastHeightRef.current) return;
      lastHeightRef.current = clamped;

      const win = getCurrentWebviewWindow();
      win.setSize(new PhysicalSize(WINDOW_WIDTH, clamped)).catch(() => {
        // Silently ignore — window may not be ready
      });
    };

    const debouncedSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sync, DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(debouncedSync);
    observer.observe(el);

    // Initial sync
    sync();

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [contentRef]);
}
