import type { PipelineConfiguration } from '@/types/pipeline';
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_K,
} from '@/lib/constants';

function newPipelineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pipeline-${Date.now()}`;
}

/**
 * Creates a full default {@link PipelineConfiguration} for Designer drafts and Autopilot baselines.
 */
export function createDefaultPipelineConfiguration(
  overrides?: Partial<PipelineConfiguration>
): PipelineConfiguration {
  const now = new Date().toISOString();
  const base: PipelineConfiguration = {
    id: newPipelineId(),
    name: 'Untitled pipeline',
    description: '',
    cloudProvider: 'aws',
    stages: {
      dataIngestion: {
        sourceType: 'file-upload',
        fileTypes: ['pdf', 'md', 'txt', 'html'],
        preprocessing: {
          stripHtml: true,
          normalizeWhitespace: true,
          extractMetadata: true,
        },
        metadata: {
          includeSource: true,
          includePageNumber: true,
        },
      },
      chunking: {
        strategy: 'recursive-character',
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
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
        configuration: {
          metric: 'cosine',
          replicas: 1,
          shards: 1,
        },
      },
      retrieval: {
        strategy: 'similarity',
        topK: DEFAULT_TOP_K,
        scoreThreshold: null,
      },
      reranking: {
        enabled: false,
      },
      generation: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
        outputFormat: 'markdown',
      },
      routing: {
        enabled: false,
      },
      memory: {
        type: 'none',
      },
      evaluation: {
        enabled: false,
        metrics: ['faithfulness', 'answer_relevance'],
        testSetSize: 50,
        schedule: 'on-demand',
      },
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      source: 'designer',
    },
  };

  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    id: overrides.id ?? base.id,
    stages: overrides.stages ? { ...base.stages, ...overrides.stages } : base.stages,
    metadata: overrides.metadata ? { ...base.metadata, ...overrides.metadata } : base.metadata,
  };
}
