import { formatSeconds, totalWorklogSeconds } from "../lib/api-client";
import { useWorklogs } from "../hooks/useWorklogs";

export function WorklogList() {
  const { data, isLoading, error } = useWorklogs();

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="h-3 bg-gray-200 rounded w-16 shrink-0" />
            <div className="h-3 bg-gray-200 rounded flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 text-xs text-red-600">
        Failed to load worklogs
      </div>
    );
  }

  const worklogs = data?.worklogs ?? [];
  const totalSeconds = totalWorklogSeconds(worklogs);

  if (worklogs.length === 0) {
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-sm text-gray-500">No worklogs today</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Today
        </span>
        <span className="text-xs font-semibold text-gray-700">
          {formatSeconds(totalSeconds)} total
        </span>
      </div>
      <ul className="space-y-2">
        {worklogs.map((w) => (
          <li key={w.id} className="flex items-start gap-2">
            <span className="font-mono text-xs text-blue-600 shrink-0 mt-0.5 w-14">
              {w.issueKey}
            </span>
            <div className="flex-1 min-w-0">
              {w.comment && (
                <p className="text-xs text-gray-700 truncate">{w.comment}</p>
              )}
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
