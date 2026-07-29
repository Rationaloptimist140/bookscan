'use client';

import React from 'react';
import Link from 'next/link';
import { ScanLine, Plus, BookOpen, TrendingUp } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TriageDistributionChart } from '@/components/dashboard/TriageDistribution';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TopValueBooks } from '@/components/dashboard/TopValueBooks';
import {
  useStats,
  useRevenueSummary,
  useActivity,
  useTriageDistribution,
} from '@/lib/hooks/useStats';
import { useBooks } from '@/lib/hooks/useBooks';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { stats, isLoading: statsLoading } = useStats();
  const { summary, isLoading: revenueLoading } = useRevenueSummary();
  const { activity, isLoading: activityLoading } = useActivity(10);
  const { distribution, isLoading: distLoading } = useTriageDistribution();
  const { books: topBooks, isLoading: topBooksLoading } = useBooks({
    sort: 'score_desc',
    limit: 5,
  });

  const today = formatDate(new Date().toISOString());

  return (
    <PageContainer max="xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-muted mt-0.5 font-body">{today}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/inventory">
            <Button variant="ghost" size="sm" icon={<BookOpen size={15} />}>
              View Inventory
            </Button>
          </Link>
          <Link href="/sales">
            <Button variant="secondary" size="sm" icon={<TrendingUp size={15} />}>
              View Sales
            </Button>
          </Link>
          <Link href="/triage">
            <Button variant="primary" size="sm" icon={<ScanLine size={15} />}>
              Triage a Book
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <section aria-label="Summary statistics" className="mb-8">
        <StatsCards stats={stats} loading={statsLoading} />
      </section>

      {/* Charts row */}
      <section
        aria-label="Revenue and triage charts"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      >
        <div className="lg:col-span-2">
          <RevenueChart
            data={summary?.by_month ?? []}
            loading={revenueLoading}
            variant="area"
          />
        </div>
        <div>
          <TriageDistributionChart
            data={distribution}
            loading={distLoading}
          />
        </div>
      </section>

      {/* Bottom row: activity + top books */}
      <section
        aria-label="Recent activity and top value books"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <RecentActivity entries={activity} loading={activityLoading} />
        <TopValueBooks books={topBooks} loading={topBooksLoading} />
      </section>
    </PageContainer>
  );
}
