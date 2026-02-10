interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({
  message = "Something went wrong.",
  onRetry,
}: ErrorCardProps) {
  return (
    <div className="mx-4 my-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between gap-2">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 font-medium underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
