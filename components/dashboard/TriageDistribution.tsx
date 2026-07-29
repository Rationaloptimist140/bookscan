'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Label,
} from 'recharts';
import { cn } from '@/lib/utils';
import { labelise, formatNumber } from '@/lib/utils';
import { TRIAGE_DISTRIBUTION_COLOURS } from '@/lib/constants';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { TriageDistributionSlice, TriageAction } from '@/lib/types';

export interface TriageDistributionChartProps {
  data: TriageDistributionSlice[];
  loading?: boolean;
  className?: string;
}

interface CentreProps {
  viewBox?: { cx?: number; cy?: number };
  total: number;
}

function CentreLabel({ viewBox, total }: CentreProps) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={22}
        fontWeight={700}
        fontFamily="'Fraunces', Georgia, serif"
        fill="#1C1C1E"
      >
        {formatNumber(total)}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontFamily="'Inter', system-ui, sans-serif"
        fill="#6B7280"
        letterSpacing="0.05em"
      >
        BOOKS
      </text>
    </>
  );
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: TriageDistributionSlice;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-md p-3 font-body text-sm">
      <p className="font-semibold text-ink mb-1">{labelise(entry.payload.action)}</p>
      <p className="font-mono text-ink-body">{formatNumber(entry.value)} books</p>
    </div>
  );
}

/**
 * Donut PieChart of triage action distribution with a centre total,
 * coloured from TRIAGE_DISTRIBUTION_COLOURS, and a percentage legend.
 * Named `TriageDistributionChart` to avoid colliding with the `TriageDistributionSlice` type.
 */
export function TriageDistributionChart({
  data,
  loading = false,
  className,
}: TriageDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const legendFormatter = (value: string) => {
    const slice = data.find((d) => d.action === value);
    const pct = total > 0 && slice ? Math.round((slice.count / total) * 100) : 0;
    return `${labelise(value)} (${pct}%)`;
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader title="Triage Distribution" subtitle="Books by recommended action" />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Skeleton width={200} height={200} rounded="full" />
          <Skeleton height={12} className="w-3/4" />
          <Skeleton height={12} className="w-2/3" />
        </div>
      ) : data.length === 0 || total === 0 ? (
        <EmptyState
          title="No triage data yet"
          message="Triage some books to see distribution here."
        />
      ) : (
        <div aria-label="Triage distribution chart">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="78%"
                dataKey="count"
                nameKey="action"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.action}
                    fill={TRIAGE_DISTRIBUTION_COLOURS[entry.action as TriageAction] ?? '#D8D3CA'}
                  />
                ))}
                <Label
                  content={(props) => (
                    <CentreLabel viewBox={props.viewBox as { cx?: number; cy?: number }} total={total} />
                  )}
                  position="center"
                />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={legendFormatter}
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body, Inter, system-ui)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
