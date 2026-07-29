/**
 * BookScan — Triage Proxy Route
 * ==============================
 * Security contract:
 *  - Reads backend URL from server-only env var BACKEND_API_URL.
 *    Falls back to NEXT_PUBLIC_API_URL only as a secondary fallback so that
 *    local development works without BACKEND_API_URL set.
 *  - The backend URL is NEVER included in any response body or error message.
 *  - Internal stack traces are never surfaced to the client.
 *  - Requests are validated with Zod before forwarding; invalid payloads
 *    receive a 400 with a clean message.
 *  - GET ?history proxies to /api/triage/history.
 *  - POST with an `isbns` array proxies to /api/triage/bulk.
 *  - POST without `isbns` proxies to /api/triage (single triage).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const SingleTriageSchema = z.object({
  isbn: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
}).refine(
  (d) => d.isbn !== undefined || (d.title !== undefined && d.author !== undefined),
  { message: 'Provide either isbn or both title and author.' },
);

const BulkTriageSchema = z.object({
  isbns: z
    .array(z.string().min(1))
    .min(1, 'At least one ISBN is required')
    .max(100, 'Maximum 100 ISBNs per bulk request'),
});

// Union: either has an isbns array (bulk) or a single triage shape
const TriageBodySchema = z.union([BulkTriageSchema, SingleTriageSchema]);

// ── Helper: build a safe error response (no internal details) ─────────────────

function safeError(status: number, detail: string): NextResponse {
  return NextResponse.json({ detail }, { status });
}

// ── Resolve the backend base URL (server-only) ────────────────────────────────

function resolveBackendUrl(): string | null {
  // Prefer the server-only variable — never exposed to the browser bundle.
  // BACKEND_API_URL is not prefixed with NEXT_PUBLIC_ and therefore never
  // included in the client build.
  const url =
    process.env['BACKEND_API_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    null;

  if (!url) return null;
  // Strip trailing slash for consistent joining.
  return url.replace(/\/$/, '');
}

// ── Forward request to the backend ───────────────────────────────────────────

async function forwardToBackend(
  backendBase: string,
  path: string,
  method: string,
  body?: unknown,
  request?: NextRequest,
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Forward API key from server-only env var if present
  const apiKey = process.env['BACKEND_API_KEY'];
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // 30-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${backendBase}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(30_000) : controller.signal,
      cache: 'no-store',
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── GET handler — triage history ──────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const backendBase = resolveBackendUrl();
  if (!backendBase) {
    return safeError(
      503,
      'Triage service is not configured. Set BACKEND_API_URL or use mock mode (NEXT_PUBLIC_MOCK_MODE=true).',
    );
  }

  let res: Response;
  try {
    res = await forwardToBackend(backendBase, '/api/triage/history', 'GET');
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return safeError(504, 'The triage service did not respond in time. Please try again.');
    }
    // Network error — do not leak the backend URL or the error message
    return safeError(502, 'Could not reach the triage service. Please try again later.');
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return safeError(502, 'The triage service returned an invalid response.');
  }

  return NextResponse.json(data, { status: res.status });
}

// ── POST handler — single or bulk triage ─────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const backendBase = resolveBackendUrl();
  if (!backendBase) {
    return safeError(
      503,
      'Triage service is not configured. Set BACKEND_API_URL or use mock mode (NEXT_PUBLIC_MOCK_MODE=true).',
    );
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return safeError(400, 'Request body must be valid JSON.');
  }

  const parseResult = TriageBodySchema.safeParse(rawBody);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return safeError(
      400,
      firstError?.message ?? 'Invalid request body.',
    );
  }

  const body = parseResult.data;
  const isBulk = 'isbns' in body;
  const backendPath = isBulk ? '/api/triage/bulk' : '/api/triage';

  // Forward to backend
  let backendRes: Response;
  try {
    backendRes = await forwardToBackend(backendBase, backendPath, 'POST', body, request);
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return safeError(504, 'The triage service did not respond in time. Please try again.');
    }
    // Network-level failure — do not expose backend URL or error details
    return safeError(502, 'Could not reach the triage service. Please try again later.');
  }

  // Parse backend response
  let responseData: unknown;
  try {
    responseData = await backendRes.json();
  } catch {
    return safeError(502, 'The triage service returned an invalid response.');
  }

  // Return backend's status and data, but ensure we never expose internal URLs.
  // If the backend returned an error body with a `detail` field, pass it through
  // (it's a FastAPI-style error and safe to show). Otherwise forward as-is.
  return NextResponse.json(responseData, { status: backendRes.status });
}
