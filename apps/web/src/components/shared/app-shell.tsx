'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { Navbar } from './navbar';
import { Sidebar } from './sidebar';

const SIDEBAR_COLLAPSED_KEY = 'rag-studio-sidebar-collapsed';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isHome = pathname === '/';
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
        showSidebarTrigger={!isHome}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        {!isHome ? (
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
