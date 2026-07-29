'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const POSITIONS: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const ARROW_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-ink border-x-transparent border-b-transparent border-[4px_4px_0_4px]',
  bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-ink border-x-transparent border-t-transparent border-[0_4px_4px_4px]',
  left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-ink border-y-transparent border-r-transparent border-[4px_0_4px_4px]',
  right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-ink border-y-transparent border-l-transparent border-[4px_4px_4px_0]',
};

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const tooltipId = React.useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {/* Wrap child to pass aria-describedby */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': visible ? tooltipId : undefined,
          })
        : children}

      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-[400] pointer-events-none',
            'px-2.5 py-1.5 rounded-md',
            'bg-ink text-ink-inverse text-xs font-body font-medium',
            'whitespace-nowrap shadow-md',
            'animate-[fadeIn_100ms_ease_both]',
            POSITIONS[side],
            className,
          )}
        >
          {content}
          {/* Arrow */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute w-0 h-0 border-solid',
              ARROW_CLASSES[side],
            )}
          />
        </span>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96) ${side === 'top' || side === 'bottom' ? 'translateX(-50%)' : 'translateY(-50%)'}; }
          to   { opacity: 1; transform: scale(1)    ${side === 'top' || side === 'bottom' ? 'translateX(-50%)' : 'translateY(-50%)'}; }
        }
      `}</style>
    </span>
  );
}
