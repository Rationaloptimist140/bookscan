import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PLATFORM_LABELS } from '@/lib/constants';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Book } from '@/lib/types';

export interface ProvenanceTimelineProps {
  book: Book;
  className?: string;
}

/**
 * Vertical timeline rendering each entry in `book.provenance_chain`.
 * Shows event label, UK-formatted date, and any relevant detail
 * (cost, price, platform, quality score) in monospace.
 */
export function ProvenanceTimeline({ book, className }: ProvenanceTimelineProps) {
  const chain = book.provenance_chain;

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Provenance Chain" />
      <CardBody>
        {chain.length === 0 ? (
          <EmptyState
            title="No provenance data"
            message="Events such as acquisition, scanning and listing will appear here as they occur."
          />
        ) : (
          <ol className="flex flex-col" aria-label="Book provenance chain">
            {chain.map((entry, i) => {
              const isLast = i === chain.length - 1;
              return (
                <li key={i} className="relative flex gap-3">
                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      aria-hidden="true"
                      className="absolute left-[9px] top-[20px] w-0.5 bg-rule"
                      style={{ height: 'calc(100% - 4px)' }}
                    />
                  )}

                  {/* Dot */}
                  <div className="mt-1.5 shrink-0 relative z-10" aria-hidden="true">
                    <span className="block w-5 h-5 rounded-full border-2 border-primary bg-surface" />
                  </div>

                  {/* Content */}
                  <div className={cn('flex flex-col gap-0.5 pb-5', isLast && 'pb-0')}>
                    <p className="text-sm font-semibold text-ink font-body leading-snug">
                      {entry.event}
                    </p>

                    {entry.date && (
                      <p className="text-xs text-ink-muted font-body">
                        {formatDate(entry.date)}
                      </p>
                    )}

                    {entry.detail && (
                      <p className="text-sm text-ink-body font-body leading-snug">
                        {entry.detail}
                      </p>
                    )}

                    {/* Monetary / platform / quality details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {entry.cost !== null && entry.cost !== undefined && (
                        <span className="font-mono text-xs text-ink-muted">
                          Cost: {formatCurrency(entry.cost)}
                        </span>
                      )}
                      {entry.price !== null && entry.price !== undefined && (
                        <span className="font-mono text-xs text-ink-muted">
                          Price: {formatCurrency(entry.price)}
                        </span>
                      )}
                      {entry.platform && (
                        <span className="font-mono text-xs text-ink-muted">
                          {PLATFORM_LABELS[entry.platform] ?? entry.platform}
                        </span>
                      )}
                      {entry.quality !== null && entry.quality !== undefined && (
                        <span className="font-mono text-xs text-ink-muted">
                          Quality: {Math.round(entry.quality * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
