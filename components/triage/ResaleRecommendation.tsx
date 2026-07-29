import * as React from 'react';
import { ExternalLink, Tag, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS } from '@/lib/constants';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import type { ResaleRecommendation } from '@/lib/types';

export interface ResaleRecommendationCardProps {
  recommendation: ResaleRecommendation;
  className?: string;
}

/**
 * Card displaying a resale platform recommendation with estimated price range
 * and actionable listing tips.
 * Named `ResaleRecommendationCard` to avoid colliding with the `ResaleRecommendation` type.
 */
export function ResaleRecommendationCard({
  recommendation,
  className,
}: ResaleRecommendationCardProps) {
  const platformLabel =
    PLATFORM_LABELS[recommendation.platform] ?? recommendation.platform_label;

  return (
    <Card className={cn('', className)}>
      <CardHeader
        title="Resale Recommendation"
        action={
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-bg text-secondary font-body text-[13px] font-semibold uppercase tracking-wide">
            <TrendingUp size={13} aria-hidden="true" />
            {platformLabel}
          </span>
        }
      />
      <CardBody>
        <p className="text-ink-body text-sm leading-relaxed mb-3">
          {recommendation.reason}
        </p>

        <div className="flex items-center gap-2 mb-4">
          <Tag size={14} className="text-accent shrink-0" aria-hidden="true" />
          <span className="font-mono text-sm text-ink font-medium">
            {recommendation.estimated_price_range}
          </span>
          <span className="text-ink-muted text-sm">estimated</span>
        </div>

        {recommendation.listing_tips.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Listing Tips
            </p>
            <ul className="flex flex-col gap-1.5" role="list">
              {recommendation.listing_tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-ink-body"
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                    aria-hidden="true"
                  />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
