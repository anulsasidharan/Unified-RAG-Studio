'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';

export function ModeToggle() {
  const pathname = usePathname();
  const designerActive =
    pathname === ROUTES.designer || pathname?.startsWith(`${ROUTES.designer}/`);
  const autopilotActive =
    pathname === ROUTES.autopilot || pathname?.startsWith(`${ROUTES.autopilot}/`);

  return (
    <div
      className="inline-flex h-9 items-center rounded-full border border-neutral-200 bg-neutral-100/80 p-1 dark:border-neutral-700 dark:bg-neutral-900/60"
      role="group"
      aria-label="Switch between Designer and Autopilot"
    >
      <Link
        href={ROUTES.designer}
        prefetch={false}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
          designerActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        )}
      >
        Designer
      </Link>
      <Link
        href={ROUTES.autopilot}
        prefetch={false}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
          autopilotActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        )}
      >
        Autopilot
      </Link>
    </div>
  );
}
