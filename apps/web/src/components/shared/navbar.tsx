'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import {
  LayoutGrid,
  Menu,
  ChevronDown,
  FolderKanban,
  PencilLine,
  Trash2,
  UserCircle,
  ShieldCheck,
} from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { useAuthStore } from '@/stores/auth-store';

import { Logo } from './Logo';
import { ModeToggle } from './mode-toggle';

type NavbarProps = {
  showSidebarTrigger?: boolean;
  onOpenSidebar?: () => void;
};

export function Navbar({ showSidebarTrigger = true, onOpenSidebar }: NavbarProps) {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProjectOnServer = useProjectStore((s) => s.deleteProjectOnServer);
  const renameProjectOnServer = useProjectStore((s) => s.renameProjectOnServer);
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const handleRenameActive = () => {
    if (!activeProject) return;
    const next = window.prompt('Project name', activeProject.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    updateProject(activeProject.id, { name: trimmed });
    void renameProjectOnServer(activeProject.id, { name: trimmed });
  };

  const handleDeleteActive = () => {
    if (!activeProject) return;
    if (
      !window.confirm(`Delete project "${activeProject.name}"? This cannot be undone.`)
    )
      return;
    void deleteProjectOnServer(activeProject.id);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/60 bg-white/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/90 dark:shadow-none">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showSidebarTrigger ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 md:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              onClick={onOpenSidebar}
              aria-label="Open project sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}
          <Logo className="min-w-0" />
        </div>

        {isAuthenticated ? (
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <ModeToggle />
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {isAuthenticated ? (
            <>
              <Link
                href={ROUTES.analytics}
                className="hidden text-sm font-medium text-neutral-600 hover:text-primary-600 md:inline dark:text-neutral-400 dark:hover:text-primary-400"
              >
                Analytics
              </Link>
              <Link
                href={ROUTES.templates}
                className="hidden text-sm font-medium text-neutral-600 hover:text-primary-600 md:inline dark:text-neutral-400 dark:hover:text-primary-400"
              >
                Templates
              </Link>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex max-w-[200px] items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
                    )}
                    aria-label="Select active project"
                  >
                    <FolderKanban className="h-4 w-4 shrink-0 text-neutral-500" />
                    <span className="truncate">
                      {activeProject?.name ?? 'No project'}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[220px] rounded-md border border-neutral-200 bg-popover p-1 text-popover-foreground shadow-lg dark:border-neutral-700"
                    sideOffset={6}
                    align="end"
                  >
                    <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Projects
                    </DropdownMenu.Label>
                    {projects.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">
                        No projects yet — create one in the sidebar.
                      </div>
                    ) : (
                      projects.map((p) => (
                        <DropdownMenu.Item
                          key={p.id}
                          className={cn(
                            'cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                            p.id === activeProjectId && 'bg-accent/60'
                          )}
                          onSelect={() => setActiveProject(p.id)}
                        >
                          {p.name}
                        </DropdownMenu.Item>
                      ))
                    )}
                    {activeProject ? (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-border" />
                        <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Active project
                        </DropdownMenu.Label>
                        <DropdownMenu.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                          onSelect={handleRenameActive}
                        >
                          <PencilLine className="h-4 w-4" />
                          Rename…
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                          onSelect={handleDeleteActive}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete…
                        </DropdownMenu.Item>
                      </>
                    ) : null}
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item asChild>
                      <Link
                        href={ROUTES.projects}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        Manage projects
                      </Link>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          ) : null}

          {profile ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex sm:flex-col sm:items-end">
                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  {profile.name}
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {profile.email}
                </span>
              </div>
              <Link
                href={ROUTES.profile}
                title="Your profile"
                className="rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <UserCircle className="h-4 w-4" />
              </Link>
              {profile.role === 'admin' ? (
                <Link
                  href={ROUTES.adminUsers}
                  title="Admin panel"
                  className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              ) : null}
              <button
                type="button"
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={() => void logout()}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700 hover:shadow active:scale-[0.97]"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {isAuthenticated ? (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-neutral-100 px-3 pb-2 pt-2 sm:hidden dark:border-neutral-800">
          <Link
            href={ROUTES.analytics}
            className="text-xs font-medium text-neutral-600 hover:text-primary-600 dark:text-neutral-400"
          >
            Analytics
          </Link>
          <Link
            href={ROUTES.templates}
            className="text-xs font-medium text-neutral-600 hover:text-primary-600 dark:text-neutral-400"
          >
            Templates
          </Link>
          <ModeToggle />
        </div>
      ) : null}
    </header>
  );
}
