import { ActiveTimer } from "../components/ActiveTimer";
import { StartTimerForm } from "../components/StartTimerForm";
import { WorklogList } from "../components/WorklogList";

export function MainView() {
  return (
    <div className="divide-y divide-gray-100">
      {/* Active timer section */}
      <section>
        <div className="px-4 pt-3 pb-0">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Active Timer
          </h3>
        </div>
        <ActiveTimer />
      </section>

      {/* Start new timer */}
      <section>
        <StartTimerForm />
      </section>

      {/* Today's worklogs */}
      <section>
        <div className="px-4 pt-3 pb-0">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Worklogs
          </h3>
        </div>
        <WorklogList />
      </section>
    </div>
  );
}
