import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { gradientFor, initialOf } from '@/lib/utils';
import { scoreColour } from '@/lib/constants';
import { PdBadge } from '@/components/ui/Badge';
import type { Book } from '@/lib/types';

export interface BookCardProps {
  book: Book;
  className?: string;
}

/**
 * Grid card for a single book. Uses a deterministic gradient cover placeholder,
 * shows title (clamped to 2 lines), author, triage score and PD badge.
 * The whole card links to the book detail page with a hover lift effect.
 */
export function BookCard({ book, className }: BookCardProps) {
  const gradient = gradientFor(book.id);
  const initials = initialOf(book.title);
  const colour = scoreColour(book.triage_score);

  return (
    <Link
      href={`/inventory/${book.id}`}
      className={cn(
        'group block bg-surface border border-rule rounded-lg shadow-sm overflow-hidden',
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-rule-light',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:rounded-lg',
        className,
      )}
      aria-label={`View details for ${book.title} by ${book.author_name}`}
    >
      {/* Cover placeholder */}
      <div
        className="relative h-40 flex items-center justify-center"
        style={{ background: gradient }}
        aria-hidden="true"
      >
        <span className="font-heading text-5xl font-bold text-white/80 select-none">
          {initials}
        </span>
        {/* Score badge overlay */}
        <div
          className="absolute top-2 right-2 flex items-center justify-center w-9 h-9 rounded-full bg-surface/90 shadow-sm font-mono font-semibold text-sm"
          style={{ color: colour }}
          aria-label={`Triage score ${book.triage_score}`}
        >
          {book.triage_score}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2">
        <h3
          className="font-heading font-semibold text-base text-ink leading-snug line-clamp-2"
          title={book.title}
        >
          {book.title}
        </h3>
        <p className="text-sm text-ink-muted font-body truncate">{book.author_name}</p>
        <div className="flex items-center justify-between mt-1">
          <PdBadge status={book.public_domain_status} size="sm" />
          {book.publish_year && (
            <span className="font-mono text-xs text-ink-light">{book.publish_year}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
