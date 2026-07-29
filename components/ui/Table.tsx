'use client';

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  className?: string;
  stickyHeader?: boolean;
}

const ALIGN_CLASSES: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  loading = false,
  skeletonRows = 5,
  emptyState,
  className,
  stickyHeader = false,
}: TableProps<T>) {
  const allIds = rows.map(rowKey);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = allIds.some((id) => selectedIds.includes(id)) && !allSelected;

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : allIds);
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  function handleSort(key: string) {
    onSort?.(key);
  }

  function getSortIcon(col: Column<T>) {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ChevronsUpDown size={13} className="opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} />
      : <ChevronDown size={13} />;
  }

  function getAriaSortAttr(col: Column<T>): React.AriaAttributes['aria-sort'] {
    if (!col.sortable || sortKey !== col.key) return undefined;
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-rule', className)}>
      <table className="w-full border-collapse text-sm font-body">
        <thead
          className={cn(
            'bg-canvas-alt',
            stickyHeader && 'sticky top-0 z-10',
          )}
        >
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="rounded border-rule accent-primary cursor-pointer"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                aria-sort={getAriaSortAttr(col)}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-3 font-semibold text-[13px] uppercase tracking-wide text-ink-muted',
                  ALIGN_CLASSES[col.align ?? 'left'],
                  col.className,
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 hover:text-ink transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
                    )}
                  >
                    {col.header}
                    {getSortIcon(col)}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-divider">
                {selectable && (
                  <td className="px-4 py-3">
                    <Skeleton width={16} height={16} rounded="sm" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton height={16} className="w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={selectable ? columns.length + 1 : columns.length}
                className="py-12 text-center"
              >
                {emptyState ?? (
                  <span className="text-ink-muted text-sm">No results found.</span>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const id = rowKey(row);
              const isSelected = selectedIds.includes(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-divider transition-colors duration-150',
                    'hover:bg-surface-hover',
                    onRowClick && 'cursor-pointer',
                    isSelected && 'bg-primary-bg hover:bg-primary-bg',
                  )}
                >
                  {selectable && (
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${index + 1}`}
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        className="rounded border-rule accent-primary cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-[15px] text-ink-body',
                        ALIGN_CLASSES[col.align ?? 'left'],
                        col.className,
                      )}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
