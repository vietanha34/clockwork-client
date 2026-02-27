import { useEffect, useState } from 'react';

function secondsSince(isoTimestamp: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

interface ElapsedTimeProps {
  /** Seconds already elapsed at the time the cache was captured (accounts for breaks). */
  tillNow: number;
  /** ISO timestamp when the cache snapshot was taken. */
  cachedAt: string;
  className?: string;
  /** Whether the timer is paused (e.g., on_hold status) - stops counting up */
  isPaused?: boolean;
}

export function ElapsedTime({ tillNow, cachedAt, className, isPaused }: ElapsedTimeProps) {
  const [seconds, setSeconds] = useState(() => tillNow + secondsSince(cachedAt));

  useEffect(() => {
    // When paused, show the frozen time without adding elapsed time since cachedAt
    if (isPaused) {
      setSeconds(tillNow);
      return;
    }

    setSeconds(tillNow + secondsSince(cachedAt));
    const id = setInterval(() => {
      setSeconds(tillNow + secondsSince(cachedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [tillNow, cachedAt, isPaused]);

  return <span className={className}>{formatHMS(seconds)}</span>;
}
