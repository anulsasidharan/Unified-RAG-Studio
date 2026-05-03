import type { ModelTier, PipelineConfiguration } from './pipeline';

// ─── Embedding Models (data/models/embeddings.json) ──────────────────────────

export type ModelSpeed = 'very-fast' | 'fast' | 'medium' | 'slow';
export type ModelQuality = 'excellent' | 'good' | 'fair';

export interface EmbeddingModel {
  id: string;
  name: string;
  provider: string;
  dimensions: number;
  maxTokens: number;
  costPer1MTokens: number;
  speed: ModelSpeed;
  quality: ModelQuality;
  tier: ModelTier;
  openSource: boolean;
  description: string;
  bestFor: string[];
  mtebScore: number;
  languageSupport: string[];
  normalizable?: boolean;
  selfHosted?: boolean;
  deprecated?: boolean;
  inputTypes?: string[];
  modelCard?: string;
}

// ─── Generation Models (data/models/generation.json) ─────────────────────────

export interface GenerationModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  /** Cost per 1M input tokens in USD */
  costInput: number;
  /** Cost per 1M output tokens in USD */
  costOutput: number;
  tier: ModelTier;
  openSource: boolean;
  description: string;
  strengths: string[];
  bestFor: string[];
  latencyMs: number;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  supportsJsonMode: boolean;
  releaseDate: string;
}

// ─── Reranker Models (data/models/rerankers.json) ────────────────────────────

export type RerankerSpeed = 'very-fast' | 'fast' | 'medium' | 'slow';

export interface RerankerModel {
  id: string;
  name: string;
  provider: string;
  costPer1KQueries: number;
  maxDocuments: number;
  maxDocumentLength: number;
  speed: RerankerSpeed;
  quality: ModelQuality;
  openSource: boolean;
  description: string;
  bestFor: string[];
  languageSupport: string[];
  /** Average precision improvement over baseline retrieval */
  typicalPrecisionGain: number;
  latencyMs: number;
  selfHosted?: boolean;
  supportsMetadataFilter: boolean;
  modelCard?: string;
}

// ─── Chunking Strategy Metadata (data/chunking-strategies.json) ──────────────

export type ImplementationComplexity = 'low' | 'medium' | 'high';

export interface ChunkingDefaultConfig {
  chunkSize: number;
  chunkOverlap?: number;
  separators?: string[];
  minChunkSize?: number;
}

export interface ChunkingStrategyMeta {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  pros: string[];
  cons: string[];
  implementationComplexity: ImplementationComplexity;
  defaultConfig: ChunkingDefaultConfig;
  recommendedFor?: {
    documentTypes: string[];
    useCases: string[];
    notRecommendedFor: string[];
  };
}

// ─── Vector Store Metadata (data/vector-stores.json) ─────────────────────────

export type VectorStoreType = 'managed' | 'self-hosted' | 'embedded';

export interface VectorStorePricing {
  selfHosted: string;
  managedCloud: string;
  storagePerGB: number;
  queryPerMillion: number;
}

export interface VectorStoreCloudNative {
  aws: boolean;
  gcp: boolean;
  azure: boolean;
  ownCloud?: boolean;
}

export interface VectorStoreFeatures {
  hybridSearch: boolean;
  sparseVectors: boolean;
  multiVectors: boolean;
  payloadFiltering: boolean;
  quantization: boolean;
  collections: boolean;
}

export interface VectorStoreMeta {
  id: string;
  name: string;
  type: VectorStoreType;
  description: string;
  bestFor: string[];
  pros: string[];
  cons: string[];
  pricing: VectorStorePricing;
  cloudNative: VectorStoreCloudNative;
  features: VectorStoreFeatures;
  maxVectors: string;
  supportedMetrics: string[];
}

// ─── Retrieval Strategy Metadata (data/retrieval-strategies.json) ────────────

export interface RetrievalStrategyParameter {
  name: string;
  type: 'integer' | 'float' | 'boolean' | 'string';
  min?: number;
  max?: number;
  default: unknown;
  description: string;
}

export interface RetrievalStrategyMeta {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  pros: string[];
  cons: string[];
  implementationComplexity: ImplementationComplexity;
  defaultConfig: Record<string, unknown>;
  parameters: RetrievalStrategyParameter[];
}

// ─── Cloud Provider Metadata (data/cloud-providers.json) ─────────────────────

export interface CloudNativeServices {
  llm: string[];
  vectorStore: string[];
  objectStorage: string[];
  containerOrchestration: string[];
  monitoring: string[];
  secretsManagement: string[];
  computeOptions?: string[];
}

export interface CloudProviderMeta {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  description: string;
  bestFor: string[];
  strengths: string[];
  nativeServices: CloudNativeServices;
  ragStudioDefaults: {
    vectorStore: string;
    objectStorage: string;
    deployment: string;
  };
  compliance: string[];
  pricingTier: string;
}

// ─── Templates (data/templates.json) ─────────────────────────────────────────

export type TemplateComplexity = 'beginner' | 'intermediate' | 'advanced';

export interface Template {
  id: string;
  name: string;
  description: string;
  useCase: string;
  complexity: TemplateComplexity;
  estimatedMonthlyCost: string;
  tags: string[];
  providerLogos: string[];
  config: PipelineConfiguration;
}
