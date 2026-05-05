'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

import { Navbar } from './navbar';
import { Sidebar } from './sidebar';
import { useAuthStore } from '@/stores/auth-store';

const SIDEBAR_COLLAPSED_KEY = 'rag-studio-sidebar-collapsed';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoadingProfile = useAuthStore((s) => s.isLoadingProfile);
  const hasInitialized = useAuthStore((s) => s.hasInitialized);

  const isPublicRoute =
    isHome ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/verify-email') ||
    pathname === '/password-reset' ||
    pathname.startsWith('/password-reset/confirm');

  useEffect(() => {
    if (isPublicRoute) return;
    // Avoid redirecting while we still have a token and the profile is loading.
    if (!isAuthenticated && !accessToken && hasInitialized && !isLoadingProfile) {
      router.replace('/login');
    }
  }, [isPublicRoute, isAuthenticated, accessToken, isLoadingProfile, hasInitialized, router]);

  if (!isPublicRoute && !hasInitialized) {
    return null;
  }

  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        showSidebarTrigger={!isPublicRoute}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        {!isPublicRoute ? (
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        ) : null}
        <div
          className={cn(
            'min-h-[calc(100vh-3.5rem)] min-w-0 flex-1',
            isHome && 'md:min-h-screen'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
