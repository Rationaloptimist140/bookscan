'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  Download,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Globe,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { BookDetailHeader } from '@/components/inventory/BookDetailHeader';
import { BookMetadata } from '@/components/inventory/BookMetadata';
import { TriageInfo } from '@/components/inventory/TriageInfo';
import { ScanStatusTracker } from '@/components/inventory/ScanStatus';
import { SaleStatusCard } from '@/components/inventory/SaleStatus';
import { ProvenanceTimeline } from '@/components/inventory/ProvenanceTimeline';
import { StatusBadges } from '@/components/triage/StatusBadges';
import { TriageScore } from '@/components/triage/TriageScore';
import { ValueFactors } from '@/components/triage/ValueFactors';
import { useBook, updateBook, deleteBook, rerunTriage } from '@/lib/hooks/useBooks';
import { CONDITION_OPTIONS, PD_STATUS_STYLES } from '@/lib/constants';
import type { BookUpdatePayload, TriageAction } from '@/lib/types';
import { formatDate, downloadBlob } from '@/lib/utils';
import { successToast } from '@/components/ui/Toast';

// ── Edit-book schema ──────────────────────────────────────────────────────────

const editBookSchema = z.object({
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
  physical_location: z.string().optional(),
});

type EditBookFormValues = z.infer<typeof editBookSchema>;

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const { book, isLoading, error, mutate } = useBook(id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetEditForm,
    formState: { errors, isSubmitting },
  } = useForm<EditBookFormValues>({ resolver: zodResolver(editBookSchema) });

  function openEdit() {
    if (!book) return;
    resetEditForm({
      title: book.title,
      author_name: book.author_name,
      isbn: book.isbn ?? '',
      publish_year: book.publish_year ?? '',
      publisher: book.publisher ?? '',
      language: book.language,
      page_count: book.page_count ?? '',
      condition: book.condition,
      acquisition_cost: book.acquisition_cost ?? '',
      acquisition_source: book.acquisition_source ?? '',
      physical_location: book.physical_location ?? '',
    });
    setEditOpen(true);
  }

  async function onEdit(values: EditBookFormValues) {
    if (!book) return;
    const payload: BookUpdatePayload = {
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
      physical_location: values.physical_location || null,
    };
    const updated = await updateBook(id, payload, mutate);
    if (updated) {
      setEditOpen(false);
      successToast('Book updated.');
    }
  }

  async function onDelete() {
    if (!book) return;
    const ok = await deleteBook(id, book.title);
    if (ok) {
      router.push('/inventory');
    }
  }

  async function handleRerun() {
    setRerunning(true);
    await rerunTriage(id, mutate);
    setRerunning(false);
  }

  async function handleOverride(action: TriageAction) {
    await updateBook(id, { triage_action: action }, mutate);
  }

  async function handleAdvance() {
    if (!book) return;
    const nextStatusMap: Record<string, string> = {
      not_scanned: 'queued',
      queued: 'scanning',
      scanning: 'scanned',
      scanned: 'ocr_complete',
      ocr_complete: 'reviewed',
      reviewed: 'ready_for_sale',
    };
    const next = nextStatusMap[book.scan_status];
    if (next) {
      setAdvancing(true);
      await updateBook(id, { scan_status: next as BookUpdatePayload['scan_status'] }, mutate);
      setAdvancing(false);
    }
  }

  async function handleSaleUpdate(payload: BookUpdatePayload) {
    await updateBook(id, payload, mutate);
  }

  function handleExport() {
    if (!book) return;
    const json = JSON.stringify(book, null, 2);
    downloadBlob(`book-${book.id}.json`, json, 'application/json');
  }

  // Loading state
  if (isLoading) {
    return (
      <PageContainer max="xl">
        <Skeleton height={20} className="w-40 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </PageContainer>
    );
  }

  // Not found
  if (error || !book) {
    return (
      <PageContainer max="xl">
        <EmptyState
          icon={<span className="text-4xl">📕</span>}
          title="Book not found"
          message="This book may have been deleted or the link is incorrect."
          action={
            <Link href="/inventory">
              <Button variant="primary">Back to Inventory</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const pdStyle = PD_STATUS_STYLES[book.public_domain_status];

  return (
    <PageContainer max="xl">
      <Breadcrumbs
        items={[
          { label: 'Inventory', href: '/inventory' },
          { label: book.title },
        ]}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6 items-start">
        {/* ── Main column ── */}
        <main className="space-y-6 min-w-0">
          {/* Header */}
          <BookDetailHeader book={book} />

          {/* Status badges + score */}
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadges
              pdStatus={book.public_domain_status}
              aiValue={book.ai_training_value}
              triageAction={book.triage_action}
              scanStatus={book.scan_status}
              resaleStatus={book.resale_status}
            />
            <TriageScore score={book.triage_score} size={72} animate />
          </div>

          {/* Metadata */}
          <BookMetadata book={book} />

          {/* Public domain info */}
          <Card>
            <CardHeader
              title="Public Domain Status"
              action={
                <Badge bg={pdStyle.bg} text={pdStyle.text}>
                  {pdStyle.label}
                </Badge>
              }
            />
            <CardBody>
              {book.public_domain_reason ? (
                <p className="text-sm font-body text-ink-body leading-relaxed">
                  {book.public_domain_reason}
                </p>
              ) : (
                <p className="text-sm font-body text-ink-muted italic">
                  No reasoning available.
                </p>
              )}
              {book.public_domain_checked_at && (
                <div className="flex items-center gap-1.5 mt-3 text-xs font-body text-ink-light">
                  <Calendar size={12} aria-hidden="true" />
                  Checked on {formatDate(book.public_domain_checked_at)}
                </div>
              )}
              {book.gutenberg_id && (
                <a
                  href={book.gutenberg_url ?? `https://www.gutenberg.org/ebooks/${book.gutenberg_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline font-body"
                >
                  <Globe size={12} />
                  View on Project Gutenberg (ID: {book.gutenberg_id})
                </a>
              )}
            </CardBody>
          </Card>

          {/* AI training value */}
          <Card>
            <CardHeader title="AI Training Value" />
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {book.pre_llm_era === true ? (
                    <div className="flex items-center gap-1.5 text-sm font-body text-success">
                      <CheckCircle2 size={15} />
                      Pre-LLM era (pre-2022) — clean training data
                    </div>
                  ) : book.pre_llm_era === false ? (
                    <div className="flex items-center gap-1.5 text-sm font-body text-warning">
                      <AlertCircle size={15} />
                      Post-2022 — potential AI contamination
                    </div>
                  ) : (
                    <p className="text-sm font-body text-ink-muted">Pre-LLM status unknown</p>
                  )}
                </div>
                {book.ai_value_factors.length > 0 && (
                  <ValueFactors factors={book.ai_value_factors} />
                )}
              </div>
            </CardBody>
          </Card>

          {/* Provenance timeline */}
          <ProvenanceTimeline book={book} />
        </main>

        {/* ── Sidebar column ── */}
        <aside className="space-y-6 min-w-0">
          {/* Triage info */}
          <TriageInfo
            book={book}
            onRerun={handleRerun}
            rerunning={rerunning}
            onOverride={handleOverride}
          />

          {/* Scan status */}
          <ScanStatusTracker
            book={book}
            onAdvance={handleAdvance}
            advancing={advancing}
          />

          {/* Sale status */}
          <SaleStatusCard book={book} onUpdate={handleSaleUpdate} />

          {/* Quick actions */}
          <Card>
            <CardTitle className="mb-4">Quick Actions</CardTitle>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={<Pencil size={14} />}
                onClick={openEdit}
              >
                Edit Book
              </Button>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={<Download size={14} />}
                onClick={handleExport}
              >
                Export Record
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                icon={<Trash2 size={14} />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete Book
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Book"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSubmit(onEdit)}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onEdit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Title *"
            error={errors.title?.message}
            {...register('title')}
            className="sm:col-span-2"
          />
          <Input
            label="Author *"
            error={errors.author_name?.message}
            {...register('author_name')}
          />
          <Input label="ISBN" mono {...register('isbn')} />
          <Input label="Publisher" {...register('publisher')} />
          <Input
            label="Publish Year"
            type="number"
            error={errors.publish_year?.message}
            {...register('publish_year')}
          />
          <Input
            label="Page Count"
            type="number"
            error={errors.page_count?.message}
            {...register('page_count')}
          />
          <Input label="Language" {...register('language')} />
          <Select label="Condition" options={CONDITION_OPTIONS} {...register('condition')} />
          <Input
            label="Acquisition Cost (£)"
            type="number"
            step="0.01"
            error={errors.acquisition_cost?.message}
            {...register('acquisition_cost')}
          />
          <Input label="Acquisition Source" {...register('acquisition_source')} />
          <Input
            label="Physical Location"
            placeholder="e.g. Shelf B3"
            {...register('physical_location')}
            className="sm:col-span-2"
          />
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Book"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete Permanently
            </Button>
          </>
        }
      >
        <p className="text-sm font-body text-ink-body">
          Are you sure you want to delete{' '}
          <strong className="font-semibold">&ldquo;{book.title}&rdquo;</strong>? This action
          cannot be undone and will remove all associated scan data and sales records.
        </p>
      </Modal>
    </PageContainer>
  );
}
