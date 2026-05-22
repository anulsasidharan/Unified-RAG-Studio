'use client';

import { create } from 'zustand';

import { DESIGNER_STAGES, designerStageIndex, type DesignerStageId } from '@/lib/constants';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { deepStripNulls } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';
import type { BuildResult, FinalMetrics } from '@/types/autopilot';
import type { PipelineConfiguration, PipelineStages } from '@/types/pipeline';

/** Evaluation metrics + iteration count shown on Designer review after Autopilot import (P8-2). */
export type AutopilotImportSnapshot = {
  buildId: string;
  importedAt: string;
  metrics?: FinalMetrics;
  totalIterations?: number;
};

type DesignerState = {
  draft: PipelineConfiguration;
  activeStageId: DesignerStageId;
  /** Furthest designer stage reached while navigating (-1 = empty graph until user moves forward). */
  diagramMaxVisitedStageIndex: number;
  /** Set when opening Autopilot results in Designer — drives review banner + metrics strip. */
  autopilotImportSnapshot: AutopilotImportSnapshot | null;
  setDraft: (next: PipelineConfiguration) => void;
  patchDraft: (patch: Partial<PipelineConfiguration>) => void;
  updateStages: (patch: Partial<PipelineStages>) => void;
  setActiveStage: (id: DesignerStageId) => void;
  expandDiagramReach: (stageId: DesignerStageId) => void;
  resetDraft: () => void;
  loadPipeline: (config: PipelineConfiguration) => void;
  /** Replace draft with Autopilot result and attach visualization snapshot (P8-2). */
  applyAutopilotBuildResult: (buildId: string, result: BuildResult) => void;
  /** If draft is marked `source: autopilot`, pull metrics from the in-memory Autopilot build record. */
  syncAutopilotSnapshotFromStores: () => void;
};

export const useDesignerStore = create<DesignerState>()((set, get) => ({
  draft: createDefaultPipelineConfiguration(),
  activeStageId: DESIGNER_STAGES[0].id,
  diagramMaxVisitedStageIndex: -1,
  autopilotImportSnapshot: null,

  setDraft: (next) => set({ draft: deepStripNulls(next) }),

  patchDraft: (patch) =>
    set((s) => ({
      draft: {
        ...s.draft,
        ...patch,
        stages: patch.stages ? { ...s.draft.stages, ...patch.stages } : s.draft.stages,
        metadata: {
          ...s.draft.metadata,
          ...(patch.metadata ?? {}),
          updatedAt: new Date().toISOString(),
        },
      },
    })),

  updateStages: (patch) =>
    set((s) => ({
      draft: {
        ...s.draft,
        stages: { ...s.draft.stages, ...patch },
        metadata: {
          ...s.draft.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
    })),

  setActiveStage: (id) => set({ activeStageId: id }),

  expandDiagramReach: (stageId) =>
    set((s) => {
      const idx = designerStageIndex(stageId);
      return idx > s.diagramMaxVisitedStageIndex ? { diagramMaxVisitedStageIndex: idx } : s;
    }),

  resetDraft: () =>
    set({
      draft: createDefaultPipelineConfiguration(),
      activeStageId: DESIGNER_STAGES[0].id,
      diagramMaxVisitedStageIndex: -1,
      autopilotImportSnapshot: null,
    }),

  loadPipeline: (config) =>
    set({
      draft: deepStripNulls(config),
      activeStageId: DESIGNER_STAGES[0].id,
      diagramMaxVisitedStageIndex: DESIGNER_STAGES.length - 1,
      autopilotImportSnapshot: null,
    }),

  applyAutopilotBuildResult: (buildId, result) => {
    const config = result.config;
    const next: PipelineConfiguration = {
      ...config,
      metadata: {
        ...config.metadata,
        source: 'autopilot',
        buildId,
        updatedAt: new Date().toISOString(),
      },
    };
    const importedAt = new Date().toISOString();
    set({
      draft: deepStripNulls(next),
      activeStageId: DESIGNER_STAGES[0].id,
      diagramMaxVisitedStageIndex: DESIGNER_STAGES.length - 1,
      autopilotImportSnapshot: {
        buildId,
        importedAt,
        metrics: result.metrics,
        totalIterations: result.totalIterations,
      },
    });
  },

  syncAutopilotSnapshotFromStores: () => {
    const { draft, autopilotImportSnapshot } = get();
    const bid = draft.metadata.buildId;
    if (draft.metadata.source !== 'autopilot' || !bid) return;
    if (autopilotImportSnapshot?.buildId === bid && autopilotImportSnapshot.metrics !== undefined)
      return;
    const r = useAutopilotStore.getState().builds[bid]?.result;
    if (!r) return;
    set({
      autopilotImportSnapshot: {
        buildId: bid,
        importedAt: autopilotImportSnapshot?.importedAt ?? new Date().toISOString(),
        metrics: r.metrics,
        totalIterations: r.totalIterations,
      },
    });
  },
}));
