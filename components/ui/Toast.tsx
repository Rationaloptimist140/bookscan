'use client';

import { Toaster, toast as sonnerToast } from 'sonner';

/* ------------------------------------------------------------------ */
/* Re-export raw toast from sonner                                     */
/* ------------------------------------------------------------------ */

export { sonnerToast as toast };

/* ------------------------------------------------------------------ */
/* ToastProvider                                                       */
/* ------------------------------------------------------------------ */

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      expand={false}
      gap={8}
      toastOptions={{
        className: 'font-body text-sm',
        style: {
          fontFamily: 'var(--font-body, Inter, system-ui, sans-serif)',
          borderRadius: '8px',
          border: '1px solid var(--color-rule, #E5E0D8)',
          boxShadow: '0 4px 6px rgba(26,26,46,0.05), 0 2px 4px rgba(26,26,46,0.04)',
        },
        duration: 4000,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Convenience helpers                                                 */
/* ------------------------------------------------------------------ */

export function successToast(msg: string, description?: string): void {
  sonnerToast.success(msg, { description });
}

export function errorToast(msg: string, description?: string): void {
  sonnerToast.error(msg, { description });
}
