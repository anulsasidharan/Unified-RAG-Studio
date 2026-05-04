'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const NAV = [
  { href: ROUTES.autopilot, label: 'Overview', end: true },
  { href: ROUTES.autopilotNew, label: 'New build', end: false },
  { href: ROUTES.autopilotHistory, label: 'History', end: false },
  { href: ROUTES.autopilotProjects, label: 'Projects', end: false },
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
      <div className="border-b border-neutral-200 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <span className="mr-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Autopilot
          </span>
          <nav className="flex flex-wrap gap-1" aria-label="Autopilot sections">
            {NAV.map(({ href, label, end }) => {
              const active = linkActive(pathname, href, end);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
                      : 'text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-400 dark:hover:bg-neutral-800'
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
