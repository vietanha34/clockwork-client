import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

function SkeletonLine({ className }: SkeletonProps) {
  return <div className={clsx('animate-pulse bg-gray-200 rounded', className)} />;
}

export function TimerSkeleton() {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <SkeletonLine className="w-2 h-2 rounded-full" />
        <SkeletonLine className="h-4 w-20" />
      </div>
      <SkeletonLine className="h-3 w-40" />
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="h-7 w-full mt-2" />
    </div>
  );
}

export function WorklogSkeleton() {
  return (
    <div className="px-4 py-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 items-center">
          <SkeletonLine className="h-3 w-14 shrink-0" />
          <SkeletonLine className="h-3 flex-1" />
          <SkeletonLine className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}
