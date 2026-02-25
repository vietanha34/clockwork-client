import { formatSeconds } from '../lib/api-client';

interface DailyProgressBarProps {
  loggedSeconds: number;
  totalSeconds?: number; // usually 8h * 3600
}

export function DailyProgressBar({ loggedSeconds, totalSeconds = 8 * 3600 }: DailyProgressBarProps) {
  const progress = Math.min(Math.max(loggedSeconds / totalSeconds, 0), 1);
  
  // Format like "5h 30m / 8h"
  const loggedH = Math.floor(loggedSeconds / 3600);
  const loggedM = Math.floor((loggedSeconds % 3600) / 60);
  const totalH = Math.floor(totalSeconds / 3600);
  
  const label = `${loggedH}h ${loggedM}m / ${totalH}h`;

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Daily Progress</span>
        <span className="text-xs font-medium text-gray-600 tabular-nums">{label}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
