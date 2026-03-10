import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { type RefObject, useEffect, useRef } from 'react';

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
      // Use scrollHeight so we can detect and expand when content is currently clipped.
      const raw = el.scrollHeight;
      const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, raw));

      // Skip if height hasn't changed
      if (clamped === lastHeightRef.current) return;
      lastHeightRef.current = clamped;

      const win = getCurrentWebviewWindow();
      // LogicalSize expects CSS logical pixels, matching scrollHeight units.
      win.setSize(new LogicalSize(WINDOW_WIDTH, clamped)).catch((error) => {
        // Keep production quiet, but surface permission/config issues in dev.
        if (import.meta.env.DEV) {
          console.warn('[useAdaptiveWindow] setSize failed', error);
        }
      });
    };

    const debouncedSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sync, DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(debouncedSync);
    observer.observe(el);
    const mutationObserver = new MutationObserver(debouncedSync);
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    window.addEventListener('clockwork:layout-change', debouncedSync);

    // Initial sync after first paint so layout is complete
    rafRef.current = requestAnimationFrame(sync);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('clockwork:layout-change', debouncedSync);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // contentRef is a stable useRef object — effect runs once on mount
  }, [contentRef]);
}
