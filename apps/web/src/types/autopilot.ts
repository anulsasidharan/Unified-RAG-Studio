import type { CloudProvider, PipelineConfiguration } from './pipeline';

// ─── Build Requirements ──────────────────────────────────────────────────────

export interface TargetMetrics {
  faithfulness?: number;
  answerRelevance?: number;
  contextPrecision?: number;
  contextRecall?: number;
}

export interface BuildRequirements {
  targetMetrics: TargetMetrics;
  cloudProvider?: CloudProvider;
  /** Maximum cost per 1K queries in USD */
  budgetConstraint?: number;
  /** Maximum acceptable latency in milliseconds */
  latencyRequirement?: number;
  optimizeFor?: 'quality' | 'cost' | 'latency' | 'balanced';
  maxIterations?: number;
}

/** One row returned from ``POST /api/autopilot/upload`` — ``objectId`` is sent as ``documentIds`` on build start. */
export interface AutopilotUploadedDocument {
  objectId: string;
  originalFilename: string;
  sizeBytes: number;
  contentType?: string | null;
}

export interface AutopilotUploadResponse {
  documents: AutopilotUploadedDocument[];
}

// ─── Build Lifecycle ─────────────────────────────────────────────────────────

export type BuildStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';

export type AutopilotStageId =
  | 'analyze'
  | 'chunking'
  | 'embedding'
  | 'vectorstore'
  | 'retrieval'
  | 'evaluation'
  | 'deployment';

export interface StageStatus {
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt?: string;
  completedAt?: string;
  message?: string;
  data?: unknown;
}

export interface BuildMessage {
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  agent?: string;
}

// ─── Agent Decisions ─────────────────────────────────────────────────────────

export interface EmbeddingBenchmarkResult {
  model: string;
  score: number;
  costPer1MTokens: number;
  latencyMs: number;
}

export interface AgentDecisions {
  chunking?: {
    strategy: string;
    chunkSize: number;
    reasoning: string;
    alternativesTested: string[];
  };
  embedding?: {
    model: string;
    reasoning: string;
    benchmarkResults: EmbeddingBenchmarkResult[];
  };
  retrieval?: {
    strategy: string;
    topK: number;
    reasoning: string;
    performance: Record<string, number>;
    rerankingEnabled: boolean;
  };
  generation?: {
    model: string;
    reasoning: string;
  };
}

// ─── Deployment ──────────────────────────────────────────────────────────────

export type DeploymentStatus = 'deploying' | 'deployed' | 'failed';

export interface DeploymentInfo {
  provider: string;
  endpoint: string;
  status: DeploymentStatus;
  deployedAt?: string;
  healthCheckUrl?: string;
  dockerImageTag?: string;
}

// ─── Build Result ────────────────────────────────────────────────────────────

export interface FinalMetrics {
  faithfulness: number;
  answerRelevance: number;
  contextPrecision: number;
  contextRecall: number;
  avgLatencyMs?: number;
  costPerQuery?: number;
}

export interface BuildResult {
  config: PipelineConfiguration;
  metrics: FinalMetrics;
  decisions: AgentDecisions;
  deployment?: DeploymentInfo;
  totalIterations: number;
}

// ─── P7-5 · API `dashboardMetrics` (from orchestrator stage_outputs) ─────────

export interface DashboardQualitySnapshot {
  faithfulness?: number;
  answerRelevance?: number;
  contextPrecision?: number;
  contextRecall?: number;
  avgLatencyMs?: number;
  meetsTargets?: boolean;
}

export interface DashboardEmbeddingBenchRow {
  label: string;
  latencyMs?: number;
  compositeScore?: number;
  textsPerSecond?: number;
}

export interface DashboardRetrievalSummary {
  strategy?: string;
  topK?: number;
  performance?: Record<string, number>;
}

export interface AutopilotDashboardMetrics {
  quality?: DashboardQualitySnapshot;
  embeddingBenchmarks: DashboardEmbeddingBenchRow[];
  selectedEmbeddingLabel?: string;
  retrieval?: DashboardRetrievalSummary;
}

// ─── Top-Level Build Object ──────────────────────────────────────────────────

export interface AutopilotBuild {
  id: string;
  status: BuildStatus;
  /** Overall progress 0–100 */
  progress: number;
  currentStage: AutopilotStageId | string;
  iteration: number;
  input: {
    documents: string[];
    requirements: BuildRequirements;
    /** Optional starting config from Designer "Optimize This" flow */
    baseConfig?: PipelineConfiguration;
  };
  stages: Record<string, StageStatus>;
  messages: BuildMessage[];
  result?: BuildResult;
  /** P7-5: typed slice of orchestrator metrics for charts (from ``dashboardMetrics`` on poll/SSE). */
  dashboardMetrics?: AutopilotDashboardMetrics;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
