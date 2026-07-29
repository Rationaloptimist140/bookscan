'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, LayoutGrid, List, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookTable } from '@/components/inventory/BookTable';
import { BookCard } from '@/components/inventory/BookCard';
import { BookFilters } from '@/components/inventory/BookFilters';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useBooks, createBook, deleteBook } from '@/lib/hooks/useBooks';
import {
  SORT_OPTIONS,
  CONDITION_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from '@/lib/constants';
import type { BookQuery, BookSort, ViewMode } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { successToast } from '@/components/ui/Toast';

// ── Create-book form schema ────────────────────────────────────────────────────

const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author_name: z.string().min(1, 'Author name is required'),
  isbn: z.string().optional(),
  publish_year: z.coerce.number().int().min(1000).max(2100).optional().or(z.literal('')),
  publisher: z.string().optional(),
  language: z.string().optional(),
  page_count: z.coerce.number().int().positive().optional().or(z.literal('')),
  condition: z.enum(['mint', 'very_good', 'good', 'fair', 'poor', 'unknown']).optional(),
  acquisition_cost: z.coerce.number().min(0).optional().or(z.literal('')),
  acquisition_source: z.string().optional(),
});

type CreateBookFormValues = z.infer<typeof createBookSchema>;

// ── Query-string helpers ─────────────────────────────────────────────────────

function queryFromParams(params: URLSearchParams): BookQuery {
  const q: BookQuery = {};

  const search = params.get('search');
  if (search) q.search = search;

  const page = params.get('page');
  if (page) q.page = parseInt(page, 10);

  const sort = params.get('sort') as BookSort | null;
  if (sort) q.sort = sort;

  const pd = params.get('public_domain_status');
  if (pd) q.public_domain_status = pd.split(',') as BookQuery['public_domain_status'];

  const ai = params.get('ai_training_value');
  if (ai) q.ai_training_value = ai.split(',') as BookQuery['ai_training_value'];

  const ta = params.get('triage_action');
  if (ta) q.triage_action = ta.split(',') as BookQuery['triage_action'];

  const ss = params.get('scan_status');
  if (ss) q.scan_status = ss.split(',') as BookQuery['scan_status'];

  const sale = params.get('sale_status');
  if (sale) q.sale_status = sale.split(',') as BookQuery['sale_status'];

  q.limit = DEFAULT_PAGE_SIZE;

  return q;
}

