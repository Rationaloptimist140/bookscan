'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Settings, Sun, Moon, User, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function TopBar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/inventory?search=${encodeURIComponent(search.trim())}`);
    setSearch('');
  }

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-[200] h-14 bg-surface/80 backdrop-blur-md',
        'border-b border-rule flex items-center gap-3 px-4 lg:px-6',
      )}
    >
      {/* Spacer for mobile hamburger */}
      <div className="w-10 shrink-0 lg:hidden" aria-hidden="true" />

      {/* Global search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 max-w-md"
        role="search"
        aria-label="Search inventory"
      >
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books…"
            aria-label="Search inventory"
            className={cn(
              'w-full h-9 pl-9 pr-3 text-sm font-body text-ink-body',
              'bg-canvas-alt border border-rule rounded-md',
              'placeholder:text-ink-light',
              'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-surface',
              'transition-colors duration-200',
            )}
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            ref={triggerRef}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="User menu"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium font-body',
              'text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            )}
          >
            <User size={16} />
            <span className="hidden sm:inline">Account</span>
            <ChevronDown
              size={14}
              className={cn('transition-transform duration-150', menuOpen && 'rotate-180')}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="User options"
              className={cn(
                'absolute right-0 top-full mt-1.5 w-48 bg-surface border border-rule rounded-lg shadow-md py-1',
                'z-[100]',
              )}
            >
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-ink-body',
                  'hover:bg-surface-hover transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:bg-surface-hover',
                )}
              >
                <Settings size={15} className="text-ink-muted" />
                Settings
              </Link>
              <div className="border-t border-divider my-1" />
              <button
                role="menuitem"
                onClick={() => {
                  toggleTheme();
                  setMenuOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-ink-body text-left',
                  'hover:bg-surface-hover transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:bg-surface-hover',
                )}
              >
                {theme === 'light' ? (
                  <>
                    <Moon size={15} className="text-ink-muted" />
                    Dark mode
                  </>
                ) : (
                  <>
                    <Sun size={15} className="text-ink-muted" />
                    Light mode
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
