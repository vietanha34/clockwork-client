import { formatSeconds } from '../lib/api-client';

interface WorklogBannerProps {
  logged: number;
  target: number;
  deficit: number;
}

export function WorklogBanner({ logged, target, deficit }: WorklogBannerProps) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-red-800">
          Worklog: {formatSeconds(logged)} / {formatSeconds(target)}
        </span>
        <span className="text-sm text-red-600">
          — {formatSeconds(deficit)} remaining
        </span>
      </div>
    </div>
  );
}
