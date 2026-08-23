import React from 'react';

export const LoadingSkeleton: React.FC<{
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}> = ({ className = '', width, height, rounded = 'md' }) => {
  const roundedClass =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'lg'
      ? 'rounded-xl'
      : rounded === 'sm'
      ? 'rounded'
      : 'rounded-md';

  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-zinc-200/80 dark:bg-zinc-800/80 ${roundedClass} ${className}`}
      aria-hidden="true"
    />
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#17181D] space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-4 w-1/3" />
        <LoadingSkeleton className="h-4 w-16" rounded="sm" />
      </div>
      <LoadingSkeleton className="h-3 w-4/5" />
      <LoadingSkeleton className="h-3 w-2/3" />
    </div>
  );
};

export const OverviewSectionSkeleton: React.FC = () => {
  return (
    <div className="p-4 border border-zinc-200 dark:border-zinc-800/80 rounded-xl bg-white dark:bg-[#17181D] space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="w-4 h-4 rounded-full" />
          <LoadingSkeleton className="h-4 w-24" />
        </div>
        <LoadingSkeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2 pt-1">
        <LoadingSkeleton className="h-12 w-full rounded-lg" />
        <LoadingSkeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
};
