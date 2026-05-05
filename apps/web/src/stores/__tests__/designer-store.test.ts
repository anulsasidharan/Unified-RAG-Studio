import { beforeEach, describe, expect, it } from 'vitest';

import { useDesignerStore } from '@/stores/designer-store';

describe('useDesignerStore', () => {
  beforeEach(() => {
    useDesignerStore.getState().resetDraft();
  });

  it('merges chunking updates without dropping other stages', () => {
    const beforeEmbedding = useDesignerStore.getState().draft.stages.embedding?.model;
    useDesignerStore.getState().updateStages({
      chunking: {
        strategy: 'semantic',
        chunkSize: 1024,
        chunkOverlap: 80,
      },
    });
    const s = useDesignerStore.getState().draft.stages;
    expect(s.chunking?.strategy).toBe('semantic');
    expect(s.chunking?.chunkSize).toBe(1024);
    expect(s.embedding?.model).toBe(beforeEmbedding);
  });

  it('tracks active designer stage independently from draft stages', () => {
    useDesignerStore.getState().setActiveStage('embedding');
    expect(useDesignerStore.getState().activeStageId).toBe('embedding');
  });
});
