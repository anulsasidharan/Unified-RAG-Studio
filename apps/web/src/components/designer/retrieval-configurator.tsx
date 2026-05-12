'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Filter,
  GitMerge,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import {
  getRetrievalStrategyMeta,
  listRetrievalStrategies,
  retrievalDefaultsFromCatalog,
} from '@/lib/retrieval-strategies-catalog';
import {
  getRerankerRow,
  listRerankers,
  mapCatalogProviderToSchema,
  type RerankerProvider,
} from '@/lib/rerankers-catalog';
import { ROUTES } from '@/lib/constants';
import { RetrievalConfigSchema, RerankingConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type {
  EnsembleMemberStrategy,
  FilterOperator,
  MetadataFilter,
  RetrievalConfig,
  RetrievalStrategy,
} from '@/types/pipeline';

const DEFAULT_STAGES = createDefaultPipelineConfiguration().stages;
const DEFAULT_RETRIEVAL = DEFAULT_STAGES.retrieval;
const DEFAULT_RERANK = DEFAULT_STAGES.reranking ?? { enabled: false };

const OPERATORS: FilterOperator[] = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'contains',
];

const ENSEMBLE_MEMBERS: { id: EnsembleMemberStrategy; label: string }[] = [
  { id: 'similarity', label: 'Similarity' },
  { id: 'mmr', label: 'MMR' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'multi-query', label: 'Multi-query' },
  { id: 'parent-child', label: 'Parent–child' },
];

function complexityBadgeStyles(level: string): string {
  const l = level.toLowerCase();
  if (l === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100';
  }
  if (l === 'medium') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
}

function mergeRetrieval(current: RetrievalConfig | undefined, patch: Partial<RetrievalConfig>): RetrievalConfig {
  const base = current ?? DEFAULT_RETRIEVAL;
  const hybridSearch =
    patch.hybridSearch !== undefined
      ? { ...{ alpha: 0.5, fusion: 'rrf' as const }, ...base.hybridSearch, ...patch.hybridSearch }
      : base.hybridSearch;
  return {
    ...base,
    ...patch,
    filters: patch.filters !== undefined ? patch.filters : base.filters,
    hybridSearch,
    parentChildConfig: patch.parentChildConfig !== undefined ? patch.parentChildConfig : base.parentChildConfig,
    multiQueryConfig: patch.multiQueryConfig !== undefined ? patch.multiQueryConfig : base.multiQueryConfig,
    scoreThreshold: patch.scoreThreshold !== undefined ? patch.scoreThreshold : base.scoreThreshold,
    mmrFetchK: patch.mmrFetchK !== undefined ? patch.mmrFetchK : base.mmrFetchK,
    mmrLambdaMult: patch.mmrLambdaMult !== undefined ? patch.mmrLambdaMult : base.mmrLambdaMult,
    ensembleStrategies: patch.ensembleStrategies !== undefined ? patch.ensembleStrategies : base.ensembleStrategies,
    ensembleRrfK: patch.ensembleRrfK !== undefined ? patch.ensembleRrfK : base.ensembleRrfK,
  };
}

function mergeReranking(
  current: typeof DEFAULT_RERANK | undefined,
  patch: Partial<typeof DEFAULT_RERANK>
): typeof DEFAULT_RERANK {
  const base = current ?? DEFAULT_RERANK;
  return {
    ...base,
    ...patch,
    minRelevanceScore: patch.minRelevanceScore !== undefined ? patch.minRelevanceScore : base.minRelevanceScore,
    diversityMaxSimilarity:
      patch.diversityMaxSimilarity !== undefined ? patch.diversityMaxSimilarity : base.diversityMaxSimilarity,
  };
}

function parseFilterValue(op: FilterOperator, raw: string): MetadataFilter['value'] {
  const t = raw.trim();
  if (op === 'in' || op === 'nin') {
    return t
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && !Number.isNaN(Number(t)) && Number.isFinite(Number(t))) {
    return Number(t);
  }
  return t;
}

