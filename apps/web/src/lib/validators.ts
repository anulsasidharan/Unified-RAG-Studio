import { z } from 'zod';

// ─── Primitive Enums ─────────────────────────────────────────────────────────

export const CloudProviderSchema = z.enum(['aws', 'gcp', 'azure', 'multi-cloud']);

export const ChunkingStrategySchema = z.enum([
  'fixed-size',
  'recursive-character',
  'semantic',
  'markdown-header',
  'sentence-based',
  'paragraph-based',
  'code-aware',
]);

export const VectorStoreProviderSchema = z.enum([
  'pinecone',
  'weaviate',
  'qdrant',
  'chroma',
  'faiss',
  'opensearch',
  'vertex-ai-vector-search',
  'azure-ai-search',
  'pgvector',
]);

export const RetrievalStrategySchema = z.enum([
  'similarity',
  'mmr',
  'hybrid',
  'parent-child',
  'multi-query',
  'ensemble',
]);

export const EmbeddingProviderSchema = z.enum([
  'openai',
  'cohere',
  'google',
  'huggingface',
  'nomic',
  'custom',
]);

export const GenerationProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'meta',
  'mistral',
  'cohere',
  'custom',
]);

export const MemoryTypeSchema = z.enum([
  'none',
  'conversation-buffer',
  'summary-buffer',
  'vector-memory',
]);

export const FilterOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'contains',
]);

export const SimilarityMetricSchema = z.enum(['cosine', 'euclidean', 'dot']);

export const OutputFormatSchema = z.enum(['text', 'json', 'markdown']);

export const EvaluationMetricNameSchema = z.enum([
  'faithfulness',
  'answer_relevance',
  'context_precision',
  'context_recall',
  'latency',
]);

// ─── Sub-Structure Schemas ────────────────────────────────────────────────────

