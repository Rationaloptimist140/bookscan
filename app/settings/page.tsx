'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sun, Moon, Download, AlertTriangle } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useBooks } from '@/lib/hooks/useBooks';
import { RESALE_PLATFORM_OPTIONS } from '@/lib/constants';
import { downloadBlob, formatDate } from '@/lib/utils';
import { successToast, errorToast } from '@/components/ui/Toast';
import { IS_MOCK_MODE, API_BASE } from '@/lib/api';

const SETTINGS_KEY = 'bookscan-settings';

const settingsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  default_location: z.string().optional(),
  default_resale_platform: z.enum([
    'abebooks', 'ebay', 'amazon', 'ziffit', 'amazon_or_ziffit', 'world_of_books', 'direct',
  ]).optional(),
  auto_save_triage: z.boolean().optional(),
  currency: z.enum(['GBP', 'USD']).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS: SettingsFormValues = {
  name: '',
  email: '',
  default_location: '',
  default_resale_platform: 'abebooks',
  auto_save_triage: false,
  currency: 'GBP',
};

function loadSettings(): SettingsFormValues {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as SettingsFormValues;
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(vals: SettingsFormValues) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(vals));
  } catch { /* ignore */ }
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { books } = useBooks({ limit: 1000 });
  const [dangerStep, setDangerStep] = useState<0 | 1 | 2>(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULT_SETTINGS,
  });

  // Load persisted settings on mount
  useEffect(() => {
    reset(loadSettings());
  }, [reset]);

  const autoSave = watch('auto_save_triage');

  function onSave(vals: SettingsFormValues) {
    saveSettings(vals);
    successToast('Settings saved.');
  }

  function handleExportCsv() {
    if (IS_MOCK_MODE || books.length > 0) {
      const headers = [
        'id', 'title', 'author_name', 'isbn', 'publish_year', 'public_domain_status',
        'ai_training_value', 'triage_action', 'triage_score', 'scan_status',
        'resale_status', 'resale_price', 'acquisition_cost', 'created_at',
      ];
      const rows = books.map((b) =>
        headers.map((h) => {
          const val = (b as unknown as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','),
      );
      const csv = [headers.join(','), ...rows].join('\n');
      downloadBlob(
        `bookscan-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        'text/csv',
      );
      successToast('Inventory exported as CSV.');
    } else {
      errorToast('No books to export.');
    }
  }

  function handleDangerClear() {
    if (dangerStep === 0) {
      setDangerStep(1);
    } else if (dangerStep === 1) {
      setDangerStep(2);
    } else {
      // Double confirmed — clear localStorage
      try { window.localStorage.clear(); } catch { /* ignore */ }
      window.location.reload();
    }
  }

  // Mask a value — show first 4 chars then asterisks
  function maskValue(val: string): string {
    if (!val) return '(not set)';
    if (val.length <= 8) return '****' + val.slice(-2);
    return val.slice(0, 4) + '****' + val.slice(-4);
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // Note: NEXT_PUBLIC_SUPABASE_ANON_KEY must be public by design (anon key);
  // the service_role key must NEVER be in NEXT_PUBLIC_ and is never shown here.
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return (
    <PageContainer max="md">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted mt-0.5 font-body">
          Manage your profile, preferences, and data.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* Profile */}
        <Card>
          <CardTitle className="mb-4">Profile</CardTitle>
          <div className="space-y-4">
            <Input
              label="Name"
              placeholder="Your name"
              {...register('name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Default Location"
              placeholder="e.g. Oxford, UK"
              hint="Used for book sourcing context"
              {...register('default_location')}
            />
          </div>
        </Card>

        {/* API Configuration (read-only) */}
        <Card>
          <CardTitle className="mb-1">API Configuration</CardTitle>
          <p className="text-xs font-body text-ink-muted mb-4">
            These values are sourced from environment variables and are read-only.
            {IS_MOCK_MODE && (
              <span className="ml-1 text-warning font-medium">Mock mode is active — no backend required.</span>
            )}
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-body text-ink-muted mb-1">Backend API URL</p>
              <code className="block text-xs font-mono px-3 py-2 bg-canvas-alt rounded-md text-ink-body border border-rule break-all">
                {backendUrl || '(not configured — mock mode)'}
              </code>
            </div>
            <div>
              <p className="text-xs font-body text-ink-muted mb-1">Supabase URL</p>
              <code className="block text-xs font-mono px-3 py-2 bg-canvas-alt rounded-md text-ink-body border border-rule break-all">
                {supabaseUrl ? maskValue(supabaseUrl) : '(not configured)'}
              </code>
            </div>
            <div>
              <p className="text-xs font-body text-ink-muted mb-1">Supabase Anon Key</p>
              <code className="block text-xs font-mono px-3 py-2 bg-canvas-alt rounded-md text-ink-body border border-rule break-all">
                {supabaseAnonKey ? maskValue(supabaseAnonKey) : '(not configured)'}
              </code>
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <CardTitle className="mb-4">Preferences</CardTitle>
          <div className="space-y-4">
            <Select
              label="Default Resale Platform"
              options={RESALE_PLATFORM_OPTIONS}
              {...register('default_resale_platform')}
            />
            <Select
              label="Currency Display"
              options={[
                { value: 'GBP', label: '£ British Pounds (GBP)' },
                { value: 'USD', label: '$ US Dollars (USD)' },
              ]}
              {...register('currency')}
            />
            <label className="flex items-center gap-3 text-sm font-body text-ink-body cursor-pointer">
              <input
                type="checkbox"
                checked={autoSave ?? false}
                onChange={(e) => setValue('auto_save_triage', e.target.checked, { shouldDirty: true })}
                className="rounded border-rule accent-primary w-4 h-4"
              />
              <span>
                <span className="font-medium">Auto-save triage results</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  Automatically add books to inventory after triaging
                </span>
              </span>
            </label>

            {/* Dark mode toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-divider">
              <div>
                <p className="text-sm font-medium font-body text-ink-body">Dark Mode</p>
                <p className="text-xs font-body text-ink-muted">
                  Currently: {theme === 'dark' ? 'dark' : 'light'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                onClick={toggleTheme}
              >
                {theme === 'light' ? 'Enable Dark' : 'Enable Light'}
              </Button>
            </div>
          </div>
        </Card>

        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          loading={isSubmitting}
          disabled={!isDirty}
        >
          Save Settings
        </Button>
      </form>

      {/* Data export */}
      <Card className="mt-6">
        <CardTitle className="mb-1">Data Export</CardTitle>
        <p className="text-sm font-body text-ink-muted mb-4">
          Download a full export of your inventory as a CSV file.
        </p>
        <Button
          variant="outline"
          size="sm"
          icon={<Download size={15} />}
          onClick={handleExportCsv}
        >
          Export Inventory as CSV
        </Button>
      </Card>

      {/* Danger zone */}
      <Card className="mt-6 border-danger/30">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-danger" aria-hidden="true" />
          <CardTitle className="text-danger">Danger Zone</CardTitle>
        </div>
        <p className="text-sm font-body text-ink-muted mb-4">
          These actions are irreversible. Please be certain before proceeding.
        </p>
        {dangerStep === 0 && (
          <Button variant="danger" size="sm" onClick={handleDangerClear}>
            Clear All Local Data
          </Button>
        )}
        {dangerStep === 1 && (
          <div className="p-3 bg-danger-bg border border-danger/30 rounded-lg">
            <p className="text-sm font-body text-danger font-medium mb-3">
              Are you sure? This will clear all locally stored settings and cached data.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDangerStep(0)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDangerClear}>
                Yes, clear all data
              </Button>
            </div>
          </div>
        )}
        {dangerStep === 2 && (
          <div className="p-3 bg-danger-bg border border-danger/30 rounded-lg">
            <p className="text-sm font-body text-danger font-semibold mb-3">
              Final confirmation — this cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDangerStep(0)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDangerClear}>
                Confirm — Delete Everything
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
