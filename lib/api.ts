/**
 * BookScan — API Client
 * =====================
 * Centralised fetch wrapper with mock-mode support.
 *
 * When IS_MOCK_MODE is true every call resolves from lib/mockData.ts
 * after a small artificial delay so every page renders without a backend.
 *
 * All triage calls go to the Next.js proxy route /api/triage (same-origin)
 * rather than directly to the FastAPI backend.
 */

import { sleep } from './utils';
import type {
  Book,
  BookCreatePayload,
  BookQuery,
  BookUpdatePayload,
  BulkTriageRequest,
  BulkTriageResultRow,
  Dataset,
  DatasetCreatePayload,
  DatasetQuery,
  DatasetUpdatePayload,
  Paginated,
  RevenueSummary,
  Sale,
  SaleCreatePayload,
  SaleQuery,
  SaleUpdatePayload,
  ScanStatusResponse,
  StatsSummary,
  TriageRequest,
  TriageResult,
  TriageHistoryEntry,
  ActivityEntry,
  TriageDistributionSlice,
  ResaleRecommendation,
} from './types';

// ── Environment ───────────────────────────────────────────────────────────────

export const API_BASE: string = process.env.NEXT_PUBLIC_API_URL ?? '';

export const IS_MOCK_MODE: boolean =
  process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || API_BASE === '';

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

// ── Mock delay ────────────────────────────────────────────────────────────────

const MOCK_DELAY_MS = 400;

// ── Serialise query params ────────────────────────────────────────────────────

function buildQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      usp.set(key, value.join(','));
    } else {
      usp.set(key, String(value));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// ── Core fetch helpers ────────────────────────────────────────────────────────

async function coreFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Ignore parse errors — use the default detail.
    }
    throw new ApiClientError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Mock resolver ─────────────────────────────────────────────────────────────

// Import lazily so we don't bundle mock data in production builds
// when mock mode is off. Dynamic import returns a module — we cache it.
let mockModule: typeof import('./mockData') | null = null;
async function getMock(): Promise<typeof import('./mockData')> {
  if (!mockModule) {
    mockModule = await import('./mockData');
  }
  return mockModule;
}

async function resolveMock<T>(path: string, options?: RequestInit): Promise<T> {
  await sleep(MOCK_DELAY_MS);
  const m = await getMock();
  return mockDispatch<T>(path, options?.method ?? 'GET', options?.body, m);
}

/** In-memory store for mock mutations within a session. */
const mockStore: {
  books: Book[];
  datasets: Dataset[];
  sales: Sale[];
  initialised: boolean;
} = {
  books: [],
  datasets: [],
  sales: [],
  initialised: false,
};

function ensureMockStore(m: typeof import('./mockData')): void {
  if (!mockStore.initialised) {
    mockStore.books = [...m.MOCK_BOOKS];
    mockStore.datasets = [...m.MOCK_DATASETS];
    mockStore.sales = [...m.MOCK_SALES];
    mockStore.initialised = true;
  }
}

