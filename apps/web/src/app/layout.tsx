import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { AppShell } from '@/components/shared/app-shell';
import { Providers } from '@/components/providers';
import { StoreHydration } from '@/components/store-hydration';

import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RAG Studio — Build RAG Systems Your Way',
  description:
    'Design RAG pipelines step-by-step with Designer Mode, or let AI build one automatically with Autopilot Mode.',
  keywords: ['RAG', 'LLM', 'AI', 'pipeline', 'LangChain', 'vector database'],
  openGraph: {
    title: 'RAG Studio',
    description: 'The complete RAG development platform.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}
      >
        <Providers>
          <StoreHydration />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
