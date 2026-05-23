'use client';

import { CheckCircle2, ClipboardList, Copy, Download, Loader2 } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type {
  AutopilotBuild,
  BuildResult,
  DeploymentArtefacts,
  FinalMetrics,
} from '@/types/autopilot';

function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const ARTEFACT_LABELS: Record<keyof DeploymentArtefacts, string> = {
  docker_compose: 'Docker Compose',
  kubernetes_manifest: 'Kubernetes',
  terraform_stub: 'Terraform',
};

function ArtefactBlock({ label, content }: Readonly<{ label: string; content: string }>) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800/60">
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-muted-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <Copy className="h-3 w-3" aria-hidden />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all p-3 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
        {content}
      </pre>
    </div>
  );
}

function DeploymentPreview({
  deployment,
}: Readonly<{ deployment: NonNullable<BuildResult['deployment']> }>) {
  const artefacts = deployment.artefacts ?? {};
  const keys = (Object.keys(ARTEFACT_LABELS) as Array<keyof DeploymentArtefacts>).filter(
    (k) => typeof artefacts[k] === 'string' && artefacts[k]!.length > 0,
  );

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <ClipboardList className="h-4 w-4" aria-hidden />
        Deployment preview
        <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
          Stub — not deployed
        </span>
      </h3>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
        No cloud resources were provisioned. The agents generated these configuration files based on
        the optimal settings found. Review them, inject your secrets, then run{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">terraform plan</code> /{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">kubectl diff</code> /{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">docker compose up</code> to
        actually deploy.
      </p>
      {deployment.operatorNotes ? (
        <p className="mt-2 text-xs italic text-amber-700 dark:text-amber-400">
          {deployment.operatorNotes}
        </p>
      ) : null}
      {deployment.warnings && deployment.warnings.length > 0 ? (
        <ul className="mt-2 list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
          {deployment.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      {keys.length > 0 ? (
        <div className="mt-4 space-y-3">
          {keys.map((k) => (
            <ArtefactBlock key={k} label={ARTEFACT_LABELS[k]} content={artefacts[k]!} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">
          Artefacts not included — download the full JSON to access them.
        </p>
      )}
    </div>
  );
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
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
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
          className,
        )}
      >
        <p className="font-medium">Build finished — typed result not available</p>
        <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
          This run was completed before the worker started persisting a normalised{' '}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-950/80">
            BuildResult
          </code>
          . Start a new build to populate the results summary and decision explainer.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
      aria-labelledby={`${uid}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <div>
            <h2
              id={`${uid}-title`}
              className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
            >
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
          className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
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

      {result.deployment ? <DeploymentPreview deployment={result.deployment} /> : null}

      {result.config?.name ? (
        <p className="text-muted-foreground mt-4 text-xs">
          Pipeline name:{' '}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {result.config.name}
          </span>
        </p>
      ) : null}
    </section>
  );
}
