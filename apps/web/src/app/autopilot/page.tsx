import Link from 'next/link';

import { DocumentUploader } from '@/components/autopilot/document-uploader';
import { RequirementsForm } from '@/components/autopilot/requirements-form';
import { ROUTES } from '@/lib/constants';

export default function AutopilotEntryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Autopilot</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Upload corpus files, set optimisation targets and constraints, then start a build when the progress UI lands in
        P7-3.
      </p>

      <DocumentUploader className="mt-10" />
      <RequirementsForm className="mt-8" />

      <Link
        href={ROUTES.home}
        className="mt-10 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Back to home
      </Link>
    </main>
  );
}
