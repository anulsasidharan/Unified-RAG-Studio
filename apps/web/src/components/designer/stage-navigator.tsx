'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { DESIGNER_STAGES } from '@/lib/constants';
import { normalizeDesignerPathname } from '@/lib/designer-routes';
import { cn } from '@/lib/utils';
import { getEmbeddingModelMeta } from '@/lib/embeddings-catalog';
import { getGenerationModelMeta } from '@/lib/generation-catalog';
import { getVectorStoreMeta } from '@/lib/vector-stores-catalog';
import { guardrailsNavigatorHint } from '@/lib/guardrails-summary';
import { useDesignerStore } from '@/stores/designer-store';
import type { ChunkingStrategy, DataIngestionConfig, RetrievalStrategy } from '@/types/pipeline';

function ingestionSourceHint(source?: DataIngestionConfig['sourceType']): string {
  if (!source) return '';
  const labels: Record<DataIngestionConfig['sourceType'], string> = {
    'file-upload': 'Upload',
    s3: 'S3',
    gcs: 'GCS',
    'azure-blob': 'Azure Blob',
    url: 'URL',
    database: 'Database',
    api: 'API',
  };
  return labels[source];
}

function chunkingHint(strategy?: ChunkingStrategy, chunkSize?: number, overlap?: number): string {
  if (!strategy || chunkSize === undefined) return '';
  const o = overlap ?? 0;
  const short: Record<ChunkingStrategy, string> = {
    'fixed-size': 'Fixed',
    'recursive-character': 'Recursive',
    semantic: 'Semantic',
    'markdown-header': 'MD headers',
    'sentence-based': 'Sentences',
    'paragraph-based': 'Paragraphs',
    'code-aware': 'Code',
  };
  return `${short[strategy] ?? strategy} · ${chunkSize}/${o}`;
}

function embeddingHint(modelId?: string, dimensions?: number): string {
  if (!modelId) return '';
  const meta = getEmbeddingModelMeta(modelId);
  const label = meta?.name ?? modelId;
  const short = label.length > 22 ? `${label.slice(0, 20)}…` : label;
  if (dimensions === undefined) return short;
  return `${short} · ${dimensions}d`;
}

function vectorStoreHint(providerId?: string, indexName?: string): string {
  if (!providerId) return '';
  const meta = getVectorStoreMeta(providerId);
  const label = meta?.name ?? providerId;
  const short = label.length > 20 ? `${label.slice(0, 18)}…` : label;
  if (!indexName) return short;
  const idx = indexName.length > 14 ? `${indexName.slice(0, 12)}…` : indexName;
  return `${short} · ${idx}`;
}

function retrievalHint(strategy?: RetrievalStrategy, topK?: number): string {
  if (!strategy) return '';
  const k = topK != null ? topK : '?';
  const short = strategy.length > 24 ? `${strategy.slice(0, 22)}…` : strategy;
  return `${short} · top-${k}`;
}

function rerankingHint(enabled?: boolean, model?: string): string {
  if (!enabled) return 'Off';
  const m = model?.trim();
  if (!m) return 'On';
  return m.length > 24 ? `${m.slice(0, 22)}…` : m;
}

function generationHint(modelId?: string, temperature?: number, maxTokens?: number): string {
  if (!modelId) return '';
  const meta = getGenerationModelMeta(modelId);
  const label = meta?.name ?? modelId;
  const short = label.length > 22 ? `${label.slice(0, 20)}…` : label;
  const t = temperature != null ? ` · T${temperature.toFixed(1)}` : '';
  const mt = maxTokens != null ? ` · ${maxTokens} tok` : '';
  return `${short}${t}${mt}`;
}

function routingHint(enabled?: boolean, ruleCount?: number): string {
  if (!enabled) return 'Off';
  const n = ruleCount ?? 0;
  return n === 0 ? 'On · no rules' : `On · ${n} rule${n === 1 ? '' : 's'}`;
}

const MEMORY_SHORT: Record<string, string> = {
  none: 'None',
  'conversation-buffer': 'Buffer',
  'summary-buffer': 'Summary',
  'vector-memory': 'Vector',
};