function paramsFromQuery(q: BookQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.search) p.set('search', q.search);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  if (q.sort && q.sort !== 'newest') p.set('sort', q.sort);
  if (q.public_domain_status?.length) p.set('public_domain_status', q.public_domain_status.join(','));
  if (q.ai_training_value?.length) p.set('ai_training_value', q.ai_training_value.join(','));
  if (q.triage_action?.length) p.set('triage_action', q.triage_action.join(','));
  if (q.scan_status?.length) p.set('scan_status', q.scan_status.join(','));
  if (q.sale_status?.length) p.set('sale_status', q.sale_status.join(','));
  return p;
}

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function InventoryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const query = queryFromParams(params);
  const { books, total, page, pages, isLoading, mutate } = useBooks(query);

  // Create-book form
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookFormValues>({
    resolver: zodResolver(createBookSchema),
    defaultValues: { condition: 'good', language: 'en' },
  });

  function updateQuery(updates: Partial<BookQuery>) {
    const next = { ...query, ...updates };
    if ('page' in updates === false || updates.page === undefined) {
      next.page = 1; // reset page on filter change
    }
    router.replace(`/inventory?${paramsFromQuery(next).toString()}`, { scroll: false });
  }

  async function onCreateBook(values: CreateBookFormValues) {
    const book = await createBook({
      title: values.title,
      author_name: values.author_name,
      isbn: values.isbn || null,
      publish_year: values.publish_year ? Number(values.publish_year) : null,
      publisher: values.publisher || null,
      language: values.language || 'en',
      page_count: values.page_count ? Number(values.page_count) : null,
      condition: values.condition ?? 'good',
      acquisition_cost: values.acquisition_cost ? Number(values.acquisition_cost) : null,
      acquisition_source: values.acquisition_source || null,
    });
    if (book) {
      setAddOpen(false);
      resetForm();
      mutate();
    }
  }

  async function handleBulkDelete() {
    setDeleteConfirmOpen(false);
    let success = 0;
    for (const id of deleteIds) {
      const book = books.find((b) => b.id === id);
      const ok = await deleteBook(id, book?.title ?? 'Book', mutate);
      if (ok) success++;
    }
    setSelectedIds([]);
    setDeleteIds([]);
    if (success > 0) successToast(`Deleted ${success} book${success > 1 ? 's' : ''}.`);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <PageContainer max="full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Inventory</h1>
          {total > 0 && (
            <p className="text-sm text-ink-muted mt-0.5 font-body">
              {formatNumber(total)} book{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex items-center border border-rule rounded-md overflow-hidden"
            role="group"
            aria-label="View mode"
          >
            <button
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
              className={cn(
                'p-2 transition-colors duration-150 focus-visible:outline-none',
                viewMode === 'table'
                  ? 'bg-primary text-ink-inverse'
                  : 'text-ink-muted hover:bg-surface-hover',
              )}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'p-2 transition-colors duration-150 focus-visible:outline-none',
                viewMode === 'grid'
                  ? 'bg-primary text-ink-inverse'
                  : 'text-ink-muted hover:bg-surface-hover',
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setAddOpen(true)}
          >
            Add Book
          </Button>
        </div>
      </div>

      {/* Body: filters + content */}
      <div className="flex gap-6">
        {/* Filter sidebar */}
        <aside
          aria-label="Book filters"
          className="hidden lg:block w-60 shrink-0"
        >
          <BookFilters
            query={query}
            onChange={(q) => updateQuery(q)}
            onReset={() => router.replace('/inventory', { scroll: false })}
          />
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Bulk actions bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 bg-primary-bg border border-primary/20 rounded-lg">
              <span className="text-sm font-medium text-primary font-body">
                {selectedIds.length} book{selectedIds.length > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  setDeleteIds(selectedIds);
                  setDeleteConfirmOpen(true);
                }}
              >
                Delete selected
              </Button>
            </div>
          )}

          {/* Sort bar (mobile-friendly) */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Select
              options={SORT_OPTIONS}
              value={query.sort ?? 'newest'}
              onChange={(e) => updateQuery({ sort: e.target.value as BookSort })}
              aria-label="Sort by"
              size="sm"
              className="w-44"
            />
          </div>

          {/* Table / Grid */}
          {isLoading ? (
            <SkeletonTable rows={8} cols={7} />
          ) : viewMode === 'table' ? (
            <BookTable
              books={books}
              loading={isLoading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onDelete={(book) => {
                setDeleteIds([book.id]);
                setDeleteConfirmOpen(true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {books.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={<span className="text-3xl">📚</span>}
                    title="No books found"
                    message="Try adjusting your filters or add a book to get started."
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus size={14} />}
                        onClick={() => setAddOpen(true)}
                      >
                        Add Book
                      </Button>
                    }
                  />
                </div>
              ) : (
                books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between mt-6 pt-4 border-t border-rule"
            >
              <p className="text-sm font-body text-ink-muted">
                Page {page} of {pages} — {formatNumber(total)} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeft size={15} />}
                  disabled={page <= 1}
                  onClick={() => updateQuery({ page: page - 1 })}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconRight={<ChevronRight size={15} />}
                  disabled={page >= pages}
                  onClick={() => updateQuery({ page: page + 1 })}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </div>
      </div>

      {/* Add Book modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetForm(); }}
        title="Add Book"
        description="Manually add a book to your inventory."
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSubmit(onCreateBook)}
            >
              Save Book
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onCreateBook)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Title *"
            placeholder="e.g. The Interpretation of Dreams"
            error={errors.title?.message}
            {...register('title')}
            className="sm:col-span-2"
          />
          <Input
            label="Author *"
            placeholder="e.g. Sigmund Freud"
            error={errors.author_name?.message}
            {...register('author_name')}
          />
          <Input
            label="ISBN"
            placeholder="e.g. 9780140434520"
            mono
            error={errors.isbn?.message}
            {...register('isbn')}
          />
          <Input
            label="Publisher"
            placeholder="e.g. Penguin Books"
            {...register('publisher')}
          />
          <Input
            label="Publish Year"
            type="number"
            placeholder="e.g. 1899"
            error={errors.publish_year?.message}
            {...register('publish_year')}
          />
          <Input
            label="Page Count"
            type="number"
            placeholder="e.g. 352"
            error={errors.page_count?.message}
            {...register('page_count')}
          />
          <Input
            label="Language"
            placeholder="e.g. en"
            {...register('language')}
          />
          <Select
            label="Condition"
            options={CONDITION_OPTIONS}
            {...register('condition')}
          />
          <Input
            label="Acquisition Cost (£)"
            type="number"
            step="0.01"
            placeholder="e.g. 2.50"
            error={errors.acquisition_cost?.message}
            {...register('acquisition_cost')}
          />
          <Input
            label="Acquisition Source"
            placeholder="e.g. Oxfam, Oxford"
            {...register('acquisition_source')}
          />
        </form>
      </Modal>

      {/* Bulk delete confirmation */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Deletion"
        description={`Are you sure you want to delete ${deleteIds.length} book${deleteIds.length > 1 ? 's' : ''}? This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm font-body text-ink-muted">
          The selected book{deleteIds.length > 1 ? 's' : ''} and all associated data will be permanently removed.
        </p>
      </Modal>
    </PageContainer>
  );
}

// ── Page wrapper with Suspense (required by useSearchParams) ──────────────────

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <PageContainer max="full">
          <SkeletonTable rows={10} cols={8} />
        </PageContainer>
      }
    >
      <InventoryInner />
    </Suspense>
  );
}
