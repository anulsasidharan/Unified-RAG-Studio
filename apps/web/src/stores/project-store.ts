'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { applyDesignerSnapshot, takeDesignerSnapshot } from '@/lib/project-designer-bridge';
import type { DesignerProjectSnapshot, Project } from '@/types/project';

const STORAGE_KEY = 'rag-studio-projects-v1';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}`;
}

type ProjectState = {
  projects: Project[];
  activeProjectId: string | null;
  addProject: (input: {
    name: string;
    description?: string;
    id?: string;
    linkedPipelineId?: string;
    designerSnapshot?: DesignerProjectSnapshot;
  }) => Project;
  updateProject: (
    id: string,
    patch: Partial<
      Pick<Project, 'name' | 'description' | 'linkedPipelineId' | 'designerSnapshot'>
    >
  ) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  clearProjects: () => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      addProject: (input) => {
        const prevActive = get().activeProjectId;
        if (prevActive) {
          const snap = takeDesignerSnapshot();
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === prevActive
                ? { ...p, designerSnapshot: snap, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }

        const now = new Date().toISOString();
        const project: Project = {
          id: input.id ?? newId(),
          name: input.name,
          description: input.description,
          createdAt: now,
          updatedAt: now,
          linkedPipelineId: input.linkedPipelineId,
          designerSnapshot: input.designerSnapshot,
        };
        set((s) => ({
          projects: [...s.projects, project],
          activeProjectId: project.id,
        }));
        applyDesignerSnapshot(project.designerSnapshot);
        return project;
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
          ),
        })),

      removeProject: (id) => {
        const s = get();
        const wasActive = s.activeProjectId === id;
        const nextProjects = s.projects.filter((p) => p.id !== id);
        const nextActive =
          s.activeProjectId === id ? nextProjects[0]?.id ?? null : s.activeProjectId;
        set({ projects: nextProjects, activeProjectId: nextActive });
        if (wasActive) {
          const nextProject = get().projects.find((p) => p.id === nextActive);
          applyDesignerSnapshot(nextProject?.designerSnapshot);
        }
      },

      setActiveProject: (id) => {
        const prev = get().activeProjectId;
        if (prev === id) return;

        if (prev) {
          const snap = takeDesignerSnapshot();
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === prev
                ? { ...p, designerSnapshot: snap, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }

        set({ activeProjectId: id });

        if (id == null) {
          applyDesignerSnapshot(undefined);
          return;
        }

        const nextProject = get().projects.find((p) => p.id === id);
        applyDesignerSnapshot(nextProject?.designerSnapshot);
      },

      clearProjects: () => {
        set({ projects: [], activeProjectId: null });
        applyDesignerSnapshot(undefined);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
      }),
      skipHydration: true,
    }
  )
);
