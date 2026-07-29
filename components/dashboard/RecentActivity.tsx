import * as React from 'react';
import {
  BookMarked,
  BadgeDollarSign,
  Database,
  DollarSign,
  ScanLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ActivityEntry } from '@/lib/types';

export interface RecentActivityProps {
  entries: ActivityEntry[];
  loading?: boolean;
  className?: string;
}

interface IconConfig {
  icon: React.ReactNode;
  bg: string;
  colour: string;
}

function iconFor(kind: ActivityEntry['kind']): IconConfig {
  switch (kind) {
    case 'book_added':
      return { icon: <BookMarked size={15} />, bg: '#E8F0EC', colour: '#2D5F4F' };
    case 'book_sold':
      return { icon: <BadgeDollarSign size={15} />, bg: '#E8F3E8', colour: '#5C8D5C' };
    case 'dataset_created':
      return { icon: <Database size={15} />, bg: '#E8F0EF', colour: '#5B8C8A' };
    case 'dataset_sold':
      return { icon: <DollarSign size={15} />, bg: '#F7F0E0', colour: '#C49A4D' };
    case 'scan_complete':
      return { icon: <ScanLine size={15} />, bg: '#F1F5F9', colour: '#6B7280' };
    default:
      return { icon: <BookMarked size={15} />, bg: '#F1F5F9', colour: '#6B7280' };
  }
}

/**
 * Scrollable list of up to 10 recent activity entries with kind-specific icons,
 * titles, details, formatted amounts and relative timestamps.
 */
export function RecentActivity({ entries, loading = false, className }: RecentActivityProps) {
  const visible = entries.slice(0, 10);

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Recent Activity" />
      <CardBody>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton width={32} height={32} rounded="lg" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton height={14} className="w-3/4" />
                  <Skeleton height={12} className="w-1/2" />
                </div>
                <Skeleton height={12} className="w-16" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No activity yet"
            message="Actions like adding books, completing scans and recording sales will appear here."
          />
        ) : (
          <ol
            className="flex flex-col divide-y divide-divider max-h-[360px] overflow-y-auto -mx-6 px-6"
            aria-label="Recent activity feed"
          >
            {visible.map((entry) => {
              const { icon, bg, colour } = iconFor(entry.kind);
              return (
                <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: bg }}
                    aria-hidden="true"
                  >
                    <span style={{ color: colour }}>{icon}</span>
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink font-body leading-snug truncate">
                      {entry.title}
                    </p>
                    {entry.detail && (
                      <p className="text-xs text-ink-muted font-body leading-snug mt-0.5 truncate">
                        {entry.detail}
                      </p>
                    )}
                  </div>

                  {/* Right column: amount + timestamp */}
                  <div className="shrink-0 flex flex-col items-end gap-0.5 min-w-0">
                    {entry.amount !== null && (
                      <span className="font-mono text-sm font-semibold text-ink">
                        {formatCurrency(entry.amount)}
                      </span>
                    )}
                    <time
                      dateTime={entry.timestamp}
                      className="text-xs text-ink-muted font-body whitespace-nowrap"
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
