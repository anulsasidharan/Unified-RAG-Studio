'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ROUTES } from '@/lib/constants';
import { useProjectStore } from '@/stores/project-store';

export default function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const removeProject = useProjectStore((s) => s.removeProject);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const beginRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveRename = () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    updateProject(editingId, { name: trimmed });
    setEditingId(null);
    setEditName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    if (editingId === id) cancelRename();
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
            <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {editingId === p.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      className="w-full min-w-0 rounded-md border border-neutral-200 bg-background px-3 py-1.5 text-sm font-medium text-neutral-900 outline-none ring-primary-600 focus:ring-2 dark:border-neutral-700 dark:text-neutral-100"
                      aria-label="Project name"
                      autoFocus
                    />
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={saveRename}
                        className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{p.name}</p>
                    {p.description ? (
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProject(p.id)}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  {p.id === activeProjectId ? 'Active' : 'Set active'}
                </button>
                <button
                  type="button"
                  onClick={() => beginRename(p.id, p.name)}
                  disabled={editingId !== null}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={editingId !== null}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Delete
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
