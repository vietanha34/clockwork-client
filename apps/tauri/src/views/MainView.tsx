import { ActiveTimer } from '../components/ActiveTimer';
import { StartTimerForm } from '../components/StartTimerForm';
import { WorklogList } from '../components/WorklogList';
import { useActiveTimers } from '../hooks/useActiveTimers';
import { useWorklogs } from '../hooks/useWorklogs';

export function MainView() {
  const { isFetching, refetch } = useWorklogs();
  const { data: timerData } = useActiveTimers();
  const hasActiveTimer = timerData?.timers && timerData.timers.length > 0;

  return (
    <div className="divide-y divide-gray-100">
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

      {/* Today's worklogs */}
      <section>
        <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Worklogs</h3>
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
              <path
                fillRule="evenodd"
                d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.01.75.75 0 0 1-1.323-.704A6 6 0 0 1 12.33 3.53l.756.757V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.52 2.199l-.757-.757v.75a.75.75 0 0 1-1.5 0V9.991a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.84a4.5 4.5 0 0 0 7.08-1.01.75.75 0 0 1 1.024-.274Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <WorklogList />
      </section>
    </div>
  );
}
