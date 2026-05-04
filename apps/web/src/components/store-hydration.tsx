'use client';

import { useEffect } from 'react';

import { applyDesignerSnapshot } from '@/lib/project-designer-bridge';
import { useAutopilotStore } from '@/stores/autopilot-store';
import { useProjectStore } from '@/stores/project-store';
import type { PipelineConfiguration } from '@/types/pipeline';

const LEGACY_DESIGNER_STORAGE_KEY = 'rag-studio-designer-v1';

function migrateLegacyDesignerDraftOnce(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LEGACY_DESIGNER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: { draft?: unknown; diagramMaxVisitedStageIndex?: unknown } };
    const draft = parsed?.state?.draft;
    if (!draft || typeof draft !== 'object') {
      localStorage.removeItem(LEGACY_DESIGNER_STORAGE_KEY);
      return;
    }

    const projects = useProjectStore.getState().projects;
    const activeId = useProjectStore.getState().activeProjectId;
    if (!activeId) {
      localStorage.removeItem(LEGACY_DESIGNER_STORAGE_KEY);
      return;
    }

    const proj = projects.find((p) => p.id === activeId);
    if (proj?.designerSnapshot) {
      localStorage.removeItem(LEGACY_DESIGNER_STORAGE_KEY);
      return;
    }

    const diagramMaxVisitedStageIndex =
      typeof parsed.state?.diagramMaxVisitedStageIndex === 'number'
        ? parsed.state.diagramMaxVisitedStageIndex
        : -1;

    useProjectStore.getState().updateProject(activeId, {
      designerSnapshot: {
        draft: draft as PipelineConfiguration,
        diagramMaxVisitedStageIndex,
      },
    });

    localStorage.removeItem(LEGACY_DESIGNER_STORAGE_KEY);
  } catch {
    try {
      localStorage.removeItem(LEGACY_DESIGNER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Rehydrates persisted Zustand stores on the client after Next.js SSR.
 * Must be mounted once under the app root.
 */
export function StoreHydration() {
  useEffect(() => {
    void Promise.resolve(useProjectStore.persist.rehydrate()).then(() => {
      migrateLegacyDesignerDraftOnce();
      const activeId = useProjectStore.getState().activeProjectId;
      const project = useProjectStore.getState().projects.find((p) => p.id === activeId);
      applyDesignerSnapshot(project?.designerSnapshot);
    });
    void useAutopilotStore.persist.rehydrate();
  }, []);

  return null;
}
