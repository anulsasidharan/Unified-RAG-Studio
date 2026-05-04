'use client';

import { CheckCircle2, ClipboardList, Download, Loader2 } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import type { AutopilotBuild, BuildResult, FinalMetrics } from '@/types/autopilot';

function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">{value}</p>
    </div>
  );
}

export function ResultsSummary({
  className,
  build,
}: Readonly<{
  className?: string;
  build: AutopilotBuild;
}>) {
  const uid = useId();
  const result = build.result as BuildResult | undefined;
  const [downloading, setDownloading] = useState(false);

  const metrics: FinalMetrics | undefined = result?.metrics;

  const jsonBlob = useMemo(() => {
    if (!result) return null;
    return new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' });
  }, [result]);

  const onDownload = useCallback(() => {
    if (!jsonBlob || !build.id) return;
    setDownloading(true);
    try {
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autopilot-build-${build.id.slice(0, 8)}-result.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [build.id, jsonBlob]);

  if (build.status !== 'complete') {
    return null;
  }

  if (!result) {
    return (
      <section
        className={cn(
          'rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
          className
        )}
      >
        <p className="font-medium">Build finished — typed result not available</p>
        <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
          This run was completed before the worker started persisting a normalised{' '}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-950/80">BuildResult</code>. Start a
          new build to populate the results summary and decision explainer.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className
      )}
      aria-labelledby={`${uid}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <h2 id={`${uid}-title`} className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Results summary
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Final evaluation proxies, iteration count, and optional deployment stub for build{' '}
              <span className="font-mono text-xs">{build.id.slice(0, 8)}…</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!jsonBlob || downloading}
          onClick={onDownload}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Download JSON
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Faithfulness" value={fmtPct(metrics?.faithfulness)} />
        <MetricCard label="Answer relevance" value={fmtPct(metrics?.answerRelevance)} />
        <MetricCard label="Context precision" value={fmtPct(metrics?.contextPrecision)} />
        <MetricCard label="Context recall" value={fmtPct(metrics?.contextRecall)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Avg latency (eval proxy)"
          value={
            metrics?.avgLatencyMs !== undefined && Number.isFinite(metrics.avgLatencyMs)
              ? `${metrics.avgLatencyMs.toFixed(0)} ms`
              : '—'
          }
        />
        <MetricCard
          label="Optimisation passes"
          value={result.totalIterations != null ? String(result.totalIterations) : '—'}
        />
      </div>

      {result.deployment ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            <ClipboardList className="h-4 w-4" aria-hidden />
            Deployment (stub)
          </h3>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-medium text-neutral-900 dark:text-neutral-100">{result.deployment.provider}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize text-neutral-900 dark:text-neutral-100">{result.deployment.status}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Endpoint</dt>
              <dd className="break-all font-mono text-[11px] text-neutral-800 dark:text-neutral-200">{result.deployment.endpoint}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {result.config?.name ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Pipeline name: <span className="font-medium text-neutral-700 dark:text-neutral-300">{result.config.name}</span>
        </p>
      ) : null}
    </section>
  );
}
