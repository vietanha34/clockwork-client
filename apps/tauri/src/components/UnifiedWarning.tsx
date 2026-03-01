import { useMemo, useState } from 'react';
import { formatSeconds } from '../lib/api-client';
import type { UnloggedDay } from '../lib/types';
import { LogGuideModal } from './LogGuideModal';

function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

interface UnifiedWarningProps {
  unloggedDays: UnloggedDay[];
  showToday: boolean;
  todayLogged: number;
  todayTarget: number;
  todayDeficit: number;
}

export function UnifiedWarning({
  unloggedDays,
  showToday,
  todayLogged,
  todayTarget,
  todayDeficit,
}: UnifiedWarningProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const hasPreviousDays = unloggedDays.length > 0;

  const previousTitle = useMemo(() => {
    if (unloggedDays.length === 1) return '1 day needs extra logging';
    return `${unloggedDays.length} days need extra logging`;
  }, [unloggedDays.length]);

  if (!hasPreviousDays && !showToday) {
    return null;
  }

  return (
    <>
      {hasPreviousDays && (
        <section className="border-b border-amber-200 bg-amber-100/70 px-4 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Warning</p>
              <p className="text-xs font-medium text-amber-900">{previousTitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-2 space-y-1">
              <ul className="space-y-1">
                {unloggedDays.map((day) => (
                  <li key={day.date} className="text-xs text-amber-950">
                    {day.dayOfWeek} {day.date}: {formatHours(day.loggedSeconds)} /{' '}
                    {formatHours(day.requiredSeconds)}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="mt-1 rounded border border-amber-300 bg-amber-200/80 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              >
                Hướng dẫn log bù
              </button>
            </div>
          )}
        </section>
      )}

      {showToday && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-red-800">
              Worklog: {formatSeconds(todayLogged)} / {formatSeconds(todayTarget)}
            </span>
            <span className="text-sm text-red-600">
              — {formatSeconds(todayDeficit)} remaining
            </span>
          </div>
        </div>
      )}

      <LogGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
}
