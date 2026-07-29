'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, TrendingUp } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, SaleStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { useSales, createSale } from '@/lib/hooks/useSales';
import { useRevenueSummary } from '@/lib/hooks/useStats';
import {
  PLATFORM_LABELS,
  PLATFORM_COLOURS,
  RESALE_PLATFORM_OPTIONS,
  DATA_PLATFORM_OPTIONS,
} from '@/lib/constants';
import type { Sale, SaleQuery, SaleType } from '@/lib/types';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Column } from '@/components/ui/Table';

// ── Schema ────────────────────────────────────────────────────────────────────

const saleSchema = z.object({
  sale_type: z.enum(['data', 'physical']),
  platform: z.string().min(1, 'Platform is required'),
  asking_price: z.coerce.number().min(0).optional().or(z.literal('')),
  final_price: z.coerce.number().min(0).optional().or(z.literal('')),
  buyer_name: z.string().optional(),
  notes: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleSchema>;

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  colour = 'text-ink',
}: {
  label: string;
  value: string;
  sub?: string;
  colour?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-body uppercase tracking-wide text-ink-muted mb-2">{label}</p>
      <p className={cn('font-heading text-2xl font-semibold', colour)}>{value}</p>
      {sub && <p className="text-xs font-body text-ink-muted mt-1">{sub}</p>}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [filterType, setFilterType] = useState<SaleType | ''>('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const query: SaleQuery = {
    sale_type: filterType || undefined,
    platform: filterPlatform || undefined,
  };
  const { sales, total, isLoading, mutate } = useSales(query);
  const { summary, isLoading: revenueLoading } = useRevenueSummary();

  const {
    register,
    handleSubmit,
    reset: resetForm,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: { sale_type: 'physical' },
  });

  const saleType = watch('sale_type');
  const platformOptions = saleType === 'data'
    ? DATA_PLATFORM_OPTIONS
    : RESALE_PLATFORM_OPTIONS;

  async function onCreate(values: SaleFormValues) {
    const sale = await createSale(
      {
        sale_type: values.sale_type,
        platform: values.platform,
        asking_price: values.asking_price ? Number(values.asking_price) : null,
        final_price: values.final_price ? Number(values.final_price) : null,
        buyer_name: values.buyer_name || null,
        notes: values.notes || null,
      },
      mutate,
    );
    if (sale) {
      setCreateOpen(false);
      resetForm();
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Revenue numbers
  const totalRevenue = summary?.total_revenue ?? 0;
  const dataRevenue = summary?.data_revenue ?? 0;
  const physicalRevenue = summary?.physical_revenue ?? 0;

  // Platform breakdown for pie chart
  const platformData = (summary?.by_platform ?? []).map((p) => ({
    name: PLATFORM_LABELS[p.platform] ?? p.platform,
    value: p.revenue,
    fill: PLATFORM_COLOURS[p.platform] ?? '#9CA3AF',
  }));

  // Table columns
  const columns: Column<Sale>[] = [
    {
      key: 'book_title',
      header: 'Book / Dataset',
      render: (sale) => (
        <span className="font-medium text-ink-body">
          {sale.book_title ?? '—'}
        </span>
      ),
    },
    {
      key: 'sale_type',
      header: 'Type',
      sortable: true,
      render: (sale) => (
        <Badge tone={sale.sale_type === 'data' ? 'accent' : 'primary'} size="sm">
          {sale.sale_type}
        </Badge>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (sale) => (
        <span className="text-ink-muted">
          {PLATFORM_LABELS[sale.platform] ?? sale.platform}
        </span>
      ),
    },
    {
      key: 'asking_price',
      header: 'Asking',
      align: 'right',
      sortable: true,
      render: (sale) => (
        <span className="font-mono text-sm">
          {sale.asking_price != null ? formatCurrency(sale.asking_price) : '—'}
        </span>
      ),
    },
    {
      key: 'final_price',
      header: 'Final',
      align: 'right',
      sortable: true,
      render: (sale) => (
        <span className="font-mono text-sm font-semibold text-primary">
          {sale.final_price != null ? formatCurrency(sale.final_price) : '—'}
        </span>
      ),
    },
    {
      key: 'sold_at',
      header: 'Date',
      sortable: true,
      render: (sale) => (
        <span className="font-mono text-xs text-ink-muted">
          {sale.sold_at ? formatDate(sale.sold_at) : formatDate(sale.created_at)}
        </span>
      ),
    },
    {
      key: 'buyer_name',
      header: 'Buyer',
      render: (sale) => (
        <span className="text-sm text-ink-muted">{sale.buyer_name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (sale) => <SaleStatusBadge status={sale.status} size="sm" />,
    },
  ];

  return (
    <PageContainer max="xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Sales</h1>
          {total > 0 && (
            <p className="text-sm text-ink-muted mt-0.5 font-body">{total} sale record{total !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => setCreateOpen(true)}
        >
          Record Sale
        </Button>
      </div>

      {/* Stats */}
      <section aria-label="Revenue statistics" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {revenueLoading ? (
          <SkeletonStatCards count={3} />
        ) : (
          <>
            <StatCard
              label="Total Revenue"
              value={formatCurrency(totalRevenue)}
              colour="text-primary"
            />
            <StatCard
              label="Data Sales"
              value={formatCurrency(dataRevenue)}
              colour="text-accent"
            />
            <StatCard
              label="Physical Sales"
              value={formatCurrency(physicalRevenue)}
              colour="text-secondary"
            />
          </>
        )}
      </section>

      {/* Charts */}
      <section aria-label="Revenue charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueChart
          data={summary?.by_month ?? []}
          loading={revenueLoading}
          variant="bar"
        />
        <Card>
          <CardTitle className="mb-4">Revenue by Platform</CardTitle>
          {revenueLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-canvas-alt animate-pulse" />
            </div>
          ) : platformData.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm font-body text-ink-muted">No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(val: number) => formatCurrency(val)}
                  contentStyle={{ fontFamily: 'var(--font-inter)', fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontFamily: 'var(--font-inter)', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </section>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select
          size="sm"
          options={[
            { value: '', label: 'All types' },
            { value: 'data', label: 'Data sales' },
            { value: 'physical', label: 'Physical sales' },
          ]}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as SaleType | '')}
          aria-label="Filter by sale type"
        />
        <Input
          size="sm"
          placeholder="Filter by platform…"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="w-44"
          aria-label="Filter by platform"
        />
        {(filterType || filterPlatform) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterType(''); setFilterPlatform(''); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Sales table */}
      {isLoading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : (
        <Table
          columns={columns}
          rows={sales}
          rowKey={(s) => s.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          emptyState={
            <EmptyState
              icon={<TrendingUp size={32} className="text-ink-muted" />}
              title="No sales recorded yet"
              message="Record a sale to start tracking your revenue."
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  Record Sale
                </Button>
              }
            />
          }
        />
      )}

      {/* Record sale modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="Record Sale"
        description="Log a completed or in-progress sale."
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={isSubmitting} onClick={handleSubmit(onCreate)}>
              Save Sale
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <Select
            label="Type *"
            options={[
              { value: 'physical', label: 'Physical book' },
              { value: 'data', label: 'Data / dataset' },
            ]}
            error={errors.sale_type?.message}
            {...register('sale_type')}
          />
          <Select
            label="Platform *"
            options={[{ value: '', label: 'Select platform…' }, ...platformOptions]}
            error={errors.platform?.message}
            {...register('platform')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Asking Price (£)"
              type="number"
              step="0.01"
              error={errors.asking_price?.message}
              {...register('asking_price')}
            />
            <Input
              label="Final Price (£)"
              type="number"
              step="0.01"
              error={errors.final_price?.message}
              {...register('final_price')}
            />
          </div>
          <Input label="Buyer Name" placeholder="e.g. Acme Ltd" {...register('buyer_name')} />
          <div>
            <label className="text-sm font-medium font-body text-ink-body block mb-1.5">Notes</label>
            <textarea
              {...register('notes')}
              className="w-full h-20 px-3.5 py-2.5 border border-rule rounded-md bg-surface text-[15px] font-body text-ink-body focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none"
              placeholder="Optional notes…"
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
