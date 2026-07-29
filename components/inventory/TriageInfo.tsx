'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelise, formatDate } from '@/lib/utils';
import { TRIAGE_ACTIONS } from '@/lib/types';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TriageScore } from '@/components/triage/TriageScore';
import { TriageActionBadge } from '@/components/ui/Badge';
import { ValueFactors } from '@/components/triage/ValueFactors';
import type { Book, TriageAction } from '@/lib/types';

export interface TriageInfoProps {
  book: Book;
  onRerun?: () => void;
  rerunning?: boolean;
  onOverride?: (action: TriageAction) => void;
  className?: string;
}

const OVERRIDE_OPTIONS = TRIAGE_ACTIONS.map((a) => ({
  value: a,
  label: labelise(a),
}));

/**
 * Sidebar card showing triage score gauge, current action badge,
 * last run date, AI value factors, and controls to re-run or override the action.
 */
export function TriageInfo({
  book,
  onRerun,
  rerunning = false,
  onOverride,
  className,
}: TriageInfoProps) {
  const [overrideValue, setOverrideValue] = React.useState<TriageAction>(book.triage_action);

  function handleOverride() {
    if (overrideValue !== book.triage_action) {
      onOverride?.(overrideValue);
    }
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Triage" />
      <CardBody>
        <div className="flex flex-col items-center gap-4">
          <TriageScore score={book.triage_score} size={100} animate />

          <div className="flex flex-col items-center gap-1.5 w-full">
            <TriageActionBadge action={book.triage_action} size="md" />
            {book.triage_run_at && (
              <p className="text-xs text-ink-muted font-body text-center">
                Last assessed {formatDate(book.triage_run_at)}
              </p>
            )}
          </div>

          {book.triage_notes && (
            <p className="text-sm text-ink-body font-body leading-relaxed text-center italic border-t border-divider pt-3 w-full">
              {book.triage_notes}
            </p>
          )}

          {book.ai_value_factors.length > 0 && (
            <div className="w-full border-t border-divider pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                Value Factors
              </p>
              <ValueFactors factors={book.ai_value_factors} />
            </div>
          )}

          {/* Re-run triage */}
          {onRerun && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} aria-hidden="true" />}
              loading={rerunning}
              onClick={onRerun}
              fullWidth
              aria-label="Re-run triage analysis for this book"
            >
              Re-run Triage
            </Button>
          )}

          {/* Override action */}
          {onOverride && (
            <div className="w-full border-t border-divider pt-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Override Action
              </p>
              <Select
                options={OVERRIDE_OPTIONS}
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value as TriageAction)}
                aria-label="Override triage action"
                size="sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOverride}
                disabled={overrideValue === book.triage_action}
                fullWidth
              >
                Apply Override
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
