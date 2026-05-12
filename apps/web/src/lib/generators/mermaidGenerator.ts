import { designerStageIndex, type DesignerStageId } from '@/lib/constants';
import { hitlHighlightBullet, hitlPlacementMermaidSubtitle } from '@/lib/hitl-summary';
import { guardrailPolicyMermaidSubtitle, guardrailsHighlightBullet } from '@/lib/guardrails-summary';
import type { GuardrailsConfig, PipelineStages } from '@/types/pipeline';

function stageReached(maxVisitedStageIndex: number, id: DesignerStageId): boolean {
  return maxVisitedStageIndex >= designerStageIndex(id);
}

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
  maxVisitedStageIndex: number = FULL_DIAGRAM,
  guardrails?: GuardrailsConfig | null
): string {
  if (maxVisitedStageIndex < 0) {
    return emptyDiagram();
  }

  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [];

  const hitl = stages.humanInTheLoop;
  const hitlOn = Boolean(hitl?.enabled);
  const hitlSub = q(hitlPlacementMermaidSubtitle(hitl));

  const v = {
    idx: stageReached(maxVisitedStageIndex, 'cloud'),
    ingestion: stageReached(maxVisitedStageIndex, 'ingestion'),
    chunking: stageReached(maxVisitedStageIndex, 'chunking'),
    embedding: stageReached(maxVisitedStageIndex, 'embedding'),
    vectorstore: stageReached(maxVisitedStageIndex, 'vectorstore'),
    query: stageReached(maxVisitedStageIndex, 'queryTransform'),
    queryProcessing:
      stageReached(maxVisitedStageIndex, 'queryTransform') && Boolean(stages.queryProcessing?.enabled),
    contextCompression:
      stageReached(maxVisitedStageIndex, 'contextCompression') &&
      Boolean(stages.contextCompression?.enabled && stages.contextCompression.mode !== 'none'),
    /** Rerank node appears once the user has reached Generation in the designer (progressive reveal). */
    rerank: stageReached(maxVisitedStageIndex, 'generation') && Boolean(stages.reranking?.enabled),
    generation: stageReached(maxVisitedStageIndex, 'generation'),
    routing: stageReached(maxVisitedStageIndex, 'routing') && Boolean(stages.routing?.enabled),
    memory:
      stageReached(maxVisitedStageIndex, 'memory') &&
      Boolean(stages.memory && stages.memory.type !== 'none'),
    evaluation: stageReached(maxVisitedStageIndex, 'evaluation') && Boolean(stages.evaluation?.enabled),
    guardrails: stageReached(maxVisitedStageIndex, 'guardrails'),
    hitl: stageReached(maxVisitedStageIndex, 'hitl') && hitlOn,
    hitlPreIng: stageReached(maxVisitedStageIndex, 'hitl') && hitlOn && Boolean(hitl?.placement.preIngestionValidation),
    hitlRetrieval: stageReached(maxVisitedStageIndex, 'hitl') && hitlOn && Boolean(hitl?.placement.retrievalTime),
    hitlGeneration: stageReached(maxVisitedStageIndex, 'hitl') && hitlOn && Boolean(hitl?.placement.generationTime),
    hitlFeedback: stageReached(maxVisitedStageIndex, 'hitl') && hitlOn && Boolean(hitl?.placement.postResponseFeedback),
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
      if (v.hitlPreIng) {
        lines.push(`    HITLIDX["👤 Doc review\\n${hitlSub}"]`);
      }
      lines.push(`    CH["${chunkLabel}"]`);
      lines.push(`    EMB["${embLabel}"]`);
      lines.push(`    VS[("${vsLabel}")]`);
      if (stages.dataIngestion) {
        if (v.hitlPreIng) {
          lines.push('    SRC --> ING --> HITLIDX --> CH --> EMB --> VS');
        } else {
          lines.push('    SRC --> ING --> CH --> EMB --> VS');
        }
      } else if (v.hitlPreIng) {
        lines.push('    ING --> HITLIDX --> CH --> EMB --> VS');
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
        if (v.hitlPreIng && idxTail === 'ING') {
          lines.push(`    HITLIDX["👤 Doc review\\n${hitlSub}"]`);
          lines.push(`    ${idxTail} --> HITLIDX --> CH`);
        } else {
          lines.push(`    ${idxTail} --> CH`);
        }
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
    if (v.queryProcessing && stages.queryProcessing) {
      const qp = stages.queryProcessing;
      const bits: string[] = [];
      if (qp.queryRewrite) bits.push('rewrite');
      if (qp.hyde) bits.push('HyDE');
      if (qp.multiQueryExpansion) bits.push('multi-q');
      if (qp.decomposition) bits.push('split');
      if (qp.stepBack) bits.push('step-back');
      if (qp.intentClassification) bits.push('intent');
      if (qp.entityExtraction) bits.push('entities');
      if (qp.keywordAugmentation) bits.push('keywords');
      const sub = bits.length ? bits.slice(0, 4).join(', ') : 'on';
      lines.push(`    QP["🧩 Query transforms\\n${q(sub)}"]`);
      lines.push('    QUERY --> QP');
      queryToRetTail = 'QP';
    }
    if (v.memory && stages.memory) {
      const memLabel = `💾 Memory\\n${q(stages.memory.type)}`;
      lines.push(`    MEM[("${memLabel}")]`);
      lines.push('    QUERY --> MEM');
      queryToRetTail = 'MEM';
    }

    if (v.guardrails) {
      const grSub = q(guardrailPolicyMermaidSubtitle(guardrails));
      lines.push(`    GR["🛡️ Guardrails\\n${grSub}"]`);
      lines.push(`    ${queryToRetTail} --> GR`);
      queryToRetTail = 'GR';
    }

    const retLabel = `🔎 Retrieve\\n${q(stages.retrieval.strategy)} · top-${stages.retrieval.topK}`;
    lines.push(`    RET["${retLabel}"]`);
    lines.push(`    ${queryToRetTail} --> RET`);

    let tailAfterRet = 'RET';
    if (v.contextCompression && stages.contextCompression) {
      const m = stages.contextCompression.mode;
      lines.push(`    CCMP["📉 Context compression\\n${q(m)}"]`);
      lines.push(`    ${tailAfterRet} --> CCMP`);
      tailAfterRet = 'CCMP';
    }
    if (v.hitlRetrieval) {
      lines.push(`    HITLRET["👤 Retrieval gate\\n${hitlSub}"]`);
      lines.push(`    ${tailAfterRet} --> HITLRET`);
      tailAfterRet = 'HITLRET';
    }

    let beforeGen = tailAfterRet;
    if (v.rerank && stages.reranking?.enabled) {
      const rnkModel = stages.reranking.model ? q(stages.reranking.model) : 'reranker';
      const rnkTop = stages.reranking.topN ?? 5;
      lines.push(`    RNK["⚡ Rerank\\n${rnkModel} · top-${rnkTop}"]`);
      lines.push(`    ${tailAfterRet} --> RNK`);
      beforeGen = 'RNK';
    }

    if (v.generation) {
      const genLabel = `🤖 Generate\\n${q(stages.generation.model)}\\nt=${stages.generation.temperature}`;
      lines.push(`    GEN["${genLabel}"]`);
      if (v.hitlGeneration) {
        lines.push(`    HITLGEN["👤 Answer review\\n${hitlSub}"]`);
      }
      lines.push('    ANSWER[/"💬 Answer"/]');

      if (v.routing && stages.routing?.enabled) {
        lines.push('    ROUTER{"🔀 Route"}');
        lines.push(`    ${beforeGen} --> ROUTER`);
        if (v.hitlGeneration) {
          lines.push('    ROUTER --> GEN --> HITLGEN --> ANSWER');
        } else {
          lines.push('    ROUTER --> GEN --> ANSWER');
        }
      } else if (v.hitlGeneration) {
        lines.push(`    ${beforeGen} --> GEN --> HITLGEN --> ANSWER`);
      } else {
        lines.push(`    ${beforeGen} --> GEN --> ANSWER`);
      }

      let tailAfterAnswer = 'ANSWER';
      if (v.hitlFeedback) {
        lines.push(`    HITLFB["📝 Feedback\\n${hitlSub}"]`);
        lines.push('    ANSWER --> HITLFB');
        tailAfterAnswer = 'HITLFB';
      }

      if (v.evaluation && stages.evaluation?.enabled) {
        lines.push('    EVAL["📊 Evaluate"]');
        lines.push(`    ${tailAfterAnswer} --> EVAL`);
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
  if (!stageReached(maxVisitedStageIndex, 'chunking')) {
    return 'Configure chunking and later stages to see a pipeline summary here.';
  }

  const parts: string[] = [];
  if (stageReached(maxVisitedStageIndex, 'chunking')) parts.push(stages.chunking.strategy);
  if (stageReached(maxVisitedStageIndex, 'embedding')) parts.push(`${stages.embedding.model}`);
  if (stageReached(maxVisitedStageIndex, 'vectorstore')) parts.push(stages.vectorStore.provider);
  if (stageReached(maxVisitedStageIndex, 'queryTransform') && stages.queryProcessing?.enabled) {
    parts.push('query-transforms');
  }
  if (stageReached(maxVisitedStageIndex, 'retrieval')) parts.push(stages.retrieval.strategy);
  if (
    stageReached(maxVisitedStageIndex, 'generation') &&
    stages.reranking?.enabled &&
    stages.reranking.model
  ) {
    parts.push(stages.reranking.model);
  }
  if (stageReached(maxVisitedStageIndex, 'generation')) parts.push(stages.generation.model);
  return parts.join(' → ');
}

/**
 * Bullet highlights — lines appear as the corresponding designer stage is reached.
 */
export function generatePipelineHighlights(
  stages: PipelineStages,
  cloudProvider: string,
  maxVisitedStageIndex: number = FULL_DIAGRAM,
  guardrails?: GuardrailsConfig | null
): string[] {
  const cloud = PROVIDER_LABEL[cloudProvider] ?? cloudProvider;
  const lines: string[] = [];

  if (maxVisitedStageIndex < 0) {
    return ['Navigate the stages — details unlock as you go.'];
  }

  if (stageReached(maxVisitedStageIndex, 'cloud')) lines.push(`Cloud: ${cloud}`);

  if (stageReached(maxVisitedStageIndex, 'ingestion') && stages.dataIngestion) {
    lines.push(`Ingestion: ${stages.dataIngestion.sourceType}`);
  }

  if (stageReached(maxVisitedStageIndex, 'chunking')) {
    lines.push(
      `Chunking: ${stages.chunking.strategy} · ${stages.chunking.chunkSize} tok / ${stages.chunking.chunkOverlap} overlap`
    );
  }
  if (stageReached(maxVisitedStageIndex, 'embedding')) {
    lines.push(`Embedding: ${stages.embedding.model} · ${stages.embedding.dimensions}d`);
  }
  if (stageReached(maxVisitedStageIndex, 'vectorstore')) {
    lines.push(`Vector store: ${stages.vectorStore.provider} · ${stages.vectorStore.indexName}`);
  }
  if (stageReached(maxVisitedStageIndex, 'queryTransform') && stages.queryProcessing?.enabled) {
    lines.push('Query processing: on');
  }
  if (stageReached(maxVisitedStageIndex, 'retrieval')) {
    lines.push(`Retrieval: ${stages.retrieval.strategy} · top-${stages.retrieval.topK}`);
  }
  if (stageReached(maxVisitedStageIndex, 'contextCompression')) {
    const cc = stages.contextCompression;
    lines.push(
      cc?.enabled && cc.mode !== 'none'
        ? `Context compression: ${cc.mode}`
        : 'Context compression: off'
    );
  }
  if (stageReached(maxVisitedStageIndex, 'reranking')) {
    lines.push(
      stages.reranking?.enabled
        ? `Reranking: on${stages.reranking.model ? ` · ${stages.reranking.model}` : ''}`
        : 'Reranking: off'
    );
  }
  if (stageReached(maxVisitedStageIndex, 'generation')) {
    lines.push(`Generation: ${stages.generation.model} · T=${stages.generation.temperature}`);
  }
  if (stageReached(maxVisitedStageIndex, 'routing')) {
    lines.push(
      stages.routing?.enabled
        ? `Routing: on · ${stages.routing.rules?.length ?? 0} rule(s)`
        : 'Routing: off'
    );
  }
  if (stageReached(maxVisitedStageIndex, 'memory')) {
    lines.push(stages.memory ? `Memory: ${stages.memory.type}` : 'Memory: none');
  }
  if (stageReached(maxVisitedStageIndex, 'evaluation')) {
    lines.push(
      stages.evaluation?.enabled
        ? `Evaluation: on · ${stages.evaluation.metrics?.length ?? 0} metric(s)`
        : 'Evaluation: off'
    );
  }
  if (stageReached(maxVisitedStageIndex, 'guardrails')) {
    lines.push(guardrailsHighlightBullet(guardrails));
  }
  if (stageReached(maxVisitedStageIndex, 'hitl')) {
    lines.push(hitlHighlightBullet(stages.humanInTheLoop));
  }

  return lines;
}
