import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { SWRProvider } from '@/components/providers/SWRProvider';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import './globals.css';

// ── Google Font definitions ──────────────────────────────────────────────────

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['300', '400', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'BookScan',
    template: '%s — BookScan',
  },
  description:
    'Triage, scan and sell pre-2022 physical books as clean AI training data.',
  keywords: ['books', 'public domain', 'AI training data', 'OCR', 'book scanning'],
  robots: {
    index: false,
    follow: false,
  },
};

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider>
          <SWRProvider>
            {/* App shell: sidebar + top bar + main content */}
            <div className="flex min-h-screen bg-canvas">
              <Sidebar />
              <div className="flex flex-1 flex-col min-w-0">
                <TopBar />
                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
            {/* Sonner toast portal */}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              duration={4000}
              toastOptions={{
                style: {
                  fontFamily: 'var(--font-inter)',
                },
              }}
            />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
