'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle, BookOpen, ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS } from '@/lib/constants';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TriageScore } from './TriageScore';
import { StatusBadges } from './StatusBadges';
import { ValueFactors } from './ValueFactors';
import { ResaleRecommendationCard } from './ResaleRecommendation';
import { SaveToInventory } from './SaveToInventory';
import type { Book, TriageResult as TriageResultType } from '@/lib/types';

export interface TriageResultProps {
  result: TriageResultType;
  onSaved?: (book: Book) => void;
  onScan?: () => void;
}

interface MetaRowProps {
  label: string;
  children: React.ReactNode;
}

function MetaRow({ label, children }: MetaRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted font-body">
        {label}
      </dt>
      <dd className="text-sm text-ink-body font-body leading-snug">{children}</dd>
    </div>
  );
}

/**
 * Full triage result card — shows title, score gauge, status badges, metadata
 * grid, value factors, resale recommendation, and a sticky action bar.
 */
export function TriageResult({ result, onSaved, onScan }: TriageResultProps) {
  const resalePlatformLabel =
    PLATFORM_LABELS[result.resale_recommendation.platform] ??
    result.resale_recommendation.platform_label;

  return (
    <article className="flex flex-col gap-4" aria-label={`Triage result for ${result.title}`}>
      {/* Warnings / cached banner */}
      {(result.warnings.length > 0 || result.cached) && (
        <div className="flex flex-col gap-2">
          {result.cached && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-info-bg border border-info/20 text-info text-sm font-body">
              <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
              <span>Result from cache — triage was run previously.</span>
            </div>
          )}
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-md bg-warning-bg border border-warning/20 text-warning text-sm font-body"
            >
              <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main card */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          {/* Score gauge */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <TriageScore score={result.triage_score} size={120} animate />
          </div>

          {/* Book identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <h2 className="font-heading text-2xl font-bold text-ink leading-tight">
                {result.title}
              </h2>
              {result.publish_year && (
                <span className="font-mono text-sm text-ink-muted shrink-0">
                  {result.publish_year}
                </span>
              )}
            </div>
            {result.subtitle && (
              <p className="font-heading text-base text-ink-muted italic mb-1">
                {result.subtitle}
              </p>
            )}
            <p className="text-sm text-ink-muted font-body mb-4">{result.author_name}</p>
            <StatusBadges
              pdStatus={result.public_domain_status}
              aiValue={result.ai_training_value}
              triageAction={result.triage_action}
              size="md"
            />
          </div>
        </div>

        <div className="border-t border-divider px-6 py-5">
          {/* Metadata grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
            {result.author_death_year !== null && (
              <MetaRow label="Author Death Year">
                <span className="font-mono">{result.author_death_year}</span>
              </MetaRow>
            )}
            <MetaRow label="Public Domain">
              {result.public_domain_reason}
            </MetaRow>
            <MetaRow label="On Gutenberg?">
              {result.gutenberg_id ? (
                <span className="inline-flex items-center gap-1">
                  Yes — ID{' '}
                  <a
                    href={result.gutenberg_url ?? `https://www.gutenberg.org/ebooks/${result.gutenberg_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5 hover:text-primary-dark transition-colors duration-150"
                  >
                    {result.gutenberg_id}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </span>
              ) : (
                <span className="text-success font-medium">
                  No — potentially unique data
                </span>
              )}
            </MetaRow>
            <MetaRow label="Pre-LLM Era?">
              {result.pre_llm_era === true
                ? 'Yes — pre-2022, clean training data'
                : result.pre_llm_era === false
                ? 'No — post-2022 publication'
                : 'Unknown'}
            </MetaRow>
            <MetaRow label="Recommended Platform">
              {resalePlatformLabel}
            </MetaRow>
            <MetaRow label="Resale Reason">
              {result.resale_recommendation.reason}
            </MetaRow>
          </dl>

          {/* AI Value factors */}
          {result.ai_value_factors.length > 0 && (
            <section aria-label="AI training value factors" className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                AI Training Value Factors
              </p>
              <ValueFactors factors={result.ai_value_factors} />
            </section>
          )}

          {/* Resale recommendation detail */}
          <ResaleRecommendationCard recommendation={result.resale_recommendation} />
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 border-t border-divider bg-surface/95 backdrop-blur-sm px-6 py-4 flex flex-wrap items-center gap-3">
          <SaveToInventory result={result} onSaved={onSaved} />
          {result.triage_action === 'scan_and_sell_data' && onScan && (
            <Button
              variant="secondary"
              icon={<Zap size={16} aria-hidden="true" />}
              onClick={onScan}
            >
              Scan This Book
            </Button>
          )}
        </div>
      </Card>
    </article>
  );
}
