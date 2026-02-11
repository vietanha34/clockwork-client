import { useEffect, useState } from 'react';

function secondsSince(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
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
  startedAt: string;
  className?: string;
}

export function ElapsedTime({ startedAt, className }: ElapsedTimeProps) {
  const [seconds, setSeconds] = useState(() => secondsSince(startedAt));

  useEffect(() => {
    setSeconds(secondsSince(startedAt));
    const id = setInterval(() => {
      setSeconds(secondsSince(startedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className={className}>{formatHMS(seconds)}</span>;
}
