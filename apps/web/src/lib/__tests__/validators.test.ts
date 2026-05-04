import { describe, it, expect } from 'vitest';
import {
  ChunkingConfigSchema,
  EmbeddingConfigSchema,
  GenerationConfigSchema,
  RetrievalConfigSchema,
  VectorStoreConfigSchema,
  PipelineConfigurationSchema,
  BuildRequirementsSchema,
  PipelineStagesSchema,
  RerankingConfigSchema,
} from '../validators';
import { minimalConfig, fullConfig } from '../generators/__tests__/fixtures';

// ─── ChunkingConfig ──────────────────────────────────────────────────────────

describe('ChunkingConfigSchema', () => {
  it('accepts valid chunking config', () => {
    const result = ChunkingConfigSchema.safeParse({
      strategy: 'recursive-character',
      chunkSize: 512,
      chunkOverlap: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects chunk overlap >= chunk size', () => {
    const result = ChunkingConfigSchema.safeParse({
      strategy: 'fixed-size',
      chunkSize: 256,
      chunkOverlap: 256,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('chunkOverlap');
  });

  it('rejects chunk size below 128', () => {
    const result = ChunkingConfigSchema.safeParse({
      strategy: 'fixed-size',
      chunkSize: 64,
      chunkOverlap: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid strategy', () => {
    const result = ChunkingConfigSchema.safeParse({
      strategy: 'unknown-strategy',
      chunkSize: 512,
      chunkOverlap: 50,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid strategy values', () => {
    const strategies = [
      'fixed-size', 'recursive-character', 'semantic',
      'markdown-header', 'sentence-based', 'paragraph-based', 'code-aware',
    ] as const;
    for (const strategy of strategies) {
      const result = ChunkingConfigSchema.safeParse({ strategy, chunkSize: 512, chunkOverlap: 50 });
      expect(result.success).toBe(true);
    }
  });
});

// ─── EmbeddingConfig ─────────────────────────────────────────────────────────

describe('EmbeddingConfigSchema', () => {
  it('accepts valid embedding config', () => {
    const result = EmbeddingConfigSchema.safeParse({
      model: 'text-embedding-3-small',
      provider: 'openai',
      dimensions: 1536,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty model name', () => {
    const result = EmbeddingConfigSchema.safeParse({
      model: '',
      provider: 'openai',
      dimensions: 1536,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive dimensions', () => {
    const result = EmbeddingConfigSchema.safeParse({
      model: 'test-model',
      provider: 'openai',
      dimensions: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── RetrievalConfig ─────────────────────────────────────────────────────────

describe('RetrievalConfigSchema', () => {
  it('accepts valid similarity retrieval', () => {
    const result = RetrievalConfigSchema.safeParse({
      strategy: 'similarity',
      topK: 5,
    });
    expect(result.success).toBe(true);
  });

  it('requires hybridSearch when strategy is hybrid', () => {
    const result = RetrievalConfigSchema.safeParse({
      strategy: 'hybrid',
      topK: 5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts hybrid strategy with hybridSearch config', () => {
    const result = RetrievalConfigSchema.safeParse({
      strategy: 'hybrid',
      topK: 5,
      hybridSearch: { alpha: 0.6 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects topK above 100', () => {
    const result = RetrievalConfigSchema.safeParse({
      strategy: 'similarity',
      topK: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects topK below 1', () => {
    const result = RetrievalConfigSchema.safeParse({
      strategy: 'similarity',
      topK: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── GenerationConfig ─────────────────────────────────────────────────────────

describe('GenerationConfigSchema', () => {
  it('accepts valid generation config', () => {
    const result = GenerationConfigSchema.safeParse({
      model: 'gpt-4o-mini',
      provider: 'openai',
      temperature: 0.1,
      maxTokens: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rejects temperature above 2', () => {
    const result = GenerationConfigSchema.safeParse({
      model: 'gpt-4o-mini',
      provider: 'openai',
      temperature: 2.5,
      maxTokens: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects maxTokens below 64', () => {
    const result = GenerationConfigSchema.safeParse({
      model: 'gpt-4o-mini',
      provider: 'openai',
      temperature: 0.1,
      maxTokens: 32,
    });
    expect(result.success).toBe(false);
  });
});

// ─── VectorStoreConfig ────────────────────────────────────────────────────────

describe('VectorStoreConfigSchema', () => {
  it('accepts valid vector store config', () => {
    const result = VectorStoreConfigSchema.safeParse({
      provider: 'qdrant',
      indexName: 'rag-documents',
      configuration: { metric: 'cosine' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects index names with uppercase letters', () => {
    const result = VectorStoreConfigSchema.safeParse({
      provider: 'qdrant',
      indexName: 'RAG-Documents',
      configuration: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty index name', () => {
    const result = VectorStoreConfigSchema.safeParse({
      provider: 'qdrant',
      indexName: '',
      configuration: {},
    });
    expect(result.success).toBe(false);
  });
});

// ─── RerankingConfig ─────────────────────────────────────────────────────────

describe('RerankingConfigSchema', () => {
  it('accepts disabled reranking', () => {
    const result = RerankingConfigSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });

  it('accepts enabled reranking with optional fields', () => {
    const result = RerankingConfigSchema.safeParse({
      enabled: true,
      model: 'cohere-rerank-v3',
      topN: 5,
      provider: 'cohere',
    });
    expect(result.success).toBe(true);
  });
});

// ─── PipelineConfiguration ───────────────────────────────────────────────────

describe('PipelineConfigurationSchema', () => {
  it('validates the minimal fixture successfully', () => {
    const result = PipelineConfigurationSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
  });

  it('validates the full fixture successfully', () => {
    const result = PipelineConfigurationSchema.safeParse(fullConfig);
    expect(result.success).toBe(true);
  });

  it('rejects config with missing required chunking field', () => {
    const invalid = {
      ...minimalConfig,
      stages: {
        ...minimalConfig.stages,
        chunking: { strategy: 'recursive-character', chunkOverlap: 50 },
      },
    };
    const result = PipelineConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects config with invalid cloudProvider', () => {
    const invalid = { ...minimalConfig, cloudProvider: 'ibm-cloud' };
    const result = PipelineConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects config with empty pipeline name', () => {
    const invalid = { ...minimalConfig, name: '' };
    const result = PipelineConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects config with missing id', () => {
    const { id: _id, ...invalid } = minimalConfig;
    const result = PipelineConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─── BuildRequirements ────────────────────────────────────────────────────────

describe('BuildRequirementsSchema', () => {
  it('accepts minimal requirements', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts full requirements', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: { faithfulness: 0.85, answerRelevance: 0.8 },
      cloudProvider: 'aws',
      budgetConstraint: 0.05,
      latencyRequirement: 500,
      optimizeFor: 'quality',
      maxIterations: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects target metric values above 1', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: { faithfulness: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative budget constraint', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: {},
      budgetConstraint: -0.01,
    });
    expect(result.success).toBe(false);
  });

  it('rejects maxIterations above 10', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: {},
      maxIterations: 15,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid optimizeFor value', () => {
    const result = BuildRequirementsSchema.safeParse({
      targetMetrics: {},
      optimizeFor: 'speed',
    });
    expect(result.success).toBe(false);
  });
});
