'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, AlertTriangle } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { IsbnInput } from '@/components/triage/IsbnInput';
import { TriageResult } from '@/components/triage/TriageResult';
import { BulkImportModal } from '@/components/triage/BulkImportModal';
import { useTriage } from '@/lib/hooks/useTriage';
import type { Book, TriageRequest } from '@/lib/types';

export default function TriagePage() {
  const router = useRouter();
  const { result, isLoading, error, runTriage, reset } = useTriage();
  const [bulkOpen, setBulkOpen] = useState(false);

  async function handleTriage(req: TriageRequest) {
    await runTriage(req);
  }

  function handleSaved(_book: Book) {
    // result saved — inventory will be updated
  }

  function handleScan() {
    if (result) {
      // If there is an existing saved book id in the result we could use it,
      // but TriageResult handles the routing from the saved book via onScan.
      router.push('/scan');
    }
  }

  return (
    <PageContainer max="md">
      {/* Page header */}
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-semibold text-ink mb-2">
          Book Triage
        </h1>
        <p className="text-ink-muted font-body text-base max-w-md mx-auto">
          Enter an ISBN to instantly assess public domain status, AI training value,
          and the best platform to resell the physical book.
        </p>
      </div>

      {/* ISBN input */}
      <div className="mb-6">
        <IsbnInput
          onTriage={handleTriage}
          loading={isLoading}
          onBulkClick={() => setBulkOpen(true)}
        />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <section aria-label="Loading triage result" aria-busy="true">
          <SkeletonCard className="mb-4" />
          <SkeletonCard />
        </section>
      )}

      {/* Inline error card */}
      {error && !isLoading && (
        <Card className="border-danger/40 bg-danger-bg mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-danger font-body text-sm">Triage failed</p>
              <p className="text-sm font-body text-ink-body mt-1">{error}</p>
              <button
                onClick={reset}
                className="mt-3 text-sm text-primary underline-offset-2 hover:underline font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
              >
                Try again
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Triage result */}
      {result && !isLoading && (
        <section aria-label="Triage result">
          <TriageResult
            result={result}
            onSaved={handleSaved}
            onScan={handleScan}
          />
        </section>
      )}

      {/* Empty state — shown before any triage, and no error */}
      {!result && !isLoading && !error && (
        <section
          aria-label="Triage empty state"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary-bg flex items-center justify-center mb-5">
            <BookOpen size={40} className="text-primary" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl font-semibold text-ink mb-2">
            Enter an ISBN to start triaging books
          </h2>
          <p className="text-sm font-body text-ink-muted max-w-xs leading-relaxed">
            Checks: public domain · Gutenberg · AI training value · resale platform
          </p>
          <p className="mt-6 text-xs font-body text-ink-light">
            Have a list of ISBNs?{' '}
            <button
              onClick={() => setBulkOpen(true)}
              className="text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
            >
              Use Bulk Import
            </button>
          </p>
        </section>
      )}

      {/* Bulk import modal */}
      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSavedAll={(_count) => {
          setBulkOpen(false);
          router.push('/inventory');
        }}
      />
    </PageContainer>
  );
}
