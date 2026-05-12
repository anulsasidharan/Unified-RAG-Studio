'use client';

import Link from 'next/link';
import type { DesignerStageId } from '@/lib/constants';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { ChunkingConfigurator } from './chunking-configurator';
import { CloudProviderSelector } from './cloud-provider-selector';
import { ContextCompressionConfigurator } from './context-compression-configurator';
import { DataIngestionConfigurator } from './data-ingestion-configurator';
import { EmbeddingConfigurator } from './embedding-configurator';
import { EvaluationConfigurator } from './evaluation-configurator';
import { MemoryConfigurator } from './memory-configurator';
import { ObservabilityConfigurator } from './observability-configurator';
import { QueryProcessingConfigurator } from './query-processing-configurator';
import { RetrievalConfigurator } from './retrieval-configurator';
import { GenerationConfigurator } from './generation-configurator';
import { GuardrailsConfigurator } from './guardrails-configurator';
import { HitlConfigurator } from './hitl-configurator';
import { RoutingConfigurator } from './routing-configurator';
import { VectorStoreConfigurator } from './vector-store-configurator';
import { DesignerReviewPage } from './designer-review-page';

function phaseNoteFor(stageId: DesignerStageId): string {
  switch (stageId) {
    case 'cloud':
      return 'Pick where the pipeline runs; metadata comes from the shared cloud catalog.';
    case 'ingestion':
      return 'Choose source system, allowed file types, preprocessing, metadata, and connection hints — saved on your pipeline draft.';
    case 'chunking':
      return 'Choose a strategy from the catalog, tune token size and overlap, and optional chunk metadata — saved on your pipeline draft.';
    case 'embedding':
      return 'Pick an embedding model from the catalog, filter by provider and quality, tune batch size — saved on your pipeline draft.';
    case 'vectorstore':
      return 'Pick a vector database from the catalog, name your index/collection, and tune metric, scaling hints, and optional cloud placement — saved on your pipeline draft.';
    case 'queryTransform':
      return 'Optional query transforms (rewrite, HyDE, multi-query, etc.) before retrieval — saved on draft.stages.queryProcessing; Autopilot uses deterministic variants in benchmarks.';
    case 'retrieval':
      return 'Choose a retrieval strategy from the catalog, tune top-k, optional score threshold, metadata filters, and reranking — saved on your pipeline draft.';
    case 'contextCompression':
      return 'Optional post-retrieval filter or dedupe before reranking — saved on draft.stages.contextCompression; applied in the API retrieval path when enabled.';
    case 'reranking':
      return 'Focused reranking controls (same draft as Retrieval); use the Retrieval stage for full strategy and filters.';
    case 'generation':
      return 'Pick an LLM from the catalog, tune temperature, max tokens, optional top-p, system prompt, and output format — saved on your pipeline draft.';
    case 'routing':
      return 'Optional conditional routing to different LLMs (rules + fallback) — saved on your pipeline draft.';
    case 'memory':
      return 'Choose memory mode (none, buffer, summary, vector) and session options — saved on your pipeline draft.';
    case 'evaluation':
      return 'Toggle evaluation, pick metrics, test set size, and schedule — saved on your pipeline draft.';
    case 'observability':
      return 'Tracing toggles, agent tool flags, and adaptive policy hints — saved on draft.observability, draft.agentTools, and draft.adaptivePolicies for export.';
    case 'guardrails':
      return 'Toggle input, retrieval, and output safety checks — saved on draft.guardrails for export and guarded RAG preview.';
    case 'hitl':
      return 'Optional human review gates, escalation, and workflow hints — saved on draft.stages.humanInTheLoop for exports.';
    case 'review':
      return 'Jump to the live graph, cost strip, and export — or edit any prior stage from the checklist.';
    default:
      return '';
  }
}

export function DesignerStagePlaceholder({
  stageId,
  className,
}: Readonly<{
  stageId: DesignerStageId;
  className?: string;
}>) {
  const meta = DESIGNER_STAGES.find((s) => s.id === stageId)!;
  const index = DESIGNER_STAGES.findIndex((s) => s.id === stageId);
  const prev = index > 0 ? DESIGNER_STAGES[index - 1] : null;
  const next = index < DESIGNER_STAGES.length - 1 ? DESIGNER_STAGES[index + 1] : null;

  if (stageId === 'review') {
    return <DesignerReviewPage className={className} />;
  }

  return (
    <div className={cn('mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10', className)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
          Stage {index + 1} / {DESIGNER_STAGES.length}
        </span>
      </div>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {meta.label}
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        {phaseNoteFor(stageId)}
      </p>

      {stageId === 'cloud' ? (
        <CloudProviderSelector className="mt-8" />
      ) : stageId === 'ingestion' ? (
        <DataIngestionConfigurator className="mt-8" />
      ) : stageId === 'chunking' ? (
        <ChunkingConfigurator className="mt-8" />
      ) : stageId === 'embedding' ? (
        <EmbeddingConfigurator className="mt-8" />
      ) : stageId === 'vectorstore' ? (
        <VectorStoreConfigurator className="mt-8" />
      ) : stageId === 'queryTransform' ? (
        <QueryProcessingConfigurator className="mt-8" />
      ) : stageId === 'retrieval' ? (
        <RetrievalConfigurator className="mt-8" variant="full" />
      ) : stageId === 'contextCompression' ? (
        <ContextCompressionConfigurator className="mt-8" />
      ) : stageId === 'reranking' ? (
        <RetrievalConfigurator className="mt-8" variant="rerank-focus" />
      ) : stageId === 'generation' ? (
        <GenerationConfigurator className="mt-8" />
      ) : stageId === 'routing' ? (
        <RoutingConfigurator className="mt-8" />
      ) : stageId === 'memory' ? (
        <MemoryConfigurator className="mt-8" />
      ) : stageId === 'evaluation' ? (
        <EvaluationConfigurator className="mt-8" />
      ) : stageId === 'observability' ? (
        <ObservabilityConfigurator className="mt-8" />
      ) : stageId === 'guardrails' ? (
        <GuardrailsConfigurator className="mt-8" />
      ) : stageId === 'hitl' ? (
        <HitlConfigurator className="mt-8" />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground dark:border-neutral-600">
          Configuration UI for “{meta.label}” will appear in the numbered Phase 5 task above.
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6 dark:border-neutral-800">
        <div>
          {prev ? (
            <Link
              href={prev.path}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-700 dark:hover:bg-primary-950/30 dark:hover:text-primary-300"
            >
              <span aria-hidden>←</span>
              {prev.label}
            </Link>
          ) : (
            <span className="text-xs text-neutral-400">First stage</span>
          )}
        </div>
        <div>
          {next ? (
            <Link
              href={next.path}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700"
            >
              {next.label}
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link
              href={ROUTES.designer + '/review'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700"
            >
              Review pipeline
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href={ROUTES.home} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Browse templates
        </Link>
      </div>
    </div>
  );
}
