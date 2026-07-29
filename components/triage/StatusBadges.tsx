import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  PdBadge,
  AiValueBadge,
  TriageActionBadge,
  ScanStatusBadge,
  ResaleStatusBadge,
} from '@/components/ui/Badge';
import type {
  AiTrainingValue,
  PublicDomainStatus,
  ResaleStatus,
  ScanStatus,
  TriageAction,
} from '@/lib/types';

export interface StatusBadgesProps {
  pdStatus: PublicDomainStatus;
  aiValue: AiTrainingValue;
  triageAction: TriageAction;
  scanStatus?: ScanStatus;
  resaleStatus?: ResaleStatus;
  size?: 'sm' | 'md';
  className?: string;
}

/** Horizontal row of status badges for a book's classification. */
export function StatusBadges({
  pdStatus,
  aiValue,
  triageAction,
  scanStatus,
  resaleStatus,
  size = 'md',
  className,
}: StatusBadgesProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      aria-label="Book status badges"
    >
      <PdBadge status={pdStatus} size={size} />
      <AiValueBadge value={aiValue} size={size} />
      <TriageActionBadge action={triageAction} size={size} />
      {scanStatus !== undefined && (
        <ScanStatusBadge status={scanStatus} size={size} />
      )}
      {resaleStatus !== undefined && (
        <ResaleStatusBadge status={resaleStatus} size={size} />
      )}
    </div>
  );
}
