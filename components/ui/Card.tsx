import * as React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add 24px padding. Default true. */
  padded?: boolean;
  /** Elevates shadow on hover. */
  hoverable?: boolean;
  /** Render as a different element (e.g. 'article', 'section', 'a'). */
  as?: React.ElementType;
}

export function Card({
  padded = true,
  hoverable = false,
  as: Tag = 'div',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        'bg-surface border border-rule rounded-lg shadow-sm',
        'transition-shadow duration-200',
        padded && 'p-6',
        hoverable && 'hover:shadow-md cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* CardHeader                                                          */
/* ------------------------------------------------------------------ */

export interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, children, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="min-w-0 flex-1">
        {title && <CardTitle>{title}</CardTitle>}
        {subtitle && (
          <p className="mt-0.5 text-sm font-body text-ink-muted">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CardTitle                                                           */
/* ------------------------------------------------------------------ */

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('font-heading font-semibold text-lg text-ink leading-snug', className)}>
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/* CardBody                                                            */
/* ------------------------------------------------------------------ */

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={cn('font-body text-ink-body', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CardFooter                                                          */
/* ------------------------------------------------------------------ */

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-divider flex items-center gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
