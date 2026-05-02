import Link from 'next/link';

import { ROUTES } from '@/lib/constants';

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-center text-neutral-600 dark:text-neutral-400">
        The page you requested does not exist or has moved. Check the URL or return to the app home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.home}
          className="inline-flex rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          Home
        </Link>
        <Link
          href={ROUTES.designer}
          className="inline-flex rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Designer
        </Link>
      </div>
    </main>
  );
}
