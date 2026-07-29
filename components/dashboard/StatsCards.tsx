import * as React from 'react';
import { BookOpen, Globe2, ScanLine, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { SkeletonStatCards } from '@/components/ui/Skeleton';
import type { StatsSummary } from '@/lib/types';

export interface StatsCardsProps {
  stats?: StatsSummary;
  loading?: boolean;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColour: string;
}

function StatCard({ label, value, sub, icon, iconBg, iconColour }: StatCardProps) {
  return (
    <article
      className="bg-surface border border-rule rounded-lg p-6 shadow-sm flex flex-col gap-3"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted font-body">
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
          aria-hidden="true"
        >
          <span style={{ color: iconColour }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="font-heading text-3xl font-bold text-ink leading-none">{value}</p>
        {sub && (
          <p className="text-sm text-ink-muted font-body mt-1">{sub}</p>
        )}
      </div>
    </article>
  );
}

/**
 * 4-card responsive grid of top-level dashboard metrics.
 * Renders `SkeletonStatCards` while `loading` is true.
 */
export function StatsCards({ stats, loading = false, className }: StatsCardsProps) {
  if (loading) {
    return <SkeletonStatCards count={4} />;
  }

  const totalBooks = stats?.total_books ?? 0;
  const publicDomain = stats?.public_domain_books ?? 0;
  const pdPct = stats?.public_domain_pct ?? 0;
  const readyToScan = stats?.ready_to_scan ?? 0;
  const revenue = stats?.total_revenue ?? 0;

  return (
    <section
      className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}
      aria-label="Inventory summary statistics"
    >
      <StatCard
        label="Total Books"
        value={formatNumber(totalBooks)}
        icon={<BookOpen size={18} />}
        iconBg="#E8F0EC"
        iconColour="#2D5F4F"
      />
      <StatCard
        label="Public Domain"
        value={formatNumber(publicDomain)}
        sub={totalBooks > 0 ? `${pdPct.toFixed(1)}% of catalogue` : undefined}
        icon={<Globe2 size={18} />}
        iconBg="#E8F3E8"
        iconColour="#5C8D5C"
      />
      <StatCard
        label="Ready to Scan"
        value={formatNumber(readyToScan)}
        sub="scan_and_sell_data action"
        icon={<ScanLine size={18} />}
        iconBg="#F7F0E0"
        iconColour="#C49A4D"
      />
      <StatCard
        label="Total Revenue"
        value={formatCurrency(revenue)}
        sub={
          stats
            ? `Data: ${formatCurrency(stats.data_revenue)} · Physical: ${formatCurrency(stats.physical_revenue)}`
            : undefined
        }
        icon={<TrendingUp size={18} />}
        iconBg="#E8F0EF"
        iconColour="#5B8C8A"
      />
    </section>
  );
}
