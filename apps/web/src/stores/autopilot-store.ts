'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AutopilotBuild, BuildRequirements } from '@/types/autopilot';
import type { PipelineConfiguration } from '@/types/pipeline';

const STORAGE_KEY = 'rag-studio-autopilot-v1';
const MAX_PERSISTED_MESSAGES = 120;

function createDefaultRequirements(): BuildRequirements {
  return {
    targetMetrics: {
      faithfulness: 0.85,
      answerRelevance: 0.85,
      contextPrecision: 0.8,
      contextRecall: 0.8,
    },
    optimizeFor: 'balanced',
    maxIterations: 10,
  };
}

function trimBuildForPersistence(build: AutopilotBuild): AutopilotBuild {
  if (!build.messages?.length || build.messages.length <= MAX_PERSISTED_MESSAGES) {
    return build;
  }
  return {
    ...build,
    messages: build.messages.slice(-MAX_PERSISTED_MESSAGES),
  };
}

type AutopilotState = {
  requirements: BuildRequirements;
  documents: string[];
  /** Optional Designer handoff baseline */
  baseConfig: PipelineConfiguration | null;
  activeBuildId: string | null;
  builds: Record<string, AutopilotBuild>;

  setRequirements: (next: BuildRequirements) => void;
  patchRequirements: (patch: Partial<BuildRequirements>) => void;
  setDocuments: (docs: string[]) => void;
  addDocument: (doc: string) => void;
  removeDocument: (index: number) => void;
  setBaseConfig: (config: PipelineConfiguration | null) => void;
  startFromDesigner: (config: PipelineConfiguration) => void;
  clearHandoff: () => void;
  upsertBuild: (build: AutopilotBuild) => void;
  removeBuild: (id: string) => void;
  setActiveBuildId: (id: string | null) => void;
  /** Resets wizard inputs; keeps stored build history. */
  resetSession: () => void;
  clearBuildHistory: () => void;
};

export const useAutopilotStore = create<AutopilotState>()(
  persist(
    (set) => ({
      requirements: createDefaultRequirements(),
      documents: [],
      baseConfig: null,
      activeBuildId: null,
      builds: {},

      setRequirements: (next) => set({ requirements: next }),

      patchRequirements: (patch) =>
        set((s) => ({
          requirements: {
            ...s.requirements,
            ...patch,
            targetMetrics: {
              ...s.requirements.targetMetrics,
              ...(patch.targetMetrics ?? {}),
            },
          },
        })),

      setDocuments: (docs) => set({ documents: [...docs] }),

      addDocument: (doc) =>
        set((s) => ({ documents: [...s.documents, doc] })),

      removeDocument: (index) =>
        set((s) => ({
          documents: s.documents.filter((_, i) => i !== index),
        })),

      setBaseConfig: (config) => set({ baseConfig: config }),

      startFromDesigner: (config) =>
        set({
          baseConfig: config,
          requirements: createDefaultRequirements(),
          documents: [],
        }),

      clearHandoff: () =>
        set({
          baseConfig: null,
        }),

      upsertBuild: (build) =>
        set((s) => ({
          builds: {
            ...s.builds,
            [build.id]: trimBuildForPersistence(build),
          },
          activeBuildId: build.id,
        })),

      removeBuild: (id) =>
        set((s) => {
          const next = { ...s.builds };
          delete next[id];
          return {
            builds: next,
            activeBuildId: s.activeBuildId === id ? null : s.activeBuildId,
          };
        }),

      setActiveBuildId: (id) => set({ activeBuildId: id }),

      resetSession: () =>
        set({
          requirements: createDefaultRequirements(),
          documents: [],
          baseConfig: null,
          activeBuildId: null,
        }),

      clearBuildHistory: () => set({ builds: {}, activeBuildId: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        requirements: s.requirements,
        documents: s.documents,
        baseConfig: s.baseConfig,
        activeBuildId: s.activeBuildId,
        builds: s.builds,
      }),
      skipHydration: true,
    }
  )
);
