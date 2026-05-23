import type {
  AgentToolsConfig,
  ContextCompressionConfig,
  GuardrailsConfig,
  HumanInTheLoopConfig,
  ObservabilityConfig,
  PipelineConfiguration,
  QueryProcessingConfig,
} from '@/types/pipeline';
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

function mergeGuardrailsConfig(
  base: GuardrailsConfig,
  patch: Partial<GuardrailsConfig>,
): GuardrailsConfig {
  return {
    input: patch.input ? { ...base.input, ...patch.input } : base.input,
    retrieval: patch.retrieval ? { ...base.retrieval, ...patch.retrieval } : base.retrieval,
    output: patch.output ? { ...base.output, ...patch.output } : base.output,
  };
}

/** Default HITL block — matches API `HumanInTheLoopConfigSchema`; disabled until the customer opts in. */
export function createDefaultQueryProcessingConfig(): QueryProcessingConfig {
  return {
    enabled: false,
    queryRewrite: false,
    hyde: false,
    multiQueryExpansion: false,
    decomposition: false,
    stepBack: false,
    intentClassification: false,
    entityExtraction: false,
    keywordAugmentation: false,
  };
}

export function createDefaultContextCompressionConfig(): ContextCompressionConfig {
  return {
    enabled: false,
    mode: 'none',
    minScore: null,
    maxTokenBudget: null,
  };
}

export function createDefaultObservabilityConfig(): ObservabilityConfig {
  return {
    tokenTracking: true,
    latencyMonitoring: true,
    retrievalTracing: false,
    promptTracing: false,
  };
}

export function createDefaultAgentToolsConfig(): AgentToolsConfig {
  return {
    calculatorEnabled: false,
    webSearchEnabled: false,
    sqlAgentEnabled: false,
  };
}

export function createDefaultHumanInTheLoopConfig(): HumanInTheLoopConfig {
  return {
    enabled: false,
    tier: 'simple',
    roles: ['approver'],
    placement: {
      preIngestionValidation: false,
      retrievalTime: false,
      generationTime: true,
      postResponseFeedback: false,
    },
    confidence: {
      retrieverScoreThreshold: 0.72,
      rerankerScoreThreshold: null,
      llmUncertaintySignals: false,
      escalationMode: 'deferred_queue',
    },
    workflow: {
      synchronousReview: true,
      allowHumanEdit: true,
      sequentialApprovalRoles: ['approver'],
    },
    advanced: {
      orchestrationHint: 'langgraph',
      agenticToolApproval: false,
      multiReviewerConsensus: false,
      auditLoggingRequired: false,
      humanGuidedRetrieval: false,
      activeLearningFeedback: false,
    },
  };
}

/**
 * Creates a full default {@link PipelineConfiguration} for Designer drafts and Autopilot baselines.
 */
export function createDefaultPipelineConfiguration(
  overrides?: Partial<PipelineConfiguration>,
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
        sources: [
          { sourceType: 'file-upload', enabled: true },
          { sourceType: 's3', enabled: false },
          { sourceType: 'gcs', enabled: false },
          { sourceType: 'azure-blob', enabled: false },
          { sourceType: 'url', enabled: false },
          { sourceType: 'database', enabled: false },
          { sourceType: 'api', enabled: false },
        ],
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
        cacheEmbeddings: false,
        embeddingVersion: undefined,
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
      queryProcessing: createDefaultQueryProcessingConfig(),
      retrieval: {
        strategy: 'similarity',
        topK: DEFAULT_TOP_K,
        scoreThreshold: null,
      },
      contextCompression: createDefaultContextCompressionConfig(),
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
      humanInTheLoop: createDefaultHumanInTheLoopConfig(),
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      source: 'designer',
    },
    guardrails: createDefaultGuardrailsConfig(),
    observability: createDefaultObservabilityConfig(),
    adaptivePolicies: [],
    agentTools: createDefaultAgentToolsConfig(),
  };

  if (!overrides) {
    return base;
  }

  const {
    stages: overrideStages,
    metadata: overrideMetadata,
    guardrails: overrideGuardrails,
    observability: overrideObservability,
    adaptivePolicies: overrideAdaptivePolicies,
    agentTools: overrideAgentTools,
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
    observability:
      overrideObservability === undefined
        ? base.observability
        : overrideObservability === null
          ? null
          : { ...base.observability!, ...overrideObservability },
    adaptivePolicies: overrideAdaptivePolicies ?? base.adaptivePolicies,
    agentTools:
      overrideAgentTools === undefined
        ? base.agentTools
        : { ...base.agentTools!, ...overrideAgentTools },
  };
}
