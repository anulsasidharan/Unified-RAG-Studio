// ─── Primitive Union Types ──────────────────────────────────────────────────

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'multi-cloud';

export type ModelTier = 'fast' | 'balanced' | 'advanced';

export type ChunkingStrategy =
  | 'fixed-size'
  | 'recursive-character'
  | 'semantic'
  | 'markdown-header'
  | 'sentence-based'
  | 'paragraph-based'
  | 'code-aware'
  | 'token-aware';

export type VectorStoreProvider =
  | 'pinecone'
  | 'weaviate'
  | 'qdrant'
  | 'chroma'
  | 'faiss'
  | 'opensearch'
  | 'vertex-ai-vector-search'
  | 'azure-ai-search'
  | 'pgvector';

export type RetrievalStrategy =
  | 'similarity'
  | 'mmr'
  | 'hybrid'
  | 'parent-child'
  | 'multi-query'
  | 'ensemble';

export type EmbeddingProvider = 'openai' | 'cohere' | 'google' | 'huggingface' | 'nomic' | 'custom';

export type GenerationProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'cohere'
  | 'custom';

export type MemoryType =
  | 'none'
  | 'conversation-buffer'
  | 'summary-buffer'
  | 'vector-memory'
  | 'entity-memory'
  | 'episodic-memory';

export type OutputFormat = 'text' | 'json' | 'markdown';

export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot';

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';

// ─── Sub-Structures ──────────────────────────────────────────────────────────

export interface MetadataFilter {
  key: string;
  operator: FilterOperator;
  value: string | number | boolean | string[];
}

export type HybridFusionMode = 'rrf' | 'weighted';

export interface HybridSearchConfig {
  /** Weight between dense (1.0) and sparse/BM25 (0.0) */
  alpha: number;
  sparseWeight?: number;
  denseWeight?: number;
  /** How dense and sparse rankings are merged in the retrieval runtime. */
  fusion?: HybridFusionMode;
}

// ─── Stage Configurations ────────────────────────────────────────────────────

export type DataIngestionSourceType =
  | 'file-upload'
  | 's3'
  | 'gcs'
  | 'azure-blob'
  | 'url'
  | 'database'
  | 'api';

/** One designer-selectable ingestion channel; several may be enabled at once. */
export interface DataIngestionSourceSlot {
  sourceType: DataIngestionSourceType;
  enabled: boolean;
  connectionConfig?: Record<string, unknown>;
}

export interface DataIngestionConfig {
  sourceType: DataIngestionSourceType;
  /** When set, multiple sources can run in parallel; `sourceType` stays the primary (first enabled) for legacy consumers. */
  sources?: DataIngestionSourceSlot[];
  fileTypes: string[];
  preprocessing: {
    stripHtml: boolean;
    normalizeWhitespace: boolean;
    extractMetadata: boolean;
    customRules?: string[];
  };
  metadata: {
    includeSource: boolean;
    includePageNumber: boolean;
    customMetadata?: Record<string, string>;
  };
  connectionConfig?: Record<string, unknown>;
}

export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
  metadata?: {
    includeSource: boolean;
    includePageNumber: boolean;
    customMetadata?: Record<string, unknown>;
  };
}

export interface EmbeddingConfig {
  model: string;
  provider: EmbeddingProvider;
  dimensions: number;
  batchSize?: number;
  maxTokens?: number;
  cacheEmbeddings?: boolean;
  embeddingVersion?: string;
}

export interface VectorStoreConfig {
  provider: VectorStoreProvider;
  indexName: string;
  configuration: {
    metric?: SimilarityMetric;
    replicas?: number;
    shards?: number;
    namespace?: string;
    cloud?: {
      region: string;
      instanceType?: string;
    };
  };
}

/** Pre-retrieval query transforms (design-time; Autopilot uses deterministic expansion). */
export interface QueryProcessingConfig {
  enabled: boolean;
  queryRewrite: boolean;
  hyde: boolean;
  multiQueryExpansion: boolean;
  decomposition: boolean;
  stepBack: boolean;
  intentClassification: boolean;
  entityExtraction: boolean;
  keywordAugmentation: boolean;
  llmModel?: string;
}

export type ContextCompressionMode = 'none' | 'relevance_filter' | 'dedupe' | 'summarize_stub';

export interface ContextCompressionConfig {
  enabled: boolean;
  mode: ContextCompressionMode;
  minScore?: number | null;
  maxTokenBudget?: number | null;
}

