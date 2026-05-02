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

  // Optional memory
  if (stages.memory && stages.memory.type !== 'none') {
    const memLabel = `💾 Memory\\n${q(stages.memory.type)}`;
    lines.push(`    MEM[("${memLabel}")]`);
    lines.push('    QUERY --> MEM');
  }

  const retLabel = `🔎 Retrieve\\n${q(stages.retrieval.strategy)} · top-${stages.retrieval.topK}`;
  lines.push(`    RET["${retLabel}"]`);

  // Reranking (conditional)
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

  if (stages.memory && stages.memory.type !== 'none') {
    lines.push('    MEM --> RET');
  }
  lines.push(`    QUERY --> RET`);
  lines.push(`    ${beforeGen} --> GEN --> ANSWER`);

  // Optional routing
  if (stages.routing?.enabled) {
    lines.push('    ROUTER{"🔀 Route"}');
    lines.push('    QUERY --> ROUTER --> GEN');
  }

  // Optional evaluation
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
