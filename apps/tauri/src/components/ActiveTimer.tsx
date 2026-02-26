import { useQuery } from '@tanstack/react-query';
import { useActiveTimers } from '../hooks/useActiveTimers';
import { useStopTimer } from '../hooks/useTimerActions';
import { fetchIssue } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { getTimerStatus } from '../lib/timer-utils';
import { openIssueInBrowser } from '../lib/utils';
import { ElapsedTime } from './ElapsedTime';
import { ErrorCard } from './ErrorCard';
import { TimerSkeleton } from './Skeleton';

function formatStartTime(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActiveTimer() {
  const { data, isLoading, error, needsAccountId } = useActiveTimers();
  const stopTimer = useStopTimer();

  const activeTimer = data?.timers[0];

  // Fetch issue details for active timer
  const { data: issue } = useQuery({
    queryKey: ['issue', activeTimer?.issue.key],
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by enabled
    queryFn: () => fetchIssue(API_BASE_URL, activeTimer!.issue.key),
    enabled: Boolean(activeTimer?.issue.key),
    staleTime: 60_000,
  });

  if (isLoading) return <TimerSkeleton />;
  if (error) return <ErrorCard message="Failed to load timer data" />;
  if (needsAccountId)
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-sm text-gray-500">Open Settings to link your Jira account.</p>
      </div>
    );

  if (!activeTimer) {
    return null;
  }

  const status = getTimerStatus(activeTimer);
  const isOnHold = status === 'on_hold';

  return (
    <div
      className={`px-4 py-3 flex items-center justify-between gap-3 ${isOnHold ? 'bg-amber-50/50 border-l-4 border-l-amber-500 -ml-[1px]' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {isOnHold ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-amber-500 shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm5-2.25A.75.75 0 015.75 7h.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75v-4.5zm4 0a.75.75 0 01.75-.75h.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75v-4.5z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
          )}
          {isOnHold && (
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide bg-amber-100 px-1.5 py-0.5 rounded">
              On Hold
            </span>
          )}
          <button
            type="button"
            className="font-mono text-sm font-semibold text-gray-900 truncate hover:underline hover:text-blue-600 cursor-pointer"
            onClick={() => openIssueInBrowser(activeTimer.issue.key)}
            title="Open in Jira"
          >
            {activeTimer.issue.key}
          </button>
        </div>

        {issue?.project && (
          <div className="flex items-baseline gap-1 mb-0.5 max-w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 select-none">
              PRJ:
            </span>
            <p className="text-xs text-gray-600 truncate font-medium" title={issue.project.name}>
              {issue.project.name}
            </p>
          </div>
        )}

        {issue && (
          <div className="flex items-baseline gap-1 mb-1 max-w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 select-none">
              ISS:
            </span>
            <p className="text-xs text-gray-500 truncate" title={issue.summary}>
              {issue.summary}
            </p>
          </div>
        )}

        <p
          className={`text-[10px] mt-1.5 flex items-center gap-1 ${isOnHold ? 'text-amber-600' : 'text-gray-400'}`}
        >
          <span
            className={`w-1 h-1 rounded-full inline-block ${isOnHold ? 'bg-amber-400' : 'bg-gray-300'}`}
          />
          Started: {formatStartTime(activeTimer.startedAt)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <ElapsedTime
          tillNow={activeTimer.tillNow}
          cachedAt={data.cachedAt ?? new Date().toISOString()}
          className="font-mono text-sm font-semibold text-gray-900 tabular-nums"
        />
        <button
          type="button"
          onClick={() =>
            stopTimer.mutate({ issueKey: activeTimer.issue.key, timerId: activeTimer.id })
          }
          disabled={stopTimer.isPending}
          className="py-1 px-2 text-xs font-medium text-red-700 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {stopTimer.isPending ? 'Stopping…' : 'Stop'}
        </button>
        {stopTimer.isError && (
          <p
            className="text-[10px] text-red-600 max-w-[180px] text-right"
            title={stopTimer.error.message}
          >
            {stopTimer.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
