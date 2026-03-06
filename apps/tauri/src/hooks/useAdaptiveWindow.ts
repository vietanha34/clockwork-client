import { useEffect, useRef, type RefObject } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';

const WINDOW_WIDTH = 302;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 700;
const DEBOUNCE_MS = 50;

export function useAdaptiveWindow(contentRef: RefObject<HTMLDivElement | null>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeightRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const sync = () => {
      // getBoundingClientRect().height reflects actual rendered height,
      // respecting inner max-h CSS constraints (unlike scrollHeight).
      const raw = el.getBoundingClientRect().height;
      const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, raw));

      // Skip if height hasn't changed
      if (clamped === lastHeightRef.current) return;
      lastHeightRef.current = clamped;

      const win = getCurrentWebviewWindow();
      // LogicalSize uses CSS logical pixels, matching what getBoundingClientRect reports.
      win.setSize(new LogicalSize(WINDOW_WIDTH, clamped)).catch(() => {
        // Silently ignore — window may not be ready
      });
    };

    const debouncedSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sync, DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(debouncedSync);
    observer.observe(el);

    // Initial sync after first paint so layout is complete
    rafRef.current = requestAnimationFrame(sync);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  // contentRef is a stable useRef object — effect runs once on mount
  }, [contentRef]);
}
