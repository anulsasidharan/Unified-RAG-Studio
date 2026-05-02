import Link from 'next/link';

import { ROUTES } from '@/lib/constants';

export default function DesignerEntryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Designer
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Step-by-step pipeline builder will live here (Phase 5). Use the mode toggle or navigation to explore
        other areas.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={ROUTES.home}
          className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Browse templates
        </Link>
      </div>
    </main>
  );
}
