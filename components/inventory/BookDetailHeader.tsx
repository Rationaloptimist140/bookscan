import * as React from 'react';
import { cn } from '@/lib/utils';
import { gradientFor, initialOf } from '@/lib/utils';
import { StatusBadges } from '@/components/triage/StatusBadges';
import type { Book } from '@/lib/types';

export interface BookDetailHeaderProps {
  book: Book;
  className?: string;
}

/**
 * Header section for the book detail page: cover placeholder, title (Fraunces large),
 * author + year subtitle, and all status badges.
 */
export function BookDetailHeader({ book, className }: BookDetailHeaderProps) {
  const gradient = gradientFor(book.id);
  const initials = initialOf(book.title);

  return (
    <header className={cn('flex flex-col sm:flex-row gap-6 items-start', className)}>
      {/* Cover placeholder */}
      <div
        className="w-28 h-36 sm:w-32 sm:h-44 rounded-lg shadow-md flex items-center justify-center shrink-0"
        style={{ background: gradient }}
        aria-hidden="true"
      >
        <span className="font-heading text-5xl font-bold text-white/80 select-none">
          {initials}
        </span>
      </div>

      {/* Book info */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink leading-tight mb-1">
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="font-heading text-lg text-ink-muted italic mb-1">{book.subtitle}</p>
          )}
          <p className="text-base text-ink-muted font-body">
            {book.author_name}
            {book.publish_year && (
              <>
                {' '}
                <span className="text-ink-light">&middot;</span>{' '}
                <span className="font-mono text-sm">{book.publish_year}</span>
              </>
            )}
          </p>
        </div>

        <StatusBadges
          pdStatus={book.public_domain_status}
          aiValue={book.ai_training_value}
          triageAction={book.triage_action}
          scanStatus={book.scan_status}
          resaleStatus={book.resale_status}
          size="md"
        />
      </div>
    </header>
  );
}
