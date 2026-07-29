/**
 * useSales — SWR hooks for Sale CRUD
 */
'use client';

import useSWR from 'swr';
import { toast } from 'sonner';
import {
  apiDelete,
  apiPatch,
  apiPost,
  endpoints,
  type Paginated,
  type Sale,
  type SaleCreatePayload,
  type SaleQuery,
  type SaleUpdatePayload,
} from '@/lib/api';

// ── List hook ──────────────────────────────────────────────────────────────────

interface UseSalesReturn {
  sales: Sale[];
  total: number;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useSales(query?: SaleQuery): UseSalesReturn {
  const key = endpoints.sales.list(query);
  const { data, error, isLoading, mutate } = useSWR<Paginated<Sale>>(key);

  return {
    sales: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Single sale hook ───────────────────────────────────────────────────────────

interface UseSaleReturn {
  sale: Sale | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useSale(id: string | null): UseSaleReturn {
  const key = id ? endpoints.sales.get(id) : null;
  const { data, error, isLoading, mutate } = useSWR<Sale>(key);

  return {
    sale: data,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Mutators ──────────────────────────────────────────────────────────────────

export async function createSale(
  payload: SaleCreatePayload,
  mutateList?: () => void,
): Promise<Sale | null> {
  try {
    const sale = await apiPost<Sale>(endpoints.sales.create(), payload);
    toast.success('Sale record created.');
    mutateList?.();
    return sale;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create sale.');
    return null;
  }
}

export async function updateSale(
  id: string,
  payload: SaleUpdatePayload,
  mutateSale?: () => void,
  mutateList?: () => void,
): Promise<Sale | null> {
  try {
    const sale = await apiPatch<Sale>(endpoints.sales.update(id), payload);
    toast.success('Sale updated.');
    mutateSale?.();
    mutateList?.();
    return sale;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to update sale.');
    return null;
  }
}

export async function deleteSale(
  id: string,
  mutateList?: () => void,
): Promise<boolean> {
  try {
    await apiDelete(endpoints.sales.delete(id));
    toast.success('Sale record deleted.');
    mutateList?.();
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to delete sale.');
    return false;
  }
}
