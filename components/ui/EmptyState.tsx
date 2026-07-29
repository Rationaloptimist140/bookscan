import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-canvas-alt text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-lg font-semibold text-ink mb-1">{title}</h3>
      {message && (
        <p className="text-sm font-body text-ink-muted max-w-xs leading-relaxed">{message}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
