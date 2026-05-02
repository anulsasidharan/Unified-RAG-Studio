'use client';

import Link from 'next/link';

import { ROUTES } from '@/lib/constants';
import { useProjectStore } from '@/stores/project-store';

export default function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Projects
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Local project list until the Projects API (Phase 4) syncs with the server. Create projects from the
        sidebar.
      </p>
      <ul className="mt-8 divide-y rounded-lg border border-neutral-200 dark:border-neutral-800">
        {projects.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">No projects yet.</li>
        ) : (
          projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">{p.name}</p>
                {p.description ? (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveProject(p.id)}
                className="shrink-0 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                {p.id === activeProjectId ? 'Active' : 'Set active'}
              </button>
            </li>
          ))
        )}
      </ul>
      <Link
        href={ROUTES.home}
        className="mt-8 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Back to home
      </Link>
    </main>
  );
}
