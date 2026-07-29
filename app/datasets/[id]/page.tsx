'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Download, CheckCircle2, Trash2, ExternalLink } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DatasetStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import {
  useDataset,
  useDatasetPreview,
  updateDataset,
  deleteDataset,
} from '@/lib/hooks/useDatasets';
import { DATA_PLATFORM_OPTIONS } from '@/lib/constants';
import type { DatasetUpdatePayload } from '@/lib/types';
import { formatDate, formatNumber, downloadBlob } from '@/lib/utils';
import { successToast } from '@/components/ui/Toast';

// ── Pricing form schema ───────────────────────────────────────────────────────

const pricingSchema = z.object({
  asking_price: z.coerce.number().min(0, 'Must be a positive number').optional().or(z.literal('')),
  final_price: z.coerce.number().min(0).optional().or(z.literal('')),
  listed_platform: z.string().optional(),
  listed_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  buyer_name: z.string().optional(),
  buyer_type: z.string().optional(),
  nda_signed: z.boolean().optional(),
});

type PricingFormValues = z.infer<typeof pricingSchema>;

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const { dataset, isLoading, error, mutate } = useDataset(id);
  const { preview, isLoading: previewLoading } = useDatasetPreview(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset: resetForm,
  } = useForm<PricingFormValues>({ resolver: zodResolver(pricingSchema) });

  React.useEffect(() => {
    if (dataset) {
      resetForm({
        asking_price: dataset.asking_price ?? '',
        final_price: dataset.final_price ?? '',
        listed_platform: dataset.listed_platform ?? '',
        listed_url: dataset.listed_url ?? '',
        buyer_name: dataset.buyer_name ?? '',
        buyer_type: dataset.buyer_type ?? '',
        nda_signed: dataset.nda_signed,
      });
    }
  }, [dataset, resetForm]);

  async function onSavePricing(values: PricingFormValues) {
    const payload: DatasetUpdatePayload = {
      asking_price: values.asking_price ? Number(values.asking_price) : null,
      final_price: values.final_price ? Number(values.final_price) : null,
      listed_platform: values.listed_platform || null,
      listed_url: values.listed_url || null,
      buyer_name: values.buyer_name || null,
      buyer_type: values.buyer_type || null,
      nda_signed: values.nda_signed ?? false,
    };
    await updateDataset(id, payload, mutate);
  }

  async function handleMarkSold() {
    setMarkingSold(true);
    await updateDataset(id, { sale_status: 'sold' }, mutate);
    setMarkingSold(false);
    successToast('Dataset marked as sold.');
  }

  async function handleListForSale() {
    await updateDataset(id, { sale_status: 'listed' }, mutate);
    successToast('Dataset listed for sale.');
  }

  async function onDelete() {
    if (!dataset) return;
    const ok = await deleteDataset(id, dataset.title);
    if (ok) {
      router.push('/datasets');
    }
  }

  function handleDownload() {
    if (!preview) return;
    downloadBlob(`dataset-${id}.txt`, preview, 'text/plain');
  }

  if (isLoading) {
    return (
      <PageContainer max="xl">
        <Skeleton height={20} className="w-40 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </PageContainer>
    );
  }

  if (error || !dataset) {
    return (
      <PageContainer max="xl">
        <EmptyState
          icon={<span className="text-4xl">📂</span>}
          title="Dataset not found"
          message="This dataset may have been deleted."
          action={
            <Link href="/datasets">
              <Button variant="primary">Back to Datasets</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer max="xl">
      <Breadcrumbs
        items={[
          { label: 'Datasets', href: '/datasets' },
          { label: dataset.title },
        ]}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6 items-start">
        {/* Main column */}
        <main className="space-y-6 min-w-0">
          {/* Header */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl font-semibold text-ink">
                  {dataset.title}
                </h1>
                {dataset.description && (
                  <p className="text-sm font-body text-ink-muted mt-1">{dataset.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {dataset.domain_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full bg-secondary-bg text-secondary font-body"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <DatasetStatusBadge status={dataset.sale_status} />
            </div>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Words', value: dataset.word_count != null ? formatNumber(dataset.word_count) : '—' },
              { label: 'Pages', value: dataset.page_count?.toString() ?? '—' },
              { label: 'OCR Quality', value: dataset.ocr_quality_score != null ? `${Math.round(dataset.ocr_quality_score * 100)}%` : '—' },
              { label: 'Language', value: dataset.language.toUpperCase() },
            ].map(({ label, value }) => (
              <Card key={label} padded={false} className="p-4 text-center">
                <p className="text-xl font-mono font-semibold text-ink">{value}</p>
                <p className="text-xs font-body text-ink-muted mt-1">{label}</p>
              </Card>
            ))}
          </div>

          {/* Provenance */}
          {Object.keys(dataset.provenance_document).length > 0 && (
            <Card>
              <CardTitle className="mb-3">Provenance Document</CardTitle>
              <div className="bg-canvas-alt rounded-lg p-4 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono text-ink-body whitespace-pre-wrap">
                  {JSON.stringify(dataset.provenance_document, null, 2)}
                </pre>
              </div>
            </Card>
          )}

          {/* Text preview */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Text Preview</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={14} />}
                onClick={handleDownload}
                disabled={!preview}
              >
                Download
              </Button>
            </div>
            {previewLoading ? (
              <div className="bg-canvas-alt rounded-lg p-4 h-32 animate-pulse" />
            ) : preview ? (
              <div className="bg-canvas-alt rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs font-mono text-ink-body whitespace-pre-wrap leading-relaxed">
                  {preview}
                </pre>
              </div>
            ) : (
              <p className="text-sm font-body text-ink-muted italic">No preview available.</p>
            )}
          </Card>
        </main>

        {/* Sidebar */}
        <aside className="space-y-6 min-w-0">
          {/* Pricing & sale management */}
          <Card>
            <CardTitle className="mb-4">Pricing & Sale</CardTitle>
            <form onSubmit={handleSubmit(onSavePricing)} className="space-y-4">
              <Input
                label="Asking Price (£)"
                type="number"
                step="0.01"
                error={errors.asking_price?.message}
                {...register('asking_price')}
              />
              <Input
                label="Final Price (£)"
                type="number"
                step="0.01"
                hint="Set when deal is agreed"
                error={errors.final_price?.message}
                {...register('final_price')}
              />
              <Select
                label="Platform"
                options={[{ value: '', label: 'Not listed' }, ...DATA_PLATFORM_OPTIONS]}
                {...register('listed_platform')}
              />
              <Input
                label="Listing URL"
                type="url"
                placeholder="https://…"
                error={errors.listed_url?.message}
                {...register('listed_url')}
              />
              <Input
                label="Buyer Name"
                placeholder="e.g. Acme AI Ltd"
                {...register('buyer_name')}
              />
              <Input
                label="Buyer Type"
                placeholder="e.g. AI company"
                {...register('buyer_type')}
              />
              <label className="flex items-center gap-2 text-sm font-body text-ink-body cursor-pointer">
                <input
                  type="checkbox"
                  {...register('nda_signed')}
                  className="rounded border-rule accent-primary"
                />
                NDA signed
              </label>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                loading={isSubmitting}
                type="submit"
              >
                Save Details
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-divider space-y-2">
              {dataset.sale_status === 'not_listed' && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={handleListForSale}
                >
                  List for Sale
                </Button>
              )}
              {dataset.sale_status !== 'sold' && (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  loading={markingSold}
                  icon={<CheckCircle2 size={14} />}
                  onClick={handleMarkSold}
                >
                  Mark as Sold
                </Button>
              )}
            </div>
          </Card>

          {/* Metadata */}
          <Card>
            <CardTitle className="mb-3">Metadata</CardTitle>
            <dl className="space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Created</dt>
                <dd className="text-ink-body font-mono text-xs">{formatDate(dataset.created_at)}</dd>
              </div>
              {dataset.listed_at && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Listed</dt>
                  <dd className="text-ink-body font-mono text-xs">{formatDate(dataset.listed_at)}</dd>
                </div>
              )}
              {dataset.sold_at && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Sold</dt>
                  <dd className="text-ink-body font-mono text-xs">{formatDate(dataset.sold_at)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-muted">Dataset ID</dt>
                <dd className="text-ink-light font-mono text-[10px] truncate max-w-[120px]">{dataset.id}</dd>
              </div>
            </dl>
          </Card>

          {/* Actions */}
          <Card>
            <CardTitle className="mb-3">Actions</CardTitle>
            <div className="space-y-2">
              {dataset.listed_url && (
                <a
                  href={dataset.listed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    icon={<ExternalLink size={14} />}
                  >
                    View Listing
                  </Button>
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                icon={<Download size={14} />}
                onClick={handleDownload}
                disabled={!preview}
              >
                Download Text
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                icon={<Trash2 size={14} />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete Dataset
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Delete confirmation */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Dataset"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm font-body text-ink-body">
          Are you sure you want to delete{' '}
          <strong>&ldquo;{dataset.title}&rdquo;</strong>?
          This cannot be undone.
        </p>
      </Modal>
    </PageContainer>
  );
}
