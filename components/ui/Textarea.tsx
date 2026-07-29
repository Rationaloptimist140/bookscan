'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      mono = false,
      id: externalId,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = externalId ?? generatedId;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium font-body text-ink-body"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full font-body text-[15px] text-ink-body',
            'border border-rule rounded-md bg-surface placeholder:text-ink-light',
            'px-3.5 py-2.5 transition-colors duration-200 resize-y min-h-[80px]',
            'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-canvas-alt',
            error && 'border-danger focus:border-danger focus:ring-danger/10',
            mono && 'font-mono',
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-sm font-body text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm font-body text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
