'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Layers, Search, Sparkles } from 'lucide-react';

import {
  embeddingConfigFromCatalogEntry,
  getEmbeddingModelMeta,
  listEmbeddingModels,
} from '@/lib/embeddings-catalog';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { EmbeddingConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { EmbeddingModel } from '@/types/models';
import type { EmbeddingConfig } from '@/types/pipeline';

const DEFAULT_EMBEDDING = createDefaultPipelineConfiguration().stages.embedding;

function mergeEmbedding(
  current: EmbeddingConfig | undefined,
  patch: Partial<EmbeddingConfig>
): EmbeddingConfig {
  const base = current ?? DEFAULT_EMBEDDING;
  return { ...base, ...patch };
}

function tierBadgeStyles(tier: string): string {
  const t = tier.toLowerCase();
  if (t === 'advanced') {
    return 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100';
  }
  if (t === 'fast') {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100';
  }
  return 'border-neutral-200 bg-muted text-muted-foreground';
}

function qualityBadgeStyles(q: string): string {
  const x = q.toLowerCase();
  if (x === 'excellent') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  }
  if (x === 'good') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-neutral-200 bg-muted text-muted-foreground';
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  cohere: 'Cohere',
  google: 'Google',
  huggingface: 'Hugging Face',
  nomic: 'Nomic',
  custom: 'Custom',
};

