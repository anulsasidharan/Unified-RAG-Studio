import type { PipelineConfiguration } from './pipeline';

/**
 * Designer pipeline state stored per project (draft + diagram progress).
 * Active stage follows the URL while in Designer; it is not duplicated here.
 */
export interface DesignerProjectSnapshot {
  draft: PipelineConfiguration;
  diagramMaxVisitedStageIndex: number;
}

/**
 * Client-side project record until Projects API (P4-1) backs persistence.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Optional link to a pipeline config id for navigation once APIs exist */
  linkedPipelineId?: string;
  /** Last saved Designer pipeline for this project */
  designerSnapshot?: DesignerProjectSnapshot;
}
