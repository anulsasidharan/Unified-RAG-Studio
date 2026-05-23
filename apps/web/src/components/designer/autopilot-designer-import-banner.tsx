'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { AutopilotImportSnapshot } from '@/stores/designer-store';

function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function MetricTile({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-lg border border-emerald-200/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-emerald-900/50 dark:bg-neutral-950/80">
      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
    </div>
  );
}

export function AutopilotDesignerImportBanner({
  className,
  snapshot,
}: Readonly<{
  className?: string;
  snapshot: AutopilotImportSnapshot;
}>) {
  const m = snapshot.metrics;
  const autopilotHref = `${ROUTES.autopilotNew}?build=${encodeURIComponent(snapshot.buildId)}`;

  return (
    <section
      className={cn(
        'rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-white p-5 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-neutral-950 dark:to-neutral-950',
        className,
      )}
      aria-label="Autopilot import summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm dark:bg-emerald-500">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Visualizing Autopilot results in Designer
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              This draft was loaded from Autopilot build{' '}
              <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
                {snapshot.buildId.slice(0, 8)}…
              </span>
              . The pipeline graph and cost strips below reflect this configuration. Scroll to the
              live diagram or jump back to the build for full logs.
            </p>
          </div>
        </div>
        <Link
          href={autopilotHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Open Autopilot build
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Faithfulness" value={fmtPct(m?.faithfulness)} />
        <MetricTile label="Answer relevance" value={fmtPct(m?.answerRelevance)} />
        <MetricTile label="Context precision" value={fmtPct(m?.contextPrecision)} />
        <MetricTile label="Context recall" value={fmtPct(m?.contextRecall)} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MetricTile
          label="Avg latency (eval proxy)"
          value={
            m?.avgLatencyMs !== undefined && Number.isFinite(m.avgLatencyMs)
              ? `${m.avgLatencyMs.toFixed(0)} ms`
              : '—'
          }
        />
        <MetricTile
          label="Optimisation passes"
          value={snapshot.totalIterations != null ? String(snapshot.totalIterations) : '—'}
        />
      </div>
    </section>
  );
}
