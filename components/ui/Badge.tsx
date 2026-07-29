import * as React from 'react';
import { cn } from '@/lib/utils';
import type { BadgeTone } from '@/lib/types';
import type {
  AiTrainingValue,
  DatasetSaleStatus,
  PublicDomainStatus,
  ResaleStatus,
  SaleStatus,
  ScanStatus,
  TriageAction,
} from '@/lib/types';
import {
  AI_VALUE_STYLES,
  DATASET_SALE_STATUS_STYLES,
  PD_STATUS_STYLES,
  RESALE_STATUS_STYLES,
  SALE_STATUS_STYLES,
  SCAN_STATUS_STYLES,
  TRIAGE_ACTION_STYLES,
} from '@/lib/constants';

/* ------------------------------------------------------------------ */
/* Tone → Tailwind token mapping (no hardcoded hex)                    */
/* ------------------------------------------------------------------ */

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  info: 'bg-info-bg text-info',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-canvas-alt text-ink-muted',
  primary: 'bg-primary-bg text-primary',
  accent: 'bg-accent-bg text-accent',
};

/* ------------------------------------------------------------------ */
/* Base Badge                                                          */
/* ------------------------------------------------------------------ */

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Hex background colour from frozen constants — wins over `tone`. */
  bg?: string;
  /** Hex text colour from frozen constants — wins over `tone`. */
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export function Badge({
  children,
  tone = 'neutral',
  bg,
  text,
  size = 'md',
  className,
  dot = false,
}: BadgeProps) {
  const hasInlineStyle = bg !== undefined || text !== undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-body font-semibold uppercase tracking-wide rounded-full',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
        !hasInlineStyle && TONE_CLASSES[tone],
        className,
      )}
      style={
        hasInlineStyle
          ? { backgroundColor: bg, color: text }
          : undefined
      }
    >
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={hasInlineStyle ? { backgroundColor: text } : undefined}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Typed convenience wrappers — read from frozen constants             */
/* ------------------------------------------------------------------ */

export function PdBadge({
  status,
  size,
}: {
  status: PublicDomainStatus;
  size?: 'sm' | 'md';
}) {
  const style = PD_STATUS_STYLES[status];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function AiValueBadge({
  value,
  size,
}: {
  value: AiTrainingValue;
  size?: 'sm' | 'md';
}) {
  const style = AI_VALUE_STYLES[value];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function TriageActionBadge({
  action,
  size,
}: {
  action: TriageAction;
  size?: 'sm' | 'md';
}) {
  const style = TRIAGE_ACTION_STYLES[action];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function ScanStatusBadge({
  status,
  size,
}: {
  status: ScanStatus;
  size?: 'sm' | 'md';
}) {
  const style = SCAN_STATUS_STYLES[status];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function ResaleStatusBadge({
  status,
  size,
}: {
  status: ResaleStatus;
  size?: 'sm' | 'md';
}) {
  const style = RESALE_STATUS_STYLES[status];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function DatasetStatusBadge({
  status,
  size,
}: {
  status: DatasetSaleStatus;
  size?: 'sm' | 'md';
}) {
  const style = DATASET_SALE_STATUS_STYLES[status];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}

export function SaleStatusBadge({
  status,
  size,
}: {
  status: SaleStatus;
  size?: 'sm' | 'md';
}) {
  const style = SALE_STATUS_STYLES[status];
  return (
    <Badge bg={style.bg} text={style.text} size={size}>
      {style.label}
    </Badge>
  );
}
