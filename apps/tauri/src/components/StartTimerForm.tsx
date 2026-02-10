import { useState } from "react";
import { useStartTimer } from "../hooks/useTimerActions";

export function StartTimerForm() {
  const [issueKey, setIssueKey] = useState("");
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const startTimer = useStartTimer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!issueKey.trim()) return;
    startTimer.mutate(
      { issueKey: issueKey.trim().toUpperCase(), comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setIssueKey("");
          setComment("");
          setExpanded(false);
        },
      }
    );
  }

  return (
    <div className="px-4 py-3">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2 px-3 text-xs font-medium text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
        >
          + Start New Timer
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={issueKey}
            onChange={(e) => setIssueKey(e.target.value)}
            placeholder="Issue key (e.g. KAN-42)"
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            autoFocus
            required
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
              {startTimer.isPending ? "Starting…" : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setIssueKey("");
                setComment("");
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
