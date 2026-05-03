'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { normalizeDesignerPathname } from '@/lib/designer-routes';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
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
  const expandDiagramReach = useDesignerStore((s) => s.expandDiagramReach);

  useEffect(() => {
    const normalized = normalizeDesignerPathname(pathname ?? '');
    const stage = DESIGNER_STAGES.find((s) => s.path === normalized);
    if (stage) {
      setActiveStage(stage.id);
      // Stay empty at `/designer` only; advancing to any other stage unlocks the graph step-by-step.
      if (normalized !== ROUTES.designer) {
        expandDiagramReach(stage.id);
      }
    }
  }, [pathname, setActiveStage, expandDiagramReach]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background lg:min-h-[calc(100vh-3.5rem)]">
      {/* Stage nav + builder share the upper pane; graph preview is full-width below */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:min-h-0">
        <div className="flex min-h-0 shrink-0 flex-col lg:h-full lg:w-[min(280px,calc((100vw-14rem)*0.28))] lg:overflow-y-auto lg:border-r lg:border-neutral-200 lg:dark:border-neutral-800 xl:w-72">
          <StageNavigator />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-neutral-200 dark:border-neutral-800 lg:border-l">
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </div>
      <PipelineVisualizer className="w-full" />
    </div>
  );
}
