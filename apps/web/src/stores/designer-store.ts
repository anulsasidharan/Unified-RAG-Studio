'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DESIGNER_STAGES, designerStageIndex, type DesignerStageId } from '@/lib/constants';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import type { PipelineConfiguration, PipelineStages } from '@/types/pipeline';

const STORAGE_KEY = 'rag-studio-designer-v1';

type DesignerState = {
  draft: PipelineConfiguration;
  activeStageId: DesignerStageId;
  /** Furthest designer stage reached while navigating (-1 = empty graph until user moves forward). */
  diagramMaxVisitedStageIndex: number;
  setDraft: (next: PipelineConfiguration) => void;
  patchDraft: (patch: Partial<PipelineConfiguration>) => void;
  updateStages: (patch: Partial<PipelineStages>) => void;
  setActiveStage: (id: DesignerStageId) => void;
  expandDiagramReach: (stageId: DesignerStageId) => void;
  resetDraft: () => void;
  loadPipeline: (config: PipelineConfiguration) => void;
};

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      draft: createDefaultPipelineConfiguration(),
      activeStageId: DESIGNER_STAGES[0].id,
      diagramMaxVisitedStageIndex: -1,

      setDraft: (next) => set({ draft: next }),

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
          return idx > s.diagramMaxVisitedStageIndex
            ? { diagramMaxVisitedStageIndex: idx }
            : s;
        }),

      resetDraft: () =>
        set({
          draft: createDefaultPipelineConfiguration(),
          activeStageId: DESIGNER_STAGES[0].id,
          diagramMaxVisitedStageIndex: -1,
        }),

      loadPipeline: (config) =>
        set({
          draft: config,
          activeStageId: DESIGNER_STAGES[0].id,
          diagramMaxVisitedStageIndex: DESIGNER_STAGES.length - 1,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        draft: s.draft,
        activeStageId: s.activeStageId,
        diagramMaxVisitedStageIndex: s.diagramMaxVisitedStageIndex,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<DesignerState, 'draft' | 'activeStageId' | 'diagramMaxVisitedStageIndex'>> | undefined;
        if (!p || typeof p !== 'object') return current;
        return {
          ...current,
          draft: p.draft ?? current.draft,
          activeStageId: p.activeStageId ?? current.activeStageId,
          diagramMaxVisitedStageIndex:
            typeof p.diagramMaxVisitedStageIndex === 'number'
              ? p.diagramMaxVisitedStageIndex
              : DESIGNER_STAGES.length - 1,
        };
      },
      skipHydration: true,
    }
  )
);
