'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-ink-inverse hover:bg-primary-light active:bg-primary-dark focus-visible:ring-primary/30',
  secondary:
    'bg-secondary text-ink-inverse hover:bg-secondary-light active:bg-secondary focus-visible:ring-secondary/30',
  accent:
    'bg-accent text-ink-inverse hover:bg-accent-light active:bg-accent focus-visible:ring-accent/30',
  ghost:
    'bg-transparent text-primary hover:bg-primary-bg active:bg-primary-bg focus-visible:ring-primary/30',
  danger:
    'bg-danger text-ink-inverse hover:brightness-110 active:brightness-90 focus-visible:ring-danger/30',
  outline:
    'bg-transparent border border-rule text-ink-body hover:bg-surface-hover active:bg-surface-hover focus-visible:ring-rule',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const spinnerSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          'inline-flex items-center justify-center font-body font-medium rounded-md',
          'transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'focus-visible:outline-none focus-visible:ring-4',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'select-none whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Spinner
              size={spinnerSizes[size]}
              className="shrink-0"
              label="Loading"
            />
            {children && <span className="sr-only">{children}</span>}
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
