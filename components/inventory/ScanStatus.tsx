'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCAN_STEPS } from '@/lib/constants';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Book } from '@/lib/types';

export interface ScanStatusTrackerProps {
  book: Book;
  onAdvance?: () => void;
  advancing?: boolean;
  className?: string;
}

/**
 * Vertical stepper showing the book's progress through the scan workflow.
 * Completed steps: filled primary circle with check. Current: ringed primary.
 * Future: muted outline. Hides the Advance button at `ready_for_sale`.
 * Named `ScanStatusTracker` to avoid collision with the `ScanStatus` type.
 */
export function ScanStatusTracker({
  book,
  onAdvance,
  advancing = false,
  className,
}: ScanStatusTrackerProps) {
  const currentIndex = SCAN_STEPS.findIndex((s) => s.status === book.scan_status);
  const isComplete = book.scan_status === 'ready_for_sale';

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Scan Status" />
      <CardBody>
        <ol className="flex flex-col" aria-label="Scan workflow steps">
          {SCAN_STEPS.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isFuture = i > currentIndex;
            const isLast = i === SCAN_STEPS.length - 1;

            return (
              <li key={step.status} className="relative flex gap-3">
                {/* Connecting line */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'absolute left-[14px] top-[28px] w-0.5 h-full -z-10',
                      isCompleted ? 'bg-primary' : 'bg-rule',
                    )}
                    style={{ height: 'calc(100% - 8px)' }}
                  />
                )}

                {/* Step indicator */}
                <div className="shrink-0 mt-1" aria-hidden="true">
                  {isCompleted ? (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary">
                      <Check size={13} className="text-ink-inverse" />
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary bg-primary-bg">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    </span>
                  ) : (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-rule bg-canvas-alt">
                      <span className="w-2 h-2 rounded-full bg-rule" />
                    </span>
                  )}
                </div>

                {/* Step label */}
                <div className={cn('flex flex-col pb-5', isLast && 'pb-0')}>
                  <span
                    className={cn(
                      'text-sm font-semibold font-body leading-tight',
                      isCurrent ? 'text-primary' : isCompleted ? 'text-ink' : 'text-ink-muted',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-xs text-ink-muted font-body leading-snug">
                    {step.description}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {onAdvance && !isComplete && (
          <div className="mt-4 pt-4 border-t border-divider">
            <Button
              variant="primary"
              size="sm"
              loading={advancing}
              onClick={onAdvance}
              fullWidth
              aria-label="Advance book to the next scan status"
            >
              Advance Status
            </Button>
          </div>
        )}

        {isComplete && (
          <div className="mt-4 pt-4 border-t border-divider flex items-center gap-2 text-success">
            <Check size={16} aria-hidden="true" />
            <span className="text-sm font-semibold font-body">Ready for sale</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
