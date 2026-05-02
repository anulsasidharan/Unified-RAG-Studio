'use client';

import Link from 'next/link';
import { ChevronRight, FolderPlus, PanelLeftClose, PanelLeft, X } from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';

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
  const addProject = useProjectStore((s) => s.addProject);

  const handleNewProject = () => {
    const n = projects.filter((p) => p.name.startsWith('Untitled project')).length;
    const name =
      n === 0 ? 'Untitled project' : `Untitled project (${n + 1})`;
    addProject({ name });
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
          'fixed bottom-0 left-0 top-14 z-50 flex flex-col border-r border-neutral-200 bg-card transition-transform duration-200 dark:border-neutral-800 md:static md:top-0 md:z-0 md:h-auto md:min-h-[calc(100vh-3.5rem)] md:translate-x-0',
          collapsed ? 'md:w-14' : 'w-56 sm:w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b border-neutral-200 px-2 py-2 dark:border-neutral-800',
            collapsed && 'md:flex-col md:gap-2 md:py-3'
          )}
        >
          {!collapsed ? (
            <span className="truncate px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              'flex w-full items-center gap-2 rounded-md border border-dashed border-neutral-300 px-2 py-2 text-left text-sm font-medium text-primary-600 hover:bg-primary-50 dark:border-neutral-600 dark:hover:bg-neutral-900/50',
              collapsed && 'md:justify-center md:px-0'
            )}
            title="Create project"
          >
            <FolderPlus className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>New project</span> : null}
          </button>

          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveProject(p.id);
                onMobileClose();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent',
                p.id === activeProjectId &&
                  'bg-primary-50 font-medium text-primary-900 dark:bg-primary-950/40 dark:text-primary-100',
                collapsed && 'md:justify-center md:px-0'
              )}
              title={p.name}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100'
                )}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              {!collapsed ? <span className="truncate">{p.name}</span> : null}
            </button>
          ))}
        </div>

        <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
          <Link
            href={ROUTES.projects}
            onClick={onMobileClose}
            className={cn(
              'flex items-center gap-2 rounded-md py-2 text-xs font-medium text-primary-600 hover:bg-accent sm:text-sm',
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
