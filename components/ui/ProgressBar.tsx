import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number;
  max?: number;
  colour?: string;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  colour,
  label,
  showValue = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5 gap-2">
          {label && (
            <span className="text-sm font-body font-medium text-ink-body">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-body text-ink-muted tabular-nums">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className={cn(
          'w-full overflow-hidden rounded-full bg-canvas-alt',
          trackHeight,
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            !colour && 'bg-primary',
          )}
          style={{
            width: `${pct}%`,
            ...(colour ? { backgroundColor: colour } : {}),
          }}
        />
      </div>
    </div>
  );
}
