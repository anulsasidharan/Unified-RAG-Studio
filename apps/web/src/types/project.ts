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
}
