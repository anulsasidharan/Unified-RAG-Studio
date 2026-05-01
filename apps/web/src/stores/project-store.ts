'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Project } from '@/types/project';

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
  }) => Project;
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'linkedPipelineId'>>
  ) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  clearProjects: () => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,

      addProject: (input) => {
        const now = new Date().toISOString();
        const project: Project = {
          id: input.id ?? newId(),
          name: input.name,
          description: input.description,
          createdAt: now,
          updatedAt: now,
          linkedPipelineId: input.linkedPipelineId,
        };
        set((s) => ({
          projects: [...s.projects, project],
          activeProjectId: project.id,
        }));
        return project;
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, ...patch, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      removeProject: (id) =>
        set((s) => {
          const nextProjects = s.projects.filter((p) => p.id !== id);
          const nextActive =
            s.activeProjectId === id
              ? nextProjects[0]?.id ?? null
              : s.activeProjectId;
          return { projects: nextProjects, activeProjectId: nextActive };
        }),

      setActiveProject: (id) => set({ activeProjectId: id }),

      clearProjects: () => set({ projects: [], activeProjectId: null }),
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
