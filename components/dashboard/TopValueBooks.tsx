import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { scoreColour } from '@/lib/constants';
import { TriageActionBadge } from '@/components/ui/Badge';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Book } from '@/lib/types';

export interface TopValueBooksProps {
  books: Book[];
  loading?: boolean;
  className?: string;
}

/**
 * Compact top-5 table of highest-scoring books with rank, title+author,
 * coloured triage score, and action badge. Each row links to the detail page.
 */
export function TopValueBooks({ books, loading = false, className }: TopValueBooksProps) {
  const top5 = books.slice(0, 5);

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Top Value Books" subtitle="Highest triage scores in your catalogue" />
      <CardBody>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={24} height={24} rounded="full" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton height={14} className="w-2/3" />
                  <Skeleton height={12} className="w-1/3" />
                </div>
                <Skeleton height={20} className="w-12" />
                <Skeleton height={20} className="w-24" />
              </div>
            ))}
          </div>
        ) : top5.length === 0 ? (
          <EmptyState
            title="No books yet"
            message="Add books to your inventory to see top-value picks here."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm font-body" aria-label="Top value books">
              <thead>
                <tr className="border-b border-rule">
                  <th className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted w-8">
                    #
                  </th>
                  <th className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Book
                  </th>
                  <th className="py-2 pr-3 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted w-14">
                    Score
                  </th>
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {top5.map((book, i) => (
                  <tr
                    key={book.id}
                    className="border-b border-divider last:border-b-0 hover:bg-surface-hover transition-colors duration-150"
                  >
                    {/* Rank */}
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-canvas-alt text-ink-muted text-xs font-semibold">
                        {i + 1}
                      </span>
                    </td>

                    {/* Title + author */}
                    <td className="py-3 pr-3 min-w-0">
                      <Link
                        href={`/inventory/${book.id}`}
                        className={cn(
                          'group flex flex-col min-w-0',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
                        )}
                        aria-label={`View ${book.title}`}
                      >
                        <span className="font-semibold text-ink group-hover:text-primary transition-colors duration-150 truncate max-w-[180px]">
                          {book.title}
                        </span>
                        <span className="text-xs text-ink-muted truncate max-w-[180px]">
                          {book.author_name}
                        </span>
                      </Link>
                    </td>

                    {/* Score */}
                    <td className="py-3 pr-3 text-center">
                      <span
                        className="font-mono font-semibold text-sm"
                        style={{ color: scoreColour(book.triage_score) }}
                        aria-label={`Score ${book.triage_score}`}
                      >
                        {book.triage_score}
                      </span>
                    </td>

                    {/* Action badge */}
                    <td className="py-3">
                      <TriageActionBadge action={book.triage_action} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
