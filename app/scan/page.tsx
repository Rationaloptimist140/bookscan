'use client';

import React, { Suspense, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Image as ImageIcon,
  FileText,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useBooks } from '@/lib/hooks/useBooks';
import { createDataset } from '@/lib/hooks/useDatasets';
import { SCAN_METHOD_OPTIONS } from '@/lib/constants';
import type { Book, Dataset } from '@/lib/types';
import { cn, sleep } from '@/lib/utils';
import { successToast } from '@/components/ui/Toast';
import { IS_MOCK_MODE } from '@/lib/api';

// ── Step type ────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Select Book',
  2: 'Scan Setup',
  3: 'Upload Pages',
  4: 'OCR Review',
  5: 'Finalise',
};

// ── Mock OCR helper ──────────────────────────────────────────────────────────

function mockOcrText(fileName: string): string {
  return `[Extracted text from ${fileName}]\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
}

// ── Page file upload item ────────────────────────────────────────────────────

interface PageFile {
  id: string;
  file: File;
  preview: string;
  ocrText: string;
  confidence: number;
  reviewed: boolean;
}

// ── Inner component ──────────────────────────────────────────────────────────

function ScanInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedBookId = searchParams.get('book');

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookSearch, setBookSearch] = useState('');
  const [scanMethod, setScanMethod] = useState('phone_camera');
  const [estimatedPages, setEstimatedPages] = useState('');
  const [pages, setPages] = useState<PageFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [currentOcrPage, setCurrentOcrPage] = useState(0);
  const [savedDataset, setSavedDataset] = useState<Dataset | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { books, isLoading: booksLoading } = useBooks({
    search: bookSearch || undefined,
    limit: 20,
  });

  // Preselect book from query param
  const preselectedApplied = useRef(false);
  React.useEffect(() => {
    if (preselectedBookId && books.length > 0 && !preselectedApplied.current) {
      const found = books.find((b) => b.id === preselectedBookId);
      if (found) {
        setSelectedBook(found);
        preselectedApplied.current = true;
      }
    }
  }, [preselectedBookId, books]);

  // ── Step navigation guards ─────────────────────────────────────────────────

  function canProceed(): boolean {
    if (step === 1) return selectedBook !== null;
    if (step === 2) return scanMethod !== '';
    if (step === 3) return pages.length > 0;
    if (step === 4) return pages.every((p) => p.reviewed);
    return true;
  }

  async function goNext() {
    if (!canProceed()) return;
    if (step === 3) {
      await runOcr();
    }
    setStep((s) => Math.min(s + 1, 5) as WizardStep);
  }

  function goPrev() {
    setStep((s) => Math.max(s - 1, 1) as WizardStep);
  }

  // ── File upload ───────────────────────────────────────────────────────────

  function processFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const newPages: PageFile[] = fileArr.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      ocrText: '',
      confidence: 0,
      reviewed: false,
    }));
    setPages((prev) => [...prev, ...newPages]);
  }

  function removePage(id: string) {
    setPages((prev) => {
      const p = prev.find((pg) => pg.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((pg) => pg.id !== id);
    });
  }

  function movePageUp(index: number) {
    if (index === 0) return;
    setPages((prev) => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index]!, arr[index - 1]!];
      return arr;
    });
  }

  function movePageDown(index: number) {
    setPages((prev) => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1]!, arr[index]!];
      return arr;
    });
  }

  // ── OCR simulation ────────────────────────────────────────────────────────

  async function runOcr() {
    if (!IS_MOCK_MODE) return; // Real OCR handled by backend

    setProcessingOcr(true);
    setOcrProgress(0);
    setCurrentOcrPage(0);

    for (let i = 0; i < pages.length; i++) {
      setCurrentOcrPage(i + 1);
      await sleep(600);
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === i
            ? {
                ...p,
                ocrText: mockOcrText(p.file.name),
                confidence: Math.round(75 + Math.random() * 22),
              }
            : p,
        ),
      );
      setOcrProgress(Math.round(((i + 1) / pages.length) * 100));
    }

    setProcessingOcr(false);
    setOcrProgress(100);
  }

  function updateOcrText(id: string, text: string) {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ocrText: text, reviewed: true } : p)),
    );
  }

  function approveAll() {
    setPages((prev) => prev.map((p) => ({ ...p, reviewed: true })));
  }

  // ── Save dataset ──────────────────────────────────────────────────────────

  async function handleSaveDataset() {
    if (!selectedBook) return;
    setSaving(true);
    const ds = await createDataset({
      book_id: selectedBook.id,
      title: selectedBook.title,
      description: `Scanned text of "${selectedBook.title}" by ${selectedBook.author_name}`,
      domain_tags: selectedBook.subject_keywords.slice(0, 3),
      language: selectedBook.language,
    });
    setSaving(false);
    if (ds) {
      setSavedDataset(ds);
      successToast(`Dataset "${ds.title}" created and ready for listing.`);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const fullText = pages.map((p) => p.ocrText).filter(Boolean).join('\n\n---\n\n');

  return (
    <PageContainer max="lg">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-semibold text-ink mb-1">Scan Workflow</h1>
        <p className="text-sm font-body text-ink-muted">
          Step {step} of 5 — {STEP_LABELS[step]}
        </p>
      </div>

      {/* Step indicator */}
      <nav aria-label="Scan steps" className="mb-8">
        <ol className="flex items-center justify-center gap-0">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((s, i) => {
            const isDone = step > s;
            const isCurrent = step === s;
            return (
              <li key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold font-body transition-all',
                      isDone
                        ? 'bg-primary text-ink-inverse'
                        : isCurrent
                        ? 'bg-primary text-ink-inverse ring-4 ring-primary/20'
                        : 'bg-canvas-alt text-ink-muted border border-rule',
                    )}
                  >
                    {isDone ? <Check size={16} /> : s}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-body uppercase tracking-wide hidden sm:block',
                      isCurrent ? 'text-primary font-semibold' : 'text-ink-muted',
                    )}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < 4 && (
                  <div
                    className={cn(
                      'h-px w-8 sm:w-16 mx-1 -mt-4',
                      step > s ? 'bg-primary' : 'bg-rule',
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <Card padded className="mb-6">
        {/* Step 1: Select Book */}
        {step === 1 && (
          <section aria-label="Select a book">
            <CardTitle className="mb-4">Select a Book to Scan</CardTitle>
            <Input
              placeholder="Search by title, author or ISBN…"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              className="mb-4"
              aria-label="Search books"
            />
            {booksLoading ? (
              <SkeletonCard />
            ) : books.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={32} className="text-ink-muted" />}
                title="No books found"
                message="Try a different search term or add books to your inventory first."
                action={
                  <Link href="/inventory">
                    <Button variant="ghost" size="sm">Go to Inventory</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      selectedBook?.id === book.id
                        ? 'border-primary bg-primary-bg'
                        : 'border-rule hover:bg-surface-hover',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium font-heading text-ink text-sm">{book.title}</p>
                        <p className="text-xs font-body text-ink-muted mt-0.5">
                          {book.author_name}
                          {book.publish_year ? ` · ${book.publish_year}` : ''}
                          {book.isbn ? ` · ${book.isbn}` : ''}
                        </p>
                      </div>
                      {selectedBook?.id === book.id && (
                        <CheckCircle2 size={18} className="text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 2: Scan Setup */}
        {step === 2 && selectedBook && (
          <section aria-label="Scan setup">
            <CardTitle className="mb-4">Scan Setup</CardTitle>
            <p className="text-sm font-body text-ink-muted mb-6">
              Scanning: <strong className="text-ink">{selectedBook.title}</strong>
            </p>
            <div className="space-y-4 max-w-sm">
              <Select
                label="Scan Method"
                options={SCAN_METHOD_OPTIONS}
                value={scanMethod}
                onChange={(e) => setScanMethod(e.target.value)}
              />
              <Input
                label="Estimated Page Count"
                type="number"
                placeholder={selectedBook.page_count?.toString() ?? 'e.g. 250'}
                value={estimatedPages}
                onChange={(e) => setEstimatedPages(e.target.value)}
                hint="Approximate number of pages to scan"
              />
            </div>
          </section>
        )}

        {/* Step 3: Upload Pages */}
        {step === 3 && (
          <section aria-label="Upload page images">
            <CardTitle className="mb-4">Upload Page Images</CardTitle>

            {/* Drag-and-drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop images here or click to browse"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={cn(
                'border-2 border-dashed rounded-lg p-10 text-center transition-all duration-150 cursor-pointer',
                dragOver
                  ? 'border-primary bg-primary-bg'
                  : 'border-rule hover:border-primary/50 hover:bg-canvas-alt',
              )}
            >
              <Upload size={32} className="mx-auto mb-3 text-ink-muted" />
              <p className="font-body text-sm text-ink-body font-medium mb-1">
                Drop page images here
              </p>
              <p className="font-body text-xs text-ink-muted">
                or click to browse — JPG, PNG, TIFF supported
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label="Upload page images"
              onChange={(e) => { if (e.target.files) processFiles(e.target.files); }}
            />

            {/* Thumbnail grid */}
            {pages.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-body font-medium text-ink-body mb-3">
                  {pages.length} page{pages.length > 1 ? 's' : ''} queued
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {pages.map((page, index) => (
                    <div
                      key={page.id}
                      className="relative group rounded-lg overflow-hidden border border-rule bg-canvas-alt"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.preview}
                        alt={`Page ${index + 1}`}
                        className="w-full h-28 object-cover"
                      />
                      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-all duration-150" />
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                          aria-label={`Remove page ${index + 1}`}
                          className="p-1 rounded bg-danger text-white hover:bg-danger/80"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-ink/60 px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] text-white font-mono">P{index + 1}</span>
                        <div className="flex gap-1">
                          {index > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); movePageUp(index); }}
                              aria-label={`Move page ${index + 1} up`}
                              className="text-white/80 hover:text-white text-[10px]"
                            >↑</button>
                          )}
                          {index < pages.length - 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); movePageDown(index); }}
                              aria-label={`Move page ${index + 1} down`}
                              className="text-white/80 hover:text-white text-[10px]"
                            >↓</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 4: OCR Review */}
        {step === 4 && (
          <section aria-label="OCR review">
            <div className="flex items-center justify-between mb-4">
              <CardTitle>OCR Review</CardTitle>
              <Button variant="ghost" size="sm" onClick={approveAll}>
                Approve All
              </Button>
            </div>

            {processingOcr ? (
              <div className="py-12 flex flex-col items-center gap-4">
                <Spinner size={36} label="Processing OCR…" />
                <p className="text-sm font-body text-ink-muted">
                  Processing page {currentOcrPage} of {pages.length}…
                </p>
                <ProgressBar value={ocrProgress} className="w-64" />
              </div>
            ) : (
              <div className="space-y-6">
                {pages.map((page, index) => (
                  <div
                    key={page.id}
                    className={cn(
                      'border rounded-lg overflow-hidden',
                      page.reviewed ? 'border-success/40 bg-success-bg/20' : 'border-rule',
                    )}
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-canvas-alt border-b border-rule">
                      <span className="text-sm font-medium font-body text-ink-body">
                        Page {index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        {page.confidence > 0 && (
                          <span
                            className={cn(
                              'text-xs font-mono',
                              page.confidence >= 85
                                ? 'text-success'
                                : page.confidence >= 70
                                ? 'text-warning'
                                : 'text-danger',
                            )}
                          >
                            {page.confidence}% confidence
                          </span>
                        )}
                        {page.reviewed && (
                          <CheckCircle2 size={14} className="text-success" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-rule">
                      {/* Image */}
                      <div className="p-3 bg-canvas-alt/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.preview}
                          alt={`Scan of page ${index + 1}`}
                          className="w-full rounded object-contain max-h-64"
                        />
                      </div>
                      {/* Editable text */}
                      <div className="p-3">
                        <textarea
                          value={page.ocrText}
                          onChange={(e) => updateOcrText(page.id, e.target.value)}
                          aria-label={`OCR text for page ${index + 1}`}
                          className={cn(
                            'w-full h-64 resize-none font-mono text-xs p-2 rounded border border-rule',
                            'bg-surface text-ink-body focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10',
                          )}
                          placeholder="OCR text will appear here…"
                        />
                        <button
                          onClick={() => updateOcrText(page.id, page.ocrText)}
                          className="mt-2 text-xs text-primary hover:underline font-body"
                        >
                          Mark as reviewed
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 5: Finalise */}
        {step === 5 && (
          <section aria-label="Finalise and save dataset">
            {savedDataset ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-success" />
                </div>
                <h2 className="font-heading text-xl font-semibold text-ink mb-2">
                  Dataset saved!
                </h2>
                <p className="text-sm font-body text-ink-muted mb-6">
                  &ldquo;{savedDataset.title}&rdquo; is ready to be listed for sale.
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  <Link href="/datasets">
                    <Button variant="outline" size="sm">View Datasets</Button>
                  </Link>
                  <Link href={`/datasets/${savedDataset.id}`}>
                    <Button variant="primary" size="sm">Manage This Dataset</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <CardTitle className="mb-4">Finalise</CardTitle>
                {selectedBook && (
                  <div className="mb-4 p-4 bg-canvas-alt rounded-lg text-sm font-body">
                    <p><span className="text-ink-muted">Book:</span> <strong className="text-ink">{selectedBook.title}</strong></p>
                    <p className="mt-1"><span className="text-ink-muted">Author:</span> {selectedBook.author_name}</p>
                    {selectedBook.publish_year && (
                      <p className="mt-1"><span className="text-ink-muted">Year:</span> {selectedBook.publish_year}</p>
                    )}
                    <p className="mt-1"><span className="text-ink-muted">Pages scanned:</span> {pages.length}</p>
                    <p className="mt-1"><span className="text-ink-muted">Total words (approx):</span>{' '}
                      {fullText.split(/\s+/).filter(Boolean).length.toLocaleString('en-GB')}
                    </p>
                  </div>
                )}

                {/* Text preview */}
                {fullText && (
                  <div className="mb-6">
                    <p className="text-sm font-medium font-body text-ink-body mb-2 flex items-center gap-1.5">
                      <FileText size={14} />
                      Text preview (first 400 words)
                    </p>
                    <div className="bg-canvas-alt rounded-lg p-4 max-h-48 overflow-y-auto">
                      <p className="text-xs font-mono text-ink-body leading-relaxed whitespace-pre-wrap">
                        {fullText.split(/\s+/).slice(0, 400).join(' ')}
                        {fullText.split(/\s+/).length > 400 ? '…' : ''}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={saving}
                  onClick={handleSaveDataset}
                  icon={<CheckCircle2 size={16} />}
                >
                  Save Dataset
                </Button>
              </>
            )}
          </section>
        )}
      </Card>

      {/* Navigation buttons */}
      {!savedDataset && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            icon={<ChevronLeft size={15} />}
            onClick={goPrev}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 5 && (
            <Button
              variant="primary"
              size="sm"
              iconRight={<ChevronRight size={15} />}
              onClick={goNext}
              disabled={!canProceed()}
              loading={processingOcr}
            >
              {step === 3 ? 'Process OCR & Continue' : 'Continue'}
            </Button>
          )}
        </div>
      )}
    </PageContainer>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <PageContainer max="lg">
          <SkeletonCard />
        </PageContainer>
      }
    >
      <ScanInner />
    </Suspense>
  );
}
