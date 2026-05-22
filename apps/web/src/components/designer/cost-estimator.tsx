'use client';

import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWhenVisible } from '@/hooks/use-when-visible';
import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import { useAuthStore } from '@/stores/auth-store';
import type { CostEstimate, PipelineConfiguration } from '@/types/pipeline';

const DEBOUNCE_MS = 450;

function formatUsd(value: number, maxFractionDigits = 4): string {
  const abs = Math.abs(value);
  const digits = abs >= 1 ? Math.min(2, maxFractionDigits) : maxFractionDigits;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function componentLabel(component: string): string {
  const map: Record<string, string> = {
    embedding: 'Embedding (query path)',
    vector_storage: 'Vector storage',
    retrieval_ops: 'Retrieval / read units',
    reranking: 'Reranking',
    generation: 'Generation',
    query_transforms: 'Query transforms',
    context_compression: 'Context compression',
    observability: 'Observability (logging/trace)',
  };
  return map[component] ?? component.replace(/_/g, ' ');
}

type CostAssumptions = {
  queriesPerMonth: number;
  documentsCount: number;
  avgDocumentTokens: number;
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function CostEstimator({
  className,
  id,
}: Readonly<{
  className?: string;
  /** Optional DOM id for in-page navigation (e.g. Designer Review). */
  id?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [sectionRef, sectionVisible] = useWhenVisible<HTMLElement>();

  const [assumptions, setAssumptions] = useState<CostAssumptions>({
    queriesPerMonth: 100_000,
    documentsCount: 1_000,
    avgDocumentTokens: 500,
  });

  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const firstFetch = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);

  const payloadDigest = useMemo(
    () =>
      JSON.stringify({
        cfg: draft,
        q: assumptions.queriesPerMonth,
        d: assumptions.documentsCount,
        t: assumptions.avgDocumentTokens,
      }),
    [draft, assumptions],
  );

  const fetchEstimate = useCallback(
    async (config: PipelineConfiguration, body: CostAssumptions, signal: AbortSignal) => {
      if (!useAuthStore.getState().accessToken?.trim()) {
        setLoading(false);
        setError('Sign in to load cost estimates.');
        setEstimate(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.post<CostEstimate>(
          '/api/utilities/cost',
          {
            config,
            queriesPerMonth: body.queriesPerMonth,
            documentsCount: body.documentsCount,
            avgDocumentTokens: body.avgDocumentTokens,
          },
          signal,
        );
        if (!signal.aborted) {
          setEstimate(data);
          setLastOkAt(Date.now());
        }
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof ApiError) {
          setError(formatApiErrorForUi(e));
        } else {
          setError(e instanceof Error ? e.message : 'Cost request failed');
        }
        setEstimate(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sectionVisible) return;
    if (!accessToken?.trim()) {
      setLoading(false);
      setError('Sign in to load cost estimates.');
      setEstimate(null);
      return;
    }
    const ctrl = new AbortController();
    const delay = firstFetch.current ? 0 : DEBOUNCE_MS;
    firstFetch.current = false;
    const tid = window.setTimeout(() => {
      void fetchEstimate(draft, assumptions, ctrl.signal);
    }, delay);
    return () => {
      window.clearTimeout(tid);
      ctrl.abort();
    };
    // payloadDigest is a stable hash of draft+assumptions — intentionally used instead of the
    // raw objects to debounce fetches without triggering on every reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadDigest, fetchEstimate, accessToken, sectionVisible]);

  const breakdown = estimate?.breakdown ?? [];

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn(
        'w-full shrink-0 scroll-mt-4 border-t border-neutral-200 bg-white py-6 dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
      aria-labelledby="cost-estimator-heading"
    >
      <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary-100 dark:bg-primary-950/40 flex h-8 w-8 items-center justify-center rounded-lg">
              <Calculator className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
            </div>
            <div>
              <h2
                id="cost-estimator-heading"
                className="font-display text-sm font-bold text-neutral-900 dark:text-neutral-50"
              >
                Cost estimate
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Live heuristic · updates with draft
              </p>
            </div>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Updating…
              </span>
            ) : lastOkAt ? (
              <span className="tabular-nums">
                Updated {new Date(lastOkAt).toLocaleTimeString()}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const ctrl = new AbortController();
                void fetchEstimate(draft, assumptions, ctrl.signal);
              }}
              className="hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              title="Refresh estimate now"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Workload assumptions
            </p>
            <div>
              <label
                htmlFor="cost-qpm"
                className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Queries / month
              </label>
              <input
                id="cost-qpm"
                type="number"
                min={1}
                max={100_000_000}
                value={assumptions.queriesPerMonth}
                onChange={(e) =>
                  setAssumptions((a) => ({
                    ...a,
                    queriesPerMonth: clampInt(Number(e.target.value), 1, 100_000_000),
                  }))
                }
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="cost-docs"
                className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Documents in corpus
              </label>
              <input
                id="cost-docs"
                type="number"
                min={1}
                max={10_000_000}
                value={assumptions.documentsCount}
                onChange={(e) =>
                  setAssumptions((a) => ({
                    ...a,
                    documentsCount: clampInt(Number(e.target.value), 1, 10_000_000),
                  }))
                }
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="cost-tok"
                className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Avg tokens / document
              </label>
              <input
                id="cost-tok"
                type="number"
                min={1}
                max={500_000}
                value={assumptions.avgDocumentTokens}
                onChange={(e) =>
                  setAssumptions((a) => ({
                    ...a,
                    avgDocumentTokens: clampInt(Number(e.target.value), 1, 500_000),
                  }))
                }
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {error ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
              >
                {error}
              </div>
            ) : null}

            {estimate ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="border-primary-100 from-primary-50 dark:border-primary-900/30 dark:from-primary-950/30 rounded-xl border bg-gradient-to-br to-indigo-50 p-4 dark:to-indigo-950/30">
                    <p className="text-primary-600 dark:text-primary-400 text-xs font-medium">
                      Per query
                    </p>
                    <p className="font-display mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {formatUsd(estimate.perQuery)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 dark:border-indigo-900/30 dark:from-indigo-950/30 dark:to-purple-950/30">
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Monthly total
                    </p>
                    <p className="font-display mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {formatUsd(estimate.perMonth)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Currency
                    </p>
                    <p className="font-display mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
                      {estimate.currency}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Category totals (monthly)
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {(
                      [
                        ['Embedding', estimate.embedding],
                        ['Storage', estimate.storage],
                        ['Retrieval', estimate.retrieval],
                        ['Reranking', estimate.reranking],
                        ['Generation', estimate.generation],
                      ] as const
                    ).map(([label, amt]) => (
                      <li key={label} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          {label}
                        </span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                          <div
                            className="from-primary-500 h-full rounded-full bg-gradient-to-r to-indigo-500"
                            style={{
                              width: `${estimate.perMonth > 0 ? Math.min(100, (100 * amt) / estimate.perMonth) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                          {formatUsd(amt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-muted/30 text-muted-foreground border-b border-neutral-200 text-xs uppercase dark:border-neutral-700">
                      <tr>
                        <th className="px-3 py-2 font-medium">Component</th>
                        <th className="px-3 py-2 font-medium">Unit cost</th>
                        <th className="px-3 py-2 font-medium">Usage</th>
                        <th className="px-3 py-2 font-medium">Monthly</th>
                        <th className="px-3 py-2 font-medium">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((row) => (
                        <tr
                          key={row.component}
                          className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                        >
                          <td className="px-3 py-2 font-medium">{componentLabel(row.component)}</td>
                          <td className="text-muted-foreground px-3 py-2 tabular-nums">
                            {formatUsd(row.unitCost, 6)}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 tabular-nums">
                            {row.estimatedUsage.toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{formatUsd(row.totalCost)}</td>
                          <td className="text-muted-foreground px-3 py-2 tabular-nums">
                            {row.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : !error && loading ? (
              <div className="bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-lg border border-neutral-200 p-6 text-sm dark:border-neutral-700">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Computing estimate…
              </div>
            ) : !error ? (
              <p className="text-muted-foreground text-sm">No estimate yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
