import type { PipelineStages } from '@/types/pipeline';

const PROVIDER_LABEL: Record<string, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  'multi-cloud': 'Multi-Cloud',
};

const FULL_DIAGRAM = Number.MAX_SAFE_INTEGER;

function q(text: string): string {
  return text.replace(/["\[\]]/g, '');
}

/**
 * Renders a minimal flowchart when the user has not yet advanced past the start (-1).
 */
function emptyDiagram(): string {
  return ['flowchart LR', '  EMPTY["Start designing — graph blocks appear as you complete each stage."]'].join('\n');
}

/**
 * Generates a Mermaid flowchart for the RAG pipeline.
 *
 * @param maxVisitedStageIndex — Index in {@link DESIGNER_STAGES} furthest reached while navigating.
 *   `-1` = empty placeholder only. Default `Number.MAX_SAFE_INTEGER` = show everything from draft (tests / loaded pipelines).
 */
export function generateMermaidDiagram(
  stages: PipelineStages,
  cloudProvider: string,
  maxVisitedStageIndex: number = FULL_DIAGRAM
): string {
  if (maxVisitedStageIndex < 0) {
    return emptyDiagram();
  }

  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [];

  const v = {
    idx: maxVisitedStageIndex >= 0,
    ingestion: maxVisitedStageIndex >= 1,
    chunking: maxVisitedStageIndex >= 2,
    embedding: maxVisitedStageIndex >= 3,
    vectorstore: maxVisitedStageIndex >= 4,
    /** QUERY + RET visible */
    query: maxVisitedStageIndex >= 5,
    /** Rerank node (between RET and GEN) only after generation stage is in play */
    rerank: maxVisitedStageIndex >= 7 && Boolean(stages.reranking?.enabled),
    generation: maxVisitedStageIndex >= 7,
    routing: maxVisitedStageIndex >= 8 && Boolean(stages.routing?.enabled),
    memory:
      maxVisitedStageIndex >= 9 &&
      Boolean(stages.memory && stages.memory.type !== 'none'),
    evaluation: maxVisitedStageIndex >= 10 && Boolean(stages.evaluation?.enabled),
  };

  lines.push('flowchart LR');

  // ── Indexing subgraph ─────────────────────────────────────────────────────
  if (v.idx) {
    lines.push(`  subgraph IDX["${cloud} — Indexing Path"]`);
    lines.push('    direction LR');

    const chunkLabel = `✂️ Chunking\\n${q(stages.chunking.strategy)}\\n${stages.chunking.chunkSize} tok / ${stages.chunking.chunkOverlap} overlap`;
    const embLabel = `🎯 Embed\\n${q(stages.embedding.model)}\\n${stages.embedding.dimensions}d`;
    const vsLabel = `🗃️ Vector Store\\n${q(stages.vectorStore.provider)}\\n${q(stages.vectorStore.indexName)}`;

    const fullIndexingChain = v.ingestion && v.chunking && v.embedding && v.vectorstore;

    if (fullIndexingChain) {
      if (stages.dataIngestion) {
        const src = q(stages.dataIngestion.sourceType);
        lines.push(`    SRC[("📄 Source\\n${src}")]`);
        lines.push('    ING["⬆️ Ingest & Preprocess"]');
      } else {
        lines.push('    ING[("📄 Documents")]');
      }
      lines.push(`    CH["${chunkLabel}"]`);
      lines.push(`    EMB["${embLabel}"]`);
      lines.push(`    VS[("${vsLabel}")]`);
      if (stages.dataIngestion) {
        lines.push('    SRC --> ING --> CH --> EMB --> VS');
      } else {
        lines.push('    ING --> CH --> EMB --> VS');
      }
    } else {
      let idxTail = '';

      if (v.ingestion) {
        if (stages.dataIngestion) {
          const src = q(stages.dataIngestion.sourceType);
          lines.push(`    SRC[("📄 Source\\n${src}")]`);
          lines.push('    ING["⬆️ Ingest & Preprocess"]');
          lines.push('    SRC --> ING');
          idxTail = 'ING';
        } else {
          lines.push('    ING[("📄 Documents")]');
          idxTail = 'ING';
        }
      } else {
        lines.push('    IDX_WAIT["⏳ Continue to Data Ingestion"]');
        idxTail = 'IDX_WAIT';
      }

      if (v.chunking) {
        lines.push(`    CH["${chunkLabel}"]`);
        lines.push(`    ${idxTail} --> CH`);
        idxTail = 'CH';
      }

      if (v.embedding) {
        lines.push(`    EMB["${embLabel}"]`);
        lines.push(`    ${idxTail} --> EMB`);
        idxTail = 'EMB';
      }

      if (v.vectorstore) {
        lines.push(`    VS[("${vsLabel}")]`);
        lines.push(`    ${idxTail} --> VS`);
      }
    }

    lines.push('  end');
  }

  // ── Query subgraph ────────────────────────────────────────────────────────
  if (v.query) {
    lines.push('  subgraph QRY["Query Path"]');
    lines.push('    direction LR');

    lines.push('    QUERY[/"🔍 User Query"/]');

    let queryToRetTail = 'QUERY';
    if (v.memory && stages.memory) {
      const memLabel = `💾 Memory\\n${q(stages.memory.type)}`;
      lines.push(`    MEM[("${memLabel}")]`);
      lines.push('    QUERY --> MEM');
      queryToRetTail = 'MEM';
    }

    const retLabel = `🔎 Retrieve\\n${q(stages.retrieval.strategy)} · top-${stages.retrieval.topK}`;
    lines.push(`    RET["${retLabel}"]`);
    lines.push(`    ${queryToRetTail} --> RET`);

    let beforeGen = 'RET';
    if (v.rerank && stages.reranking?.enabled) {
      const rnkModel = stages.reranking.model ? q(stages.reranking.model) : 'reranker';
      const rnkTop = stages.reranking.topN ?? 5;
      lines.push(`    RNK["⚡ Rerank\\n${rnkModel} · top-${rnkTop}"]`);
      lines.push('    RET --> RNK');
      beforeGen = 'RNK';
    }

    if (v.generation) {
      const genLabel = `🤖 Generate\\n${q(stages.generation.model)}\\nt=${stages.generation.temperature}`;
      lines.push(`    GEN["${genLabel}"]`);
      lines.push('    ANSWER[/"💬 Answer"/]');

      if (v.routing && stages.routing?.enabled) {
        lines.push('    ROUTER{"🔀 Route"}');
        lines.push(`    ${beforeGen} --> ROUTER`);
        lines.push('    ROUTER --> GEN --> ANSWER');
      } else {
        lines.push(`    ${beforeGen} --> GEN --> ANSWER`);
      }

      if (v.evaluation && stages.evaluation?.enabled) {
        lines.push('    EVAL["📊 Evaluate"]');
        lines.push('    ANSWER --> EVAL');
      }
    }

    lines.push('  end');
  }

  if (v.vectorstore && v.query) {
    lines.push('  VS --> RET');
  }

  return lines.join('\n');
}

/**
 * One-line summary — only includes stages the user has reached in the designer.
 */
export function generatePipelineSummary(
  stages: PipelineStages,
  maxVisitedStageIndex: number = FULL_DIAGRAM
): string {
  if (maxVisitedStageIndex < 2) {
    return 'Configure chunking and later stages to see a pipeline summary here.';
  }

  const parts: string[] = [];
  if (maxVisitedStageIndex >= 2) parts.push(stages.chunking.strategy);
  if (maxVisitedStageIndex >= 3) parts.push(`${stages.embedding.model}`);
  if (maxVisitedStageIndex >= 4) parts.push(stages.vectorStore.provider);
  if (maxVisitedStageIndex >= 5) parts.push(stages.retrieval.strategy);
  if (maxVisitedStageIndex >= 7 && stages.reranking?.enabled && stages.reranking.model) {
    parts.push(stages.reranking.model);
  }
  if (maxVisitedStageIndex >= 7) parts.push(stages.generation.model);
  return parts.join(' → ');
}

/**
 * Bullet highlights — lines appear as the corresponding designer stage is reached.
 */
export function generatePipelineHighlights(
  stages: PipelineStages,
  cloudProvider: string,
  maxVisitedStageIndex: number = FULL_DIAGRAM
): string[] {
  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [];

  if (maxVisitedStageIndex < 0) {
    return ['Navigate the stages — details unlock as you go.'];
  }

  if (maxVisitedStageIndex >= 0) lines.push(`Cloud: ${cloud}`);

  if (maxVisitedStageIndex >= 1 && stages.dataIngestion) {
    lines.push(`Ingestion: ${stages.dataIngestion.sourceType}`);
  }

  if (maxVisitedStageIndex >= 2) {
    lines.push(
      `Chunking: ${stages.chunking.strategy} · ${stages.chunking.chunkSize} tok / ${stages.chunking.chunkOverlap} overlap`
    );
  }
  if (maxVisitedStageIndex >= 3) {
    lines.push(`Embedding: ${stages.embedding.model} · ${stages.embedding.dimensions}d`);
  }
  if (maxVisitedStageIndex >= 4) {
    lines.push(`Vector store: ${stages.vectorStore.provider} · ${stages.vectorStore.indexName}`);
  }
  if (maxVisitedStageIndex >= 5) {
    lines.push(`Retrieval: ${stages.retrieval.strategy} · top-${stages.retrieval.topK}`);
  }
  if (maxVisitedStageIndex >= 6) {
    lines.push(
      stages.reranking?.enabled
        ? `Reranking: on${stages.reranking.model ? ` · ${stages.reranking.model}` : ''}`
        : 'Reranking: off'
    );
  }
  if (maxVisitedStageIndex >= 7) {
    lines.push(`Generation: ${stages.generation.model} · T=${stages.generation.temperature}`);
  }
  if (maxVisitedStageIndex >= 8) {
    lines.push(
      stages.routing?.enabled
        ? `Routing: on · ${stages.routing.rules?.length ?? 0} rule(s)`
        : 'Routing: off'
    );
  }
  if (maxVisitedStageIndex >= 9) {
    lines.push(stages.memory ? `Memory: ${stages.memory.type}` : 'Memory: none');
  }
  if (maxVisitedStageIndex >= 10) {
    lines.push(
      stages.evaluation?.enabled
        ? `Evaluation: on · ${stages.evaluation.metrics?.length ?? 0} metric(s)`
        : 'Evaluation: off'
    );
  }

  return lines;
}
