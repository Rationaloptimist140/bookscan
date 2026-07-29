import * as React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Base Skeleton                                                       */
/* ------------------------------------------------------------------ */

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED_CLASSES: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-canvas-alt',
        ROUNDED_CLASSES[rounded],
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonText — multiple lines of text placeholders                  */
/* ------------------------------------------------------------------ */

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          rounded="md"
          className={i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonCard — full card placeholder                                 */
/* ------------------------------------------------------------------ */

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-surface border border-rule rounded-lg p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <Skeleton width={40} height={40} rounded="lg" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton height={16} className="w-2/3" />
          <Skeleton height={12} className="w-1/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonTable — table loading state                                  */
/* ------------------------------------------------------------------ */

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('w-full border border-rule rounded-lg overflow-hidden', className)}
    >
      {/* Header row */}
      <div className="bg-canvas-alt px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} className="flex-1" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="px-4 py-3 border-t border-divider flex gap-4 items-center"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height={14}
              className={cn('flex-1', c === 0 && 'w-2/5 flex-none')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonStatCards — dashboard stat card grid                         */
/* ------------------------------------------------------------------ */

export interface SkeletonStatCardsProps {
  count?: number;
}

export function SkeletonStatCards({ count = 4 }: SkeletonStatCardsProps) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-rule rounded-lg p-6 shadow-sm flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton height={13} className="w-1/2" />
            <Skeleton width={32} height={32} rounded="lg" />
          </div>
          <Skeleton height={32} className="w-2/3" />
          <Skeleton height={12} className="w-1/3" />
        </div>
      ))}
    </div>
  );
}
