'use client';

import { History, FolderKanban, Rocket, Zap } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { ROUTES } from '@/lib/constants';
import { useAutopilotStore } from '@/stores/autopilot-store';

export default function AutopilotEntryPage() {
  const builds = useAutopilotStore((s) => s.builds);
  const buildCount = useMemo(() => Object.keys(builds).length, [builds]);

  return (
    <>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="from-primary-600 shadow-primary-200 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br to-indigo-600 shadow-sm">
            <Zap className="h-5 w-5 text-white" aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Autopilot mode
          </h1>
        </div>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
          Let agents analyse your corpus, tune chunking, embeddings, and retrieval, then evaluate
          the pipeline. Start here, track runs in history, and attach builds to a project.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* New build — primary hero card */}
        <div className="from-primary-600 via-primary-700 shadow-primary-200/40 dark:shadow-primary-900/30 relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br to-indigo-700 p-6 shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Rocket className="h-5 w-5 text-white" aria-hidden />
            </div>
            <h2 className="font-display mt-4 text-xl font-bold text-white">New build</h2>
            <p className="text-primary-100 mt-2 text-sm">
              Upload documents, set targets, and run the orchestrator automatically.
            </p>
            <Link
              href={ROUTES.autopilotNew}
              className="text-primary-700 hover:bg-primary-50 mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              <Rocket className="h-4 w-4" aria-hidden />
              Start wizard
            </Link>
          </div>
        </div>

        {/* Build history */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <History className="h-5 w-5 text-neutral-600 dark:text-neutral-400" aria-hidden />
          </div>
          <h2 className="font-display mt-4 text-lg font-bold text-neutral-900 dark:text-neutral-50">
            Build history
          </h2>
          <p className="mt-2 flex-1 text-sm text-neutral-600 dark:text-neutral-400">
            Browse server-side runs newest first. Open a run to resume monitoring in the wizard.
          </p>
          <div className="mt-4 space-y-3">
            {buildCount > 0 ? (
              <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 dark:bg-neutral-900">
                {buildCount} build snapshot{buildCount !== 1 ? 's' : ''} cached locally
              </p>
            ) : null}
            <Link
              href={ROUTES.autopilotHistory}
              className="hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            >
              View history
            </Link>
          </div>
        </div>

        {/* Projects */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-950/40">
            <FolderKanban className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden />
          </div>
          <h2 className="font-display mt-4 text-lg font-bold text-neutral-900 dark:text-neutral-50">
            Projects
          </h2>
          <p className="mt-2 flex-1 text-sm text-neutral-600 dark:text-neutral-400">
            Corpus uploads are scoped to a backend project. Create or pick the active project before
            uploading.
          </p>
          <Link
            href={ROUTES.autopilotProjects}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            Manage projects
          </Link>
        </div>
      </div>

      <Link
        href={ROUTES.home}
        className="hover:text-primary-600 dark:hover:text-primary-400 mt-10 inline-block text-sm font-medium text-neutral-500 transition-colors dark:text-neutral-400"
      >
        ← Back to home
      </Link>
    </>
  );
}
