'use client';

import dynamic from 'next/dynamic';

import { DESIGNER_DOM_SECTION_IDS } from '@/lib/designer-section-anchors';

const PanelSkeleton = () => (
  <div className="bg-muted/20 h-24 w-full shrink-0 animate-pulse border-t border-neutral-200 dark:border-neutral-800" />
);

export const DeferredCostEstimator = dynamic(
  () => import('./cost-estimator').then((m) => ({ default: m.CostEstimator })),
  { ssr: false, loading: PanelSkeleton },
);

export const DeferredCodeExporter = dynamic(
  () => import('./code-exporter').then((m) => ({ default: m.CodeExporter })),
  { ssr: false, loading: PanelSkeleton },
);

export const DeferredPipelineVisualizer = dynamic(
  () => import('./pipeline-visualizer').then((m) => ({ default: m.PipelineVisualizer })),
  { ssr: false, loading: PanelSkeleton },
);

export { DESIGNER_DOM_SECTION_IDS };
