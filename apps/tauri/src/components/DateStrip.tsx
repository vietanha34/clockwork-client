import type { WeekDay } from '../hooks/useWeeklyWorklogs';
import { todayDate } from '../lib/api-client';

// Mon=0 … Sun=6 mapped to 2-char abbreviations matching getWeekDates order
const SHORT_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface DateStripProps {
  weekData: Array<Pick<WeekDay, 'date' | 'isFuture'>>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function DateStrip({ weekData, selectedDate, onSelectDate }: DateStripProps) {
  const today = todayDate();

  return (
    <div className="flex gap-1 justify-between">
      {weekData.map((day, index) => {
        const isToday = day.date === today;
        const isSelected = day.date === selectedDate;
        const dayNum = day.date.split('-')[2] ?? '';
        const shortDay = SHORT_DAYS[index] ?? '';

        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            disabled={day.isFuture}
            className={`flex flex-col items-center py-1 px-1 rounded-lg text-xs transition-colors flex-1 min-w-0 ${
              isSelected
                ? 'bg-blue-500 text-white'
                : isToday
                  ? 'ring-1 ring-blue-400 text-blue-600 hover:bg-blue-50'
                  : day.isFuture
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium leading-none">{shortDay}</span>
            <span
              className={`text-[10px] leading-none mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}
            >
              {dayNum}
            </span>
          </button>
        );
      })}
    </div>
  );
}
