'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ScanLine,
  BookOpen,
  Camera,
  Database,
  TrendingUp,
  Settings,
  Sun,
  Moon,
  X,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, APP_NAME, APP_VERSION } from '@/lib/constants';
import { useTheme } from '@/components/providers/ThemeProvider';

const ICON_MAP = {
  LayoutDashboard,
  ScanLine,
  BookOpen,
  Camera,
  Database,
  TrendingUp,
  Settings,
} as const;

type IconName = keyof typeof ICON_MAP;

function NavItem({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const Icon = ICON_MAP[icon as IconName] ?? LayoutDashboard;

  // Exact match for dashboard ('/'), prefix match for others
  const isActive =
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-md mx-2 text-sm font-medium font-body',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        'border-l-[3px]',
        isActive
          ? 'bg-primary-bg text-primary border-primary'
          : 'text-ink-muted hover:bg-surface-hover hover:text-ink-body border-transparent',
      )}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-rule">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          <span className="text-xl" aria-hidden="true">📚</span>
          <span className="font-heading font-semibold text-xl text-primary">
            {APP_NAME}
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-canvas-alt transition-colors lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label="Main navigation"
        className="flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto"
      >
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            onClick={onClose}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-rule flex items-center justify-between">
        <span className="text-xs text-ink-light font-mono">v{APP_VERSION}</span>
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className={cn(
            'p-2 rounded-md text-ink-muted transition-colors duration-150',
            'hover:text-ink hover:bg-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          )}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button — shown only below lg */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        className={cn(
          'fixed top-3 left-3 z-[201] p-2 rounded-md bg-surface border border-rule shadow-sm',
          'text-ink-muted hover:text-ink transition-colors lg:hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        )}
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className={cn(
          'hidden lg:flex flex-col w-60 shrink-0 bg-canvas border-r border-rule',
          'sticky top-0 h-screen overflow-y-auto z-[200]',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[299] bg-ink/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed inset-y-0 left-0 z-[300] w-64 bg-canvas border-r border-rule shadow-lg',
          'transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </div>
    </>
  );
}
