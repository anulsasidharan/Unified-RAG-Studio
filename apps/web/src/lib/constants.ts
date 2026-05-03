export const APP_NAME = 'RAG Studio';
export const APP_VERSION = '0.1.0';

export const DESIGNER_STAGES = [
  { id: 'cloud',       label: 'Cloud Provider', path: '/designer' },
  { id: 'ingestion',  label: 'Data Ingestion',  path: '/designer/ingestion' },
  { id: 'chunking',   label: 'Chunking',         path: '/designer/chunking' },
  { id: 'embedding',  label: 'Embedding',         path: '/designer/embedding' },
  { id: 'vectorstore',label: 'Vector Store',      path: '/designer/vectorstore' },
  { id: 'retrieval',  label: 'Retrieval',          path: '/designer/retrieval' },
  { id: 'reranking',  label: 'Reranking',          path: '/designer/reranking' },
  { id: 'generation', label: 'Generation',         path: '/designer/generation' },
  { id: 'routing',    label: 'Routing',            path: '/designer/routing' },
  { id: 'memory',     label: 'Memory',             path: '/designer/memory' },
  { id: 'evaluation', label: 'Evaluation',         path: '/designer/evaluation' },
  { id: 'review',     label: 'Review',             path: '/designer/review' },
] as const;

export type DesignerStageId = (typeof DESIGNER_STAGES)[number]['id'];

/** 0-based index in {@link DESIGNER_STAGES} — used for progressive diagram reveal. */
export function designerStageIndex(id: DesignerStageId): number {
  const i = DESIGNER_STAGES.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

export const STAGE_ROUTE_MAP: Record<string, string> = Object.fromEntries(
  DESIGNER_STAGES.map((s) => [s.id, s.path])
);

export const AUTOPILOT_STAGES = [
  { id: 'analyze',    label: 'Analyzing Documents' },
  { id: 'chunking',   label: 'Optimizing Chunking' },
  { id: 'embedding',  label: 'Testing Embeddings' },
  { id: 'vectorstore',label: 'Creating Vector Index' },
  { id: 'retrieval',  label: 'Optimizing Retrieval' },
  { id: 'evaluation', label: 'Evaluating Pipeline' },
  { id: 'deployment', label: 'Deploying System' },
] as const;

export const DEFAULT_CHUNK_SIZE = 512;
export const DEFAULT_CHUNK_OVERLAP = 50;
export const DEFAULT_TOP_K = 5;
export const DEFAULT_TEMPERATURE = 0.1;
export const DEFAULT_MAX_TOKENS = 1024;

export const CLOUD_PROVIDERS = ['aws', 'gcp', 'azure', 'multi-cloud'] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const ROUTES = {
  home: '/',
  designer: '/designer',
  autopilot: '/autopilot',
  templates: '/templates',
  projects: '/projects',
} as const;
