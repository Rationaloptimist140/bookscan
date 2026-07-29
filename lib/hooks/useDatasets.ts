/**
 * useDatasets — SWR hooks for Dataset CRUD
 */
'use client';

import useSWR from 'swr';
import { toast } from 'sonner';
import {
  apiDelete,
  apiPatch,
  apiPost,
  endpoints,
  type Dataset,
  type DatasetCreatePayload,
  type DatasetQuery,
  type DatasetUpdatePayload,
  type Paginated,
} from '@/lib/api';

// ── List hook ──────────────────────────────────────────────────────────────────

interface UseDatasetsReturn {
  datasets: Dataset[];
  total: number;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useDatasets(query?: DatasetQuery): UseDatasetsReturn {
  const key = endpoints.datasets.list(query);
  const { data, error, isLoading, mutate } = useSWR<Paginated<Dataset>>(key);

  return {
    datasets: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Single dataset hook ────────────────────────────────────────────────────────

interface UseDatasetReturn {
  dataset: Dataset | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useDataset(id: string | null): UseDatasetReturn {
  const key = id ? endpoints.datasets.get(id) : null;
  const { data, error, isLoading, mutate } = useSWR<Dataset>(key);

  return {
    dataset: data,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Dataset preview hook ──────────────────────────────────────────────────────

interface UseDatasetPreviewReturn {
  preview: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useDatasetPreview(id: string | null): UseDatasetPreviewReturn {
  const key = id ? endpoints.datasets.preview(id) : null;
  const { data, error, isLoading } = useSWR<string>(key);

  return { preview: data, isLoading, error };
}

// ── Mutators ──────────────────────────────────────────────────────────────────

export async function createDataset(
  payload: DatasetCreatePayload,
  mutateList?: () => void,
): Promise<Dataset | null> {
  try {
    const ds = await apiPost<Dataset>(endpoints.datasets.create(), payload);
    toast.success(`Dataset "${ds.title}" created.`);
    mutateList?.();
    return ds;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create dataset.');
    return null;
  }
}

export async function updateDataset(
  id: string,
  payload: DatasetUpdatePayload,
  mutateDataset?: () => void,
  mutateList?: () => void,
): Promise<Dataset | null> {
  try {
    const ds = await apiPatch<Dataset>(endpoints.datasets.update(id), payload);
    toast.success('Dataset updated.');
    mutateDataset?.();
    mutateList?.();
    return ds;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to update dataset.');
    return null;
  }
}

export async function deleteDataset(
  id: string,
  title: string,
  mutateList?: () => void,
): Promise<boolean> {
  try {
    await apiDelete(endpoints.datasets.delete(id));
    toast.success(`Dataset "${title}" deleted.`);
    mutateList?.();
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to delete dataset.');
    return false;
  }
}
