import type { PipelineStages } from '@/types/pipeline';

const PROVIDER_LABEL: Record<string, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  'multi-cloud': 'Multi-Cloud',
};

function q(text: string): string {
  return text.replace(/["\[\]]/g, '');
}

/**
 * Generates a Mermaid flowchart string representing the full RAG pipeline.
 * The diagram uses left-to-right (LR) layout with two sub-graphs:
 * one for the indexing path and one for the query path.
 */
export function generateMermaidDiagram(
  stages: PipelineStages,
  cloudProvider: string
): string {
  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [];

  lines.push('flowchart LR');

  // ── Indexing subgraph ─────────────────────────────────────────────────────
  lines.push(`  subgraph IDX["${cloud} — Indexing Path"]`);
  lines.push('    direction LR');

  if (stages.dataIngestion) {
    const src = q(stages.dataIngestion.sourceType);
    lines.push(`    SRC[("📄 Source\\n${src}")]`);
    lines.push('    ING["⬆️ Ingest & Preprocess"]');
    lines.push('    SRC --> ING');
  } else {
    lines.push('    ING[("📄 Documents")]');
  }

  const chunkLabel = `✂️ Chunking\\n${q(stages.chunking.strategy)}\\n${stages.chunking.chunkSize} tok / ${stages.chunking.chunkOverlap} overlap`;
  lines.push(`    CH["${chunkLabel}"]`);

  const embLabel = `🎯 Embed\\n${q(stages.embedding.model)}\\n${stages.embedding.dimensions}d`;
  lines.push(`    EMB["${embLabel}"]`);

  const vsLabel = `🗃️ Vector Store\\n${q(stages.vectorStore.provider)}\\n${q(stages.vectorStore.indexName)}`;
  lines.push(`    VS[("${vsLabel}")]`);

  lines.push('    ING --> CH --> EMB --> VS');
  lines.push('  end');

  // ── Query subgraph ────────────────────────────────────────────────────────
  lines.push('  subgraph QRY["Query Path"]');
  lines.push('    direction LR');

  lines.push('    QUERY[/"🔍 User Query"/]');

  let queryToRetTail = 'QUERY';
  if (stages.memory && stages.memory.type !== 'none') {
    const memLabel = `💾 Memory\\n${q(stages.memory.type)}`;
    lines.push(`    MEM[("${memLabel}")]`);
    lines.push('    QUERY --> MEM');
    queryToRetTail = 'MEM';
  }

  const retLabel = `🔎 Retrieve\\n${q(stages.retrieval.strategy)} · top-${stages.retrieval.topK}`;
  lines.push(`    RET["${retLabel}"]`);
  lines.push(`    ${queryToRetTail} --> RET`);

  let beforeGen = 'RET';
  if (stages.reranking?.enabled) {
    const rnkModel = stages.reranking.model ? q(stages.reranking.model) : 'reranker';
    const rnkTop = stages.reranking.topN ?? 5;
    lines.push(`    RNK["⚡ Rerank\\n${rnkModel} · top-${rnkTop}"]`);
    lines.push('    RET --> RNK');
    beforeGen = 'RNK';
  }

  const genLabel = `🤖 Generate\\n${q(stages.generation.model)}\\nt=${stages.generation.temperature}`;
  lines.push(`    GEN["${genLabel}"]`);
  lines.push('    ANSWER[/"💬 Answer"/]');

  if (stages.routing?.enabled) {
    lines.push('    ROUTER{"🔀 Route"}');
    lines.push(`    ${beforeGen} --> ROUTER`);
    lines.push('    ROUTER --> GEN --> ANSWER');
  } else {
    lines.push(`    ${beforeGen} --> GEN --> ANSWER`);
  }

  if (stages.evaluation?.enabled) {
    lines.push('    EVAL["📊 Evaluate"]');
    lines.push('    ANSWER --> EVAL');
  }

  lines.push('  end');

  // Cross-graph edge: VS feeds retrieval
  lines.push('  VS --> RET');

  return lines.join('\n');
}

/**
 * Generates a simplified one-line pipeline summary string for compact display.
 */
export function generatePipelineSummary(stages: PipelineStages): string {
  const parts: string[] = [
    stages.chunking.strategy,
    `${stages.embedding.model}`,
    stages.vectorStore.provider,
    stages.retrieval.strategy,
  ];
  if (stages.reranking?.enabled && stages.reranking.model) {
    parts.push(stages.reranking.model);
  }
  parts.push(stages.generation.model);
  return parts.join(' → ');
}

/**
 * Short bullet lines for the Designer pipeline visualizer summary panel.
 */
export function generatePipelineHighlights(
  stages: PipelineStages,
  cloudProvider: string
): string[] {
  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [
    `Cloud: ${cloud}`,
    ...(stages.dataIngestion
      ? [`Ingestion: ${stages.dataIngestion.sourceType}`]
      : []),
    `Chunking: ${stages.chunking.strategy} · ${stages.chunking.chunkSize} tok / ${stages.chunking.chunkOverlap} overlap`,
    `Embedding: ${stages.embedding.model} · ${stages.embedding.dimensions}d`,
    `Vector store: ${stages.vectorStore.provider} · ${stages.vectorStore.indexName}`,
    `Retrieval: ${stages.retrieval.strategy} · top-${stages.retrieval.topK}`,
    stages.reranking?.enabled
      ? `Reranking: on${stages.reranking.model ? ` · ${stages.reranking.model}` : ''}`
      : 'Reranking: off',
    `Generation: ${stages.generation.model} · T=${stages.generation.temperature}`,
    stages.routing?.enabled
      ? `Routing: on · ${stages.routing.rules?.length ?? 0} rule(s)`
      : 'Routing: off',
    stages.memory
      ? `Memory: ${stages.memory.type}`
      : 'Memory: none',
    stages.evaluation?.enabled
      ? `Evaluation: on · ${stages.evaluation.metrics?.length ?? 0} metric(s)`
      : 'Evaluation: off',
  ];
  return lines;
}
