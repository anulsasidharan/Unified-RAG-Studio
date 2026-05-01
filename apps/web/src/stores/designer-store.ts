'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DESIGNER_STAGES, type DesignerStageId } from '@/lib/constants';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import type { PipelineConfiguration, PipelineStages } from '@/types/pipeline';

const STORAGE_KEY = 'rag-studio-designer-v1';

type DesignerState = {
  draft: PipelineConfiguration;
  activeStageId: DesignerStageId;
  setDraft: (next: PipelineConfiguration) => void;
  patchDraft: (patch: Partial<PipelineConfiguration>) => void;
  updateStages: (patch: Partial<PipelineStages>) => void;
  setActiveStage: (id: DesignerStageId) => void;
  resetDraft: () => void;
  loadPipeline: (config: PipelineConfiguration) => void;
};

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      draft: createDefaultPipelineConfiguration(),
      activeStageId: DESIGNER_STAGES[0].id,

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

      resetDraft: () =>
        set({
          draft: createDefaultPipelineConfiguration(),
          activeStageId: DESIGNER_STAGES[0].id,
        }),

      loadPipeline: (config) =>
        set({
          draft: config,
          activeStageId: DESIGNER_STAGES[0].id,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        draft: s.draft,
        activeStageId: s.activeStageId,
      }),
      skipHydration: true,
    }
  )
);
