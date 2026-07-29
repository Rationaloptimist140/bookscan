'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
  className?: string;
}

export function Tabs({ tabs, value, onChange, fullWidth = false, className }: TabsProps) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((t) => t.value === value);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (currentIndex + 1) % tabs.length;
      const tab = tabs[next];
      if (tab) {
        onChange(tab.value);
        tabRefs.current[next]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (currentIndex - 1 + tabs.length) % tabs.length;
      const tab = tabs[prev];
      if (tab) {
        onChange(tab.value);
        tabRefs.current[prev]?.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = tabs[0];
      if (first) {
        onChange(first.value);
        tabRefs.current[0]?.focus();
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = tabs[tabs.length - 1];
      if (last) {
        onChange(last.value);
        tabRefs.current[tabs.length - 1]?.focus();
      }
    }
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className={cn(
        'flex border-b border-rule',
        fullWidth && 'w-full',
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.value}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 px-4 py-2.5',
              'text-sm font-medium font-body transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:rounded',
              'whitespace-nowrap',
              fullWidth && 'flex-1 justify-center',
              isActive
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-ink-muted hover:text-ink-body hover:border-b-2 hover:border-rule -mb-px',
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1',
                  'text-[11px] font-semibold rounded-full',
                  isActive
                    ? 'bg-primary text-ink-inverse'
                    : 'bg-canvas-alt text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
