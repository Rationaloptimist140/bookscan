'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// `size` is omitted from the native attributes because the DOM defines it as a
// number (character width); BookScan uses it as a design-system scale token.
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md';
  mono?: boolean;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

let idCounter = 0;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      mono = false,
      icon,
      suffix,
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

    const inputHeight = size === 'sm' ? 'h-8' : 'h-10';

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
        <div className="relative flex items-center">
          {icon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-ink-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full font-body text-[15px] text-ink-body',
              'border border-rule rounded-md bg-surface placeholder:text-ink-light',
              'px-3.5 transition-colors duration-200',
              'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-canvas-alt',
              error && 'border-danger focus:border-danger focus:ring-danger/10',
              mono && 'font-mono',
              inputHeight,
              icon && 'pl-10',
              suffix && 'pr-10',
            )}
            {...props}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-3 flex items-center text-ink-muted">
              {suffix}
            </span>
          )}
        </div>
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

Input.displayName = 'Input';
