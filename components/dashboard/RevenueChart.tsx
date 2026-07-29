'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { CHART_COLOURS } from '@/lib/constants';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MonthlyRevenuePoint } from '@/lib/types';

export interface RevenueChartProps {
  data: MonthlyRevenuePoint[];
  loading?: boolean;
  variant?: 'area' | 'bar';
  className?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-md p-3 font-body text-sm">
      <p className="font-semibold text-ink mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-ink-muted capitalize">{entry.name}</span>
          </div>
          <span className="font-mono font-medium text-ink">{formatCurrency(entry.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-2 pt-2 border-t border-divider flex items-center justify-between">
          <span className="text-ink-muted">Total</span>
          <span className="font-mono font-semibold text-ink">
            {formatCurrency(payload.reduce((s, e) => s + e.value, 0))}
          </span>
        </div>
      )}
    </div>
  );
}

function yAxisFormatter(value: number) {
  if (value >= 1000) return `£${(value / 1000).toFixed(1)}k`;
  return `£${value}`;
}

/**
 * Stacked area or bar chart of monthly revenue split by data sales (gold)
 * and physical sales (teal). Switches between variants via the `variant` prop.
 */
export function RevenueChart({
  data,
  loading = false,
  variant = 'area',
  className,
}: RevenueChartProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader title="Revenue Over Time" subtitle="Monthly data sales and physical sales" />

      {loading ? (
        <Skeleton height={260} rounded="md" />
      ) : data.length === 0 ? (
        <EmptyState
          title="No revenue data yet"
          message="Revenue will appear here once you record your first sale."
        />
      ) : (
        <div aria-label="Revenue over time chart">
          <ResponsiveContainer width="100%" height={260}>
            {variant === 'bar' ? (
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLOURS.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)', fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yAxisFormatter}
                  tick={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)', fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLOURS.grid }} />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)' }}
                />
                <Bar dataKey="data_revenue" name="Data Sales" stackId="a" fill={CHART_COLOURS.data} radius={[0, 0, 0, 0]} />
                <Bar dataKey="physical_revenue" name="Physical Sales" stackId="a" fill={CHART_COLOURS.physical} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradData" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLOURS.data} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_COLOURS.data} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradPhysical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLOURS.physical} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_COLOURS.physical} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLOURS.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)', fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yAxisFormatter}
                  tick={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)', fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)' }}
                />
                <Area
                  type="monotone"
                  dataKey="data_revenue"
                  name="Data Sales"
                  stackId="1"
                  stroke={CHART_COLOURS.data}
                  strokeWidth={2}
                  fill="url(#gradData)"
                />
                <Area
                  type="monotone"
                  dataKey="physical_revenue"
                  name="Physical Sales"
                  stackId="1"
                  stroke={CHART_COLOURS.physical}
                  strokeWidth={2}
                  fill="url(#gradPhysical)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
