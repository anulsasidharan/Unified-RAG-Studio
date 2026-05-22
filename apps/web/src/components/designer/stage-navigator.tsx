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
import { hitlNavigatorHint } from '@/lib/hitl-summary';
import { guardrailsNavigatorHint } from '@/lib/guardrails-summary';
import { useDesignerStore } from '@/stores/designer-store';
import { getEnabledIngestionSourceTypes } from '@/lib/data-ingestion-sources';
import type {
  ChunkingStrategy,
  ContextCompressionConfig,
  DataIngestionConfig,
  DataIngestionSourceType,
  ObservabilityConfig,
  QueryProcessingConfig,
  RetrievalStrategy,
} from '@/types/pipeline';

const INGESTION_SHORT: Record<DataIngestionSourceType, string> = {
  'file-upload': 'Upload',
  s3: 'S3',
  gcs: 'GCS',
  'azure-blob': 'Azure Blob',
  url: 'URL',
  database: 'Database',
  api: 'API',
};

function ingestionSourceHint(cfg?: DataIngestionConfig): string {
  if (!cfg) return '';
  const enabled = getEnabledIngestionSourceTypes(cfg);
  if (!enabled.length) return '';
  return enabled.map((id) => INGESTION_SHORT[id]).join(' + ');
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
    'token-aware': 'Token-aware',
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

function queryTransformHint(q?: QueryProcessingConfig): string {
  if (!q?.enabled) return 'Off';
  const bits = [
    q.queryRewrite,
    q.hyde,
    q.multiQueryExpansion,
    q.decomposition,
    q.stepBack,
    q.intentClassification,
    q.entityExtraction,
    q.keywordAugmentation,
  ].filter(Boolean).length;
  return bits ? `${bits} transform(s)` : 'On';
}

function contextCompressionHint(c?: ContextCompressionConfig): string {
  if (!c?.enabled || c.mode === 'none') return 'Off';
  return c.mode;
}

function observabilityHint(o?: ObservabilityConfig | null): string {
  if (!o) return 'Defaults';
  const on = [o.retrievalTracing, o.promptTracing].filter(Boolean).length;
  return on ? `${on} trace on` : 'Standard';
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
  'entity-memory': 'Entity',
  'episodic-memory': 'Episodic',
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
      className="sticky top-0 z-30 flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:sticky lg:top-0 lg:z-10 lg:border-b-0 lg:border-r lg:border-neutral-100 lg:px-2 lg:py-5 dark:border-neutral-800 dark:bg-neutral-950/95 dark:lg:border-neutral-800"
      aria-label="Designer pipeline stages"
    >
      <div className="hidden px-2 lg:block">
        <div className="flex items-center gap-2">
          <div className="from-primary-600 h-5 w-1 rounded-full bg-gradient-to-b to-indigo-600" />
          <p className="font-display text-xs font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
            Pipeline builder
          </p>
        </div>
        <p className="mt-2 pl-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Configure each stage. Live graph updates as you go.
        </p>
      </div>

      <div className="lg:hidden">
        <label htmlFor="designer-stage-select" className="sr-only">
          Jump to stage
        </label>
        <select
          id="designer-stage-select"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
          const isPast = DESIGNER_STAGES.findIndex((x) => x.path === normalized) > idx;

          return (
            <li key={stage.id} className="relative">
              {isActive && (
                <span
                  className="from-primary-600 absolute inset-y-1 left-0 w-[3px] rounded-full bg-gradient-to-b to-indigo-600"
                  aria-hidden
                />
              )}
              <Link
                href={stage.path}
                className={cn(
                  'group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-all',
                  isActive &&
                    'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200 font-semibold',
                  !isActive &&
                    isPast &&
                    'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300',
                  !isActive &&
                    !isPast &&
                    'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    isActive &&
                      'from-primary-600 shadow-primary-200 bg-gradient-to-br to-indigo-600 text-white shadow-sm',
                    !isActive &&
                      isPast &&
                      'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900',
                    !isActive &&
                      !isPast &&
                      'border border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500',
                  )}
                  aria-hidden
                >
                  {isPast ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{stage.label}</span>
                  {stage.id === 'cloud' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {String(draft.cloudProvider).toUpperCase()}
                    </span>
                  ) : stage.id === 'ingestion' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {ingestionSourceHint(draft.stages.dataIngestion)}
                    </span>
                  ) : stage.id === 'chunking' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {chunkingHint(
                        draft.stages.chunking?.strategy,
                        draft.stages.chunking?.chunkSize,
                        draft.stages.chunking?.chunkOverlap,
                      )}
                    </span>
                  ) : stage.id === 'embedding' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {embeddingHint(
                        draft.stages.embedding?.model,
                        draft.stages.embedding?.dimensions,
                      )}
                    </span>
                  ) : stage.id === 'vectorstore' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {vectorStoreHint(
                        draft.stages.vectorStore?.provider,
                        draft.stages.vectorStore?.indexName,
                      )}
                    </span>
                  ) : stage.id === 'queryTransform' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {queryTransformHint(draft.stages.queryProcessing)}
                    </span>
                  ) : stage.id === 'retrieval' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {retrievalHint(
                        draft.stages.retrieval?.strategy,
                        draft.stages.retrieval?.topK,
                      )}
                    </span>
                  ) : stage.id === 'contextCompression' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {contextCompressionHint(draft.stages.contextCompression)}
                    </span>
                  ) : stage.id === 'reranking' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {rerankingHint(
                        draft.stages.reranking?.enabled,
                        draft.stages.reranking?.model,
                      )}
                    </span>
                  ) : stage.id === 'generation' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {generationHint(
                        draft.stages.generation?.model,
                        draft.stages.generation?.temperature,
                        draft.stages.generation?.maxTokens,
                      )}
                    </span>
                  ) : stage.id === 'routing' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {routingHint(
                        draft.stages.routing?.enabled,
                        draft.stages.routing?.rules?.length,
                      )}
                    </span>
                  ) : stage.id === 'memory' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {memoryHint(draft.stages.memory?.type)}
                    </span>
                  ) : stage.id === 'evaluation' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {evaluationHint(
                        draft.stages.evaluation?.enabled,
                        draft.stages.evaluation?.metrics?.length,
                      )}
                    </span>
                  ) : stage.id === 'observability' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {observabilityHint(draft.observability ?? undefined)}
                    </span>
                  ) : stage.id === 'guardrails' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {guardrailsNavigatorHint(draft.guardrails)}
                    </span>
                  ) : stage.id === 'hitl' ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {hitlNavigatorHint(draft.stages.humanInTheLoop)}
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
