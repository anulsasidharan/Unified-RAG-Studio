'use client';

import Link from 'next/link';
import type { DesignerStageId } from '@/lib/constants';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { ChunkingConfigurator } from './chunking-configurator';
import { CloudProviderSelector } from './cloud-provider-selector';
import { DataIngestionConfigurator } from './data-ingestion-configurator';
import { EmbeddingConfigurator } from './embedding-configurator';
import { EvaluationConfigurator } from './evaluation-configurator';
import { MemoryConfigurator } from './memory-configurator';
import { RetrievalConfigurator } from './retrieval-configurator';
import { GenerationConfigurator } from './generation-configurator';
import { GuardrailsConfigurator } from './guardrails-configurator';
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
    case 'retrieval':
      return 'Choose a retrieval strategy from the catalog, tune top-k, optional score threshold, metadata filters, and reranking — saved on your pipeline draft.';
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
    case 'guardrails':
      return 'Toggle input, retrieval, and output safety checks — saved on draft.guardrails for export and guarded RAG preview.';
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stage {index + 1} of {DESIGNER_STAGES.length}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {meta.label}
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Configure this step of your RAG pipeline. {phaseNoteFor(stageId)}
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
      ) : stageId === 'retrieval' ? (
        <RetrievalConfigurator className="mt-8" variant="full" />
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
      ) : stageId === 'guardrails' ? (
        <GuardrailsConfigurator className="mt-8" />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground dark:border-neutral-600">
          Configuration UI for “{meta.label}” will appear in the numbered Phase 5 task above.
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          {prev ? (
            <Link
              href={prev.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">First stage</span>
          )}
        </div>
        <div>
          {next ? (
            <Link
              href={next.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {next.label} →
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Last stage</span>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href={ROUTES.home} className="text-muted-foreground hover:text-foreground hover:underline">
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Browse templates
        </Link>
      </div>
    </div>
  );
}
