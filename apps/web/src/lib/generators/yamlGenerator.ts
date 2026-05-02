import type { PipelineConfiguration, PipelineStages } from '@/types/pipeline';

// ─── Indented YAML helpers ────────────────────────────────────────────────────

function indent(level: number): string {
  return '  '.repeat(level);
}

function yamlString(value: string | undefined | null): string {
  if (!value) return '""';
  if (/[:#\[\]{},|>&*!,]/.test(value) || value.includes('\n')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function yamlBool(value: boolean): string {
  return value ? 'true' : 'false';
}

function yamlNumber(value: number | undefined | null, fallback: number): string {
  return String(value ?? fallback);
}

function yamlArray(items: string[], lvl: number): string {
  if (items.length === 0) return '[]';
  return '\n' + items.map((item) => `${indent(lvl)}- ${yamlString(item)}`).join('\n');
}

// ─── Section builders ─────────────────────────────────────────────────────────

function ingestionSection(stages: PipelineStages, lvl: number): string {
  const di = stages.dataIngestion;
  if (!di) return `${indent(lvl)}dataIngestion: ~`;

  return [
    `${indent(lvl)}dataIngestion:`,
    `${indent(lvl + 1)}sourceType: ${yamlString(di.sourceType)}`,
    `${indent(lvl + 1)}fileTypes: ${yamlArray(di.fileTypes, lvl + 2)}`,
    `${indent(lvl + 1)}preprocessing:`,
    `${indent(lvl + 2)}stripHtml: ${yamlBool(di.preprocessing.stripHtml)}`,
    `${indent(lvl + 2)}normalizeWhitespace: ${yamlBool(di.preprocessing.normalizeWhitespace)}`,
    `${indent(lvl + 2)}extractMetadata: ${yamlBool(di.preprocessing.extractMetadata)}`,
    `${indent(lvl + 1)}metadata:`,
    `${indent(lvl + 2)}includeSource: ${yamlBool(di.metadata.includeSource)}`,
    `${indent(lvl + 2)}includePageNumber: ${yamlBool(di.metadata.includePageNumber)}`,
  ].join('\n');
}

function chunkingSection(stages: PipelineStages, lvl: number): string {
  const c = stages.chunking;
  const lines = [
    `${indent(lvl)}chunking:`,
    `${indent(lvl + 1)}strategy: ${yamlString(c.strategy)}`,
    `${indent(lvl + 1)}chunkSize: ${c.chunkSize}`,
    `${indent(lvl + 1)}chunkOverlap: ${c.chunkOverlap}`,
  ];
  if (c.separators && c.separators.length > 0) {
    lines.push(`${indent(lvl + 1)}separators: ${yamlArray(c.separators, lvl + 2)}`);
  }
  return lines.join('\n');
}

function embeddingSection(stages: PipelineStages, lvl: number): string {
  const e = stages.embedding;
  const lines = [
    `${indent(lvl)}embedding:`,
    `${indent(lvl + 1)}model: ${yamlString(e.model)}`,
    `${indent(lvl + 1)}provider: ${yamlString(e.provider)}`,
    `${indent(lvl + 1)}dimensions: ${e.dimensions}`,
  ];
  if (e.batchSize != null) lines.push(`${indent(lvl + 1)}batchSize: ${e.batchSize}`);
  if (e.maxTokens != null) lines.push(`${indent(lvl + 1)}maxTokens: ${e.maxTokens}`);
  return lines.join('\n');
}

function vectorStoreSection(stages: PipelineStages, lvl: number): string {
  const vs = stages.vectorStore;
  const cfg = vs.configuration;
  const lines = [
    `${indent(lvl)}vectorStore:`,
    `${indent(lvl + 1)}provider: ${yamlString(vs.provider)}`,
    `${indent(lvl + 1)}indexName: ${yamlString(vs.indexName)}`,
    `${indent(lvl + 1)}configuration:`,
  ];
  if (cfg.metric) lines.push(`${indent(lvl + 2)}metric: ${yamlString(cfg.metric)}`);
  if (cfg.replicas != null) lines.push(`${indent(lvl + 2)}replicas: ${cfg.replicas}`);
  if (cfg.shards != null) lines.push(`${indent(lvl + 2)}shards: ${cfg.shards}`);
  if (cfg.namespace) lines.push(`${indent(lvl + 2)}namespace: ${yamlString(cfg.namespace)}`);
  if (cfg.cloud) {
    lines.push(`${indent(lvl + 2)}cloud:`);
    lines.push(`${indent(lvl + 3)}region: ${yamlString(cfg.cloud.region)}`);
    if (cfg.cloud.instanceType) {
      lines.push(`${indent(lvl + 3)}instanceType: ${yamlString(cfg.cloud.instanceType)}`);
    }
  }
  return lines.join('\n');
}

function retrievalSection(stages: PipelineStages, lvl: number): string {
  const r = stages.retrieval;
  const lines = [
    `${indent(lvl)}retrieval:`,
    `${indent(lvl + 1)}strategy: ${yamlString(r.strategy)}`,
    `${indent(lvl + 1)}topK: ${r.topK}`,
  ];
  if (r.scoreThreshold != null) {
    lines.push(`${indent(lvl + 1)}scoreThreshold: ${r.scoreThreshold}`);
  }
  if (r.hybridSearch) {
    lines.push(`${indent(lvl + 1)}hybridSearch:`);
    lines.push(`${indent(lvl + 2)}alpha: ${r.hybridSearch.alpha}`);
  }
  if (r.parentChildConfig) {
    lines.push(`${indent(lvl + 1)}parentChildConfig:`);
    lines.push(`${indent(lvl + 2)}parentChunkSize: ${r.parentChildConfig.parentChunkSize}`);
    lines.push(`${indent(lvl + 2)}childChunkSize: ${r.parentChildConfig.childChunkSize}`);
  }
  if (r.multiQueryConfig) {
    lines.push(`${indent(lvl + 1)}multiQueryConfig:`);
    lines.push(`${indent(lvl + 2)}numVariants: ${r.multiQueryConfig.numVariants}`);
    lines.push(`${indent(lvl + 2)}llmModel: ${yamlString(r.multiQueryConfig.llmModel)}`);
  }
  return lines.join('\n');
}

function rerankingSection(stages: PipelineStages, lvl: number): string {
  const rr = stages.reranking;
  if (!rr) return `${indent(lvl)}reranking:\n${indent(lvl + 1)}enabled: false`;
  const lines = [
    `${indent(lvl)}reranking:`,
    `${indent(lvl + 1)}enabled: ${yamlBool(rr.enabled)}`,
  ];
  if (rr.enabled) {
    if (rr.model) lines.push(`${indent(lvl + 1)}model: ${yamlString(rr.model)}`);
    if (rr.topN != null) lines.push(`${indent(lvl + 1)}topN: ${rr.topN}`);
    if (rr.provider) lines.push(`${indent(lvl + 1)}provider: ${yamlString(rr.provider)}`);
  }
  return lines.join('\n');
}

function generationSection(stages: PipelineStages, lvl: number): string {
  const g = stages.generation;
  const lines = [
    `${indent(lvl)}generation:`,
    `${indent(lvl + 1)}model: ${yamlString(g.model)}`,
    `${indent(lvl + 1)}provider: ${yamlString(g.provider)}`,
    `${indent(lvl + 1)}temperature: ${g.temperature}`,
    `${indent(lvl + 1)}maxTokens: ${g.maxTokens}`,
  ];
  if (g.topP != null) lines.push(`${indent(lvl + 1)}topP: ${g.topP}`);
  if (g.outputFormat) lines.push(`${indent(lvl + 1)}outputFormat: ${yamlString(g.outputFormat)}`);
  if (g.systemPrompt) {
    lines.push(`${indent(lvl + 1)}systemPrompt: |`);
    g.systemPrompt.split('\n').forEach((line) => {
      lines.push(`${indent(lvl + 2)}${line}`);
    });
  }
  return lines.join('\n');
}

function routingSection(stages: PipelineStages, lvl: number): string {
  const rt = stages.routing;
  if (!rt) return `${indent(lvl)}routing:\n${indent(lvl + 1)}enabled: false`;
  const lines = [
    `${indent(lvl)}routing:`,
    `${indent(lvl + 1)}enabled: ${yamlBool(rt.enabled)}`,
  ];
  if (rt.defaultModel) lines.push(`${indent(lvl + 1)}defaultModel: ${yamlString(rt.defaultModel)}`);
  if (rt.rules && rt.rules.length > 0) {
    lines.push(`${indent(lvl + 1)}rules:`);
    rt.rules.forEach((rule) => {
      lines.push(`${indent(lvl + 2)}- condition: ${yamlString(rule.condition)}`);
      if (rule.threshold != null) lines.push(`${indent(lvl + 3)}threshold: ${rule.threshold}`);
      if (rule.keywords && rule.keywords.length > 0) {
        lines.push(`${indent(lvl + 3)}keywords: ${yamlArray(rule.keywords, lvl + 4)}`);
      }
      lines.push(`${indent(lvl + 3)}targetModel: ${yamlString(rule.targetModel)}`);
    });
  }
  return lines.join('\n');
}

function memorySection(stages: PipelineStages, lvl: number): string {
  const m = stages.memory;
  if (!m) return `${indent(lvl)}memory:\n${indent(lvl + 1)}type: none`;
  const lines = [
    `${indent(lvl)}memory:`,
    `${indent(lvl + 1)}type: ${yamlString(m.type)}`,
  ];
  if (m.windowSize != null) lines.push(`${indent(lvl + 1)}windowSize: ${m.windowSize}`);
  if (m.maxTokens != null) lines.push(`${indent(lvl + 1)}maxTokens: ${m.maxTokens}`);
  if (m.sessionPersistence != null) {
    lines.push(`${indent(lvl + 1)}sessionPersistence: ${yamlBool(m.sessionPersistence)}`);
  }
  return lines.join('\n');
}

function evaluationSection(stages: PipelineStages, lvl: number): string {
  const ev = stages.evaluation;
  if (!ev) return `${indent(lvl)}evaluation:\n${indent(lvl + 1)}enabled: false`;
  const lines = [
    `${indent(lvl)}evaluation:`,
    `${indent(lvl + 1)}enabled: ${yamlBool(ev.enabled)}`,
  ];
  if (ev.enabled) {
    if (ev.metrics && ev.metrics.length > 0) {
      lines.push(`${indent(lvl + 1)}metrics: ${yamlArray(ev.metrics, lvl + 2)}`);
    }
    if (ev.testSetSize != null) lines.push(`${indent(lvl + 1)}testSetSize: ${ev.testSetSize}`);
    if (ev.schedule) lines.push(`${indent(lvl + 1)}schedule: ${yamlString(ev.schedule)}`);
  }
  return lines.join('\n');
}

/**
 * Serialises a `PipelineConfiguration` to a human-readable YAML string
 * suitable for saving to `pipeline.yaml` or passing to the export API.
 */
export function generateYAML(config: PipelineConfiguration, generatedAt?: string): string {
  const now = generatedAt ?? new Date().toISOString();
  const { stages } = config;

  const sections: string[] = [
    `# RAG Studio — Pipeline Configuration`,
    `# Generated: ${now}`,
    `# Version: ${config.metadata.version}`,
    '',
    `pipeline:`,
    `  id: ${yamlString(config.id)}`,
    `  name: ${yamlString(config.name)}`,
    config.description ? `  description: ${yamlString(config.description)}` : `  description: ""`,
    `  cloudProvider: ${yamlString(config.cloudProvider)}`,
    '',
    `  metadata:`,
    `    createdAt: ${yamlString(config.metadata.createdAt)}`,
    config.metadata.updatedAt ? `    updatedAt: ${yamlString(config.metadata.updatedAt)}` : '',
    `    version: ${yamlString(config.metadata.version)}`,
    config.metadata.source ? `    source: ${yamlString(config.metadata.source)}` : '',
    '',
    `  stages:`,
    ingestionSection(stages, 2),
    chunkingSection(stages, 2),
    embeddingSection(stages, 2),
    vectorStoreSection(stages, 2),
    retrievalSection(stages, 2),
    rerankingSection(stages, 2),
    generationSection(stages, 2),
    routingSection(stages, 2),
    memorySection(stages, 2),
    evaluationSection(stages, 2),
  ];

  return sections.filter((s) => s !== '').join('\n');
}
