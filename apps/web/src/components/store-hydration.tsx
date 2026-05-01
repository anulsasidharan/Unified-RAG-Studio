'use client';

import { useEffect } from 'react';

import { useAutopilotStore } from '@/stores/autopilot-store';
import { useDesignerStore } from '@/stores/designer-store';
import { useProjectStore } from '@/stores/project-store';

/**
 * Rehydrates persisted Zustand stores on the client after Next.js SSR.
 * Must be mounted once under the app root.
 */
export function StoreHydration() {
  useEffect(() => {
    void useDesignerStore.persist.rehydrate();
    void useProjectStore.persist.rehydrate();
    void useAutopilotStore.persist.rehydrate();
  }, []);

  return null;
}
