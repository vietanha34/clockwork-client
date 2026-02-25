import { useState } from 'react';
import { ActiveTimer } from '../components/ActiveTimer';
import { DateStrip } from '../components/DateStrip';
import { StartTimerForm } from '../components/StartTimerForm';
import { UnloggedDaysWarning } from '../components/UnloggedDaysWarning';
import { WeeklyChart } from '../components/WeeklyChart';
import { WorklogList } from '../components/WorklogList';
import { WorklogTabs, type WorklogTab } from '../components/WorklogTabs';
import { useActiveTimers } from '../hooks/useActiveTimers';
import { useUnloggedDays } from '../hooks/useUnloggedDays';
import { useWeeklyWorklogs } from '../hooks/useWeeklyWorklogs';
import { useWorklogs } from '../hooks/useWorklogs';
import { todayDate } from '../lib/api-client';

export function MainView() {
  const [selectedDate, setSelectedDate] = useState<string>(() => todayDate());
  const [activeTab, setActiveTab] = useState<WorklogTab>('list');

  const { isFetching, refetch } = useWorklogs(selectedDate);
  const { data: timerData } = useActiveTimers();
  const { unloggedDays } = useUnloggedDays();
  const { weekData } = useWeeklyWorklogs();

  const hasActiveTimer = timerData?.timers && timerData.timers.length > 0;

  return (
    <div className="relative h-full min-h-0 flex flex-col divide-y divide-gray-100">
      <UnloggedDaysWarning unloggedDays={unloggedDays} />

      {/* Active timer section */}
      {hasActiveTimer && (
        <section>
          <div className="px-4 pt-3 pb-0">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Active Timer
            </h3>
          </div>
          <ActiveTimer />
        </section>
      )}

      {/* Start new timer */}
      <section>
        <StartTimerForm />
      </section>

      {/* Worklogs section with tabs + date strip */}
      <section className="flex min-h-0 flex-1 flex-col">
        {/* Header row */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Worklogs</h3>
          {activeTab === 'list' && (
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Reload worklogs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              >
                <title>Reload worklogs</title>
                <path
                  fillRule="evenodd"
                  d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.01.75.75 0 0 1-1.323-.704A6 6 0 0 1 12.33 3.53l.756.757V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.52 2.199l-.757-.757v.75a.75.75 0 0 1-1.5 0V9.991a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.84a4.5 4.5 0 0 0 7.08-1.01.75.75 0 0 1 1.024-.274Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Tab switcher + date strip */}
        <div className="px-4 pt-2 pb-1 flex flex-col gap-1.5">
          <WorklogTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <DateStrip
            weekData={weekData}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Tab content */}
        <div className="worklogs-scroll min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'list' ? (
            <WorklogList date={selectedDate} />
          ) : (
            <WeeklyChart weekData={weekData} />
          )}
        </div>
      </section>
    </div>
  );
}
