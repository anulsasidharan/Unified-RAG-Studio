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
  patch: Partial<typeof DEFAULT_VS>,
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
    [updateStages],
  );

  const patchVectorStore = useCallback(
    (patch: Partial<typeof DEFAULT_VS>) => {
      setVectorStore(mergeVectorStore(draft.stages.vectorStore, patch));
    },
    [draft.stages.vectorStore, setVectorStore],
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
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="vs-filter-heading"
      >
        <h2 id="vs-filter-heading" className="text-foreground text-lg font-semibold">
          Discover & filter
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse <code className="bg-muted rounded px-1">data/vector-stores.json</code> and choose a
          backend. Selection updates{' '}
          <strong className="text-foreground font-medium">draft.stages.vectorStore</strong> for
          exports and APIs.
        </p>

        <div className="mt-4">
          <label htmlFor="vs-search" className="sr-only">
            Search vector stores
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="vs-search"
              type="search"
              placeholder="Search by name, id, description, best-for…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="vs-filter-type"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Deployment type
            </label>
            <select
              id="vs-filter-type"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Cloud native
            </label>
            <select
              id="vs-filter-cloud"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
                hybridOnly
                  ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30'
                  : 'border-border bg-muted/30',
              )}
            >
              <span>Hybrid search capable only</span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  hybridOnly ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted',
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'bg-background pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full shadow transition',
                    hybridOnly ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </span>
            </button>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
          Showing {filteredStores.length} of {allStores.length} stores
          {filteredStores.length === 0 ? ' — relax filters or clear search.' : '.'}
          {pinnedSelectionId ? (
            <>
              {' '}
              Your current selection is pinned at the top because it does not match the active
              filters.
            </>
          ) : null}
        </p>
      </section>

      <div
        role="radiogroup"
        aria-label="Vector store provider"
        className="grid gap-4 sm:grid-cols-2"
      >
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
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-600 bg-primary-600/[0.06] ring-primary-600 dark:bg-primary-500/10 ring-2'
                  : 'bg-card hover:border-primary-400/60 hover:bg-accent/40 border-neutral-200 dark:border-neutral-700',
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
                  <Database className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-semibold">{s.name}</span>
                    {s.id === pinnedSelectionId ? (
                      <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                        Current · outside filters
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        typeBadgeStyles(s.type),
                      )}
                    >
                      {s.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{s.description}</p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {s.cloudNative.aws ? (
                      <span className="border-border bg-muted/40 rounded border px-1.5 py-0.5">
                        AWS
                      </span>
                    ) : null}
                    {s.cloudNative.gcp ? (
                      <span className="border-border bg-muted/40 rounded border px-1.5 py-0.5">
                        GCP
                      </span>
                    ) : null}
                    {s.cloudNative.azure ? (
                      <span className="border-border bg-muted/40 rounded border px-1.5 py-0.5">
                        Azure
                      </span>
                    ) : null}
                    {s.cloudNative.ownCloud ? (
                      <span className="border-border bg-muted/40 rounded border px-1.5 py-0.5">
                        Self-managed
                      </span>
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
          aria-labelledby="vs-detail-heading"
        >
          <h2 id="vs-detail-heading" className="text-foreground text-lg font-semibold">
            About this store
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
              <div>
                <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Strengths
                </h3>
                <ul className="text-muted-foreground mt-2 list-inside list-disc">
                  {selectedMeta.pros.slice(0, 4).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Trade-offs
                </h3>
                <ul className="text-muted-foreground mt-2 list-inside list-disc">
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
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="vs-params-heading"
      >
        <h2 id="vs-params-heading" className="text-foreground text-lg font-semibold">
          Index & provider settings
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Index name must match{' '}
          <strong className="text-foreground font-medium">VectorStoreConfigSchema</strong>{' '}
          (lowercase letters, numbers, hyphens). Similarity metric options are limited to values
          supported by both the catalog entry and the shared pipeline schema (cosine, euclidean,
          dot).
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="vs-index" className="text-foreground text-sm font-medium">
              Index / collection name
            </label>
            <input
              id="vs-index"
              type="text"
              autoComplete="off"
              value={cfg.indexName}
              onChange={(e) => patchVectorStore({ indexName: e.target.value })}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm shadow-sm outline-none focus-visible:ring-2"
              placeholder="rag-documents"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vs-metric" className="text-foreground text-sm font-medium">
                Similarity metric
              </label>
              <select
                id="vs-metric"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
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
              <label htmlFor="vs-namespace" className="text-foreground text-sm font-medium">
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
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                placeholder="production"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vs-replicas" className="text-foreground text-sm font-medium">
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
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div>
              <label htmlFor="vs-shards" className="text-foreground text-sm font-medium">
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
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="border-border bg-muted/10 rounded-lg border border-dashed p-4">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Cloud placement (optional)
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Non-secret hints for managed deployments; credentials stay in your environment.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="vs-region" className="text-foreground text-xs font-medium">
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
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                  placeholder="us-east-1"
                />
              </div>
              <div>
                <label htmlFor="vs-instance" className="text-foreground text-xs font-medium">
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
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                  placeholder="m7g.large"
                />
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Provider id</dt>
            <dd className="text-foreground mt-1 font-mono text-xs">{cfg.provider}</dd>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">
              Max vectors (catalog)
            </dt>
            <dd className="text-foreground mt-1">{selectedMeta?.maxVectors ?? '—'}</dd>
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
            Vector store settings are valid and saved with your pipeline draft (local storage).
            Provision an index with{' '}
            <strong className="text-foreground font-medium">
              {cfg.configuration.metric ?? 'cosine'}
            </strong>{' '}
            distance and dimension{' '}
            <strong className="text-foreground font-medium">
              {draft.stages.embedding?.dimensions ?? '—'}
            </strong>{' '}
            to match your embedding stage.
          </span>
        </p>
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Box className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span>
          Catalog metrics such as <code className="bg-muted rounded px-1">l2</code> or{' '}
          <code className="bg-muted rounded px-1">ip</code> map to pipeline{' '}
          <strong className="text-foreground font-medium">euclidean</strong> /{' '}
          <strong className="text-foreground font-medium">dot</strong> for export compatibility.
        </span>
      </p>
    </div>
  );
}
