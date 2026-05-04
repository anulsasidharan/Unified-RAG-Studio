'use client';

import { History, FolderKanban, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';

function Panel({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className
      )}
    >
      {children}
    </div>
  );
}

export default function AutopilotEntryPage() {
  const builds = useAutopilotStore((s) => s.builds);
  const buildCount = useMemo(() => Object.keys(builds).length, [builds]);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Autopilot mode
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
        Let agents analyse your corpus, tune chunking, embeddings, and retrieval, then evaluate the pipeline.
        Start here, track runs in history, and attach builds to a backend project.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Panel className="border-primary-200/60 dark:border-primary-900/40">
          <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            <Rocket className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
            New build
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Upload documents, set targets, and run the orchestrator.
          </p>
          <Link
            href={ROUTES.autopilotNew}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 sm:w-auto"
          >
            Start wizard
          </Link>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            <History className="h-5 w-5 text-neutral-600 dark:text-neutral-400" aria-hidden />
            Build history
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Browse server-side runs (newest first). Open a run to resume monitoring in the wizard.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {buildCount > 0
                ? `${buildCount} build snapshot(s) cached in this browser.`
                : 'No local build cache yet.'}
            </p>
            <Link
              href={ROUTES.autopilotHistory}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              View history
            </Link>
          </div>
        </Panel>

        <Panel className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            <FolderKanban className="h-5 w-5 text-neutral-600 dark:text-neutral-400" aria-hidden />
            Projects
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Corpus uploads are scoped to a backend project. Create or pick the active project before uploading.
          </p>
          <Link
            href={ROUTES.autopilotProjects}
            className="mt-4 inline-flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
          >
            Manage projects
          </Link>
        </Panel>
      </div>

      <Link
        href={ROUTES.home}
        className="mt-10 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Back to home
      </Link>
    </>
  );
}
