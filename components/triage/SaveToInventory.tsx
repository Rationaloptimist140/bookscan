'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { successToast, errorToast } from '@/components/ui/Toast';
import { createBook } from '@/lib/hooks/useBooks';
import type { Book, BookCreatePayload, TriageResult } from '@/lib/types';

export interface SaveToInventoryProps {
  result: TriageResult;
  onSaved?: (book: Book) => void;
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  size: number;
}

const PARTICLE_COLOURS = [
  '#2D5F4F', '#C49A4D', '#5B8C8A', '#3A7A66',
  '#D4AF6A', '#7BA8A6', '#1F4537', '#B5523E',
];

/**
 * Saves a TriageResult to inventory. Shows a loading state while saving,
 * fires a success toast on completion, and flips to a disabled "Saved" state.
 * Includes a subtle particle burst animation (respects prefers-reduced-motion).
 */
export function SaveToInventory({ result, onSaved, className }: SaveToInventoryProps) {
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [particles, setParticles] = React.useState<Particle[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const particleIdRef = React.useRef(0);

  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  function spawnParticles() {
    if (prefersReducedMotion) return;

    const count = 10;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      return {
        id: particleIdRef.current++,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour: PARTICLE_COLOURS[i % PARTICLE_COLOURS.length] as string,
        size: 4 + Math.random() * 4,
      };
    });

    setParticles(newParticles);

    // Clear particles after ~1 second
    const timeout = setTimeout(() => {
      setParticles([]);
    }, 900);

    return () => clearTimeout(timeout);
  }

  async function handleSave() {
    if (saved || loading) return;
    setLoading(true);

    const payload: BookCreatePayload = {
      isbn: result.isbn ?? undefined,
      title: result.title,
      subtitle: result.subtitle ?? undefined,
      author_name: result.author_name,
      author_birth_year: result.author_birth_year ?? undefined,
      author_death_year: result.author_death_year ?? undefined,
      publisher: result.publisher ?? undefined,
      publish_year: result.publish_year ?? undefined,
      language: result.language,
      page_count: result.page_count ?? undefined,
      subject_keywords: result.subject_keywords,
      description: result.description ?? undefined,
      public_domain_status: result.public_domain_status,
      public_domain_reason: result.public_domain_reason,
      gutenberg_id: result.gutenberg_id ?? undefined,
      gutenberg_url: result.gutenberg_url ?? undefined,
      openlibrary_id: result.openlibrary_id ?? undefined,
      openlibrary_url: result.openlibrary_url ?? undefined,
      already_digitised: result.already_digitised,
      ai_training_value: result.ai_training_value,
      ai_value_factors: result.ai_value_factors,
      pre_llm_era: result.pre_llm_era ?? undefined,
      triage_action: result.triage_action,
      triage_score: result.triage_score,
      triage_notes: result.triage_notes ?? undefined,
    };

    const book = await createBook(payload);
    setLoading(false);

    if (book) {
      setSaved(true);
      successToast('Saved to inventory', `"${result.title}" has been added.`);
      spawnParticles();
      onSaved?.(book);
    } else {
      errorToast('Could not save to inventory', 'Please try again.');
    }
  }

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      {/* Particle burst layer */}
      {particles.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
        >
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full opacity-0"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.colour,
                animation: `particleBurst 0.9s cubic-bezier(0,0,0.2,1) forwards`,
                '--vx': `${p.vx * 30}px`,
                '--vy': `${p.vy * 30}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      <Button
        variant={saved ? 'outline' : 'primary'}
        loading={loading}
        disabled={saved}
        onClick={handleSave}
        icon={saved ? <Check size={16} aria-hidden="true" /> : undefined}
        className={cn(
          saved && 'text-success border-success/40',
          'transition-all duration-300',
        )}
        aria-label={saved ? 'Book saved to inventory' : 'Save this book to inventory'}
      >
        {saved ? 'Saved' : 'Save to Inventory'}
      </Button>

      <style>{`
        @keyframes particleBurst {
          0%   { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--vx), var(--vy)) scale(0); }
        }
      `}</style>
    </div>
  );
}