export interface ObservabilityConfig {
  tokenTracking: boolean;
  latencyMonitoring: boolean;
  retrievalTracing: boolean;
  promptTracing: boolean;
}

export interface AdaptivePolicyRule {
  predicate: string;
  action: string;
}

export interface AgentToolsConfig {
  calculatorEnabled: boolean;
  webSearchEnabled: boolean;
  sqlAgentEnabled: boolean;
}

/** Sub-strategies run in parallel for ensemble retrieval (RRF fusion). */
export type EnsembleMemberStrategy =
  | 'similarity'
  | 'mmr'
  | 'hybrid'
  | 'multi-query'
  | 'parent-child';

export interface FewShotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RetrievalConfig {
  strategy: RetrievalStrategy;
  topK: number;
  scoreThreshold?: number | null;
  filters?: MetadataFilter[];
  hybridSearch?: HybridSearchConfig;
  parentChildConfig?: {
    parentChunkSize: number;
    childChunkSize: number;
  };
  multiQueryConfig?: {
    numVariants: number;
    llmModel: string;
  };
  /** MMR: candidate pool size before diversity selection (retrieval runtime). */
  mmrFetchK?: number | null;
  /** MMR: 0 = max diversity, 1 = max relevance to query. */
  mmrLambdaMult?: number;
  /** Ensemble: member strategies fused with RRF (order preserved). */
  ensembleStrategies?: EnsembleMemberStrategy[];
  /** Ensemble: RRF smoothing constant `k` (higher = more smoothing). */
  ensembleRrfK?: number;
}

export interface RerankingConfig {
  enabled: boolean;
  model?: string;
  topN?: number;
  provider?: 'cohere' | 'huggingface' | 'custom';
  /** When the reranker returns relevance scores (e.g. Cohere), drop chunks below this threshold. */
  minRelevanceScore?: number | null;
  /**
   * Optional post-rerank diversity: skip a document if its normalized text is more similar than this
   * to any already-kept document (0–1). Omitted or null = no deduplication pass.
   */
  diversityMaxSimilarity?: number | null;
}

export interface GenerationConfig {
  model: string;
  provider: GenerationProvider;
  temperature: number;
  maxTokens: number;
  topP?: number;
  systemPrompt?: string;
  outputFormat?: OutputFormat;
  fewShotMessages?: FewShotMessage[];
  persona?: string;
  citationGrounding?: boolean;
}

export interface RoutingRule {
  condition:
    | 'keyword'
    | 'query-length'
    | 'semantic-complexity'
    | 'semantic-routing'
    | 'cost-aware'
    | 'latency-aware'
    | 'confidence-routing'
    | 'tool-routing';
  threshold?: number;
  keywords?: string[];
  targetModel: string;
}

export interface RoutingConfig {
  enabled: boolean;
  rules?: RoutingRule[];
  defaultModel?: string;
}

export interface MemoryConfig {
  type: MemoryType;
  windowSize?: number;
  maxTokens?: number;
  sessionPersistence?: boolean;
}

export type EvaluationMetricName =
  | 'faithfulness'
  | 'answer_relevance'
  | 'context_precision'
  | 'context_recall'
  | 'latency'
  | 'groundedness'
  | 'safety'
  | 'human_evaluation'
  | 'retrieval_ndcg';

export interface EvaluationConfig {
  enabled: boolean;
  metrics?: EvaluationMetricName[];
  testSetSize?: number;
  schedule?: 'on-demand' | 'continuous';
}

/** Human-in-the-loop capability tier — controls how much configuration is surfaced in the designer. */
export type HitlTier = 'simple' | 'medium' | 'advanced';

export type HitlRole =
  | 'reviewer'
  | 'approver'
  | 'corrector'
  | 'escalation_handler'
  | 'trainer'
  | 'data_curator';

export type HitlEscalationMode =
  | 'soft_warn'
  | 'hard_block'
  | 'silent_route'
  | 'deferred_queue'
  | 'human_takeover';

export type HitlOrchestrationHint =
  | 'langgraph'
  | 'temporal'
  | 'step_functions'
  | 'prefect'
  | 'camunda'
  | 'airflow';

export interface HitlPlacementConfig {
  preIngestionValidation: boolean;
  retrievalTime: boolean;
  generationTime: boolean;
  postResponseFeedback: boolean;
}

export interface HitlConfidenceConfig {
  /** When max similarity falls below this, route to human (retrieval-time HITL). */
  retrieverScoreThreshold: number | null;
  rerankerScoreThreshold: number | null;
  llmUncertaintySignals: boolean;
  escalationMode: HitlEscalationMode;
}

