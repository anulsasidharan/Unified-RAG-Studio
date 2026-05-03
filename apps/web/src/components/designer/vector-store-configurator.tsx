'use client';

import { useCallback, useMemo, useState } from 'react';
import { Box, Check, Database, Layers, Search } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import {
  getVectorStoreMeta,
  listVectorStores,
  schemaMetricsForStore,
  vectorStorePatchFromCatalog,
  type VectorStoreCatalogRow,
} from '@/lib/vector-stores-catalog';
import { VectorStoreConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { SimilarityMetric } from '@/types/pipeline';

const DEFAULT_VS = createDefaultPipelineConfiguration().stages.vectorStore;

function mergeVectorStore(
  current: typeof DEFAULT_VS | undefined,
  patch: Partial<typeof DEFAULT_VS>
): typeof DEFAULT_VS {
  const base = current ?? DEFAULT_VS;
  const cfgPatch = patch.configuration;
  const nextConfig = { ...base.configuration, ...cfgPatch };
  if (cfgPatch && 'cloud' in cfgPatch && cfgPatch.cloud === undefined) {
    delete (nextConfig as { cloud?: unknown }).cloud;
  }
  return {
    ...base,
    ...patch,
    configuration: nextConfig,
  };
}

function typeBadgeStyles(t: string): string {
  const x = t.toLowerCase();
  if (x === 'managed') {
    return 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100';
  }
  if (x === 'self-hosted') {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100';
  }
  if (x === 'embedded') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-neutral-200 bg-muted text-muted-foreground';
}

export function VectorStoreConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.vectorStore ?? DEFAULT_VS;

  const setVectorStore = useCallback(
    (next: typeof DEFAULT_VS) => {
      updateStages({ vectorStore: next });
    },
    [updateStages]
  );

  const patchVectorStore = useCallback(
    (patch: Partial<typeof DEFAULT_VS>) => {
      setVectorStore(mergeVectorStore(draft.stages.vectorStore, patch));
    },
    [draft.stages.vectorStore, setVectorStore]
  );

  const validation = useMemo(() => VectorStoreConfigSchema.safeParse(cfg), [cfg]);

  const allStores = useMemo(() => listVectorStores(), []);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cloudFilter, setCloudFilter] = useState<string>('all');
  const [hybridOnly, setHybridOnly] = useState(false);

  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allStores.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (cloudFilter !== 'all') {
        const k = cloudFilter as 'aws' | 'gcp' | 'azure';
        if (!s.cloudNative[k]) return false;
      }
      if (hybridOnly && !s.features.hybridSearch) return false;
      if (!q) return true;
      const hay = [s.id, s.name, s.description, ...(s.bestFor ?? [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [allStores, cloudFilter, hybridOnly, query, typeFilter]);

  const pinnedSelectionId = useMemo(() => {
    const m = getVectorStoreMeta(cfg.provider);
    if (!m) return undefined;
    if (filteredStores.some((x) => x.id === m.id)) return undefined;
    return m.id;
  }, [filteredStores, cfg.provider]);

  const displayStores = useMemo(() => {
    const m = getVectorStoreMeta(cfg.provider);
    if (!m) return filteredStores;
    if (filteredStores.some((x) => x.id === m.id)) return filteredStores;
    return [m, ...filteredStores];
  }, [filteredStores, cfg.provider]);

  const selectedMeta = useMemo(() => getVectorStoreMeta(cfg.provider), [cfg.provider]);

  const metricOptions = useMemo((): SimilarityMetric[] => {
    if (!selectedMeta) return ['cosine', 'dot', 'euclidean'];
    return [...schemaMetricsForStore(selectedMeta)].sort();
  }, [selectedMeta]);

  const selectStore = (entry: VectorStoreCatalogRow) => {
    const patch = vectorStorePatchFromCatalog(entry.id, cfg);
    if (patch) {
      setVectorStore(mergeVectorStore(draft.stages.vectorStore, patch));
    }
  };

  const cloudRegion = cfg.configuration.cloud?.region ?? '';
  const cloudInstance = cfg.configuration.cloud?.instanceType ?? '';

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="vs-filter-heading"
      >
        <h2 id="vs-filter-heading" className="text-lg font-semibold text-foreground">
          Discover & filter
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse <code className="rounded bg-muted px-1">data/vector-stores.json</code> and choose a backend. Selection
          updates <strong className="font-medium text-foreground">draft.stages.vectorStore</strong> for exports and APIs.
        </p>

        <div className="mt-4">
          <label htmlFor="vs-search" className="sr-only">
            Search vector stores
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="vs-search"
              type="search"
              placeholder="Search by name, id, description, best-for…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="vs-filter-type"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Deployment type
            </label>
            <select
              id="vs-filter-type"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="managed">Managed</option>
              <option value="self-hosted">Self-hosted</option>
              <option value="embedded">Embedded</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="vs-filter-cloud"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Cloud native
            </label>
            <select
              id="vs-filter-cloud"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={cloudFilter}
              onChange={(e) => setCloudFilter(e.target.value)}
            >
              <option value="all">Any region</option>
              <option value="aws">AWS</option>
              <option value="gcp">GCP</option>
              <option value="azure">Azure</option>
            </select>
          </div>
          <div className="flex flex-col justify-end lg:col-span-2">
            <button
              type="button"
              role="switch"
              aria-checked={hybridOnly}
              onClick={() => setHybridOnly((v) => !v)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                hybridOnly ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30' : 'border-border bg-muted/30'
              )}
            >
              <span>Hybrid search capable only</span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  hybridOnly ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted'
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full bg-background shadow transition',
                    hybridOnly ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </span>
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          Showing {filteredStores.length} of {allStores.length} stores
          {filteredStores.length === 0 ? ' — relax filters or clear search.' : '.'}
          {pinnedSelectionId ? (
            <>
              {' '}
              Your current selection is pinned at the top because it does not match the active filters.
            </>
          ) : null}
        </p>
      </section>

      <div role="radiogroup" aria-label="Vector store provider" className="grid gap-4 sm:grid-cols-2">
        {displayStores.map((s) => {
          const selected = cfg.provider === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectStore(s)}
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
                  <Database className="h-5 w-5" />
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
                        typeBadgeStyles(s.type)
                      )}
                    >
                      {s.type}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    {s.cloudNative.aws ? (
                      <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">AWS</span>
                    ) : null}
                    {s.cloudNative.gcp ? (
                      <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">GCP</span>
                    ) : null}
                    {s.cloudNative.azure ? (
                      <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">Azure</span>
                    ) : null}
                    {s.cloudNative.ownCloud ? (
                      <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">Self-managed</span>
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
          aria-labelledby="vs-detail-heading"
        >
          <h2 id="vs-detail-heading" className="text-lg font-semibold text-foreground">
            About this store
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
        aria-labelledby="vs-params-heading"
      >
        <h2 id="vs-params-heading" className="text-lg font-semibold text-foreground">
          Index & provider settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Index name must match <strong className="font-medium text-foreground">VectorStoreConfigSchema</strong>{' '}
          (lowercase letters, numbers, hyphens). Similarity metric options are limited to values supported by both the
          catalog entry and the shared pipeline schema (cosine, euclidean, dot).
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="vs-index" className="text-sm font-medium text-foreground">
              Index / collection name
            </label>
            <input
              id="vs-index"
              type="text"
              autoComplete="off"
              value={cfg.indexName}
              onChange={(e) => patchVectorStore({ indexName: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="rag-documents"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vs-metric" className="text-sm font-medium text-foreground">
                Similarity metric
              </label>
              <select
                id="vs-metric"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                value={cfg.configuration.metric ?? metricOptions[0] ?? 'cosine'}
                onChange={(e) =>
                  patchVectorStore({
                    configuration: {
                      ...cfg.configuration,
                      metric: e.target.value as SimilarityMetric,
                    },
                  })
                }
              >
                {metricOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vs-namespace" className="text-sm font-medium text-foreground">
                Namespace (optional)
              </label>
              <input
                id="vs-namespace"
                type="text"
                autoComplete="off"
                value={cfg.configuration.namespace ?? ''}
                onChange={(e) =>
                  patchVectorStore({
                    configuration: {
                      ...cfg.configuration,
                      namespace: e.target.value || undefined,
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="production"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vs-replicas" className="text-sm font-medium text-foreground">
                Replicas
              </label>
              <input
                id="vs-replicas"
                type="number"
                min={1}
                step={1}
                value={cfg.configuration.replicas ?? 1}
                onChange={(e) =>
                  patchVectorStore({
                    configuration: {
                      ...cfg.configuration,
                      replicas: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="vs-shards" className="text-sm font-medium text-foreground">
                Shards
              </label>
              <input
                id="vs-shards"
                type="number"
                min={1}
                step={1}
                value={cfg.configuration.shards ?? 1}
                onChange={(e) =>
                  patchVectorStore({
                    configuration: {
                      ...cfg.configuration,
                      shards: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cloud placement (optional)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Non-secret hints for managed deployments; credentials stay in your environment.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="vs-region" className="text-xs font-medium text-foreground">
                  Region
                </label>
                <input
                  id="vs-region"
                  type="text"
                  autoComplete="off"
                  value={cloudRegion}
                  onChange={(e) => {
                    const region = e.target.value.trim();
                    const inst = cloudInstance.trim();
                    if (!region && !inst) {
                      patchVectorStore({
                        configuration: { ...cfg.configuration, cloud: undefined },
                      });
                      return;
                    }
                    patchVectorStore({
                      configuration: {
                        ...cfg.configuration,
                        cloud: { region: region || 'us-east-1', instanceType: inst || undefined },
                      },
                    });
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="us-east-1"
                />
              </div>
              <div>
                <label htmlFor="vs-instance" className="text-xs font-medium text-foreground">
                  Instance type
                </label>
                <input
                  id="vs-instance"
                  type="text"
                  autoComplete="off"
                  value={cloudInstance}
                  onChange={(e) => {
                    const instanceType = e.target.value.trim();
                    const reg = cloudRegion.trim();
                    if (!reg && !instanceType) {
                      patchVectorStore({
                        configuration: { ...cfg.configuration, cloud: undefined },
                      });
                      return;
                    }
                    patchVectorStore({
                      configuration: {
                        ...cfg.configuration,
                        cloud: {
                          region: reg || 'us-east-1',
                          instanceType: instanceType || undefined,
                        },
                      },
                    });
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="m7g.large"
                />
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Provider id</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{cfg.provider}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Max vectors (catalog)</dt>
            <dd className="mt-1 text-foreground">{selectedMeta?.maxVectors ?? '—'}</dd>
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
            Vector store settings are valid and saved with your pipeline draft (local storage). Provision an index with{' '}
            <strong className="font-medium text-foreground">{cfg.configuration.metric ?? 'cosine'}</strong> distance and
            dimension <strong className="font-medium text-foreground">{draft.stages.embedding?.dimensions ?? '—'}</strong>{' '}
            to match your embedding stage.
          </span>
        </p>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Box className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span>
          Catalog metrics such as <code className="rounded bg-muted px-1">l2</code> or{' '}
          <code className="rounded bg-muted px-1">ip</code> map to pipeline{' '}
          <strong className="font-medium text-foreground">euclidean</strong> /{' '}
          <strong className="font-medium text-foreground">dot</strong> for export compatibility.
        </span>
      </p>
    </div>
  );
}
