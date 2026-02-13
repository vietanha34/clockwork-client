import { useState } from 'react';
import { useSettings } from '../lib/settings-context';
import { useActiveTimers } from '../hooks/useActiveTimers';
import { useStartTimer } from '../hooks/useTimerActions';
import { IssueCombobox } from './IssueCombobox';

export function StartTimerForm() {
  const [issueKey, setIssueKey] = useState('');
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);
  const startTimer = useStartTimer();
  const { settings } = useSettings();
  const accountId = settings.jiraToken;
  const { data: timerData } = useActiveTimers();
  const hasActiveTimer = timerData?.timers && timerData.timers.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!issueKey.trim()) return;
    startTimer.mutate(
      { issueKey: issueKey.trim().toUpperCase(), comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setIssueKey('');
          setComment('');
          setExpanded(false);
        },
      },
    );
  }

  return (
    <div className="px-4 py-3">
      {!expanded ? (
        !hasActiveTimer ? (
          <div className="flex justify-center py-12">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="py-2 px-6 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 shadow-sm transition-colors"
            >
              + Start New Timer
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="py-1 px-3 text-xs font-medium text-blue-700 border border-blue-300 rounded hover:bg-blue-50 w-auto"
            >
              + Start New Timer
            </button>
          </div>
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <IssueCombobox
            value={issueKey}
            accountId={accountId}
            onChange={setIssueKey}
            onSelect={setIssueKey}
            placeholder="Issue key (e.g. KAN-42)"
            autoFocus
          />
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {startTimer.isError && (
            <p className="text-xs text-red-600">
              Failed to start timer. Check the issue key and try again.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={startTimer.isPending || !issueKey.trim()}
              className="flex-1 py-1.5 px-3 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startTimer.isPending ? 'Starting…' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setIssueKey('');
                setComment('');
                startTimer.reset();
              }}
              className="py-1.5 px-3 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
