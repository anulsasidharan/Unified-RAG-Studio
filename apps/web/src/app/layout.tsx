import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
