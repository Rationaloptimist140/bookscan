'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelise } from '@/lib/utils';
import {
  PUBLIC_DOMAIN_STATUSES,
  AI_TRAINING_VALUES,
  TRIAGE_ACTIONS,
  SCAN_STATUSES,
  RESALE_STATUSES,
} from '@/lib/types';
import { SORT_OPTIONS } from '@/lib/constants';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { BookQuery, PublicDomainStatus, AiTrainingValue, TriageAction, ScanStatus, ResaleStatus } from '@/lib/types';

export interface BookFiltersProps {
  query: BookQuery;
  onChange: (q: BookQuery) => void;
  onReset?: () => void;
  className?: string;
}

interface FilterSectionProps {
  title: string;
  activeCount: number;
  children: React.ReactNode;
}

function FilterSection({ title, activeCount, children }: FilterSectionProps) {
  const [open, setOpen] = React.useState(true);
  const id = `filter-section-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border-b border-divider last:border-b-0 pb-3 mb-3 last:pb-0 last:mb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between py-1.5 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold font-body text-ink-body">{title}</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-primary text-ink-inverse text-[11px] font-semibold rounded-full">
              {activeCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp size={14} className="text-ink-muted shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown size={14} className="text-ink-muted shrink-0" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-1.5 mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-rule accent-primary cursor-pointer w-4 h-4 shrink-0"
      />
      <span className="text-sm font-body text-ink-body group-hover:text-ink transition-colors duration-150">
        {label}
      </span>
    </label>
  );
}

/**
 * Sidebar filter panel with debounced search input, checkbox groups for
 * each status dimension, a sort selector, and a "Clear all" action.
 */
export function BookFilters({ query, onChange, onReset, className }: BookFiltersProps) {
  const [localSearch, setLocalSearch] = React.useState(query.search ?? '');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local search state if query.search is reset externally
  React.useEffect(() => {
    setLocalSearch(query.search ?? '');
  }, [query.search]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...query, search: value || undefined, page: 1 });
    }, 300);
  }

  function toggleFilter<T extends string>(
    field: keyof BookQuery,
    value: T,
    currentValues: T[] | undefined,
  ) {
    const arr = currentValues ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onChange({ ...query, [field]: next.length > 0 ? next : undefined, page: 1 });
  }

  const totalActive =
    (query.public_domain_status?.length ?? 0) +
    (query.ai_training_value?.length ?? 0) +
    (query.triage_action?.length ?? 0) +
    (query.scan_status?.length ?? 0) +
    (query.sale_status?.length ?? 0);

  return (
    <aside
      className={cn('flex flex-col gap-4', className)}
      aria-label="Book filters"
    >
      {/* Search */}
      <Input
        label="Search"
        placeholder="Title, author or ISBN…"
        value={localSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        aria-label="Search books"
      />

      {/* Sort */}
      <Select
        label="Sort by"
        value={query.sort ?? 'newest'}
        options={SORT_OPTIONS}
        onChange={(e) => onChange({ ...query, sort: e.target.value as BookQuery['sort'], page: 1 })}
        aria-label="Sort books"
      />

      {/* Filter sections */}
      <div className="bg-surface border border-rule rounded-lg p-4">
        <FilterSection
          title="Public Domain"
          activeCount={query.public_domain_status?.length ?? 0}
        >
          {PUBLIC_DOMAIN_STATUSES.map((status) => (
            <CheckboxRow
              key={status}
              label={labelise(status)}
              checked={query.public_domain_status?.includes(status as PublicDomainStatus) ?? false}
              onChange={() =>
                toggleFilter('public_domain_status', status as PublicDomainStatus, query.public_domain_status)
              }
            />
          ))}
        </FilterSection>

        <FilterSection
          title="AI Training Value"
          activeCount={query.ai_training_value?.length ?? 0}
        >
          {AI_TRAINING_VALUES.map((value) => (
            <CheckboxRow
              key={value}
              label={labelise(value)}
              checked={query.ai_training_value?.includes(value as AiTrainingValue) ?? false}
              onChange={() =>
                toggleFilter('ai_training_value', value as AiTrainingValue, query.ai_training_value)
              }
            />
          ))}
        </FilterSection>

        <FilterSection
          title="Triage Action"
          activeCount={query.triage_action?.length ?? 0}
        >
          {TRIAGE_ACTIONS.map((action) => (
            <CheckboxRow
              key={action}
              label={labelise(action)}
              checked={query.triage_action?.includes(action as TriageAction) ?? false}
              onChange={() =>
                toggleFilter('triage_action', action as TriageAction, query.triage_action)
              }
            />
          ))}
        </FilterSection>

        <FilterSection
          title="Scan Status"
          activeCount={query.scan_status?.length ?? 0}
        >
          {SCAN_STATUSES.map((status) => (
            <CheckboxRow
              key={status}
              label={labelise(status)}
              checked={query.scan_status?.includes(status as ScanStatus) ?? false}
              onChange={() =>
                toggleFilter('scan_status', status as ScanStatus, query.scan_status)
              }
            />
          ))}
        </FilterSection>

        <FilterSection
          title="Sale Status"
          activeCount={query.sale_status?.length ?? 0}
        >
          {RESALE_STATUSES.map((status) => (
            <CheckboxRow
              key={status}
              label={labelise(status)}
              checked={query.sale_status?.includes(status as ResaleStatus) ?? false}
              onChange={() =>
                toggleFilter('sale_status', status as ResaleStatus, query.sale_status)
              }
            />
          ))}
        </FilterSection>
      </div>

      {/* Clear all */}
      {(totalActive > 0 || localSearch) && (
        <Button
          variant="ghost"
          size="sm"
          icon={<X size={14} aria-hidden="true" />}
          onClick={() => {
            setLocalSearch('');
            onReset?.();
          }}
          fullWidth
        >
          Clear all filters
          {totalActive > 0 && ` (${totalActive})`}
        </Button>
      )}
    </aside>
  );
}
