import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
} from 'date-fns';

// ── Class name utility ────────────────────────────────────────────────────────

/** Merge Tailwind classes with clsx, deduplicating conflicting utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ── Currency formatting ───────────────────────────────────────────────────────

/**
 * Format a number as a UK sterling amount.
 * @example formatCurrency(1234.5) → "£1,234.50"
 * @example formatCurrency(99, 'USD') → "$99.00"
 */
export function formatCurrency(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Date formatting ───────────────────────────────────────────────────────────

function safeParseDate(iso: string): Date | null {
  try {
    const d = parseISO(iso);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/** Format an ISO date string as DD/MM/YYYY (UK locale). */
export function formatDate(iso: string): string {
  const d = safeParseDate(iso);
  if (!d) return iso;
  return format(d, 'dd/MM/yyyy');
}

/** Format an ISO datetime string as DD/MM/YYYY at HH:mm. */
export function formatDateTime(iso: string): string {
  const d = safeParseDate(iso);
  if (!d) return iso;
  return format(d, "dd/MM/yyyy 'at' HH:mm");
}

/** Format an ISO datetime as a human-readable relative time (e.g. "3 days ago"). */
export function formatRelativeTime(iso: string): string {
  const d = safeParseDate(iso);
  if (!d) return iso;
  return formatDistanceToNow(d, { addSuffix: true });
}

// ── Number formatting ─────────────────────────────────────────────────────────

/** Format a number with locale-aware thousands separators. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n);
}

/** Format a large number compactly: 1200 → "1.2K", 1500000 → "1.5M". */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

// ── String utilities ──────────────────────────────────────────────────────────

/** Truncate a string to at most `n` characters, appending "…" if truncated. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

/** Return the first character of each word in a string, upper-cased (max 2). */
export function initialOf(s: string): string {
  const words = s.trim().split(/\s+/);
  const initials = words.map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2);
  return initials.join('');
}

/**
 * Return a deterministic warm-gradient CSS string suitable for book-cover
 * placeholder backgrounds. The gradient varies with a seed string so that
 * different books get visually distinct colourways.
 */
export function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  const h = Math.abs(hash);

  const gradients = [
    'linear-gradient(135deg, #2D5F4F 0%, #1F4537 100%)',
    'linear-gradient(135deg, #C49A4D 0%, #92400E 100%)',
    'linear-gradient(135deg, #5B8C8A 0%, #1E4040 100%)',
    'linear-gradient(135deg, #3A7A66 0%, #2D5F4F 100%)',
    'linear-gradient(135deg, #D4AF6A 0%, #C49A4D 100%)',
    'linear-gradient(135deg, #7BA8A6 0%, #5B8C8A 100%)',
    'linear-gradient(135deg, #1F4537 0%, #5B8C8A 100%)',
    'linear-gradient(135deg, #B5523E 0%, #7A2D20 100%)',
  ] as const;

  return gradients[h % gradients.length] as string;
}

// ── ISBN utilities ────────────────────────────────────────────────────────────

/** Strip all non-digit characters (plus 'X') to produce a raw ISBN string. */
export function normaliseIsbn(s: string): string {
  return s.replace(/[^0-9X]/gi, '').toUpperCase();
}

/** Validate an ISBN-10 or ISBN-13 string using real checksum algorithms. */
export function isValidIsbn(raw: string): boolean {
  const isbn = normaliseIsbn(raw);

  if (isbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const digit = isbn[i];
      if (digit === undefined || !/[0-9]/.test(digit)) return false;
      sum += parseInt(digit, 10) * (10 - i);
    }
    const last = isbn[9];
    if (last === undefined) return false;
    const check = last === 'X' ? 10 : parseInt(last, 10);
    return (sum + check) % 11 === 0;
  }

  if (isbn.length === 13) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const digit = isbn[i];
      if (digit === undefined || !/[0-9]/.test(digit)) return false;
      sum += parseInt(digit, 10) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }

  return false;
}

/**
 * Parse a block of pasted text containing ISBNs (one per line, or
 * space/comma-separated). Returns deduplicated valid and invalid lists.
 */
export function parseIsbnList(text: string): {
  valid: string[];
  invalid: string[];
} {
  const tokens = text
    .split(/[\n\r,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const normalised = normaliseIsbn(token);
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    if (isValidIsbn(normalised)) {
      valid.push(normalised);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}

// ── Math utilities ────────────────────────────────────────────────────────────

/**
 * Compute (a / b) * 100 as a percentage, rounded to one decimal place.
 * Returns 0 when b is 0.
 */
export function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100 * 10) / 10;
}

// ── String transformations ────────────────────────────────────────────────────

/** Create a URL-safe slug from an arbitrary string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Title-case a string — capitalise the first letter of every word. */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Convert a snake_case identifier to a human-readable label.
 * @example labelise('scan_and_sell_data') → "Scan And Sell Data"
 */
export function labelise(snake: string): string {
  return titleCase(snake.replace(/_/g, ' '));
}

// ── Download ──────────────────────────────────────────────────────────────────

/** Trigger a browser file download with the given content. */
export function downloadBlob(
  filename: string,
  content: string,
  mime = 'application/octet-stream',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ── Async ─────────────────────────────────────────────────────────────────────

/** Resolve after a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
