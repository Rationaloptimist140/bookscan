'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, RESALE_PLATFORM_OPTIONS } from '@/lib/constants';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResaleStatusBadge } from '@/components/ui/Badge';
import type { Book, BookUpdatePayload } from '@/lib/types';

export interface SaleStatusCardProps {
  book: Book;
  onUpdate?: (payload: BookUpdatePayload) => Promise<void> | void;
  className?: string;
}

const saleSchema = z.object({
  resale_price: z
    .string()
    .min(1, 'Price is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: 'Price must be a positive number',
    }),
  resale_platform: z.string().min(1, 'Platform is required'),
});
type SaleForm = z.infer<typeof saleSchema>;

/**
 * Sale tracking card: shows current resale status badge, price input (£ prefix),
 * platform select, and contextual action buttons (List / Sold / Delist).
 * Named `SaleStatusCard` to avoid colliding with the `SaleStatus` type.
 */
export function SaleStatusCard({ book, onUpdate, className }: SaleStatusCardProps) {
  const [updating, setUpdating] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      resale_price: book.resale_price?.toString() ?? '',
      resale_platform: book.resale_platform ?? '',
    },
  });

  async function doUpdate(payload: BookUpdatePayload) {
    if (!onUpdate) return;
    setUpdating(true);
    try {
      await onUpdate(payload);
    } finally {
      setUpdating(false);
    }
  }

  function onList(data: SaleForm) {
    void doUpdate({
      resale_status: 'listed',
      resale_price: parseFloat(data.resale_price),
      resale_platform: data.resale_platform,
    });
  }

  function onMarkSold(data: SaleForm) {
    void doUpdate({
      resale_status: 'sold',
      resale_price: parseFloat(data.resale_price),
      resale_platform: data.resale_platform,
    });
  }

  function onDelist() {
    void doUpdate({ resale_status: 'delisted' });
  }

  const platformLabel =
    book.resale_platform ? (PLATFORM_LABELS[book.resale_platform] ?? book.resale_platform) : null;

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Sale Tracking" />
      <CardBody>
        <div className="flex flex-col gap-4">
          {/* Current status */}
          <div className="flex items-center gap-3">
            <ResaleStatusBadge status={book.resale_status} />
            {platformLabel && (
              <span className="text-sm text-ink-muted font-body">{platformLabel}</span>
            )}
          </div>

          {book.resale_price !== null && (
            <p className="font-mono text-lg font-semibold text-ink">
              £{book.resale_price.toFixed(2)}
            </p>
          )}

          {/* Form */}
          <form className="flex flex-col gap-3" noValidate>
            <Input
              {...register('resale_price')}
              label="Asking Price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              icon={<span className="text-sm font-mono font-medium text-ink-muted">£</span>}
              error={errors.resale_price?.message}
              aria-label="Asking price in pounds"
            />

            <Select
              {...register('resale_platform')}
              label="Platform"
              placeholder="Select platform…"
              options={RESALE_PLATFORM_OPTIONS}
              error={errors.resale_platform?.message}
              aria-label="Resale platform"
            />

            {/* Contextual action buttons */}
            <div className="flex flex-col gap-2">
              {book.resale_status === 'not_listed' && onUpdate && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={updating}
                  onClick={handleSubmit(onList)}
                  fullWidth
                >
                  List for Sale
                </Button>
              )}
              {book.resale_status === 'listed' && onUpdate && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={updating}
                    onClick={handleSubmit(onMarkSold)}
                    fullWidth
                  >
                    Mark as Sold
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={updating}
                    onClick={onDelist}
                    fullWidth
                  >
                    Delist
                  </Button>
                </>
              )}
              {book.resale_status === 'sold' && (
                <p className="text-sm text-success font-semibold font-body text-center">
                  Sold
                </p>
              )}
              {book.resale_status === 'delisted' && onUpdate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={updating}
                  onClick={handleSubmit(onList)}
                  fullWidth
                >
                  Re-list for Sale
                </Button>
              )}
            </div>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