export function EmbeddingConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.embedding ?? DEFAULT_EMBEDDING;

  const setEmbedding = useCallback(
    (next: EmbeddingConfig) => {
      updateStages({ embedding: next });
    },
    [updateStages]
  );

  const patchEmbedding = useCallback(
    (patch: Partial<EmbeddingConfig>) => {
      setEmbedding(mergeEmbedding(draft.stages.embedding, patch));
    },
    [draft.stages.embedding, setEmbedding]
  );

  const validation = useMemo(() => EmbeddingConfigSchema.safeParse(cfg), [cfg]);

  const allModels = useMemo(() => listEmbeddingModels(), []);

  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [speedFilter, setSpeedFilter] = useState<string>('all');
  const [openSourceFilter, setOpenSourceFilter] = useState<string>('all');
  const [hideDeprecated, setHideDeprecated] = useState(true);

  const providerOptions = useMemo(() => {
    const set = new Set(allModels.map((m) => m.provider));
    return Array.from(set).sort();
  }, [allModels]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allModels.filter((m) => {
      if (hideDeprecated && m.deprecated) return false;
      if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
      if (tierFilter !== 'all' && m.tier !== tierFilter) return false;
      if (qualityFilter !== 'all' && m.quality !== qualityFilter) return false;
      if (speedFilter !== 'all' && m.speed !== speedFilter) return false;
      if (openSourceFilter === 'yes' && !m.openSource) return false;
      if (openSourceFilter === 'no' && m.openSource) return false;
      if (!q) return true;
      const hay = [
        m.id,
        m.name,
        m.description,
        ...(m.bestFor ?? []),
        ...(m.languageSupport ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    allModels,
    hideDeprecated,
    providerFilter,
    tierFilter,
    qualityFilter,
    speedFilter,
    openSourceFilter,
    query,
  ]);

  const selectedMeta = useMemo(() => getEmbeddingModelMeta(cfg.model), [cfg.model]);

  const selectModel = (entry: EmbeddingModel) => {
    const fromCat = embeddingConfigFromCatalogEntry(entry.id, {
      batchSize: draft.stages.embedding?.batchSize ?? DEFAULT_EMBEDDING.batchSize ?? 100,
    });
    if (fromCat) {
      setEmbedding(mergeEmbedding(draft.stages.embedding, fromCat));
    }
  };

  const batchMax = 2048;
  const batchMin = 1;
  const batchSize = cfg.batchSize ?? DEFAULT_EMBEDDING.batchSize ?? 100;

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="emb-filter-heading"
      >
        <h2 id="emb-filter-heading" className="text-lg font-semibold text-foreground">
          Discover & filter
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search and narrow models from <code className="rounded bg-muted px-1">data/models/embeddings.json</code>. Your
          choice updates <strong className="font-medium text-foreground">draft.stages.embedding</strong> for exports and
          APIs.
        </p>

        <div className="mt-4">
          <label htmlFor="emb-search" className="sr-only">
            Search embedding models
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="emb-search"
              type="search"
              placeholder="Search by name, id, description, languages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="emb-filter-provider" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Provider
            </label>
            <select
              id="emb-filter-provider"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="all">All providers</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p] ?? p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="emb-filter-tier" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tier
            </label>
            <select
              id="emb-filter-tier"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="all">All tiers</option>
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label htmlFor="emb-filter-quality" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quality
            </label>
            <select
              id="emb-filter-quality"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </select>
          </div>
          <div>
            <label htmlFor="emb-filter-speed" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Speed
            </label>
            <select
              id="emb-filter-speed"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={speedFilter}
              onChange={(e) => setSpeedFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="very-fast">Very fast</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
            </select>
          </div>
          <div>
            <label htmlFor="emb-filter-oss" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open source
            </label>
            <select
              id="emb-filter-oss"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={openSourceFilter}
              onChange={(e) => setOpenSourceFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="yes">Open source only</option>
              <option value="no">Proprietary only</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button
              type="button"
              role="switch"
              aria-checked={hideDeprecated}
              onClick={() => setHideDeprecated((v) => !v)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                hideDeprecated ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30' : 'border-border bg-muted/30'
              )}
            >
              <span>Hide deprecated models</span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  hideDeprecated ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted'
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full bg-background shadow transition',
                    hideDeprecated ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </span>
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          Showing {filteredModels.length} of {allModels.length} models
          {filteredModels.length === 0 ? ' — relax filters or clear search.' : '.'}
        </p>
      </section>

      <div
        role="radiogroup"
        aria-label="Embedding model"
        className="grid gap-4 sm:grid-cols-2"
      >
        {filteredModels.map((m) => {
          const selected = cfg.model === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectModel(m)}
              className={cn(
                'flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-600 bg-primary-600/[0.06] ring-2 ring-primary-600 dark:bg-primary-500/10'
                  : 'border-neutral-200 bg-card hover:border-primary-400/60 hover:bg-accent/40 dark:border-neutral-700',
                m.deprecated && !selected ? 'opacity-80' : ''
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
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{m.name}</span>
                    {m.deprecated ? (
                      <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                        Deprecated
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        tierBadgeStyles(m.tier)
                      )}
                    >
                      {m.tier}
                    </span>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        qualityBadgeStyles(m.quality)
                      )}
                    >
                      {m.quality}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">{m.dimensions} dims</span>
                    <span>·</span>
                    <span>{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                    <span>·</span>
                    <span className="capitalize">{m.speed.replace('-', ' ')}</span>
                    {m.openSource ? (
                      <>
                        <span>·</span>
                        <span>Open source</span>
                      </>
                    ) : null}
                  </div>
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
          aria-labelledby="emb-detail-heading"
        >
          <h2 id="emb-detail-heading" className="text-lg font-semibold text-foreground">
            About this model
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
              <div className="flex justify-between gap-2 border-b border-border pb-2">
                <span className="text-muted-foreground">MTEB score</span>
                <span className="tabular-nums font-medium">{selectedMeta.mtebScore}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border pb-2">
                <span className="text-muted-foreground">Cost / 1M tokens (USD)</span>
                <span className="tabular-nums font-medium">{selectedMeta.costPer1MTokens}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border pb-2">
                <span className="text-muted-foreground">Max input tokens</span>
                <span className="tabular-nums font-medium">{selectedMeta.maxTokens}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Languages</span>
                <span className="max-w-[60%] text-right text-xs leading-snug">
                  {selectedMeta.languageSupport.join(', ')}
                </span>
              </div>
              {selectedMeta.modelCard ? (
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-muted-foreground">Model card / HF id</span>
                  <span className="max-w-[60%] truncate text-right font-mono text-xs" title={selectedMeta.modelCard}>
                    {selectedMeta.modelCard}
                  </span>
                </div>
              ) : null}
              {selectedMeta.inputTypes?.length ? (
                <div className="pt-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input types</span>
                  <p className="mt-1 text-xs text-foreground">{selectedMeta.inputTypes.join(', ')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="emb-params-heading"
      >
        <h2 id="emb-params-heading" className="text-lg font-semibold text-foreground">
          Inference parameters
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Batch size is bounded by <strong className="font-medium text-foreground">EmbeddingConfigSchema</strong> (1–2048).
          Dimensions and provider come from the catalog entry for the selected model id.
        </p>
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="emb-batch" className="text-sm font-medium text-foreground">
              Batch size
            </label>
            <span className="tabular-nums text-sm text-muted-foreground">{batchSize}</span>
          </div>
          <input
            id="emb-batch"
            type="range"
            min={batchMin}
            max={batchMax}
            step={1}
            value={Math.min(batchMax, Math.max(batchMin, batchSize))}
            onChange={(e) => patchEmbedding({ batchSize: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer accent-primary-600"
          />
        </div>

        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Model id</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{cfg.model}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Provider</dt>
            <dd className="mt-1 text-foreground">{PROVIDER_LABEL[cfg.provider] ?? cfg.provider}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Dimensions</dt>
            <dd className="mt-1 tabular-nums text-foreground">{cfg.dimensions}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Max tokens (catalog)</dt>
            <dd className="mt-1 tabular-nums text-foreground">{cfg.maxTokens ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {!validation.success ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Configuration needs adjustment</p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {validation.error.issues.slice(0, 8).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span>
            Embedding settings are valid and saved with your pipeline draft (local storage). Vector index dimensionality must
            match <strong className="font-medium text-foreground">{cfg.dimensions}</strong> when you provision the store.
          </span>
        </p>
      )}
    </div>
  );
}