export const MetadataFilterSchema = z.object({
  key: z.string().min(1, 'Filter key is required'),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const HybridSearchConfigSchema = z.object({
  alpha: z.number().min(0).max(1),
  sparseWeight: z.number().optional(),
  denseWeight: z.number().optional(),
});

// ─── Stage Configuration Schemas ─────────────────────────────────────────────

export const DataIngestionConfigSchema = z.object({
  sourceType: z.enum(['file-upload', 's3', 'gcs', 'azure-blob', 'url', 'database', 'api']),
  fileTypes: z.array(z.string()).min(1, 'Select at least one file type'),
  preprocessing: z.object({
    stripHtml: z.boolean(),
    normalizeWhitespace: z.boolean(),
    extractMetadata: z.boolean(),
    customRules: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    includeSource: z.boolean(),
    includePageNumber: z.boolean(),
    customMetadata: z.record(z.string()).optional(),
  }),
  connectionConfig: z.record(z.unknown()).optional(),
});

export const ChunkingConfigSchema = z.object({
  strategy: ChunkingStrategySchema,
  chunkSize: z.number().int().min(128, 'Minimum chunk size is 128').max(4096, 'Maximum chunk size is 4096'),
  chunkOverlap: z.number().int().min(0).max(1024, 'Overlap cannot exceed 1024 tokens'),
  separators: z.array(z.string()).optional(),
  metadata: z
    .object({
      includeSource: z.boolean(),
      includePageNumber: z.boolean(),
      customMetadata: z.record(z.unknown()).optional(),
    })
    .optional(),
}).refine(
  (data) => data.chunkOverlap < data.chunkSize,
  { message: 'Chunk overlap must be less than chunk size', path: ['chunkOverlap'] }
);

export const EmbeddingConfigSchema = z.object({
  model: z.string().min(1, 'Embedding model is required'),
  provider: EmbeddingProviderSchema,
  dimensions: z.number().int().min(1).max(8192),
  batchSize: z.number().int().min(1).max(2048).optional(),
  maxTokens: z.number().int().min(1).optional(),
});

export const VectorStoreConfigSchema = z.object({
  provider: VectorStoreProviderSchema,
  indexName: z
    .string()
    .min(1, 'Index name is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Index name must be lowercase alphanumeric with hyphens'),
  configuration: z.object({
    metric: SimilarityMetricSchema.optional(),
    replicas: z.number().int().min(1).optional(),
    shards: z.number().int().min(1).optional(),
    namespace: z.string().optional(),
    cloud: z
      .object({
        region: z.string().min(1),
        instanceType: z.string().optional(),
      })
      .optional(),
  }),
});

export const RetrievalConfigSchema = z
  .object({
    strategy: RetrievalStrategySchema,
    topK: z.number().int().min(1, 'Minimum top-k is 1').max(100, 'Maximum top-k is 100'),
    scoreThreshold: z.number().min(0).max(1).nullable().optional(),
    filters: z.array(MetadataFilterSchema).optional(),
    hybridSearch: HybridSearchConfigSchema.optional(),
    parentChildConfig: z
      .object({
        parentChunkSize: z.number().int().min(1),
        childChunkSize: z.number().int().min(1),
      })
      .optional(),
    multiQueryConfig: z
      .object({
        numVariants: z.number().int().min(2).max(10),
        llmModel: z.string().min(1),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.strategy === 'hybrid' && !data.hybridSearch) return false;
      return true;
    },
    { message: 'Hybrid search config is required when using hybrid strategy', path: ['hybridSearch'] }
  );

export const RerankingConfigSchema = z.object({
  enabled: z.boolean(),
  model: z.string().optional(),
  topN: z.number().int().min(1).max(100).optional(),
  provider: z.enum(['cohere', 'huggingface', 'custom']).optional(),
});

export const GenerationConfigSchema = z.object({
  model: z.string().min(1, 'Generation model is required'),
  provider: GenerationProviderSchema,
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(32768),
  topP: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().max(10000).optional(),
  outputFormat: OutputFormatSchema.optional(),
});

export const RoutingRuleSchema = z.object({
  condition: z.enum(['keyword', 'query-length', 'semantic-complexity']),
  threshold: z.number().optional(),
  keywords: z.array(z.string()).optional(),
  targetModel: z.string().min(1),
});

export const RoutingConfigSchema = z.object({
  enabled: z.boolean(),
  rules: z.array(RoutingRuleSchema).optional(),
  defaultModel: z.string().optional(),
});

export const MemoryConfigSchema = z.object({
  type: MemoryTypeSchema,
  windowSize: z.number().int().min(1).max(100).optional(),
  maxTokens: z.number().int().min(1).optional(),
  sessionPersistence: z.boolean().optional(),
});

export const EvaluationConfigSchema = z.object({
  enabled: z.boolean(),
  metrics: z.array(EvaluationMetricNameSchema).optional(),
  testSetSize: z.number().int().min(10).max(1000).optional(),
  schedule: z.enum(['on-demand', 'continuous']).optional(),
});

// ─── Top-Level Schemas ───────────────────────────────────────────────────────

export const PipelineStagesSchema = z.object({
  dataIngestion: DataIngestionConfigSchema.optional(),
  chunking: ChunkingConfigSchema,
  embedding: EmbeddingConfigSchema,
  vectorStore: VectorStoreConfigSchema,
  retrieval: RetrievalConfigSchema,
  reranking: RerankingConfigSchema.optional(),
  generation: GenerationConfigSchema,
  routing: RoutingConfigSchema.optional(),
  memory: MemoryConfigSchema.optional(),
  evaluation: EvaluationConfigSchema.optional(),
});

export const PipelineMetadataSchema = z.object({
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
  version: z.string().min(1),
  author: z.string().optional(),
  source: z.enum(['designer', 'autopilot', 'template']).optional(),
  buildId: z.string().optional(),
});

export const PipelineConfigurationSchema = z.object({
  id: z.string().min(1, 'Pipeline ID is required'),
  name: z.string().min(1, 'Pipeline name is required').max(255),
  description: z.string().max(1000).optional(),
  cloudProvider: CloudProviderSchema,
  stages: PipelineStagesSchema,
  metadata: PipelineMetadataSchema,
});

// ─── Build Requirements Schema ───────────────────────────────────────────────

export const TargetMetricsSchema = z.object({
  faithfulness: z.number().min(0).max(1).optional(),
  answerRelevance: z.number().min(0).max(1).optional(),
  contextPrecision: z.number().min(0).max(1).optional(),
  contextRecall: z.number().min(0).max(1).optional(),
});

export const BuildRequirementsSchema = z.object({
  targetMetrics: TargetMetricsSchema,
  cloudProvider: CloudProviderSchema.optional(),
  budgetConstraint: z.number().positive('Budget must be a positive number').optional(),
  latencyRequirement: z.number().positive('Latency must be a positive number in ms').optional(),
  optimizeFor: z.enum(['quality', 'cost', 'latency', 'balanced']).optional(),
  maxIterations: z.number().int().min(1).max(10).optional(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type PipelineConfigurationInput = z.input<typeof PipelineConfigurationSchema>;
export type BuildRequirementsInput = z.input<typeof BuildRequirementsSchema>;