export interface HitlWorkflowConfig {
  synchronousReview: boolean;
  allowHumanEdit: boolean;
  /** Ordered roles for sequential approvals (e.g. SME then compliance). */
  sequentialApprovalRoles: HitlRole[];
}

export interface HitlAdvancedConfig {
  orchestrationHint: HitlOrchestrationHint | null;
  agenticToolApproval: boolean;
  multiReviewerConsensus: boolean;
  auditLoggingRequired: boolean;
  humanGuidedRetrieval: boolean;
  activeLearningFeedback: boolean;
}

export interface HumanInTheLoopConfig {
  enabled: boolean;
  tier: HitlTier;
  roles: HitlRole[];
  placement: HitlPlacementConfig;
  confidence: HitlConfidenceConfig;
  workflow: HitlWorkflowConfig;
  advanced: HitlAdvancedConfig;
}

// ─── Guardrails (P4.5) — optional on saved pipeline JSON ─────────────────────

export interface GuardrailStageSettings {
  enabled: boolean;
}

export interface InputStageGuardrails extends GuardrailStageSettings {
  piiRedactionEnabled: boolean;
  promptInjectionBlockEnabled: boolean;
  toxicityBlockEnabled: boolean;
}

export interface RetrievalStageGuardrails extends GuardrailStageSettings {
  contentFilterEnabled: boolean;
  sourceValidationEnabled: boolean;
  biasDetectionEnabled: boolean;
}

export interface OutputStageGuardrails extends GuardrailStageSettings {
  hallucinationHeuristicEnabled: boolean;
  factualityCheckEnabled: boolean;
  citationVerificationEnabled: boolean;
}

export interface GuardrailsConfig {
  input: InputStageGuardrails;
  retrieval: RetrievalStageGuardrails;
  output: OutputStageGuardrails;
}

// ─── Cost & Performance ──────────────────────────────────────────────────────

export interface CostBreakdown {
  component: string;
  unitCost: number;
  estimatedUsage: number;
  totalCost: number;
  percentage: number;
}

export interface CostEstimate {
  embedding: number;
  storage: number;
  retrieval: number;
  reranking: number;
  generation: number;
  total: number;
  perQuery: number;
  perMonth: number;
  currency: 'USD';
  breakdown: CostBreakdown[];
}

/** Formats supported by `POST /api/designer/export` (P4-4). */
export type DesignerExportFormat = 'python' | 'yaml' | 'terraform' | 'docker-compose' | 'k8s';

/** Response from `POST /api/designer/export` (camelCase via `RAGBaseModel`). */
export interface DesignerExportResponse {
  code: string;
  filename: string;
  format: DesignerExportFormat;
  contentType: string;
}

export interface PerformanceEstimate {
  avgLatencyMs: number;
  p95LatencyMs: number;
  faithfulness: number;
  relevance: number;
  tier: 'budget' | 'balanced' | 'premium';
}

// ─── Top-Level Pipeline Configuration ───────────────────────────────────────

export interface PipelineStages {
  dataIngestion?: DataIngestionConfig;
  chunking: ChunkingConfig;
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  queryProcessing?: QueryProcessingConfig;
  retrieval: RetrievalConfig;
  contextCompression?: ContextCompressionConfig;
  reranking?: RerankingConfig;
  generation: GenerationConfig;
  routing?: RoutingConfig;
  memory?: MemoryConfig;
  evaluation?: EvaluationConfig;
  /** Optional human review / approval gates — exported with pipeline artifacts. */
  humanInTheLoop?: HumanInTheLoopConfig;
}

export interface PipelineMetadata {
  createdAt: string;
  updatedAt?: string;
  version: string;
  author?: string;
  source?: 'designer' | 'autopilot' | 'template';
  buildId?: string;
}

export interface PipelineConfiguration {
  id: string;
  name: string;
  description?: string;
  cloudProvider: CloudProvider;
  stages: PipelineStages;
  metadata: PipelineMetadata;
  estimatedCost?: CostEstimate;
  estimatedPerformance?: PerformanceEstimate;
  /** When omitted, the API applies default guardrail policy (all stages on). */
  guardrails?: GuardrailsConfig | null;
  observability?: ObservabilityConfig | null;
  adaptivePolicies?: AdaptivePolicyRule[];
  agentTools?: AgentToolsConfig;
}
