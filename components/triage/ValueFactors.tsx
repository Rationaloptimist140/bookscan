import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ValueFactorsProps {
  factors: string[];
  className?: string;
}

/**
 * Wrapped pill chips for AI training value factors.
 * Each factor is displayed as a rounded tag with a subtle background.
 */
export function ValueFactors({ factors, className }: ValueFactorsProps) {
  if (factors.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)} aria-label="AI training value factors">
      {factors.map((factor) => (
        <span
          key={factor}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1 rounded-full',
            'bg-accent-bg text-accent font-body text-[13px] font-medium',
            'border border-accent/20 leading-snug',
          )}
        >
          {factor}
        </span>
      ))}
    </div>
  );
}
