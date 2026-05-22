'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { apiClient } from '@/lib/api-client';
import { applyDesignerSnapshot, takeDesignerSnapshot } from '@/lib/project-designer-bridge';
import type { DesignerProjectSnapshot, Project } from '@/types/project';

const STORAGE_KEY = 'rag-studio-projects-v1';

type ProjectRowFromApi = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedProjects = {
  items: ProjectRowFromApi[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

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
    patch: Partial<Pick<Project, 'name' | 'description' | 'linkedPipelineId' | 'designerSnapshot'>>,
  ) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  clearProjects: () => void;

  syncFromServer: () => Promise<void>;
  createProjectOnServer: (input: { name: string; description?: string | null }) => Promise<Project>;
  renameProjectOnServer: (
    id: string,
    patch: { name?: string; description?: string | null },
  ) => Promise<void>;
  deleteProjectOnServer: (id: string) => Promise<void>;
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
                : p,
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
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
          ),
        })),

      removeProject: (id) => {
        const s = get();
        const wasActive = s.activeProjectId === id;
        const nextProjects = s.projects.filter((p) => p.id !== id);
        const nextActive =
          s.activeProjectId === id ? (nextProjects[0]?.id ?? null) : s.activeProjectId;
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
                : p,
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

      syncFromServer: async () => {
        const res = await apiClient.get<PaginatedProjects>('/api/projects?page=1&page_size=100');

        const prevById = new Map(get().projects.map((p) => [p.id, p.designerSnapshot]));

        set((s) => {
          const nextProjects: Project[] = res.items.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description ?? undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            designerSnapshot: prevById.get(row.id),
          }));

          const nextActive =
            s.activeProjectId && nextProjects.some((p) => p.id === s.activeProjectId)
              ? s.activeProjectId
              : (nextProjects[0]?.id ?? null);

          return { projects: nextProjects, activeProjectId: nextActive };
        });

        const activeId = get().activeProjectId;
        const activeProject = get().projects.find((p) => p.id === activeId);
        applyDesignerSnapshot(activeProject?.designerSnapshot);
      },

      createProjectOnServer: async (input) => {
        const created = await apiClient.post<ProjectRowFromApi>('/api/projects', {
          name: input.name,
          description: input.description ?? null,
        });

        const project: Project = {
          id: created.id,
          name: created.name,
          description: created.description ?? undefined,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };

        set((s) => ({
          projects: [...s.projects, project],
          activeProjectId: project.id,
        }));

        applyDesignerSnapshot(undefined);
        return project;
      },

      renameProjectOnServer: async (id, patch) => {
        const updated = await apiClient.put<ProjectRowFromApi>(`/api/projects/${id}`, {
          name: patch.name,
          description: patch.description ?? undefined,
        });

        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  name: updated.name,
                  description: updated.description ?? undefined,
                  updatedAt: updated.updatedAt,
                }
              : p,
          ),
        }));
      },

      deleteProjectOnServer: async (id) => {
        await apiClient.delete(`/api/projects/${id}`);
        get().removeProject(id);
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
    },
  ),
);
