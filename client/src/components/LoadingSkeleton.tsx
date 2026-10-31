import React from 'react';

export interface SkeletonProps {
  shape?: 'table' | 'card' | 'header';
  count?: number;
  className?: string;
}

export function Skeleton({ shape = 'card', count = 1, className = '' }: SkeletonProps) {
  if (shape === 'header') {
    return (
      <div className={`flex items-center justify-between py-4 animate-pulse ${className}`}>
        <div className="space-y-2">
          <div className="skeleton h-8 w-48 bg-base-300"></div>
          <div className="skeleton h-4 w-72 bg-base-300"></div>
        </div>
        <div className="skeleton h-10 w-28 rounded-lg bg-base-300"></div>
      </div>
    );
  }

  if (shape === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="card bg-base-200 border border-base-300 p-6 rounded-2xl shadow-sm space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="skeleton h-6 w-36 bg-base-300 rounded"></div>
              <div className="skeleton h-5 w-16 bg-base-300 rounded-full"></div>
            </div>
            <div className="skeleton h-4 w-full bg-base-300 rounded"></div>
            <div className="skeleton h-4 w-2/3 bg-base-300 rounded"></div>
            <div className="pt-2 flex justify-between items-center border-t border-base-300/40">
              <div className="skeleton h-4 w-24 bg-base-300 rounded"></div>
              <div className="skeleton h-8 w-20 bg-base-300 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // shape === 'table'
  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-base-300 bg-base-200 ${className}`}>
      <div className="p-4 border-b border-base-300 flex items-center justify-between">
        <div className="skeleton h-6 w-32 bg-base-300 rounded"></div>
        <div className="skeleton h-8 w-24 bg-base-300 rounded"></div>
      </div>
      <div className="divide-y divide-base-300/60 p-4 space-y-3">
        {Array.from({ length: count || 4 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <div className="skeleton h-4 w-4 bg-base-300 rounded"></div>
              <div className="skeleton h-4 w-32 bg-base-300 rounded"></div>
            </div>
            <div className="skeleton h-4 w-28 bg-base-300 rounded"></div>
            <div className="skeleton h-4 w-20 bg-base-300 rounded"></div>
            <div className="skeleton h-6 w-16 bg-base-300 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
