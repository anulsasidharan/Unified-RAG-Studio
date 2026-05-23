import type { PipelineConfiguration } from '@/types/pipeline';

/**
 * Minimal pipeline fixture — all required fields, sensible defaults.
 */
export const minimalConfig: PipelineConfiguration = {
  id: 'test-pipeline-001',
  name: 'Test RAG Pipeline',
  description: 'Fixture for unit tests',
  cloudProvider: 'aws',
  stages: {
    chunking: {
      strategy: 'recursive-character',
      chunkSize: 512,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', ' '],
    },
    embedding: {
      model: 'text-embedding-3-small',
      provider: 'openai',
      dimensions: 1536,
      batchSize: 100,
    },
    vectorStore: {
      provider: 'qdrant',
      indexName: 'rag-documents',
      configuration: { metric: 'cosine', replicas: 1 },
    },
    retrieval: {
      strategy: 'similarity',
      topK: 5,
    },
    reranking: { enabled: false },
    generation: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      temperature: 0.1,
      maxTokens: 1024,
      outputFormat: 'markdown',
    },
  },
  metadata: {
    createdAt: '2026-05-01T00:00:00.000Z',
    version: '1.0.0',
    source: 'designer',
  },
};

/**
 * Full pipeline fixture — exercises all optional fields and providers.
 */
export const fullConfig: PipelineConfiguration = {
  id: 'test-pipeline-002',
  name: 'Full Feature Pipeline',
  description: 'All optional stages enabled',
  cloudProvider: 'gcp',
  stages: {
    dataIngestion: {
      sourceType: 'gcs',
      fileTypes: ['pdf', 'docx', 'txt'],
      preprocessing: {
        stripHtml: true,
        normalizeWhitespace: true,
        extractMetadata: true,
      },
      metadata: { includeSource: true, includePageNumber: true },
    },
    chunking: {
      strategy: 'semantic',
      chunkSize: 1024,
      chunkOverlap: 128,
    },
    embedding: {
      model: 'text-embedding-3-large',
      provider: 'openai',
      dimensions: 3072,
    },
    vectorStore: {
      provider: 'pinecone',
      indexName: 'full-pipeline-index',
      configuration: {
        metric: 'cosine',
        cloud: { region: 'us-central1' },
      },
    },
    retrieval: {
      strategy: 'hybrid',
      topK: 10,
      hybridSearch: { alpha: 0.6 },
    },
    reranking: {
      enabled: true,
      model: 'cohere-rerank-v3',
      topN: 5,
      provider: 'cohere',
    },
    generation: {
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      temperature: 0.0,
      maxTokens: 2048,
      systemPrompt: 'You are a helpful assistant.',
      outputFormat: 'json',
    },
    routing: {
      enabled: true,
      defaultModel: 'gpt-4o-mini',
      rules: [{ condition: 'keyword', keywords: ['detailed', 'explain'], targetModel: 'gpt-4o' }],
    },
    memory: {
      type: 'conversation-buffer',
      windowSize: 10,
      sessionPersistence: true,
    },
    evaluation: {
      enabled: true,
      metrics: ['faithfulness', 'answer_relevance', 'context_precision'],
      testSetSize: 100,
      schedule: 'on-demand',
    },
  },
  metadata: {
    createdAt: '2026-05-01T00:00:00.000Z',
    version: '1.0.0',
    source: 'autopilot',
    buildId: 'build-abc-123',
  },
};

export const azureConfig: PipelineConfiguration = {
  ...minimalConfig,
  id: 'test-pipeline-003',
  name: 'Azure Pipeline',
  cloudProvider: 'azure',
  stages: {
    ...minimalConfig.stages,
    vectorStore: {
      provider: 'azure-ai-search',
      indexName: 'azure-rag-index',
      configuration: { metric: 'cosine' },
    },
    embedding: {
      model: 'text-embedding-ada-002',
      provider: 'openai',
      dimensions: 1536,
    },
    generation: {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.2,
      maxTokens: 2048,
    },
  },
};
