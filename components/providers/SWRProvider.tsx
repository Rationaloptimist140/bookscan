'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { toast } from 'sonner';
import { fetcher } from '@/lib/api';

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        keepPreviousData: true,
        errorRetryCount: 2,
        onError: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'An unexpected error occurred.';
          toast.error(message);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
