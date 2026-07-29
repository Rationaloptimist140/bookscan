/**
 * useStats — SWR hooks for dashboard statistics and analytics
 */
'use client';

import useSWR from 'swr';
import { endpoints } from '@/lib/api';
import type {
  ActivityEntry,
  RevenueSummary,
  StatsSummary,
  TriageDistributionSlice,
} from '@/lib/types';

// ── Summary stats ─────────────────────────────────────────────────────────────

interface UseStatsReturn {
  stats: StatsSummary | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useStats(): UseStatsReturn {
  const { data, error, isLoading } = useSWR<StatsSummary>(endpoints.stats.summary());
  return { stats: data, isLoading, error };
}

// ── Revenue summary ────────────────────────────────────────────────────────────

interface UseRevenueSummaryReturn {
  summary: RevenueSummary | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useRevenueSummary(): UseRevenueSummaryReturn {
  const { data, error, isLoading } = useSWR<RevenueSummary>(endpoints.stats.revenueSummary());
  return { summary: data, isLoading, error };
}

// ── Activity feed ──────────────────────────────────────────────────────────────

interface UseActivityReturn {
  activity: ActivityEntry[];
  isLoading: boolean;
  error: Error | undefined;
}

export function useActivity(limit = 10): UseActivityReturn {
  const { data, error, isLoading } = useSWR<ActivityEntry[]>(endpoints.stats.activity(limit));
  return { activity: data ?? [], isLoading, error };
}

// ── Triage distribution ────────────────────────────────────────────────────────

interface UseTriageDistributionReturn {
  distribution: TriageDistributionSlice[];
  isLoading: boolean;
  error: Error | undefined;
}

export function useTriageDistribution(): UseTriageDistributionReturn {
  const { data, error, isLoading } = useSWR<TriageDistributionSlice[]>(
    endpoints.stats.triageDistribution(),
  );
  return { distribution: data ?? [], isLoading, error };
}
