'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { normalizeDesignerPathname } from '@/lib/designer-routes';
import { DESIGNER_STAGES } from '@/lib/constants';
import { useDesignerStore } from '@/stores/designer-store';

import { PipelineVisualizer } from './pipeline-visualizer';
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
      <div className="flex min-h-0 shrink-0 flex-col lg:max-h-[calc(100vh-3.5rem)] lg:w-[min(280px,calc((100vw-14rem)*0.28))] lg:overflow-y-auto lg:border-r lg:border-neutral-200 lg:dark:border-neutral-800 xl:w-72">
        <StageNavigator />
        <PipelineVisualizer placement="sidebar" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-neutral-200 dark:border-neutral-800 lg:border-l">
        <PipelineVisualizer placement="main" />
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
