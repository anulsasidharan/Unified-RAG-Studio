'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { normalizeDesignerPathname } from '@/lib/designer-routes';
import { DESIGNER_STAGES } from '@/lib/constants';
import { useDesignerStore } from '@/stores/designer-store';

import { StageNavigator } from './stage-navigator';

export function DesignerShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const setActiveStage = useDesignerStore((s) => s.setActiveStage);

  useEffect(() => {
    const normalized = normalizeDesignerPathname(pathname ?? '');
    const stage = DESIGNER_STAGES.find((s) => s.path === normalized);
    if (stage) setActiveStage(stage.id);
  }, [pathname, setActiveStage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background lg:min-h-[calc(100vh-3.5rem)] lg:flex-row">
      <StageNavigator />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-neutral-200 dark:border-neutral-800 lg:border-l">
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
