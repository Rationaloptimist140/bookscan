'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreColour } from '@/lib/constants';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  PdBadge,
  AiValueBadge,
  ScanStatusBadge,
  ResaleStatusBadge,
} from '@/components/ui/Badge';
import type { Column } from '@/components/ui/Table';
import type { Book } from '@/lib/types';

export interface BookTableProps {
  books: Book[];
  loading?: boolean;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onDelete?: (book: Book) => void;
}

/**
 * Full-featured sortable book inventory table with selection checkboxes,
 * inline badge rendering, and a delete confirmation modal.
 */
export function BookTable({
  books,
  loading = false,
  sortKey,
  sortDir,
  onSort,
  selectedIds = [],
  onSelectionChange,
  onDelete,
}: BookTableProps) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<Book | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function confirmDelete() {
    if (!pendingDelete || !onDelete) return;
    setDeleting(true);
    onDelete(pendingDelete);
    setDeleting(false);
    setPendingDelete(null);
  }

  const columns: Column<Book>[] = [
    {
      key: 'title',
      header: 'Title / Author',
      sortable: true,
      render: (book) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink text-[15px] leading-snug truncate max-w-xs">
            {book.title}
          </p>
          <p className="text-sm text-ink-muted font-body truncate max-w-xs">
            {book.author_name}
          </p>
        </div>
      ),
    },
    {
      key: 'isbn',
      header: 'ISBN',
      render: (book) =>
        book.isbn ? (
          <span className="font-mono text-[13px] text-ink-body tracking-tight">
            {book.isbn}
          </span>
        ) : (
          <span className="text-ink-light text-sm">—</span>
        ),
    },
    {
      key: 'publish_year',
      header: 'Year',
      sortable: true,
      align: 'center' as const,
      width: '72px',
      render: (book) => (
        <span className="font-mono text-[13px] text-ink-body">
          {book.publish_year ?? '—'}
        </span>
      ),
    },
    {
      key: 'public_domain_status',
      header: 'PD Status',
      render: (book) => <PdBadge status={book.public_domain_status} size="sm" />,
    },
    {
      key: 'ai_training_value',
      header: 'AI Value',
      render: (book) => <AiValueBadge value={book.ai_training_value} size="sm" />,
    },
    {
      key: 'triage_score',
      header: 'Score',
      sortable: true,
      align: 'center' as const,
      width: '72px',
      render: (book) => (
        <span
          className="font-mono font-semibold text-sm"
          style={{ color: scoreColour(book.triage_score) }}
        >
          {book.triage_score}
        </span>
      ),
    },
    {
      key: 'scan_status',
      header: 'Scan',
      render: (book) => <ScanStatusBadge status={book.scan_status} size="sm" />,
    },
    {
      key: 'resale_status',
      header: 'Resale',
      render: (book) => <ResaleStatusBadge status={book.resale_status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      width: '88px',
      render: (book) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={`View details for ${book.title}`}
            onClick={() => router.push(`/inventory/${book.id}`)}
            className={cn(
              'p-1.5 rounded-md text-ink-muted hover:text-primary hover:bg-primary-bg',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            )}
          >
            <Eye size={16} aria-hidden="true" />
          </button>
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${book.title}`}
              onClick={() => setPendingDelete(book)}
              className={cn(
                'p-1.5 rounded-md text-ink-muted hover:text-danger hover:bg-danger-bg',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30',
              )}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        rows={books}
        rowKey={(b) => b.id}
        loading={loading}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        selectable={Boolean(onSelectionChange)}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={(book) => router.push(`/inventory/${book.id}`)}
        emptyState={
          <EmptyState
            title="No books found"
            message="Your inventory is empty. Triage an ISBN to add your first book."
          />
        }
        stickyHeader
      />

      {/* Delete confirmation modal */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete Book"
        description={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.title}"? This action cannot be undone.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted font-body">
          All associated data including scan pages, datasets and provenance records will
          be permanently removed.
        </p>
      </Modal>
    </>
  );
}