function mockDispatch<T>(
  path: string,
  method: string,
  rawBody: BodyInit | null | undefined,
  m: typeof import('./mockData'),
): T {
  ensureMockStore(m);
  const body = rawBody ? (JSON.parse(rawBody as string) as Record<string, unknown>) : undefined;

  // ── Stats ──────────────────────────────────────────────────────────────────
  if (path === '/api/stats/summary') {
    return m.MOCK_STATS as T;
  }

  if (path === '/api/sales/revenue/summary') {
    return m.MOCK_REVENUE_SUMMARY as T;
  }

  if (path.startsWith('/api/stats/activity')) {
    return m.MOCK_ACTIVITY as T;
  }

  if (path === '/api/stats/triage-distribution') {
    return m.MOCK_TRIAGE_DISTRIBUTION as T;
  }

  // ── Triage ─────────────────────────────────────────────────────────────────
  if (path === '/api/triage' && method === 'POST') {
    const req = body as TriageRequest;
    const isbn = req.isbn ?? '';
    return m.mockTriageResult(isbn) as T;
  }

  if (path === '/api/triage/bulk' && method === 'POST') {
    const req = body as unknown as BulkTriageRequest;
    const rows: BulkTriageResultRow[] = req.isbns.map((isbn) => ({
      isbn,
      ok: true,
      error: null,
      result: m.mockTriageResult(isbn),
    }));
    return rows as T;
  }

  if (path === '/api/triage/history') {
    return m.MOCK_TRIAGE_HISTORY as T;
  }

  // ── Books ──────────────────────────────────────────────────────────────────
  if (path.startsWith('/api/books') && method === 'GET') {
    // Single book
    const singleMatch = path.match(/^\/api\/books\/([^/?]+)$/);
    if (singleMatch) {
      const id = singleMatch[1];
      const book = mockStore.books.find((b) => b.id === id);
      if (!book) throw new ApiClientError(404, 'Book not found');
      return book as T;
    }

    // Resale recommendation
    const resaleMatch = path.match(/^\/api\/books\/([^/?]+)\/resale/);
    if (resaleMatch) {
      const id = resaleMatch[1];
      const book = mockStore.books.find((b) => b.id === id);
      if (!book) throw new ApiClientError(404, 'Book not found');
      const rec: ResaleRecommendation = {
        platform: book.resale_platform ?? 'abebooks',
        platform_label: book.resale_platform ?? 'AbeBooks',
        reason: 'Recommended based on triage assessment.',
        estimated_price_range: '£8–£25',
        listing_tips: ['Include edition details', 'Photograph spine and title page'],
      };
      return rec as T;
    }

    // List books with basic filtering/pagination
    const url = new URL(`http://localhost${path}`);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10);

    let filtered = mockStore.books.filter((b) => {
      if (!search) return true;
      return (
        b.title.toLowerCase().includes(search) ||
        b.author_name.toLowerCase().includes(search) ||
        (b.isbn ?? '').includes(search)
      );
    });

    const pdFilter = url.searchParams.get('public_domain_status');
    if (pdFilter) {
      const vals = pdFilter.split(',');
      filtered = filtered.filter((b) => vals.includes(b.public_domain_status));
    }

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const items = filtered.slice((page - 1) * limit, page * limit);

    return { items, total, page, limit, pages } as T;
  }

  if (path === '/api/books' && method === 'POST') {
    const payload = body as unknown as BookCreatePayload;
    const newBook: Book = {
      id: crypto.randomUUID(),
      isbn: payload.isbn ?? null,
      title: payload.title,
      subtitle: payload.subtitle ?? null,
      author_name: payload.author_name,
      author_birth_year: payload.author_birth_year ?? null,
      author_death_year: payload.author_death_year ?? null,
      publisher: payload.publisher ?? null,
      publish_year: payload.publish_year ?? null,
      publish_date_exact: null,
      language: payload.language ?? 'en',
      page_count: payload.page_count ?? null,
      genre: payload.genre ?? null,
      subject_keywords: payload.subject_keywords ?? [],
      description: payload.description ?? null,
      public_domain_status: payload.public_domain_status ?? 'unknown',
      public_domain_reason: payload.public_domain_reason ?? null,
      public_domain_checked_at: null,
      gutenberg_id: payload.gutenberg_id ?? null,
      gutenberg_url: payload.gutenberg_url ?? null,
      openlibrary_id: payload.openlibrary_id ?? null,
      openlibrary_url: payload.openlibrary_url ?? null,
      already_digitised: payload.already_digitised ?? false,
      digitised_source: null,
      estimated_copies_surviving: 'unknown',
      worldcat_holding_count: null,
      ai_training_value: payload.ai_training_value ?? 'unassessed',
      ai_value_factors: payload.ai_value_factors ?? [],
      pre_llm_era: payload.pre_llm_era ?? null,
      triage_action: payload.triage_action ?? 'pending',
      triage_notes: payload.triage_notes ?? null,
      triage_score: payload.triage_score ?? 0,
      triage_run_at: null,
      physical_location: payload.physical_location ?? null,
      acquisition_cost: payload.acquisition_cost ?? null,
      acquisition_date: payload.acquisition_date ?? null,
      acquisition_source: payload.acquisition_source ?? null,
      condition: payload.condition ?? 'good',
      scan_status: 'not_scanned',
      scan_method: null,
      scan_started_at: null,
      scan_completed_at: null,
      ocr_text_path: null,
      ocr_quality_score: null,
      ocr_word_count: null,
      ocr_page_count: null,
      resale_status: 'not_listed',
      resale_platform: null,
      resale_price: null,
      resale_listed_at: null,
      resale_sold_at: null,
      provenance_chain: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.books.unshift(newBook);
    return newBook as T;
  }

  if (path.match(/^\/api\/books\/[^/]+$/) && method === 'PATCH') {
    const id = path.split('/').pop()!;
    const idx = mockStore.books.findIndex((b) => b.id === id);
    if (idx === -1) throw new ApiClientError(404, 'Book not found');
    const updated = { ...mockStore.books[idx]!, ...(body as BookUpdatePayload), updated_at: new Date().toISOString() };
    mockStore.books[idx] = updated;
    return updated as T;
  }

  if (path.match(/^\/api\/books\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    mockStore.books = mockStore.books.filter((b) => b.id !== id);
    return undefined as T;
  }

  if (path.match(/^\/api\/books\/[^/]+\/rerun-triage$/) && method === 'POST') {
    const id = path.split('/')[3]!;
    const idx = mockStore.books.findIndex((b) => b.id === id);
    if (idx === -1) throw new ApiClientError(404, 'Book not found');
    const book = mockStore.books[idx]!;
    const result = m.mockTriageResult(book.isbn ?? book.title);
    const updated: Book = {
      ...book,
      triage_score: result.triage_score,
      triage_action: result.triage_action,
      ai_training_value: result.ai_training_value,
      public_domain_status: result.public_domain_status,
      triage_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.books[idx] = updated;
    return updated as T;
  }

  // ── Datasets ───────────────────────────────────────────────────────────────
  if (path.startsWith('/api/datasets') && method === 'GET') {
    const singleMatch = path.match(/^\/api\/datasets\/([^/?]+)$/);
    if (singleMatch) {
      const id = singleMatch[1];
      const ds = mockStore.datasets.find((d) => d.id === id);
      if (!ds) throw new ApiClientError(404, 'Dataset not found');
      return ds as T;
    }

    const previewMatch = path.match(/^\/api\/datasets\/([^/?]+)\/preview/);
    if (previewMatch) {
      const id = previewMatch[1];
      const ds = mockStore.datasets.find((d) => d.id === id);
      return (ds?.text_preview ?? 'Preview not available.') as T;
    }

    return { items: mockStore.datasets, total: mockStore.datasets.length, page: 1, limit: 50, pages: 1 } as T;
  }

  if (path === '/api/datasets' && method === 'POST') {
    const payload = body as unknown as DatasetCreatePayload;
    const newDs: Dataset = {
      id: crypto.randomUUID(),
      book_id: payload.book_id,
      title: payload.title,
      description: payload.description ?? null,
      domain_tags: payload.domain_tags ?? [],
      language: payload.language ?? 'en',
      word_count: null,
      page_count: null,
      text_file_path: `/ocr-text/${payload.book_id}.txt`,
      text_preview: null,
      ocr_quality_score: null,
      provenance_document: {},
      sale_status: 'not_listed',
      asking_price: payload.asking_price ?? null,
      final_price: null,
      listed_platform: null,
      listed_url: null,
      buyer_name: null,
      buyer_type: null,
      nda_signed: false,
      listed_at: null,
      sold_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.datasets.unshift(newDs);
    return newDs as T;
  }

  if (path.match(/^\/api\/datasets\/[^/]+$/) && method === 'PATCH') {
    const id = path.split('/').pop()!;
    const idx = mockStore.datasets.findIndex((d) => d.id === id);
    if (idx === -1) throw new ApiClientError(404, 'Dataset not found');
    const updated = { ...mockStore.datasets[idx]!, ...(body as DatasetUpdatePayload), updated_at: new Date().toISOString() };
    mockStore.datasets[idx] = updated;
    return updated as T;
  }

  if (path.match(/^\/api\/datasets\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    mockStore.datasets = mockStore.datasets.filter((d) => d.id !== id);
    return undefined as T;
  }

  // ── Sales ──────────────────────────────────────────────────────────────────
  if (path.startsWith('/api/sales') && method === 'GET') {
    const singleMatch = path.match(/^\/api\/sales\/([^/?]+)$/);
    if (singleMatch) {
      const id = singleMatch[1];
      const sale = mockStore.sales.find((s) => s.id === id);
      if (!sale) throw new ApiClientError(404, 'Sale not found');
      return sale as T;
    }

    return { items: mockStore.sales, total: mockStore.sales.length, page: 1, limit: 50, pages: 1 } as T;
  }

  if (path === '/api/sales' && method === 'POST') {
    const payload = body as unknown as SaleCreatePayload;
    const newSale: Sale = {
      id: crypto.randomUUID(),
      book_id: payload.book_id ?? null,
      dataset_id: payload.dataset_id ?? null,
      sale_type: payload.sale_type,
      platform: payload.platform,
      listing_url: payload.listing_url ?? null,
      asking_price: payload.asking_price ?? null,
      final_price: payload.final_price ?? null,
      buyer_name: payload.buyer_name ?? null,
      buyer_type: payload.buyer_type ?? null,
      nda_signed: payload.nda_signed ?? false,
      status: payload.status ?? 'draft',
      listed_at: null,
      sold_at: null,
      notes: payload.notes ?? null,
      created_at: new Date().toISOString(),
    };
    mockStore.sales.unshift(newSale);
    return newSale as T;
  }

  if (path.match(/^\/api\/sales\/[^/]+$/) && method === 'PATCH') {
    const id = path.split('/').pop()!;
    const idx = mockStore.sales.findIndex((s) => s.id === id);
    if (idx === -1) throw new ApiClientError(404, 'Sale not found');
    const updated = { ...mockStore.sales[idx]!, ...(body as SaleUpdatePayload) };
    mockStore.sales[idx] = updated;
    return updated as T;
  }

  if (path.match(/^\/api\/sales\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    mockStore.sales = mockStore.sales.filter((s) => s.id !== id);
    return undefined as T;
  }

  // ── Scan ───────────────────────────────────────────────────────────────────
  if (path.match(/^\/api\/scan\/status\//)) {
    const bookId = path.split('/').pop()!;
    const book = mockStore.books.find((b) => b.id === bookId);
    const scanResp: ScanStatusResponse = {
      book_id: bookId,
      scan_status: book?.scan_status ?? 'not_scanned',
      scan_method: book?.scan_method ?? null,
      pages_uploaded: 0,
      pages_ocr_complete: 0,
      pages_reviewed: 0,
      ocr_quality_score: book?.ocr_quality_score ?? null,
      ocr_word_count: book?.ocr_word_count ?? null,
      ocr_page_count: book?.ocr_page_count ?? null,
      progress_pct: 0,
      text_preview: null,
    };
    return scanResp as T;
  }

  if (path.match(/^\/api\/scan\//)) {
    // Queue, process, review — return success shape.
    return { ok: true } as T;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return {} as T;
}

// ── Public API functions ──────────────────────────────────────────────────────

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const qs = params ? buildQueryString(params) : '';
  const fullPath = `${path}${qs}`;

  if (IS_MOCK_MODE) return resolveMock<T>(fullPath, { method: 'GET' });

  return coreFetch<T>(`${API_BASE}${fullPath}`);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (IS_MOCK_MODE) {
    return resolveMock<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  return coreFetch<T>(`${API_BASE}${path}`, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  if (IS_MOCK_MODE) {
    return resolveMock<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  return coreFetch<T>(`${API_BASE}${path}`, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  if (IS_MOCK_MODE) return resolveMock<T>(path, { method: 'DELETE' });

  return coreFetch<T>(`${API_BASE}${path}`, { method: 'DELETE' });
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  if (IS_MOCK_MODE) {
    await sleep(MOCK_DELAY_MS);
    return { ok: true } as T;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type here — let the browser set it with the boundary.
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Ignore.
    }
    throw new ApiClientError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

/** SWR-compatible fetcher. The SWR key is treated as a path. */
export const fetcher = <T>(key: string): Promise<T> => apiGet<T>(key);

// ── Endpoint path builders ────────────────────────────────────────────────────

export const endpoints = {
  // Stats
  stats: {
    summary: () => '/api/stats/summary',
    activity: (limit?: number) => `/api/stats/activity${limit ? `?limit=${limit}` : ''}`,
    triageDistribution: () => '/api/stats/triage-distribution',
    revenueSummary: () => '/api/sales/revenue/summary',
  },

  // Triage — all go via the Next.js proxy (/api/triage)
  triage: {
    run: () => '/api/triage',
    bulk: () => '/api/triage/bulk',
    history: () => '/api/triage/history',
  },

  // Books
  books: {
    list: (q?: BookQuery) =>
      `/api/books${q ? buildQueryString(q as Record<string, unknown>) : ''}`,
    get: (id: string) => `/api/books/${id}`,
    create: () => '/api/books',
    update: (id: string) => `/api/books/${id}`,
    delete: (id: string) => `/api/books/${id}`,
    rerunTriage: (id: string) => `/api/books/${id}/rerun-triage`,
    resale: (id: string) => `/api/books/${id}/resale`,
  },

  // Scan
  scan: {
    queue: (bookId: string) => `/api/scan/queue/${bookId}`,
    upload: () => '/api/scan/upload',
    process: (bookId: string) => `/api/scan/process/${bookId}`,
    status: (bookId: string) => `/api/scan/status/${bookId}`,
    text: (bookId: string) => `/api/scan/text/${bookId}`,
    review: (bookId: string) => `/api/scan/review/${bookId}`,
  },

  // Datasets
  datasets: {
    list: (q?: DatasetQuery) =>
      `/api/datasets${q ? buildQueryString(q as Record<string, unknown>) : ''}`,
    get: (id: string) => `/api/datasets/${id}`,
    create: () => '/api/datasets',
    update: (id: string) => `/api/datasets/${id}`,
    delete: (id: string) => `/api/datasets/${id}`,
    preview: (id: string) => `/api/datasets/${id}/preview`,
    download: (id: string) => `/api/datasets/${id}/download`,
  },

  // Sales
  sales: {
    list: (q?: SaleQuery) =>
      `/api/sales${q ? buildQueryString(q as Record<string, unknown>) : ''}`,
    get: (id: string) => `/api/sales/${id}`,
    create: () => '/api/sales',
    update: (id: string) => `/api/sales/${id}`,
    delete: (id: string) => `/api/sales/${id}`,
  },

  // Export
  export: {
    inventory: () => '/api/export/inventory.csv',
    book: (id: string) => `/api/export/books/${id}.json`,
  },
} as const;

// Re-export types that hooks need so they only import from api.ts
export type {
  Book,
  BookQuery,
  BookCreatePayload,
  BookUpdatePayload,
  BulkTriageRequest,
  BulkTriageResultRow,
  Dataset,
  DatasetCreatePayload,
  DatasetQuery,
  DatasetUpdatePayload,
  Paginated,
  RevenueSummary,
  Sale,
  SaleCreatePayload,
  SaleQuery,
  SaleUpdatePayload,
  ScanStatusResponse,
  StatsSummary,
  TriageRequest,
  TriageResult,
  TriageHistoryEntry,
  ActivityEntry,
  TriageDistributionSlice,
  ResaleRecommendation,
};
