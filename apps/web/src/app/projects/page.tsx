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
  const deleteProjectOnServer = useProjectStore((s) => s.deleteProjectOnServer);
  const updateProject = useProjectStore((s) => s.updateProject);
  const createProjectOnServer = useProjectStore((s) => s.createProjectOnServer);
  const renameProjectOnServer = useProjectStore((s) => s.renameProjectOnServer);

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    void deleteProjectOnServer(id);
  };

  const handleCreateFirstProject = () => {
    const n = projects.filter((p) => p.name.startsWith('Untitled project')).length;
    const name = n === 0 ? 'Untitled project' : `Untitled project (${n + 1})`;
    void createProjectOnServer({ name });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Projects
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Your projects are scoped to your account. Create a project to unlock Designer and Autopilot.
      </p>
      <ul className="mt-8 divide-y rounded-lg border border-neutral-200 dark:border-neutral-800">
        {projects.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">No projects yet.</p>
            <p className="mt-2">
              Get started by creating your first project, then open Designer to build your RAG pipeline.
            </p>
            <button
              type="button"
              onClick={handleCreateFirstProject}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Create New Project
            </button>
          </li>
        ) : (
          projects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <EditableProjectName
                  variant="list"
                  name={p.name}
                  onSave={(next) => {
                    updateProject(p.id, { name: next });
                    void renameProjectOnServer(p.id, { name: next });
                  }}
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
