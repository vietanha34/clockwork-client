import type { WeekDay } from '../hooks/useWeeklyWorklogs';
import { formatSeconds } from '../lib/api-client';

const TARGET_SECONDS = 8 * 3600;
const SHORT_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// SVG layout constants
const CHART_W = 262;
const MAX_BAR_H = 72;
const TOP_PAD = 16; // room for hours label above bar
const BOTTOM_PAD = 14; // room for day label below bar
const SVG_H = TOP_PAD + MAX_BAR_H + BOTTOM_PAD;
const COL_W = CHART_W / 7;
const BAR_W = 20;

interface WeeklyChartProps {
  weekData: WeekDay[];
}

export function WeeklyChart({ weekData }: WeeklyChartProps) {
  const maxSeconds = Math.max(TARGET_SECONDS, ...weekData.map((d) => d.totalSeconds));
  const totalSeconds = weekData
    .filter((d) => !d.isFuture)
    .reduce((sum, d) => sum + d.totalSeconds, 0);

  const targetY = TOP_PAD + MAX_BAR_H - (TARGET_SECONDS / maxSeconds) * MAX_BAR_H;

  return (
    <div className="px-4 py-3">
      <svg
        width="100%"
        height={SVG_H}
        viewBox={`0 0 ${CHART_W} ${SVG_H}`}
        className="overflow-visible"
        aria-label="Weekly worklog chart"
      >
        {/* 8h target dashed line */}
        <line
          x1={0}
          y1={targetY}
          x2={CHART_W}
          y2={targetY}
          stroke="#d1d5db"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={CHART_W - 1} y={targetY - 2} textAnchor="end" fontSize={7} fill="#d1d5db">
          8h
        </text>

        {/* Bars + labels */}
        {weekData.map((day, index) => {
          const colX = index * COL_W;
          const barX = colX + (COL_W - BAR_W) / 2;
          const labelX = colX + COL_W / 2;
          const labelY = TOP_PAD + MAX_BAR_H + 10;

          if (day.isFuture) {
            return (
              <g key={day.date}>
                <rect
                  x={barX}
                  y={TOP_PAD + MAX_BAR_H - 4}
                  width={BAR_W}
                  height={4}
                  rx={2}
                  fill="#e5e7eb"
                />
                <text x={labelX} y={labelY} textAnchor="middle" fontSize={9} fill="#d1d5db">
                  {SHORT_DAYS[index]}
                </text>
              </g>
            );
          }

          const barH = day.totalSeconds > 0
            ? Math.max(4, (day.totalSeconds / maxSeconds) * MAX_BAR_H)
            : 4;
          const barY = TOP_PAD + MAX_BAR_H - barH;
          const barColor = day.totalSeconds >= TARGET_SECONDS ? '#3b82f6' : '#f59e0b';
          const hoursLabel = day.totalSeconds > 0
            ? `${(day.totalSeconds / 3600).toFixed(1)}h`
            : '';

          return (
            <g key={day.date}>
              {/* Hours label above bar */}
              {hoursLabel && (
                <text x={labelX} y={barY - 3} textAnchor="middle" fontSize={8} fill="#6b7280">
                  {hoursLabel}
                </text>
              )}
              {/* Bar */}
              <rect x={barX} y={barY} width={BAR_W} height={barH} rx={3} fill={barColor} />
              {/* Day label */}
              <text x={labelX} y={labelY} textAnchor="middle" fontSize={9} fill="#6b7280">
                {SHORT_DAYS[index]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Weekly total */}
      <p className="text-xs text-center text-gray-500 mt-1">
        Week total:{' '}
        <span className="font-semibold text-gray-700">{formatSeconds(totalSeconds)}</span>
      </p>
    </div>
  );
}
