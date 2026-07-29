import React from 'react';
import { cn } from '@/lib/utils';

export type PageContainerMax = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  max?: PageContainerMax;
}

const MAX_CLASSES: Record<PageContainerMax, string> = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
};

export function PageContainer({
  children,
  className,
  max = 'xl',
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8 py-6',
        MAX_CLASSES[max],
        className,
      )}
    >
      {children}
    </div>
  );
}
