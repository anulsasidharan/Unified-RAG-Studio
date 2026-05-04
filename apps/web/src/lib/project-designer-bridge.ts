'use client';

import { useDesignerStore } from '@/stores/designer-store';
import type { DesignerProjectSnapshot } from '@/types/project';

export function takeDesignerSnapshot(): DesignerProjectSnapshot {
  const { draft, diagramMaxVisitedStageIndex } = useDesignerStore.getState();
  return { draft, diagramMaxVisitedStageIndex };
}

export function applyDesignerSnapshot(snapshot: DesignerProjectSnapshot | undefined): void {
  if (!snapshot) {
    useDesignerStore.getState().resetDraft();
    return;
  }
  useDesignerStore.setState({
    draft: snapshot.draft,
    diagramMaxVisitedStageIndex: snapshot.diagramMaxVisitedStageIndex,
  });
}
