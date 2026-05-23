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
  patch: Partial<EmbeddingConfig>,
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
    [updateStages],
  );

  const patchEmbedding = useCallback(
    (patch: Partial<EmbeddingConfig>) => {
      setEmbedding(mergeEmbedding(draft.stages.embedding, patch));
    },
    [draft.stages.embedding, setEmbedding],
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
      const hay = [m.id, m.name, m.description, ...(m.bestFor ?? []), ...(m.languageSupport ?? [])]
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

  /** Keep the active catalog row visible when filters would exclude it so the selection never disappears. */
  const pinnedSelectionId = useMemo(() => {
    const m = getEmbeddingModelMeta(cfg.model);
    if (!m) return undefined;
    if (filteredModels.some((x) => x.id === m.id)) return undefined;
    return m.id;
  }, [filteredModels, cfg.model]);

  const displayModels = useMemo(() => {
    const m = getEmbeddingModelMeta(cfg.model);
    if (!m) return filteredModels;
    if (filteredModels.some((x) => x.id === m.id)) return filteredModels;
    return [m, ...filteredModels];
  }, [filteredModels, cfg.model]);

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
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="emb-filter-heading"
      >
        <h2 id="emb-filter-heading" className="text-foreground text-lg font-semibold">
          Discover & filter
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Search and narrow models from{' '}
          <code className="bg-muted rounded px-1">data/models/embeddings.json</code>. Your choice
          updates <strong className="text-foreground font-medium">draft.stages.embedding</strong>{' '}
          for exports and APIs.
        </p>

        <div className="mt-4">
          <label htmlFor="emb-search" className="sr-only">
            Search embedding models
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="emb-search"
              type="search"
              placeholder="Search by name, id, description, languages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="emb-filter-provider"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Provider
            </label>
            <select
              id="emb-filter-provider"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
            <label
              htmlFor="emb-filter-tier"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Tier
            </label>
            <select
              id="emb-filter-tier"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
            <label
              htmlFor="emb-filter-quality"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Quality
            </label>
            <select
              id="emb-filter-quality"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
            <label
              htmlFor="emb-filter-speed"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Speed
            </label>
            <select
              id="emb-filter-speed"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
            <label
              htmlFor="emb-filter-oss"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Open source
            </label>
            <select
              id="emb-filter-oss"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
                hideDeprecated
                  ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30'
                  : 'border-border bg-muted/30',
              )}
            >
              <span>Hide deprecated models</span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  hideDeprecated ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted',
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'bg-background pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full shadow transition',
                    hideDeprecated ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </span>
            </button>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
          Showing {filteredModels.length} of {allModels.length} models
          {filteredModels.length === 0 ? ' — relax filters or clear search.' : '.'}
          {pinnedSelectionId ? (
            <>
              {' '}
              Your current selection is pinned at the top because it does not match the active
              filters.
            </>
          ) : null}
        </p>
      </section>

      <div role="radiogroup" aria-label="Embedding model" className="grid gap-4 sm:grid-cols-2">
        {displayModels.map((m) => {
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
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-600 bg-primary-600/[0.06] ring-primary-600 dark:bg-primary-500/10 ring-2'
                  : 'bg-card hover:border-primary-400/60 hover:bg-accent/40 border-neutral-200 dark:border-neutral-700',
                m.deprecated && !selected ? 'opacity-80' : '',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                    selected
                      ? 'border-primary-600 text-primary-700 dark:text-primary-200'
                      : 'border-muted',
                  )}
                  aria-hidden
                >
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-semibold">{m.name}</span>
                    {m.id === pinnedSelectionId ? (
                      <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                        Current · outside filters
                      </span>
                    ) : null}
                    {m.deprecated ? (
                      <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                        Deprecated
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        tierBadgeStyles(m.tier),
                      )}
                    >
                      {m.tier}
                    </span>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        qualityBadgeStyles(m.quality),
                      )}
                    >
                      {m.quality}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{m.description}</p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
                      : 'border-muted bg-muted/50 text-transparent',
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
          className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
          aria-labelledby="emb-detail-heading"
        >
          <h2 id="emb-detail-heading" className="text-foreground text-lg font-semibold">
            About this model
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Best for
              </h3>
              <ul className="text-foreground mt-2 list-inside list-disc text-sm">
                {selectedMeta.bestFor.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 text-sm">
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">MTEB score</span>
                <span className="font-medium tabular-nums">{selectedMeta.mtebScore}</span>
              </div>
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Cost / 1M tokens (USD)</span>
                <span className="font-medium tabular-nums">{selectedMeta.costPer1MTokens}</span>
              </div>
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Max input tokens</span>
                <span className="font-medium tabular-nums">{selectedMeta.maxTokens}</span>
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
                  <span
                    className="max-w-[60%] truncate text-right font-mono text-xs"
                    title={selectedMeta.modelCard}
                  >
                    {selectedMeta.modelCard}
                  </span>
                </div>
              ) : null}
              {selectedMeta.inputTypes?.length ? (
                <div className="pt-1">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Input types
                  </span>
                  <p className="text-foreground mt-1 text-xs">
                    {selectedMeta.inputTypes.join(', ')}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="emb-params-heading"
      >
        <h2 id="emb-params-heading" className="text-foreground text-lg font-semibold">
          Inference parameters
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Batch size is bounded by{' '}
          <strong className="text-foreground font-medium">EmbeddingConfigSchema</strong> (1–2048).
          Dimensions and provider come from the catalog entry for the selected model id.
        </p>
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="emb-batch" className="text-foreground text-sm font-medium">
              Batch size
            </label>
            <span className="text-muted-foreground text-sm tabular-nums">{batchSize}</span>
          </div>
          <input
            id="emb-batch"
            type="range"
            min={batchMin}
            max={batchMax}
            step={1}
            value={Math.min(batchMax, Math.max(batchMin, batchSize))}
            onChange={(e) => patchEmbedding({ batchSize: Number(e.target.value) })}
            className="accent-primary-600 h-2 w-full cursor-pointer"
          />
        </div>

        <div className="border-border bg-muted/15 mt-6 space-y-4 rounded-lg border px-3 py-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={Boolean(cfg.cacheEmbeddings)}
              onChange={(e) => patchEmbedding({ cacheEmbeddings: e.target.checked })}
              className="border-input mt-1 rounded"
            />
            <span>
              <span className="text-foreground font-medium">Cache embeddings</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                When enabled, the API embedding layer reuses Redis or in-memory vectors for
                identical text + model fingerprints.
              </span>
            </span>
          </label>
          <div>
            <label htmlFor="emb-version" className="text-foreground text-sm font-medium">
              Embedding version tag (optional)
            </label>
            <input
              id="emb-version"
              type="text"
              maxLength={64}
              placeholder="e.g. 2026-05-embed-v2"
              value={cfg.embeddingVersion ?? ''}
              onChange={(e) =>
                patchEmbedding({
                  embeddingVersion:
                    e.target.value.trim() === '' ? undefined : e.target.value.trim(),
                })
              }
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full max-w-md rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Stored on chunk metadata at index time when your worker uses the shared embedding
              service.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Model id</dt>
            <dd className="text-foreground mt-1 font-mono text-xs">{cfg.model}</dd>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Provider</dt>
            <dd className="text-foreground mt-1">{PROVIDER_LABEL[cfg.provider] ?? cfg.provider}</dd>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Dimensions</dt>
            <dd className="text-foreground mt-1 tabular-nums">{cfg.dimensions}</dd>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">
              Max tokens (catalog)
            </dt>
            <dd className="text-foreground mt-1 tabular-nums">{cfg.maxTokens ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {!validation.success ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          <p className="font-medium">Configuration needs adjustment</p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {validation.error.issues.slice(0, 8).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground flex items-start gap-2 text-xs" aria-live="polite">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span>
            Embedding settings are valid and saved with your pipeline draft (local storage). Vector
            index dimensionality must match{' '}
            <strong className="text-foreground font-medium">{cfg.dimensions}</strong> when you
            provision the store.
          </span>
        </p>
      )}
    </div>
  );
}
