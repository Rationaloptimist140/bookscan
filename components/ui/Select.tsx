'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

// `size` is omitted from the native attributes because the DOM defines it as a
// number (visible row count); BookScan uses it as a design-system scale token.
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md';
  options: readonly SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      options,
      placeholder,
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full appearance-none font-body text-[15px] text-ink-body',
              'border border-rule rounded-md bg-surface',
              'pl-3.5 pr-9 transition-colors duration-200',
              'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-canvas-alt',
              error && 'border-danger focus:border-danger focus:ring-danger/10',
              inputHeight,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
            <ChevronDown size={16} />
          </span>
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

Select.displayName = 'Select';
