/**
 * useBooks — SWR hooks for Book CRUD
 */
'use client';

import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  endpoints,
  type Book,
  type BookCreatePayload,
  type BookQuery,
  type BookUpdatePayload,
  type Paginated,
  type ResaleRecommendation,
  type TriageResult,
} from '@/lib/api';

// ── List hook ──────────────────────────────────────────────────────────────────

interface UseBooksReturn {
  books: Book[];
  total: number;
  page: number;
  pages: number;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useBooks(query: BookQuery = {}): UseBooksReturn {
  const key = endpoints.books.list(query);
  const { data, error, isLoading, mutate } = useSWR<Paginated<Book>>(key);

  return {
    books: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pages: data?.pages ?? 1,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Single book hook ───────────────────────────────────────────────────────────

interface UseBookReturn {
  book: Book | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useBook(id: string | null): UseBookReturn {
  const key = id ? endpoints.books.get(id) : null;
  const { data, error, isLoading, mutate } = useSWR<Book>(key);

  return {
    book: data,
    isLoading,
    error,
    mutate: () => { void mutate(); },
  };
}

// ── Resale recommendation hook ────────────────────────────────────────────────

interface UseResaleRecommendationReturn {
  recommendation: ResaleRecommendation | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useResaleRecommendation(bookId: string | null): UseResaleRecommendationReturn {
  const key = bookId ? endpoints.books.resale(bookId) : null;
  const { data, error, isLoading } = useSWR<ResaleRecommendation>(key);

  return { recommendation: data, isLoading, error };
}

// ── Mutators ──────────────────────────────────────────────────────────────────

/** Create a book and revalidate the list cache. */
export async function createBook(
  payload: BookCreatePayload,
  onSuccess?: (book: Book) => void,
): Promise<Book | null> {
  try {
    const book = await apiPost<Book>(endpoints.books.create(), payload);
    toast.success(`"${book.title}" added to inventory.`);
    onSuccess?.(book);
    return book;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create book.');
    return null;
  }
}

/** Partial-update a book and revalidate. */
export async function updateBook(
  id: string,
  payload: BookUpdatePayload,
  mutateBook?: () => void,
  mutateList?: () => void,
): Promise<Book | null> {
  try {
    const book = await apiPatch<Book>(endpoints.books.update(id), payload);
    mutateBook?.();
    mutateList?.();
    return book;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to update book.');
    return null;
  }
}

/** Delete a book and revalidate the list. */
export async function deleteBook(
  id: string,
  title: string,
  mutateList?: () => void,
): Promise<boolean> {
  try {
    await apiDelete(endpoints.books.delete(id));
    toast.success(`"${title}" deleted.`);
    mutateList?.();
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to delete book.');
    return false;
  }
}

/** Re-run triage on a book. */
export async function rerunTriage(
  id: string,
  mutateBook?: () => void,
): Promise<TriageResult | null> {
  try {
    const result = await apiPost<TriageResult>(endpoints.books.rerunTriage(id));
    toast.success('Triage re-run complete.');
    mutateBook?.();
    return result;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to re-run triage.');
    return null;
  }
}

// ── Global mutator convenience (for use outside SWR component tree) ──────────

export function useBooksInvalidator() {
  const { mutate } = useSWRConfig();
  return {
    invalidateAll: () => {
      void mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/books'), undefined, { revalidate: true });
    },
  };
}
