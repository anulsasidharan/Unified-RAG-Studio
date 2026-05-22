'use client';

import { Plus, Trash2, FolderOpen, CheckCircle2 } from 'lucide-react';

import { EditableProjectName } from '@/components/shared/editable-project-name';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

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

  const handleCreate = () => {
    const n = projects.filter((p) => p.name.startsWith('Untitled project')).length;
    const name = n === 0 ? 'Untitled project' : `Untitled project (${n + 1})`;
    void createProjectOnServer({ name });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Projects
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Create a project to unlock Designer and Autopilot.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="bg-primary-600 shadow-primary-200/60 hover:bg-primary-700 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        /* Empty state */
        <button
          type="button"
          onClick={handleCreate}
          className="hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 dark:hover:bg-primary-950/20 group flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-200 bg-white py-20 text-center transition-all dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="group-hover:border-primary-400 group-hover:bg-primary-100 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900">
            <FolderOpen className="group-hover:text-primary-600 h-7 w-7 text-neutral-400 dark:text-neutral-500" />
          </div>
          <div>
            <p className="font-display font-semibold text-neutral-900 dark:text-neutral-100">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Click to create your first project
            </p>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* New Project card */}
          <button
            type="button"
            onClick={handleCreate}
            className="hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 bg-white py-10 text-center transition-all dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="group-hover:border-primary-400 group-hover:bg-primary-100 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900">
              <Plus className="group-hover:text-primary-600 h-5 w-5 text-neutral-400" />
            </div>
            <span className="group-hover:text-primary-600 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              New project
            </span>
          </button>

          {/* Project cards */}
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                className={cn(
                  'group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-neutral-950',
                  isActive
                    ? 'border-primary-200 dark:border-primary-800'
                    : 'border-neutral-200 dark:border-neutral-800',
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="bg-success-100 dark:bg-success-950/40 absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="text-success-600 h-3.5 w-3.5" />
                    <span className="text-success-700 dark:text-success-400 text-xs font-semibold">
                      Active
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'mb-4 flex h-10 w-10 items-center justify-center rounded-xl',
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-950/40'
                      : 'bg-neutral-100 dark:bg-neutral-800',
                  )}
                >
                  <FolderOpen
                    className={cn('h-5 w-5', isActive ? 'text-primary-600' : 'text-neutral-500')}
                  />
                </div>

                {/* Name */}
                <div className="mb-1 min-w-0 flex-1">
                  <EditableProjectName
                    variant="list"
                    name={p.name}
                    onSave={(next) => {
                      updateProject(p.id, { name: next });
                      void renameProjectOnServer(p.id, { name: next });
                    }}
                  />
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{p.description}</p>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => setActiveProject(p.id)}
                      className="hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors dark:border-neutral-700 dark:text-neutral-400"
                    >
                      Set active
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">Currently active</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    className="hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors"
                    title={`Delete ${p.name}`}
                    aria-label={`Delete project ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
