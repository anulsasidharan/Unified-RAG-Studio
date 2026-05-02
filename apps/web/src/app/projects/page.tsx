'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';

import { EditableProjectName } from '@/components/shared/editable-project-name';
import { ROUTES } from '@/lib/constants';
import { useProjectStore } from '@/stores/project-store';

export default function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const removeProject = useProjectStore((s) => s.removeProject);
  const updateProject = useProjectStore((s) => s.updateProject);

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    removeProject(id);
  };

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
            <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <EditableProjectName
                  variant="list"
                  name={p.name}
                  onSave={(next) => updateProject(p.id, { name: next })}
                />
                {p.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProject(p.id)}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  {p.id === activeProjectId ? 'Active' : 'Set active'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.name)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-destructive/10 hover:text-destructive"
                  title={`Delete ${p.name}`}
                  aria-label={`Delete project ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
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
