'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { scoreColour } from '@/lib/constants';

export interface TriageScoreProps {
  score: number;
  size?: number;
  label?: string;
  animate?: boolean;
  className?: string;
}

/**
 * Animated SVG circular gauge showing a triage score (0–100).
 * Background ring: #F0EDE7, 3px. Score ring: 6px, coloured by score band.
 * Number centred in Fraunces 32px bold. "TRIAGE SCORE" label in Inter 11px below.
 * Animates 0 → score on mount over 400ms spring; respects prefers-reduced-motion.
 */
export function TriageScore({
  score,
  size = 120,
  label = 'TRIAGE SCORE',
  animate = true,
  className,
}: TriageScoreProps) {
  const clamped = Math.min(Math.max(Math.round(score), 0), 100);
  const colour = scoreColour(clamped);

  // Geometry — score ring sits inset from the background ring
  const strokeBg = 3;
  const strokeFg = 6;
  // Use the larger stroke for radius calculation to keep both rings contained
  const padding = strokeFg / 2 + 2;
  const radius = (size - 2 * padding) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Detect reduced-motion preference
  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const shouldAnimate = animate && !prefersReducedMotion;

  const [displayedScore, setDisplayedScore] = React.useState(shouldAnimate ? 0 : clamped);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedScore(clamped);
      return;
    }

    const duration = 400;
    // Spring-like easing: cubic-bezier(0.34, 1.56, 0.64, 1)
    function springEase(t: number): number {
      // Approximate the spring cubic-bezier with a bounce-overshoot
      const c1 = 0.34;
      const c2 = 1.56;
      const c3 = 0.64;
      // Simple polynomial approximation of the bezier
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        3 * c1 * t * (1 - t) * (1 - t) +
        3 * c2 * t2 * (1 - t) +
        c3 * t3
      );
    }

    function frame(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = springEase(progress);
      setDisplayedScore(Math.round(eased * clamped));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setDisplayedScore(clamped);
      }
    }

    startRef.current = null;
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [clamped, shouldAnimate]);

  const dashOffset = circumference - (displayedScore / 100) * circumference;

  // Font sizes scale proportionally with the size prop (base is 120px)
  const scale = size / 120;
  const scoreFontSize = Math.round(32 * scale);
  const labelFontSize = Math.round(11 * scale);
  const labelY = cy + Math.round(26 * scale);
  const scoreY = cy + Math.round(6 * scale);

  return (
    <div
      className={cn('inline-flex flex-col items-center', className)}
      role="img"
      aria-label={`Triage score: ${clamped} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#F0EDE7"
          strokeWidth={strokeBg}
        />
        {/* Score ring — starts from 12 o'clock, rotated -90deg */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={strokeFg}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: shouldAnimate ? undefined : 'none' }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={scoreY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scoreFontSize}
          fontWeight="700"
          fontFamily="'Fraunces', Georgia, serif"
          fill="currentColor"
          className="text-ink"
        >
          {displayedScore}
        </text>
        {/* Label */}
        {label && (
          <text
            x={cx}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={labelFontSize}
            fontWeight="400"
            fontFamily="'Inter', system-ui, sans-serif"
            letterSpacing="0.05em"
            fill="currentColor"
            className="text-ink-muted uppercase"
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
