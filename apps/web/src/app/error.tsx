'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/lib/constants';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-16">
      <p className="text-danger-600 text-sm font-semibold uppercase tracking-wide">Error</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-center text-neutral-600 dark:text-neutral-400">
        An unexpected error occurred. You can try again or go back to a safe page.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-2 font-mono text-xs">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-primary-600 hover:bg-primary-700 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          Try again
        </button>
        <Link
          href={ROUTES.home}
          className="inline-flex rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
