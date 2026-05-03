import type { GuardrailsConfig, PipelineConfiguration } from '@/types/pipeline';
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

/** Matches API `GuardrailsConfigSchema` defaults — all stages and checks enabled. */
export function createDefaultGuardrailsConfig(): GuardrailsConfig {
  return {
    input: {
      enabled: true,
      piiRedactionEnabled: true,
      promptInjectionBlockEnabled: true,
      toxicityBlockEnabled: true,
    },
    retrieval: {
      enabled: true,
      contentFilterEnabled: true,
      sourceValidationEnabled: true,
      biasDetectionEnabled: true,
    },
    output: {
      enabled: true,
      hallucinationHeuristicEnabled: true,
      factualityCheckEnabled: true,
      citationVerificationEnabled: true,
    },
  };
}

function mergeGuardrailsConfig(base: GuardrailsConfig, patch: Partial<GuardrailsConfig>): GuardrailsConfig {
  return {
    input: patch.input ? { ...base.input, ...patch.input } : base.input,
    retrieval: patch.retrieval ? { ...base.retrieval, ...patch.retrieval } : base.retrieval,
    output: patch.output ? { ...base.output, ...patch.output } : base.output,
  };
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
    guardrails: createDefaultGuardrailsConfig(),
  };

  if (!overrides) {
    return base;
  }

  const {
    stages: overrideStages,
    metadata: overrideMetadata,
    guardrails: overrideGuardrails,
    ...restOverrides
  } = overrides;

  return {
    ...base,
    ...restOverrides,
    id: overrides.id ?? base.id,
    stages: overrideStages ? { ...base.stages, ...overrideStages } : base.stages,
    metadata: overrideMetadata ? { ...base.metadata, ...overrideMetadata } : base.metadata,
    guardrails:
      overrideGuardrails === undefined
        ? base.guardrails
        : overrideGuardrails === null
          ? null
          : mergeGuardrailsConfig(base.guardrails!, overrideGuardrails),
  };
}
