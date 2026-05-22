'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, BarChart3, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hasInitialized, profile } = useAuthStore();

  useEffect(() => {
    if (!hasInitialized) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (profile?.role !== 'admin') {
      router.replace('/projects');
    }
  }, [hasInitialized, isAuthenticated, profile, router]);

  if (!hasInitialized || !profile || profile.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-rose-500" />
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Admin Panel
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 lg:w-48 lg:flex-col">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                pathname === href || pathname?.startsWith(href)
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
