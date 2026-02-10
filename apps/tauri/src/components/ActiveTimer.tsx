import { useQuery } from "@tanstack/react-query";
import { fetchIssue } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useActiveTimers } from "../hooks/useActiveTimers";
import { useStopTimer } from "../hooks/useTimerActions";
import { ElapsedTime } from "./ElapsedTime";
import { ErrorCard } from "./ErrorCard";
import { TimerSkeleton } from "./Skeleton";

function formatStartTime(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveTimer() {
  const { data, isLoading, error } = useActiveTimers();
  const stopTimer = useStopTimer();
  const { settings } = useSettings();

  const activeTimer = data?.timers[0];

  // Fetch issue details for active timer
  const { data: issue } = useQuery({
    queryKey: ["issue", activeTimer?.issue.key],
    queryFn: () =>
      fetchIssue(settings.apiBaseUrl, activeTimer!.issue.key),
    enabled: Boolean(activeTimer?.issue.key && settings.apiBaseUrl),
    staleTime: 60_000,
  });

  if (isLoading) return <TimerSkeleton />;
  if (error) return <ErrorCard message="Failed to load timer data" />;

  if (!activeTimer) {
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-sm text-gray-500">No active timer</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
            <span className="font-mono text-sm font-semibold text-gray-900 truncate">
              {activeTimer.issue.key}
            </span>
          </div>
          {issue && (
            <p className="text-xs text-gray-500 truncate mb-1">
              {issue.summary}
            </p>
          )}
          {issue?.project && (
            <p className="text-xs text-gray-400">{issue.project.name}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Started at {formatStartTime(activeTimer.startedAt)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <ElapsedTime
            startedAt={activeTimer.startedAt}
            className="font-mono text-sm font-semibold text-gray-900 tabular-nums"
          />
        </div>
      </div>

      <button
        onClick={() => stopTimer.mutate({ timerId: activeTimer.id })}
        disabled={stopTimer.isPending}
        className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-red-700 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {stopTimer.isPending ? "Stopping…" : "Stop Timer"}
      </button>
      {stopTimer.isError && (
        <p className="mt-1 text-xs text-red-600">
          Failed to stop timer. Try again.
        </p>
      )}
    </div>
  );
}
