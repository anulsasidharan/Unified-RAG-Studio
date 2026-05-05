'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AutopilotBuild, BuildRequirements } from '@/types/autopilot';
import type { PipelineConfiguration } from '@/types/pipeline';

const STORAGE_KEY = 'rag-studio-autopilot-v2-p7';
const MAX_PERSISTED_MESSAGES = 120;

export type AutopilotUploadedDocMeta = {
  objectId: string;
  originalName: string;
  sizeBytes: number;
};

export function createDefaultRequirements(): BuildRequirements {
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
  /** Server project UUID for uploads / future build start */
  selectedBackendProjectId: string | null;
  uploadedDocuments: AutopilotUploadedDocMeta[];
  /** Optional Designer handoff baseline */
  baseConfig: PipelineConfiguration | null;
  activeBuildId: string | null;
  builds: Record<string, AutopilotBuild>;

  setRequirements: (next: BuildRequirements) => void;
  patchRequirements: (patch: Partial<BuildRequirements>) => void;
  setSelectedBackendProjectId: (id: string | null) => void;
  setUploadedDocuments: (docs: AutopilotUploadedDocMeta[]) => void;
  addUploadedDocuments: (docs: AutopilotUploadedDocMeta[]) => void;
  removeUploadedDocument: (index: number) => void;
  clearUploadedDocuments: () => void;
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
      selectedBackendProjectId: null,
      uploadedDocuments: [],
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

      setSelectedBackendProjectId: (id) => set({ selectedBackendProjectId: id }),

      setUploadedDocuments: (docs) => set({ uploadedDocuments: [...docs] }),

      addUploadedDocuments: (docs) =>
        set((s) => ({ uploadedDocuments: [...s.uploadedDocuments, ...docs] })),

      removeUploadedDocument: (index) =>
        set((s) => ({
          uploadedDocuments: s.uploadedDocuments.filter((_, i) => i !== index),
        })),

      clearUploadedDocuments: () => set({ uploadedDocuments: [] }),

      setBaseConfig: (config) => set({ baseConfig: config }),

      startFromDesigner: (config) =>
        set({
          baseConfig: config,
          requirements: {
            ...createDefaultRequirements(),
            cloudProvider: config.cloudProvider,
          },
          uploadedDocuments: [],
          selectedBackendProjectId: null,
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
          uploadedDocuments: [],
          selectedBackendProjectId: null,
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
        selectedBackendProjectId: s.selectedBackendProjectId,
        uploadedDocuments: s.uploadedDocuments,
        baseConfig: s.baseConfig,
        activeBuildId: s.activeBuildId,
        builds: s.builds,
      }),
      skipHydration: true,
    }
  )
);
