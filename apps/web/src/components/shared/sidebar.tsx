'use client';

import Link from 'next/link';
import {
  ChevronRight,
  FolderPlus,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  X,
} from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';

import { EditableProjectName } from './editable-project-name';

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const createProjectOnServer = useProjectStore((s) => s.createProjectOnServer);
  const deleteProjectOnServer = useProjectStore((s) => s.deleteProjectOnServer);
  const renameProjectOnServer = useProjectStore((s) => s.renameProjectOnServer);
  const updateProject = useProjectStore((s) => s.updateProject);

  const handleNewProject = async () => {
    const n = projects.filter((p) => p.name.startsWith('Untitled project')).length;
    const name =
      n === 0 ? 'Untitled project' : `Untitled project (${n + 1})`;
    await createProjectOnServer({ name });
    onMobileClose();
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete "${name}"? This cannot be undone.`)
    ) {
      return;
    }
    await deleteProjectOnServer(id);
    onMobileClose();
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close sidebar"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-14 z-50 flex flex-col border-r border-neutral-100 bg-white transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950 md:static md:top-0 md:z-0 md:h-auto md:min-h-[calc(100vh-3.5rem)] md:translate-x-0',
          collapsed ? 'md:w-14' : 'w-56 sm:w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b border-neutral-100 px-2 py-2.5 dark:border-neutral-800',
            collapsed && 'md:flex-col md:gap-2 md:py-3'
          )}
        >
          {!collapsed ? (
            <span className="truncate px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Projects
            </span>
          ) : (
            <span className="sr-only">Projects</span>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-accent md:hidden"
              onClick={onMobileClose}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-accent md:inline-flex"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapsed}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={handleNewProject}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-dashed border-primary-200 px-2 py-2 text-left text-sm font-semibold text-primary-600 transition-all hover:border-primary-300 hover:bg-primary-50 dark:border-primary-800/50 dark:text-primary-400 dark:hover:bg-primary-950/30',
              collapsed && 'md:justify-center md:px-0'
            )}
            title="Create project"
          >
            <FolderPlus className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>New project</span> : null}
          </button>

          {projects.map((p, idx) => {
            const BADGE_COLORS = [
              'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400',
              'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
              'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
              'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
              'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400',
            ];
            const badgeColor = BADGE_COLORS[idx % BADGE_COLORS.length];
            return (
              <div
                key={p.id}
                className={cn(
                  'flex w-full items-center gap-0.5 rounded-lg pr-0.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
                  p.id === activeProjectId && 'bg-primary-50/80 dark:bg-primary-950/30',
                  collapsed && 'md:justify-center'
                )}
              >
                <EditableProjectName
                  variant="sidebar"
                  name={p.name}
                  onSave={(next) => {
                    updateProject(p.id, { name: next });
                    void renameProjectOnServer(p.id, { name: next });
                  }}
                  onSelect={() => {
                    setActiveProject(p.id);
                    onMobileClose();
                  }}
                  isActive={p.id === activeProjectId}
                  showLabel={!collapsed}
                  hidePencil={collapsed}
                  leading={
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold', badgeColor)}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  }
                />
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(p.id, p.name);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title={`Delete ${p.name}`}
                    aria-label={`Delete project ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-neutral-100 p-2 dark:border-neutral-800">
          <Link
            href={ROUTES.projects}
            onClick={onMobileClose}
            className={cn(
              'flex items-center gap-2 rounded-lg py-2 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30 sm:text-sm',
              collapsed ? 'justify-center md:px-0' : 'px-2'
            )}
            title="All projects"
          >
            <ChevronRight className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>All projects</span> : null}
          </Link>
        </div>
      </aside>
    </>
  );
}
