import Link from 'next/link';

import { ROUTES } from '@/lib/constants';

export default function AutopilotEntryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Autopilot
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Document upload, requirements, and build monitoring will arrive in Phase 7. Navigation is wired from
        the app shell.
      </p>
      <Link
        href={ROUTES.home}
        className="mt-8 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Back to home
      </Link>
    </main>
  );
}
