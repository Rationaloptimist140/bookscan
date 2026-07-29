/**
 * useTriage — SWR / state hooks for the triage workflow
 */
'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  apiPost,
  endpoints,
  type BulkTriageResultRow,
  type TriageHistoryEntry,
  type TriageRequest,
  type TriageResult,
} from '@/lib/api';

// ── Single triage ─────────────────────────────────────────────────────────────

interface UseTriageReturn {
  result: TriageResult | null;
  isLoading: boolean;
  error: string | null;
  runTriage: (req: TriageRequest) => Promise<void>;
  reset: () => void;
}

export function useTriage(): UseTriageReturn {
  const [result, setResult] = useState<TriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTriage = useCallback(async (req: TriageRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiPost<TriageResult>(endpoints.triage.run(), req);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Triage failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { result, isLoading, error, runTriage, reset };
}

// ── Bulk triage ────────────────────────────────────────────────────────────────

interface BulkTriageRow extends BulkTriageResultRow {
  isbn: string;
}

interface UseBulkTriageReturn {
  rows: BulkTriageRow[];
  isLoading: boolean;
  progress: number; // 0–100
  runBulk: (isbns: string[]) => Promise<void>;
  reset: () => void;
}

export function useBulkTriage(): UseBulkTriageReturn {
  const [rows, setRows] = useState<BulkTriageRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const runBulk = useCallback(async (isbns: string[]) => {
    if (isbns.length === 0) return;

    setIsLoading(true);
    setProgress(0);
    setRows([]);

    // Process in batches of 5 to show incremental progress.
    const batchSize = 5;
    const allRows: BulkTriageRow[] = [];

    for (let i = 0; i < isbns.length; i += batchSize) {
      const batch = isbns.slice(i, i + batchSize);
      try {
        const batchResult = await apiPost<BulkTriageResultRow[]>(endpoints.triage.bulk(), {
          isbns: batch,
        });
        allRows.push(...(batchResult as BulkTriageRow[]));
        setRows([...allRows]);
        setProgress(Math.round(((i + batch.length) / isbns.length) * 100));
      } catch (err) {
        const errorRows: BulkTriageRow[] = batch.map((isbn) => ({
          isbn,
          ok: false,
          error: err instanceof Error ? err.message : 'Failed',
          result: null,
        }));
        allRows.push(...errorRows);
        setRows([...allRows]);
      }
    }

    setIsLoading(false);
    setProgress(100);
    toast.success(`Bulk triage complete — ${allRows.filter((r) => r.ok).length} of ${isbns.length} succeeded.`);
  }, []);

  const reset = useCallback(() => {
    setRows([]);
    setIsLoading(false);
    setProgress(0);
  }, []);

  return { rows, isLoading, progress, runBulk, reset };
}

// ── Triage history ─────────────────────────────────────────────────────────────

interface UseTriageHistoryReturn {
  history: TriageHistoryEntry[];
  isLoading: boolean;
  error: Error | undefined;
}

export function useTriageHistory(): UseTriageHistoryReturn {
  const { data, error, isLoading } = useSWR<TriageHistoryEntry[]>(endpoints.triage.history());

  return {
    history: data ?? [],
    isLoading,
    error,
  };
}
