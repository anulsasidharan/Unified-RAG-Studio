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
  | 'code-aware';

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

export type EmbeddingProvider =
  | 'openai'
  | 'cohere'
  | 'google'
  | 'huggingface'
  | 'nomic'
  | 'custom';

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
  | 'vector-memory';

export type OutputFormat = 'text' | 'json' | 'markdown';

export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot';

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains';

// ─── Sub-Structures ──────────────────────────────────────────────────────────

export interface MetadataFilter {
  key: string;
  operator: FilterOperator;
  value: string | number | boolean | string[];
}

export interface HybridSearchConfig {
  /** Weight between dense (1.0) and sparse/BM25 (0.0) */
  alpha: number;
  sparseWeight?: number;
  denseWeight?: number;
}

// ─── Stage Configurations ────────────────────────────────────────────────────

export interface DataIngestionConfig {
  sourceType:
    | 'file-upload'
    | 's3'
    | 'gcs'
    | 'azure-blob'
    | 'url'
    | 'database'
    | 'api';
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
}

export interface RerankingConfig {
  enabled: boolean;
  model?: string;
  topN?: number;
  provider?: 'cohere' | 'huggingface' | 'custom';
}

export interface GenerationConfig {
  model: string;
  provider: GenerationProvider;
  temperature: number;
  maxTokens: number;
  topP?: number;
  systemPrompt?: string;
  outputFormat?: OutputFormat;
}

export interface RoutingRule {
  condition: 'keyword' | 'query-length' | 'semantic-complexity';
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
  | 'latency';

export interface EvaluationConfig {
  enabled: boolean;
  metrics?: EvaluationMetricName[];
  testSetSize?: number;
  schedule?: 'on-demand' | 'continuous';
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
  retrieval: RetrievalConfig;
  reranking?: RerankingConfig;
  generation: GenerationConfig;
  routing?: RoutingConfig;
  memory?: MemoryConfig;
  evaluation?: EvaluationConfig;
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
}
