'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidIsbn } from '@/lib/utils';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { TriageRequest } from '@/lib/types';

export interface IsbnInputProps {
  onTriage: (req: TriageRequest) => void;
  loading?: boolean;
  onBulkClick?: () => void;
}

/* ── Zod schemas ─────────────────────────────────────────────────────────── */

const isbnSchema = z.object({
  isbn: z
    .string()
    .min(1, 'ISBN is required')
    .refine((v) => isValidIsbn(v), { message: 'Please enter a valid ISBN-10 or ISBN-13' }),
});
type IsbnForm = z.infer<typeof isbnSchema>;

const titleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional(),
});
type TitleForm = z.infer<typeof titleSchema>;

const TABS = [
  { value: 'isbn', label: 'ISBN Lookup' },
  { value: 'title', label: 'Title + Author' },
];

/**
 * ISBN / Title+Author triage entry form.
 * Tabs toggle between modes. ISBN field uses monospace font.
 * Autofocuses the active field on mode switch. Enter key submits.
 */
export function IsbnInput({ onTriage, loading = false, onBulkClick }: IsbnInputProps) {
  const [mode, setMode] = React.useState<'isbn' | 'title'>('isbn');
  const isbnRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);

  const {
    register: registerIsbn,
    handleSubmit: handleIsbnSubmit,
    formState: { errors: isbnErrors },
    reset: resetIsbn,
  } = useForm<IsbnForm>({
    resolver: zodResolver(isbnSchema),
  });

  const {
    register: registerTitle,
    handleSubmit: handleTitleSubmit,
    formState: { errors: titleErrors },
    reset: resetTitle,
  } = useForm<TitleForm>({
    resolver: zodResolver(titleSchema),
  });

  // Autofocus the active field when mode changes
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (mode === 'isbn') {
        isbnRef.current?.focus();
      } else {
        titleRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [mode]);

  function onIsbnSubmit(data: IsbnForm) {
    onTriage({ isbn: data.isbn });
  }

  function onTitleSubmit(data: TitleForm) {
    onTriage({ title: data.title, author: data.author ?? undefined });
  }

  function handleModeChange(v: string) {
    setMode(v as 'isbn' | 'title');
    resetIsbn();
    resetTitle();
  }

  const isbnRegResult = registerIsbn('isbn');
  const titleRegResult = registerTitle('title');
  const authorRegResult = registerTitle('author');

  return (
    <section aria-label="Book triage input" className="flex flex-col gap-4">
      <Tabs
        tabs={TABS}
        value={mode}
        onChange={handleModeChange}
        fullWidth
      />

      {mode === 'isbn' ? (
        <form
          onSubmit={handleIsbnSubmit(onIsbnSubmit)}
          noValidate
          aria-label="ISBN lookup form"
        >
          <div className="flex flex-col gap-3">
            <Input
              {...isbnRegResult}
              ref={(el) => {
                isbnRegResult.ref(el);
                (isbnRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              }}
              label="ISBN"
              placeholder="e.g. 9780140434255 or 0140434259"
              hint="Scan barcode or type ISBN"
              error={isbnErrors.isbn?.message}
              mono
              autoComplete="off"
              inputMode="numeric"
              aria-label="Book ISBN"
            />
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                fullWidth
                className="sm:flex-1"
              >
                Triage Book
              </Button>
            </div>
            {onBulkClick && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onBulkClick}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-body text-primary',
                    'hover:text-primary-dark underline underline-offset-2 transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
                  )}
                >
                  <Upload size={14} aria-hidden="true" />
                  Bulk Import
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleTitleSubmit(onTitleSubmit)}
          noValidate
          aria-label="Title and author lookup form"
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                {...titleRegResult}
                ref={(el) => {
                  titleRegResult.ref(el);
                  (titleRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                }}
                label="Title"
                placeholder="e.g. Middlemarch"
                error={titleErrors.title?.message}
                autoComplete="off"
                aria-label="Book title"
              />
              <Input
                {...authorRegResult}
                label="Author"
                placeholder="e.g. George Eliot"
                error={titleErrors.author?.message}
                autoComplete="off"
                aria-label="Book author (optional)"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              fullWidth
            >
              Triage Book
            </Button>
            {onBulkClick && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onBulkClick}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-body text-primary',
                    'hover:text-primary-dark underline underline-offset-2 transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
                  )}
                >
                  <Upload size={14} aria-hidden="true" />
                  Bulk Import
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