function formatFilterValue(v: MetadataFilter['value']): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return String(v);
  return String(v);
}

export type RetrievalConfiguratorVariant = 'full' | 'rerank-focus';

export function RetrievalConfigurator({
  className,
  variant = 'full',
}: Readonly<{
  className?: string;
  variant?: RetrievalConfiguratorVariant;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.retrieval ?? DEFAULT_RETRIEVAL;
  const rerankCfg = draft.stages.reranking ?? DEFAULT_RERANK;

  const setRetrieval = useCallback(
    (next: RetrievalConfig) => {
      updateStages({ retrieval: next });
    },
    [updateStages]
  );

  const patchRetrieval = useCallback(
    (patch: Partial<RetrievalConfig>) => {
      setRetrieval(mergeRetrieval(draft.stages.retrieval, patch));
    },
    [draft.stages.retrieval, setRetrieval]
  );

  const setReranking = useCallback(
    (next: typeof DEFAULT_RERANK) => {
      updateStages({ reranking: next });
    },
    [updateStages]
  );

  const patchReranking = useCallback(
    (patch: Partial<typeof DEFAULT_RERANK>) => {
      setReranking(mergeReranking(draft.stages.reranking, patch));
    },
    [draft.stages.reranking, setReranking]
  );

  useEffect(() => {
    if (cfg.strategy !== 'ensemble') return;
    if (cfg.ensembleStrategies && cfg.ensembleStrategies.length > 0) return;
    patchRetrieval(
      retrievalDefaultsFromCatalog('ensemble', {
        fallbackLlmModel: draft.stages.generation?.model ?? 'gpt-4o-mini',
      })
    );
  }, [cfg.strategy, cfg.ensembleStrategies, draft.stages.generation?.model, patchRetrieval]);

  const retrievalValidation = useMemo(() => RetrievalConfigSchema.safeParse(cfg), [cfg]);
  const rerankValidation = useMemo(() => RerankingConfigSchema.safeParse(rerankCfg), [rerankCfg]);

  const strategies = listRetrievalStrategies();
  const allRerankers = useMemo(() => listRerankers(), []);

  const [query, setQuery] = useState('');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');

  const filteredStrategies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strategies.filter((s) => {
      if (complexityFilter !== 'all' && s.implementationComplexity !== complexityFilter) return false;
      if (!q) return true;
      const hay = [s.id, s.name, s.description, ...(s.bestFor ?? [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [strategies, complexityFilter, query]);

  const pinnedSelectionId = useMemo(() => {
    const m = getRetrievalStrategyMeta(cfg.strategy);
    if (!m) return undefined;
    if (filteredStrategies.some((x) => x.id === m.id)) return undefined;
    return m.id;
  }, [filteredStrategies, cfg.strategy]);

  const displayStrategies = useMemo(() => {
    const m = getRetrievalStrategyMeta(cfg.strategy);
    if (!m) return filteredStrategies;
    if (filteredStrategies.some((x) => x.id === m.id)) return filteredStrategies;
    return [m, ...filteredStrategies];
  }, [filteredStrategies, cfg.strategy]);

  const selectedMeta = useMemo(() => getRetrievalStrategyMeta(cfg.strategy), [cfg.strategy]);

  const applyStrategy = (id: RetrievalStrategy) => {
    const defaults = retrievalDefaultsFromCatalog(id, {
      fallbackLlmModel: draft.stages.generation?.model ?? 'gpt-4o-mini',
    });
    setRetrieval(
      mergeRetrieval(draft.stages.retrieval, {
        ...defaults,
        strategy: id,
        filters: draft.stages.retrieval?.filters,
      })
    );
  };

  const filters = cfg.filters ?? [];

  const updateFilterRow = (index: number, patch: Partial<MetadataFilter>) => {
    const next = filters.map((f, i) => (i === index ? ({ ...f, ...patch } as MetadataFilter) : f));
    patchRetrieval({ filters: next });
  };

  const addFilter = () => {
    patchRetrieval({
      filters: [...filters, { key: 'source', operator: 'eq', value: '' }],
    });
  };

  const removeFilter = (index: number) => {
    patchRetrieval({ filters: filters.filter((_, i) => i !== index) });
  };

  const rerankByProvider = useMemo(() => {
    const cohere = allRerankers.filter((m) => mapCatalogProviderToSchema(m.provider) === 'cohere');
    const hf = allRerankers.filter((m) => mapCatalogProviderToSchema(m.provider) === 'huggingface');
    const other = allRerankers.filter((m) => {
      const p = mapCatalogProviderToSchema(m.provider);
      return p !== 'cohere' && p !== 'huggingface';
    });
    return { cohere, huggingface: hf, custom: other };
  }, [allRerankers]);

  const selectRerankerModel = (modelId: string) => {
    const row = getRerankerRow(modelId);
    if (!row) {
      patchReranking({ model: modelId });
      return;
    }
    const provider = mapCatalogProviderToSchema(row.provider);
    patchReranking({
      model: modelId,
      provider,
    });
  };

  const rerankingSection = (
    <section
      className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
      aria-labelledby="rerank-heading"
      id="designer-reranking-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rerank-heading" className="text-lg font-semibold text-foreground">
            Reranking
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optionally re-score retrieved chunks before generation. Uses{' '}
            <code className="rounded bg-muted px-1">data/models/rerankers.json</code> for curated models.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={rerankCfg.enabled}
          onClick={() => patchReranking({ enabled: !rerankCfg.enabled })}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            rerankCfg.enabled
              ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30'
              : 'border-border bg-muted/30'
          )}
        >
          <span>{rerankCfg.enabled ? 'Enabled' : 'Disabled'}</span>
          <span
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
              rerankCfg.enabled ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted'
            )}
            aria-hidden
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full bg-background shadow transition',
                rerankCfg.enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>
      </div>

      {rerankCfg.enabled ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rerank-provider" className="text-sm font-medium text-foreground">
                Provider
              </label>
              <select
                id="rerank-provider"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                value={rerankCfg.provider ?? 'cohere'}
                onChange={(e) => {
                  const p = e.target.value as RerankerProvider;
                  patchReranking({ provider: p, model: undefined });
                }}
              >
                <option value="cohere">Cohere</option>
                <option value="huggingface">Hugging Face</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label htmlFor="rerank-topn" className="text-sm font-medium text-foreground">
                Top-N after rerank
              </label>
              <input
                id="rerank-topn"
                type="number"
                min={1}
                max={100}
                value={rerankCfg.topN ?? 5}
                onChange={(e) =>
                  patchReranking({ topN: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rerank-minrel" className="text-sm font-medium text-foreground">
                Min relevance score (Cohere only, optional)
              </label>
              <input
                id="rerank-minrel"
                type="text"
                inputMode="decimal"
                placeholder="empty = no filter"
                value={rerankCfg.minRelevanceScore == null ? '' : String(rerankCfg.minRelevanceScore)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '') {
                    patchReranking({ minRelevanceScore: null });
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  patchReranking({ minRelevanceScore: Math.min(1, Math.max(0, n)) });
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="rerank-div" className="text-sm font-medium text-foreground">
                Diversity (max word Jaccard, optional)
              </label>
              <input
                id="rerank-div"
                type="text"
                inputMode="decimal"
                placeholder="empty = off"
                value={rerankCfg.diversityMaxSimilarity == null ? '' : String(rerankCfg.diversityMaxSimilarity)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '') {
                    patchReranking({ diversityMaxSimilarity: null });
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  patchReranking({ diversityMaxSimilarity: Math.min(1, Math.max(0, n)) });
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Skip chunks too similar to already-kept text (e.g. 0.85). Applied after ordering.
              </p>
            </div>
          </div>

          {rerankCfg.provider === 'custom' ? (
            <div>
              <label htmlFor="rerank-custom-model" className="text-sm font-medium text-foreground">
                Custom model id or Hugging Face repo id
              </label>
              <input
                id="rerank-custom-model"
                type="text"
                autoComplete="off"
                value={rerankCfg.model ?? ''}
                onChange={(e) => patchReranking({ model: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="my-org/reranker"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="rerank-model" className="text-sm font-medium text-foreground">
                Model
              </label>
              <select
                id="rerank-model"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                value={
                  (() => {
                    const list =
                      rerankCfg.provider === 'cohere'
                        ? rerankByProvider.cohere
                        : rerankCfg.provider === 'huggingface'
                          ? rerankByProvider.huggingface
                          : allRerankers;
                    const fallback = list[0]?.id ?? 'cohere-rerank-v3';
                    if (rerankCfg.model && list.some((m) => m.id === rerankCfg.model)) {
                      return rerankCfg.model;
                    }
                    return fallback;
                  })()
                }
                onChange={(e) => selectRerankerModel(e.target.value)}
              >
                {(rerankCfg.provider === 'cohere'
                  ? rerankByProvider.cohere
                  : rerankCfg.provider === 'huggingface'
                    ? rerankByProvider.huggingface
                    : allRerankers
                ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose <strong className="font-medium text-foreground">Custom</strong> above to enter a free-form model id.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/15 p-3 text-xs text-muted-foreground">
            <p>
              <strong className="font-medium text-foreground">Tip:</strong> Set top-N ≤ retrieval top-k unless you
              expand the candidate pool in code (rerankers usually receive the retrieved set).
            </p>
          </div>
        </div>
      ) : null}

      {!rerankValidation.success ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <ul className="list-inside list-disc text-xs">
            {rerankValidation.error.issues.slice(0, 6).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );

  const retrievalSummary = (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current retrieval</p>
      <p className="mt-1 text-foreground">
        <span className="font-mono">{cfg.strategy}</span>
        <span className="text-muted-foreground"> · </span>
        top-{cfg.topK}
        {cfg.scoreThreshold != null && cfg.scoreThreshold > 0 ? (
          <>
            <span className="text-muted-foreground"> · </span>
            score ≥ {cfg.scoreThreshold}
          </>
        ) : null}
        {cfg.filters && cfg.filters.length > 0 ? (
          <>
            <span className="text-muted-foreground"> · </span>
            {cfg.filters.length} metadata filter{cfg.filters.length === 1 ? '' : 's'}
          </>
        ) : null}
      </p>
      {variant === 'rerank-focus' ? (
        <Link
          href="/designer/retrieval"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Edit retrieval parameters <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}
    </div>
  );

  return (
    <div className={cn('space-y-8', className)}>
      {variant === 'rerank-focus' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tune reranking for your pipeline draft. Retrieval parameters are shared with the{' '}
            <Link href="/designer/retrieval" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
              Retrieval
            </Link>{' '}
            stage.
          </p>
          {retrievalSummary}
          {rerankingSection}
        </div>
      ) : (
        <>
          <section
            className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
            aria-labelledby="ret-filter-heading"
          >
            <h2 id="ret-filter-heading" className="text-lg font-semibold text-foreground">
              Discover strategies
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse <code className="rounded bg-muted px-1">data/retrieval-strategies.json</code>. Choosing a card
              updates <strong className="font-medium text-foreground">draft.stages.retrieval</strong> with catalog-safe
              defaults.
            </p>

            <div className="mt-4">
              <label htmlFor="ret-search" className="sr-only">
                Search strategies
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  id="ret-search"
                  type="search"
                  placeholder="Search by name, id, description…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ret-complexity"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Implementation complexity
                </label>
                <select
                  id="ret-complexity"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={complexityFilter}
                  onChange={(e) => setComplexityFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
              Showing {filteredStrategies.length} of {strategies.length} strategies
              {filteredStrategies.length === 0 ? ' — relax filters or clear search.' : '.'}
              {pinnedSelectionId ? (
                <>
                  {' '}
                  Your current strategy is pinned at the top because it does not match the active filters.
                </>
              ) : null}
            </p>
          </section>

          <div role="radiogroup" aria-label="Retrieval strategy" className="grid gap-4 sm:grid-cols-2">
            {displayStrategies.map((s) => {
              const selected = cfg.strategy === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => applyStrategy(s.id as RetrievalStrategy)}
                  className={cn(
                    'flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    selected
                      ? 'border-primary-600 bg-primary-600/[0.06] ring-2 ring-primary-600 dark:bg-primary-500/10'
                      : 'border-neutral-200 bg-card hover:border-primary-400/60 hover:bg-accent/40 dark:border-neutral-700'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background',
                        selected ? 'border-primary-600 text-primary-700 dark:text-primary-200' : 'border-muted'
                      )}
                      aria-hidden
                    >
                      <GitMerge className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{s.name}</span>
                        {s.id === pinnedSelectionId ? (
                          <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                            Current · outside filters
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            complexityBadgeStyles(s.implementationComplexity)
                          )}
                        >
                          {s.implementationComplexity}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                    </div>
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                        selected
                          ? 'border-primary-600 bg-primary-600 text-primary-foreground'
                          : 'border-muted bg-muted/50 text-transparent'
                      )}
                      aria-hidden
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedMeta ? (
            <section
              className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
              aria-labelledby="ret-about-heading"
            >
              <h2 id="ret-about-heading" className="text-lg font-semibold text-foreground">
                About this strategy
              </h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best for</h3>
                  <ul className="mt-2 list-inside list-disc text-sm text-foreground">
                    {selectedMeta.bestFor.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths</h3>
                    <ul className="mt-2 list-inside list-disc text-muted-foreground">
                      {selectedMeta.pros.slice(0, 4).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trade-offs</h3>
                    <ul className="mt-2 list-inside list-disc text-muted-foreground">
                      {selectedMeta.cons.slice(0, 3).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
            aria-labelledby="ret-params-heading"
          >
            <h2 id="ret-params-heading" className="text-lg font-semibold text-foreground">
              Core parameters
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Values must satisfy <strong className="font-medium text-foreground">RetrievalConfigSchema</strong> for API
              export and validation.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ret-topk" className="text-sm font-medium text-foreground">
                  Top-K
                </label>
                <input
                  id="ret-topk"
                  type="number"
                  min={1}
                  max={100}
                  value={cfg.topK}
                  onChange={(e) =>
                    patchRetrieval({ topK: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="ret-threshold" className="text-sm font-medium text-foreground">
                  Score threshold (0–1, optional)
                </label>
                <input
                  id="ret-threshold"
                  type="text"
                  inputMode="decimal"
                  placeholder="empty = none"
                  value={cfg.scoreThreshold == null ? '' : String(cfg.scoreThreshold)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v === '') {
                      patchRetrieval({ scoreThreshold: null });
                      return;
                    }
                    const n = Number(v);
                    if (!Number.isFinite(n)) return;
                    patchRetrieval({ scoreThreshold: Math.min(1, Math.max(0, n)) });
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {cfg.strategy === 'hybrid' ? (
              <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                  Hybrid blend (dense vs sparse)
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  α = 1 is pure dense vector search; α = 0 is pure BM25-style sparse retrieval (when your stack
                  supports both).
                </p>
                <div className="mt-3">
                  <label htmlFor="ret-alpha" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Alpha (α)
                  </label>
                  <input
                    id="ret-alpha"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.hybridSearch?.alpha ?? 0.5}
                    onChange={(e) =>
                      patchRetrieval({
                        hybridSearch: {
                          alpha: Number(e.target.value),
                          fusion: cfg.hybridSearch?.fusion ?? 'rrf',
                        },
                      })
                    }
                    className="mt-2 w-full accent-primary-600"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current: <span className="font-mono text-foreground">{(cfg.hybridSearch?.alpha ?? 0.5).toFixed(2)}</span>
                  </p>
                </div>
                <div className="mt-4">
                  <label htmlFor="ret-hybrid-fusion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fusion mode
                  </label>
                  <select
                    id="ret-hybrid-fusion"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    value={cfg.hybridSearch?.fusion ?? 'rrf'}
                    onChange={(e) =>
                      patchRetrieval({
                        hybridSearch: {
                          alpha: cfg.hybridSearch?.alpha ?? 0.5,
                          fusion: e.target.value as 'rrf' | 'weighted',
                        },
                      })
                    }
                  >
                    <option value="rrf">Reciprocal rank fusion (RRF)</option>
                    <option value="weighted">Weighted score blend</option>
                  </select>
                </div>
              </div>
            ) : null}

            {cfg.strategy === 'parent-child' ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ret-child" className="text-sm font-medium text-foreground">
                    Child chunk size (indexed)
                  </label>
                  <input
                    id="ret-child"
                    type="number"
                    min={64}
                    max={4096}
                    value={cfg.parentChildConfig?.childChunkSize ?? 256}
                    onChange={(e) =>
                      patchRetrieval({
                        parentChildConfig: {
                          childChunkSize: Math.min(4096, Math.max(64, Number(e.target.value) || 256)),
                          parentChunkSize: cfg.parentChildConfig?.parentChunkSize ?? 1024,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="ret-parent" className="text-sm font-medium text-foreground">
                    Parent chunk size (returned)
                  </label>
                  <input
                    id="ret-parent"
                    type="number"
                    min={512}
                    max={4096}
                    value={cfg.parentChildConfig?.parentChunkSize ?? 1024}
                    onChange={(e) =>
                      patchRetrieval({
                        parentChildConfig: {
                          childChunkSize: cfg.parentChildConfig?.childChunkSize ?? 256,
                          parentChunkSize: Math.min(4096, Math.max(512, Number(e.target.value) || 1024)),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            ) : null}

            {cfg.strategy === 'multi-query' ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ret-nvar" className="text-sm font-medium text-foreground">
                    Query variants (2–10)
                  </label>
                  <input
                    id="ret-nvar"
                    type="number"
                    min={2}
                    max={10}
                    value={cfg.multiQueryConfig?.numVariants ?? 3}
                    onChange={(e) =>
                      patchRetrieval({
                        multiQueryConfig: {
                          numVariants: Math.min(10, Math.max(2, Number(e.target.value) || 2)),
                          llmModel: cfg.multiQueryConfig?.llmModel ?? 'gpt-4o-mini',
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="ret-llm" className="text-sm font-medium text-foreground">
                    Variant LLM model id
                  </label>
                  <input
                    id="ret-llm"
                    type="text"
                    autoComplete="off"
                    value={cfg.multiQueryConfig?.llmModel ?? ''}
                    onChange={(e) =>
                      patchRetrieval({
                        multiQueryConfig: {
                          numVariants: cfg.multiQueryConfig?.numVariants ?? 3,
                          llmModel: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </div>
            ) : null}

            {cfg.strategy === 'mmr' ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ret-mmr-fetch" className="text-sm font-medium text-foreground">
                    Fetch-K (candidate pool)
                  </label>
                  <input
                    id="ret-mmr-fetch"
                    type="number"
                    min={5}
                    max={200}
                    value={cfg.mmrFetchK ?? 20}
                    onChange={(e) =>
                      patchRetrieval({
                        mmrFetchK: Math.min(200, Math.max(5, Number(e.target.value) || 20)),
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Must be ≥ top-K.</p>
                </div>
                <div>
                  <label htmlFor="ret-mmr-lambda" className="text-sm font-medium text-foreground">
                    λ relevance vs diversity
                  </label>
                  <input
                    id="ret-mmr-lambda"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.mmrLambdaMult ?? 0.5}
                    onChange={(e) =>
                      patchRetrieval({
                        mmrLambdaMult: Number(e.target.value),
                      })
                    }
                    className="mt-2 w-full accent-primary-600"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current λ: <span className="font-mono text-foreground">{(cfg.mmrLambdaMult ?? 0.5).toFixed(2)}</span>
                  </p>
                </div>
              </div>
            ) : null}

            {cfg.strategy === 'ensemble' ? (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Member strategies</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each member runs in parallel; results are fused with RRF. Hybrid requires a sparse corpus at query
                    time.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ENSEMBLE_MEMBERS.map((m) => {
                      const cur = cfg.ensembleStrategies ?? ['similarity', 'hybrid'];
                      const active = cur.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const has = cur.includes(m.id);
                            const next = has ? cur.filter((x) => x !== m.id) : [...cur, m.id];
                            if (next.length < 1) return;
                            patchRetrieval({ ensembleStrategies: next });
                          }}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            active
                              ? 'border-primary-600 bg-primary-50 text-primary-900 dark:bg-primary-950/40 dark:text-primary-100'
                              : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                          )}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label htmlFor="ret-rrf-k" className="text-sm font-medium text-foreground">
                    RRF smoothing k
                  </label>
                  <input
                    id="ret-rrf-k"
                    type="number"
                    min={1}
                    max={120}
                    value={cfg.ensembleRrfK ?? 60}
                    onChange={(e) =>
                      patchRetrieval({
                        ensembleRrfK: Math.min(120, Math.max(1, Number(e.target.value) || 60)),
                      })
                    }
                    className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section
            className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
            aria-labelledby="ret-meta-filters-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="ret-meta-filters-heading" className="text-lg font-semibold text-foreground">
                  Metadata filters
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Restrict retrieval by chunk metadata. Use comma-separated values for <code className="rounded bg-muted px-1">in</code> /{' '}
                  <code className="rounded bg-muted px-1">nin</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={addFilter}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
              >
                Add filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No filters — all indexed chunks are eligible.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {filters.map((f, i) => (
                  <div
                    key={`filter-${i}-${f.key}`}
                    className="grid gap-2 rounded-lg border border-border bg-muted/10 p-3 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-xs font-medium text-muted-foreground">Key</label>
                      <input
                        type="text"
                        value={f.key}
                        onChange={(e) => updateFilterRow(i, { key: e.target.value })}
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs font-medium text-muted-foreground">Operator</label>
                      <select
                        value={f.operator}
                        onChange={(e) => {
                          const op = e.target.value as FilterOperator;
                          updateFilterRow(i, {
                            operator: op,
                            value: op === 'in' || op === 'nin' ? [] : f.value,
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <label className="text-xs font-medium text-muted-foreground">Value</label>
                      <input
                        type="text"
                        value={formatFilterValue(f.value)}
                        onChange={(e) =>
                          updateFilterRow(i, { value: parseFilterValue(f.operator, e.target.value) })
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm"
                        placeholder={f.operator === 'in' || f.operator === 'nin' ? 'a, b, c' : ''}
                      />
                    </div>
                    <div className="flex justify-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeFilter(i)}
                        className="text-xs font-medium text-destructive hover:underline"
                        aria-label={`Remove filter ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!retrievalValidation.success ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <p className="font-medium">Retrieval configuration needs adjustment</p>
              <ul className="mt-2 list-inside list-disc text-xs">
                {retrievalValidation.error.issues.slice(0, 8).map((issue) => (
                  <li key={issue.path.join('.')}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Filter className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span>
                Retrieval settings are valid and stored on your pipeline draft. Vector stage:{' '}
                <strong className="font-medium text-foreground">{draft.stages.vectorStore?.provider ?? '—'}</strong> · index{' '}
                <strong className="font-mono text-foreground">{draft.stages.vectorStore?.indexName ?? '—'}</strong>
              </span>
            </p>
          )}

          {rerankingSection}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>
              Project home: <Link href={ROUTES.home} className="font-medium text-primary-600 hover:underline dark:text-primary-400">back</Link>
            </span>
          </p>
        </>
      )}
    </div>
  );
}
