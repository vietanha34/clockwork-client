import { useWorklogs } from '../hooks/useWorklogs';
import { formatSeconds, todayDate, totalWorklogSeconds } from '../lib/api-client';
import { ErrorCard } from './ErrorCard';
import { WorklogSkeleton } from './Skeleton';

interface WorklogListProps {
  date?: string;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function dateLabel(date: string): string {
  const today = todayDate();
  if (date === today) return 'Today';
  const parts = date.split('-').map(Number);
  const [year = 0, month = 1, day = 1] = parts;
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function WorklogList({ date }: WorklogListProps) {
  const { data, isLoading, error } = useWorklogs(date);

  if (isLoading) return <WorklogSkeleton />;
  if (error) return <ErrorCard message="Failed to load worklogs" />;

  const worklogs = data?.worklogs ?? [];
  const totalSeconds = totalWorklogSeconds(worklogs);

  if (worklogs.length === 0) {
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-sm text-gray-500">No worklogs for this day</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {dateLabel(date ?? '')}
        </span>
        <span className="text-xs font-semibold text-gray-700">
          {formatSeconds(totalSeconds)} total
        </span>
      </div>
      <ul className="space-y-2">
        {worklogs.map((w) => (
          <li key={w.id} className="flex items-start gap-2">
            <span className="font-mono text-xs text-blue-600 shrink-0 mt-0.5 w-14" title={w.issueKey ?? `#${w.issueId}`}>
              {w.issueKey ?? `#${w.issueId}`}
            </span>
            <div className="flex-1 min-w-0">
              {w.issueName && (
                <p className="text-xs text-gray-800 truncate" title={w.issueName}>
                  {w.issueName}
                </p>
              )}
              {w.projectName && (
                <p className="text-[11px] text-gray-500 truncate" title={w.projectName}>
                  {w.projectName}
                </p>
              )}
              {w.comment && <p className="text-xs text-gray-700 truncate">{w.comment}</p>}
            </div>
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">
              {formatSeconds(w.timeSpentSeconds)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
