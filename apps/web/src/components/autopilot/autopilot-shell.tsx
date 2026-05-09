'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Zap, Clock, FolderOpen } from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const NAV = [
  { href: ROUTES.autopilot,         label: 'Overview',   icon: LayoutGrid, end: true  },
  { href: ROUTES.autopilotNew,      label: 'New build',  icon: Zap,        end: false },
  { href: ROUTES.autopilotHistory,  label: 'History',    icon: Clock,      end: false },
  { href: ROUTES.autopilotProjects, label: 'Projects',   icon: FolderOpen, end: false },
] as const;

function linkActive(pathname: string, href: string, end: boolean): boolean {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AutopilotShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname() ?? '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tab navigation */}
      <div className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2 sm:px-6">
          <span className="mr-3 font-display text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Autopilot
          </span>
          <nav className="flex flex-wrap gap-1" aria-label="Autopilot sections">
            {NAV.map(({ href, label, icon: Icon, end }) => {
              const active = linkActive(pathname, href, end);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-sm shadow-primary-200/60'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
