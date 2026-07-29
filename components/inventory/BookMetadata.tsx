import * as React from 'react';
import { cn } from '@/lib/utils';
import { labelise } from '@/lib/utils';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import type { Book } from '@/lib/types';

export interface BookMetadataProps {
  book: Book;
  className?: string;
}

interface MetaItemProps {
  label: string;
  value: React.ReactNode;
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted font-body">
        {label}
      </dt>
      <dd className="text-sm text-ink-body font-body leading-snug">{value}</dd>
    </div>
  );
}

/**
 * 2-column metadata grid for a book's bibliographic and physical details.
 */
export function BookMetadata({ book, className }: BookMetadataProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader title="Book Metadata" />
      <CardBody>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {book.isbn && (
            <MetaItem
              label="ISBN"
              value={<span className="font-mono text-[13px]">{book.isbn}</span>}
            />
          )}
          {book.publisher && (
            <MetaItem label="Publisher" value={book.publisher} />
          )}
          {book.publish_year && (
            <MetaItem
              label="Publish Year"
              value={<span className="font-mono">{book.publish_year}</span>}
            />
          )}
          <MetaItem
            label="Language"
            value={book.language.toUpperCase()}
          />
          {book.page_count !== null && (
            <MetaItem
              label="Page Count"
              value={<span className="font-mono">{book.page_count}</span>}
            />
          )}
          {book.author_birth_year !== null && (
            <MetaItem
              label="Author Birth Year"
              value={<span className="font-mono">{book.author_birth_year}</span>}
            />
          )}
          {book.author_death_year !== null && (
            <MetaItem
              label="Author Death Year"
              value={<span className="font-mono">{book.author_death_year}</span>}
            />
          )}
          {book.genre && (
            <MetaItem label="Genre" value={book.genre} />
          )}
          {book.condition && (
            <MetaItem label="Condition" value={labelise(book.condition)} />
          )}
          {book.acquisition_source && (
            <MetaItem label="Acquired From" value={book.acquisition_source} />
          )}
          {book.estimated_copies_surviving !== 'unknown' && (
            <MetaItem
              label="Rarity"
              value={labelise(book.estimated_copies_surviving)}
            />
          )}
          {book.physical_location && (
            <MetaItem label="Location" value={book.physical_location} />
          )}
        </dl>

        {/* Subject keywords */}
        {book.subject_keywords.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Subject Keywords
            </p>
            <div className="flex flex-wrap gap-2">
              {book.subject_keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-0.5 rounded-full bg-canvas-alt text-ink-muted font-body text-xs border border-rule-light"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {book.description && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
              Description
            </p>
            <p className="text-sm text-ink-body font-body leading-relaxed">
              {book.description}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
