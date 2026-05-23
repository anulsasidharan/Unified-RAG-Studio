'use client';

import { Activity, BarChart3, Gauge, Timer, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';
import type { AutopilotBuild, DashboardQualitySnapshot, TargetMetrics } from '@/types/autopilot';

type ProgressSample = {
  idx: number;
  progress: number;
  iteration: number;
  ts: string;
};

function formatUsd(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(n);
}

function qualityVsTargetsRows(
  quality: DashboardQualitySnapshot | undefined,
  targets: TargetMetrics,
) {
  const rows: { metric: string; value: number; target: number | null }[] = [];
  const push = (metric: string, v: number | undefined, t: number | undefined) => {
    if (v === undefined) return;
    rows.push({
      metric,
      value: v,
      target: t !== undefined && Number.isFinite(t) ? t : null,
    });
  };
  push('Faithfulness', quality?.faithfulness, targets.faithfulness);
  push('Answer relevance', quality?.answerRelevance, targets.answerRelevance);
  push('Context precision', quality?.contextPrecision, targets.contextPrecision);
  push('Context recall', quality?.contextRecall, targets.contextRecall);
  return rows;
}

export function MetricsDashboard({ className }: Readonly<{ className?: string }>) {
  const activeBuildId = useAutopilotStore((s) => s.activeBuildId);
  const builds = useAutopilotStore((s) => s.builds);
  const build: AutopilotBuild | undefined = activeBuildId ? builds[activeBuildId] : undefined;

  const [progressSeries, setProgressSeries] = useState<ProgressSample[]>([]);

  useEffect(() => {
    setProgressSeries([]);
  }, [activeBuildId]);

  useEffect(() => {
    if (!build) return;
    setProgressSeries((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.progress === build.progress &&
        last.iteration === build.iteration &&
        last.ts === build.updatedAt
      ) {
        return prev;
      }
      const next: ProgressSample[] = [
        ...prev,
        {
          idx: prev.length,
          progress: build.progress,
          iteration: build.iteration,
          ts: build.updatedAt,
        },
      ];
      return next.length > 240 ? next.slice(-240) : next;
    });
  }, [build, build?.progress, build?.iteration, build?.updatedAt]);

  const dm = build?.dashboardMetrics;
  const reqs = build?.input.requirements;

  const qualityRows = useMemo(
    () => qualityVsTargetsRows(dm?.quality, reqs?.targetMetrics ?? {}),
    [dm?.quality, reqs?.targetMetrics],
  );

  const latencyRows = useMemo(
    () =>
      (dm?.embeddingBenchmarks ?? []).map((r) => ({
        model: r.label.length > 28 ? `${r.label.slice(0, 26)}…` : r.label,
        fullLabel: r.label,
        latencyMs: r.latencyMs ?? 0,
        score: r.compositeScore ?? 0,
      })),
    [dm?.embeddingBenchmarks],
  );

  const perfEntries = useMemo(() => {
    const p = dm?.retrieval?.performance;
    if (!p) return [];
    return Object.entries(p).map(([k, v]) => ({ name: k, value: v }));
  }, [dm?.retrieval?.performance]);

  const budget = reqs?.budgetConstraint;
  const latencySlo = reqs?.latencyRequirement;
  const evalLatency = dm?.quality?.avgLatencyMs;

  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Metrics dashboard
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Live <strong>progress</strong> samples from SSE/poll, plus <strong>quality</strong>,{' '}
            <strong>latency</strong>, and <strong>SLO</strong> cards when the API exposes{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              dashboardMetrics
            </code>{' '}
            (orchestrator stage outputs).
          </p>
        </div>
      </div>

      {!activeBuildId || !build ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Select an <strong>Active build</strong> in Build progress. Charts fill as snapshots
          arrive; evaluation and embedding panels appear after the worker persists{' '}
          <strong>stage_outputs</strong> on the build row.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {/* Progress trend */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <Activity className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
              Progress & iteration trend
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Client-side series (last {progressSeries.length} points) — one sample per unique{' '}
              <code className="bg-muted rounded px-1">progress</code> /{' '}
              <code className="bg-muted rounded px-1">iteration</code> /{' '}
              <code className="bg-muted rounded px-1">updatedAt</code> tick.
            </p>
            <div className="mt-4 h-56 w-full min-w-0">
              {progressSeries.length < 2 ? (
                <p className="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm dark:border-neutral-700">
                  Need at least two snapshots for a line — keep the build selected while the job
                  runs.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={progressSeries}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis
                      dataKey="idx"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: 'Sample #',
                        position: 'insideBottom',
                        offset: -4,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      width={36}
                      label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      width={32}
                      label={{ value: 'Iter', angle: 90, position: 'insideRight', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'progress' ? 'Progress %' : 'Iteration',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="progress"
                      name="progress"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="right"
                      type="stepAfter"
                      dataKey="iteration"
                      name="iteration"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* SLO strip */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <Wallet className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
              Cost & latency SLOs
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Budget cap
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {budget !== undefined ? `${formatUsd(budget)} / 1K queries` : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Latency requirement
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {latencySlo !== undefined ? `${latencySlo} ms` : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Eval proxy latency
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {evalLatency !== undefined ? `${evalLatency} ms` : '—'}
                </p>
                {latencySlo !== undefined && evalLatency !== undefined ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    {evalLatency <= latencySlo ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Within SLO</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">Above SLO</span>
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Quality vs targets */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <Gauge className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
              Quality vs targets
              {dm?.quality?.meetsTargets !== undefined ? (
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs font-medium',
                    dm.quality.meetsTargets
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
                  )}
                >
                  Targets met: {String(dm.quality.meetsTargets)}
                </span>
              ) : null}
            </h3>
            <div className="mt-4 h-64 w-full min-w-0">
              {qualityRows.length === 0 ? (
                <p className="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm dark:border-neutral-700">
                  No evaluation metrics in{' '}
                  <code className="bg-muted mx-1 rounded px-1">dashboardMetrics.quality</code> yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={qualityRows}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                      horizontal={false}
                    />
                    <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="metric" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(3), '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="value"
                      name="Observed"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="target"
                      name="Target"
                      fill="#94a3b8"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Embedding latency */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <Timer className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
              Embedding benchmark latency
              {dm?.selectedEmbeddingLabel ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  Selected: {dm.selectedEmbeddingLabel}
                </span>
              ) : null}
            </h3>
            <div className="mt-4 h-64 w-full min-w-0">
              {latencyRows.length === 0 ? (
                <p className="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm dark:border-neutral-700">
                  No embedding candidates in{' '}
                  <code className="bg-muted mx-1 rounded px-1">
                    dashboardMetrics.embeddingBenchmarks
                  </code>
                  .
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyRows} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis
                      dataKey="model"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={48}
                      label={{
                        value: 'ms / text',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    {latencySlo !== undefined ? (
                      <ReferenceLine
                        y={latencySlo}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: 'SLO', fill: '#f59e0b', fontSize: 11 }}
                      />
                    ) : null}
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === 'latencyMs' ? `${v} ms` : v.toFixed(4),
                        name === 'latencyMs' ? 'Latency' : 'Composite',
                      ]}
                      labelFormatter={(_, items) => {
                        const pl = items?.[0]?.payload as { fullLabel?: string } | undefined;
                        return pl?.fullLabel ?? '';
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="latencyMs"
                      name="Latency (ms)"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Retrieval micro-metrics */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <BarChart3 className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
              Retrieval summary
            </h3>
            {dm?.retrieval?.strategy ? (
              <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                Strategy <strong>{dm.retrieval.strategy}</strong>
                {dm.retrieval.topK !== undefined ? (
                  <>
                    {' '}
                    · top_k <strong>{dm.retrieval.topK}</strong>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                No retrieval summary on the latest snapshot.
              </p>
            )}
            <div className="mt-4 h-52 w-full min-w-0">
              {perfEntries.length === 0 ? (
                <p className="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm dark:border-neutral-700">
                  No <code className="bg-muted mx-1 rounded px-1">retrieval.performance</code> map
                  yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfEntries} margin={{ top: 8, right: 8, left: 8, bottom: 32 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} width={36} />
                    <Tooltip formatter={(v: number) => [v.toFixed(3), 'Score']} />
                    <Bar
                      dataKey="value"
                      name="Retrieval metric"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
