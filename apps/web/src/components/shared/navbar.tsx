'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { LayoutGrid, Menu, ChevronDown, FolderKanban } from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';

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
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-neutral-800">
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

        <div className="hidden shrink-0 items-center justify-center sm:flex">
          <ModeToggle />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
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

          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white"
            title="Account (placeholder)"
          >
            RS
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-neutral-100 px-3 pb-2 pt-2 sm:hidden dark:border-neutral-800">
        <Link
          href={ROUTES.templates}
          className="text-xs font-medium text-neutral-600 hover:text-primary-600 dark:text-neutral-400"
        >
          Templates
        </Link>
        <ModeToggle />
      </div>
    </header>
  );
}
