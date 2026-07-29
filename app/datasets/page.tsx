'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Eye, Database } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DatasetStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useDatasets,
  createDataset,
  updateDataset,
  useDatasetPreview,
} from '@/lib/hooks/useDatasets';
import { useBooks } from '@/lib/hooks/useBooks';
import { DATA_PLATFORM_OPTIONS } from '@/lib/constants';
import type { Dataset, DatasetQuery } from '@/lib/types';
import { formatCurrency, formatNumber, truncate } from '@/lib/utils';
import { successToast } from '@/components/ui/Toast';

// ── Schema ────────────────────────────────────────────────────────────────────

const createDatasetSchema = z.object({
  book_id: z.string().min(1, 'Please select a book'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  domain_tags: z.string().optional(),
  asking_price: z.coerce.number().min(0).optional().or(z.literal('')),
});

type CreateDatasetFormValues = z.infer<typeof createDatasetSchema>;

// ── Preview modal inner ───────────────────────────────────────────────────────

function DatasetPreviewContent({ datasetId }: { datasetId: string }) {
  const { preview, isLoading } = useDatasetPreview(datasetId);
  if (isLoading) return <Spinner size={24} className="mx-auto my-6" />;
  return (
    <div className="bg-canvas-alt rounded-lg p-4 max-h-80 overflow-y-auto">
      <pre className="text-xs font-mono text-ink-body whitespace-pre-wrap leading-relaxed">
        {preview ?? 'No preview available.'}
      </pre>
    </div>
  );
}

// ── Dataset card ──────────────────────────────────────────────────────────────

function DatasetCardItem({
  dataset,
  onPreview,
}: {
  dataset: Dataset;
  onPreview: (id: string) => void;
}) {
  const router = useRouter();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(
    dataset.asking_price?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);

  async function savePrice() {
    const parsed = parseFloat(priceInput);
    if (isNaN(parsed)) { setEditingPrice(false); return; }
    setSaving(true);
    await updateDataset(dataset.id, { asking_price: parsed });
    setSaving(false);
    setEditingPrice(false);
  }

  async function handleListPlatform(platform: string) {
    await updateDataset(dataset.id, { listed_platform: platform || null });
  }

  return (
    <Card
      hoverable
      onClick={() => router.push(`/datasets/${dataset.id}`)}
      className="flex flex-col h-full"
    >
      <CardHeader
        title={dataset.title}
        subtitle={undefined}
        action={<DatasetStatusBadge status={dataset.sale_status} />}
      />

      <CardBody className="flex-1 space-y-3">
        {/* Domain tags */}
        {dataset.domain_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dataset.domain_tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded-full bg-secondary-bg text-secondary font-body"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs font-body text-ink-muted">
          {dataset.word_count != null && (
            <span>{formatNumber(dataset.word_count)} words</span>
          )}
          {dataset.page_count != null && (
            <span>{dataset.page_count} pages</span>
          )}
          {dataset.ocr_quality_score != null && (
            <span>OCR: {Math.round(dataset.ocr_quality_score * 100)}%</span>
          )}
          <span className="font-mono text-[10px]">{dataset.language.toUpperCase()}</span>
        </div>

        {/* Inline-editable price */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {editingPrice ? (
            <div className="flex items-center gap-1.5">
              <Input
                size="sm"
                type="number"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-24"
                aria-label="Set asking price"
                autoFocus
              />
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={savePrice}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingPrice(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingPrice(true); }}
              className="text-sm font-mono font-semibold text-primary hover:underline underline-offset-2"
              aria-label="Edit asking price"
            >
              {dataset.asking_price != null
                ? formatCurrency(dataset.asking_price)
                : 'Set price'}
            </button>
          )}
        </div>

        {/* List on platform */}
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            size="sm"
            options={[
              { value: '', label: 'List on platform…' },
              ...DATA_PLATFORM_OPTIONS,
            ]}
            value={dataset.listed_platform ?? ''}
            onChange={(e) => { void handleListPlatform(e.target.value); }}
            aria-label="List on data platform"
          />
        </div>
      </CardBody>

      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          icon={<Eye size={14} />}
          onClick={(e) => { e.stopPropagation(); onPreview(dataset.id); }}
        >
          Preview Text
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const [query, setQuery] = useState<DatasetQuery>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { datasets, total, isLoading, mutate } = useDatasets(query);
  const { books } = useBooks({ limit: 100 });

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<CreateDatasetFormValues>({ resolver: zodResolver(createDatasetSchema) });

  async function onCreate(values: CreateDatasetFormValues) {
    const ds = await createDataset(
      {
        book_id: values.book_id,
        title: values.title,
        description: values.description || null,
        domain_tags: values.domain_tags
          ? values.domain_tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        asking_price: values.asking_price ? Number(values.asking_price) : null,
      },
      mutate,
    );
    if (ds) {
      setCreateOpen(false);
      resetForm();
    }
  }

  return (
    <PageContainer max="xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Datasets</h1>
          {total > 0 && (
            <p className="text-sm text-ink-muted mt-0.5 font-body">
              {formatNumber(total)} dataset{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => setCreateOpen(true)}
        >
          Create Dataset
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Input
          size="sm"
          placeholder="Filter by domain…"
          value={query.domain ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, domain: e.target.value || undefined }))}
          className="w-44"
          aria-label="Filter by domain"
        />
        <Input
          size="sm"
          placeholder="Language…"
          value={query.language ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, language: e.target.value || undefined }))}
          className="w-32"
          aria-label="Filter by language"
        />
        <Select
          size="sm"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'not_listed', label: 'Not Listed' },
            { value: 'listed', label: 'Listed' },
            { value: 'negotiating', label: 'Negotiating' },
            { value: 'sold', label: 'Sold' },
          ]}
          value={query.sale_status?.[0] ?? ''}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              sale_status: e.target.value ? [e.target.value as never] : undefined,
            }))
          }
          aria-label="Filter by sale status"
        />
        {(query.domain || query.language || query.sale_status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuery({})}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={<Database size={36} className="text-ink-muted" />}
          title="No datasets yet"
          message="Scan books to create datasets. Once scanned and OCR complete, you can create a dataset from the scan workflow."
          action={
            <div className="flex gap-3">
              <Link href="/scan">
                <Button variant="outline" size="sm">
                  Go to Scan Workflow
                </Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                Create Manually
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets.map((ds) => (
            <DatasetCardItem
              key={ds.id}
              dataset={ds}
              onPreview={setPreviewId}
            />
          ))}
        </div>
      )}

      {/* Create dataset modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="Create Dataset"
        description="Create a dataset from a scanned book."
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={isSubmitting} onClick={handleSubmit(onCreate)}>
              Create Dataset
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="text-sm font-medium font-body text-ink-body block mb-1.5">
              Book *
            </label>
            <select
              {...register('book_id')}
              aria-invalid={errors.book_id ? true : undefined}
              className="w-full h-10 px-3.5 border border-rule rounded-md bg-surface text-[15px] font-body text-ink-body focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">Select a book…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {truncate(b.title, 60)} — {b.author_name}
                </option>
              ))}
            </select>
            {errors.book_id && (
              <p className="text-sm text-danger mt-1">{errors.book_id.message}</p>
            )}
          </div>
          <Input
            label="Dataset Title *"
            error={errors.title?.message}
            {...register('title')}
          />
          <Input
            label="Domain Tags"
            placeholder="e.g. botany, medicine, history (comma-separated)"
            hint="Comma-separated domain keywords"
            {...register('domain_tags')}
          />
          <Input
            label="Asking Price (£)"
            type="number"
            step="0.01"
            placeholder="e.g. 150.00"
            error={errors.asking_price?.message}
            {...register('asking_price')}
          />
        </form>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={previewId !== null}
        onClose={() => setPreviewId(null)}
        title="Text Preview"
        description="First 500 words of extracted text."
        size="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>
            Close
          </Button>
        }
      >
        {previewId && <DatasetPreviewContent datasetId={previewId} />}
      </Modal>
    </PageContainer>
  );
}