function memoryHint(type?: string): string {
  if (!type) return '';
  return MEMORY_SHORT[type] ?? type;
}

function evaluationHint(enabled?: boolean, metricCount?: number): string {
  if (!enabled) return 'Off';
  const n = metricCount ?? 0;
  return n === 0 ? 'On · no metrics' : `On · ${n} metric${n === 1 ? '' : 's'}`;
}

export function StageNavigator() {
  const pathname = usePathname();
  const router = useRouter();
  const normalized = normalizeDesignerPathname(pathname ?? '');
  const draft = useDesignerStore((s) => s.draft);

  return (
    <nav
      className="sticky top-0 z-30 flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:sticky lg:top-0 lg:z-10 lg:border-b-0 lg:px-2 lg:py-4 dark:border-neutral-800"
      aria-label="Designer pipeline stages"
    >
      <div className="hidden px-2 lg:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline builder
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Move through stages to configure your pipeline. A live graph and summary update as you edit the draft.
        </p>
      </div>

      <div className="lg:hidden">
        <label htmlFor="designer-stage-select" className="sr-only">
          Jump to stage
        </label>
        <select
          id="designer-stage-select"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          value={normalized}
          onChange={(e) => {
            const href = e.target.value;
            if (href) router.push(href);
          }}
        >
          {DESIGNER_STAGES.map((s) => (
            <option key={s.id} value={s.path}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <ol className="hidden max-h-none flex-1 list-none space-y-0.5 overflow-y-auto lg:block">
        {DESIGNER_STAGES.map((stage, idx) => {
          const isActive = stage.path === normalized;
          const isPast =
            DESIGNER_STAGES.findIndex((x) => x.path === normalized) > idx;

          return (
            <li key={stage.id}>
              <Link
                href={stage.path}
                className={cn(
                  'group flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                  isActive &&
                    'bg-primary-600/15 font-medium text-primary-900 dark:bg-primary-500/20 dark:text-primary-50',
                  !isActive && 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isActive &&
                      'border-primary-600 bg-primary-600 text-primary-foreground',
                    !isActive &&
                      isPast &&
                      'border-primary-600/60 bg-background text-primary-700 dark:text-primary-300',
                    !isActive &&
                      !isPast &&
                      'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
                  )}
                  aria-hidden
                >
                  {isPast ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{stage.label}</span>
                  {stage.id === 'cloud' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {String(draft.cloudProvider).toUpperCase()}
                    </span>
                  ) : stage.id === 'ingestion' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ingestionSourceHint(draft.stages.dataIngestion?.sourceType)}
                    </span>
                  ) : stage.id === 'chunking' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {chunkingHint(
                        draft.stages.chunking?.strategy,
                        draft.stages.chunking?.chunkSize,
                        draft.stages.chunking?.chunkOverlap
                      )}
                    </span>
                  ) : stage.id === 'embedding' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {embeddingHint(draft.stages.embedding?.model, draft.stages.embedding?.dimensions)}
                    </span>
                  ) : stage.id === 'vectorstore' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {vectorStoreHint(draft.stages.vectorStore?.provider, draft.stages.vectorStore?.indexName)}
                    </span>
                  ) : stage.id === 'retrieval' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {retrievalHint(draft.stages.retrieval?.strategy, draft.stages.retrieval?.topK)}
                    </span>
                  ) : stage.id === 'reranking' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {rerankingHint(draft.stages.reranking?.enabled, draft.stages.reranking?.model)}
                    </span>
                  ) : stage.id === 'generation' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {generationHint(
                        draft.stages.generation?.model,
                        draft.stages.generation?.temperature,
                        draft.stages.generation?.maxTokens
                      )}
                    </span>
                  ) : stage.id === 'routing' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {routingHint(draft.stages.routing?.enabled, draft.stages.routing?.rules?.length)}
                    </span>
                  ) : stage.id === 'memory' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {memoryHint(draft.stages.memory?.type)}
                    </span>
                  ) : stage.id === 'evaluation' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {evaluationHint(draft.stages.evaluation?.enabled, draft.stages.evaluation?.metrics?.length)}
                    </span>
                  ) : stage.id === 'guardrails' ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {guardrailsNavigatorHint(draft.guardrails)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
