'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseIsbnList } from '@/lib/utils';
import { scoreColour } from '@/lib/constants';
import { TRIAGE_ACTION_STYLES } from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import { TriageActionBadge } from '@/components/ui/Badge';
import { successToast, errorToast } from '@/components/ui/Toast';
import { useBulkTriage } from '@/lib/hooks/useTriage';
import { createBook } from '@/lib/hooks/useBooks';
import type { Column } from '@/components/ui/Table';
import type { BulkTriageResultRow } from '@/lib/types';

export interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onSavedAll?: (count: number) => void;
}

/**
 * Modal for pasting multiple ISBNs (one per line), triaging them in bulk,
 * and saving all successful results to inventory.
 */
export function BulkImportModal({ open, onClose, onSavedAll }: BulkImportModalProps) {
  const [raw, setRaw] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const { rows, isLoading, progress, runBulk, reset } = useBulkTriage();

  const parsed = React.useMemo(() => parseIsbnList(raw), [raw]);
  const hasRun = rows.length > 0;
  const successRows = rows.filter((r) => r.ok && r.result !== null);
  const failRows = rows.filter((r) => !r.ok);

  function handleClose() {
    if (isLoading) return;
    reset();
    setRaw('');
    onClose();
  }

  async function handleRun() {
    if (parsed.valid.length === 0) return;
    await runBulk(parsed.valid);
  }

  async function handleSaveAll() {
    if (successRows.length === 0) return;
    setSaving(true);
    let saved = 0;

    for (const row of successRows) {
      if (!row.result) continue;
      const book = await createBook({
        isbn: row.isbn,
        title: row.result.title,
        subtitle: row.result.subtitle ?? undefined,
        author_name: row.result.author_name,
        author_birth_year: row.result.author_birth_year ?? undefined,
        author_death_year: row.result.author_death_year ?? undefined,
        publisher: row.result.publisher ?? undefined,
        publish_year: row.result.publish_year ?? undefined,
        language: row.result.language,
        page_count: row.result.page_count ?? undefined,
        subject_keywords: row.result.subject_keywords,
        description: row.result.description ?? undefined,
        public_domain_status: row.result.public_domain_status,
        public_domain_reason: row.result.public_domain_reason,
        gutenberg_id: row.result.gutenberg_id ?? undefined,
        gutenberg_url: row.result.gutenberg_url ?? undefined,
        openlibrary_id: row.result.openlibrary_id ?? undefined,
        openlibrary_url: row.result.openlibrary_url ?? undefined,
        already_digitised: row.result.already_digitised,
        ai_training_value: row.result.ai_training_value,
        ai_value_factors: row.result.ai_value_factors,
        pre_llm_era: row.result.pre_llm_era ?? undefined,
        triage_action: row.result.triage_action,
        triage_score: row.result.triage_score,
        triage_notes: row.result.triage_notes ?? undefined,
      });
      if (book) saved++;
    }

    setSaving(false);

    if (saved > 0) {
      successToast(
        `${saved} book${saved !== 1 ? 's' : ''} saved to inventory`,
        'All successful results have been added.',
      );
      onSavedAll?.(saved);
      handleClose();
    } else {
      errorToast('No books were saved', 'Please try again.');
    }
  }

  const columns: Column<BulkTriageResultRow>[] = [
    {
      key: 'isbn',
      header: 'ISBN',
      render: (row) => (
        <span className="font-mono text-[13px] text-ink-body">{row.isbn}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="text-sm text-ink-body">
          {row.result?.title ?? <span className="text-ink-muted italic">—</span>}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      align: 'center' as const,
      render: (row) =>
        row.result ? (
          <span
            className="font-mono font-semibold text-sm"
            style={{ color: scoreColour(row.result.triage_score) }}
          >
            {row.result.triage_score}
          </span>
        ) : (
          <span className="text-ink-muted text-sm">—</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) =>
        row.result ? (
          <TriageActionBadge action={row.result.triage_action} size="sm" />
        ) : row.error ? (
          <span className="inline-flex items-center gap-1 text-danger text-xs font-body">
            <XCircle size={13} aria-hidden="true" />
            {row.error}
          </span>
        ) : (
          <span className="text-ink-muted text-sm">—</span>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk ISBN Import"
      description="Paste ISBNs one per line (or comma/space separated). Duplicates are removed automatically."
      size="lg"
      closeOnBackdrop={!isLoading}
    >
      <div className="flex flex-col gap-5">
        {!hasRun && (
          <>
            <Textarea
              label="ISBNs"
              placeholder={'0140434259\n9780140434255\n0670813820'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              mono
              rows={8}
              disabled={isLoading}
              aria-label="Paste ISBNs here"
            />

            {/* Live parse counts */}
            {raw.trim().length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm font-body">
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {parsed.valid.length} valid ISBN{parsed.valid.length !== 1 ? 's' : ''}
                </span>
                {parsed.invalid.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-danger">
                    <XCircle size={14} aria-hidden="true" />
                    {parsed.invalid.length} invalid (will be skipped)
                  </span>
                )}
              </div>
            )}

            {parsed.valid.length === 0 && raw.trim().length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-danger-bg border border-danger/20 text-danger text-sm font-body">
                <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
                No valid ISBNs found. Please check your input.
              </div>
            )}
          </>
        )}

        {/* Progress bar during run */}
        {isLoading && (
          <div className="flex flex-col gap-2">
            <ProgressBar
              value={progress}
              max={100}
              label="Triaging ISBNs…"
              showValue
            />
            <p className="text-sm text-ink-muted font-body">
              Processing {parsed.valid.length} ISBN{parsed.valid.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Results table */}
        {hasRun && !isLoading && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm font-body">
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle2 size={14} aria-hidden="true" />
                {successRows.length} succeeded
              </span>
              {failRows.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-danger">
                  <XCircle size={14} aria-hidden="true" />
                  {failRows.length} failed
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title="No results"
                message="All ISBNs failed to triage. Please check your input and try again."
              />
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-rule">
                <Table
                  columns={columns}
                  rows={rows}
                  rowKey={(row) => row.isbn}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading || saving}>
            {hasRun ? 'Close' : 'Cancel'}
          </Button>

          {!hasRun && (
            <Button
              variant="primary"
              loading={isLoading}
              disabled={parsed.valid.length === 0}
              onClick={handleRun}
            >
              Run Triage ({parsed.valid.length})
            </Button>
          )}

          {hasRun && !isLoading && successRows.length > 0 && (
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSaveAll}
            >
              Save All ({successRows.length})
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
