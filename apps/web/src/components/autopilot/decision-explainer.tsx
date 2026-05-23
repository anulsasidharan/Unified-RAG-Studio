'use client';

import {
  ChevronDown,
  ChevronRight,
  Eye,
  Scissors,
  Search,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useState } from 'react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type {
  AgentDecisions,
  AutopilotBuild,
  BuildResult,
  EmbeddingBenchmarkResult,
} from '@/types/autopilot';

function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function Collapsible({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: Readonly<{
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50 dark:text-neutral-50 dark:hover:bg-neutral-900/60"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <Icon className="text-primary-600 dark:text-primary-400 h-4 w-4 shrink-0" aria-hidden />
        {title}
      </button>
      {open ? (
        <div className="border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BenchmarkTable({ rows }: Readonly<{ rows: EmbeddingBenchmarkResult[] }>) {
  if (!rows.length) return <p className="text-muted-foreground">No benchmark rows.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-neutral-200 dark:border-neutral-700">
            <th className="py-2 pr-3 font-medium">Model</th>
            <th className="py-2 pr-3 font-medium">Score</th>
            <th className="py-2 pr-3 font-medium">Latency</th>
            <th className="py-2 font-medium">USD / 1M tok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-b border-neutral-100 dark:border-neutral-800/80">
              <td className="py-2 pr-3 font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                {r.model}
              </td>
              <td className="py-2 pr-3 tabular-nums">{fmtPct(r.score)}</td>
              <td className="py-2 pr-3 tabular-nums">{r.latencyMs.toFixed(1)} ms</td>
              <td className="py-2 tabular-nums">{r.costPer1MTokens.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionExplainer({
  className,
  build,
}: Readonly<{
  className?: string;
  build: AutopilotBuild;
}>) {
  const uid = useId();
  const router = useRouter();
  const result = build.result as BuildResult | undefined;
  const decisions: AgentDecisions | undefined = result?.decisions;

  const onOpenDesigner = useCallback(() => {
    const r = build.result as BuildResult | undefined;
    if (!r?.config) return;
    useDesignerStore.getState().applyAutopilotBuildResult(build.id, r);
    router.push(`${ROUTES.designer}/review?source=autopilot&build=${encodeURIComponent(build.id)}`);
  }, [build.id, build.result, router]);

  const sections = useMemo(() => {
    const r = build.result as BuildResult | undefined;
    const d = r?.decisions;
    if (!r || !d) return null;
    const cfg = r.config;
    return (
      <div className="space-y-3">
        {d.chunking ? (
          <Collapsible title="Chunking" icon={Scissors} defaultOpen>
            <p className="text-muted-foreground">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {d.chunking.strategy}
              </span>
              {' · '}
              <span className="tabular-nums">{d.chunking.chunkSize}</span> tokens
              {cfg.stages.chunking?.chunkOverlap != null ? (
                <>
                  , overlap <span className="tabular-nums">{cfg.stages.chunking.chunkOverlap}</span>
                </>
              ) : null}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {d.chunking.reasoning}
            </p>
            {d.chunking.alternativesTested?.length ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Alternatives tried: {d.chunking.alternativesTested.join(', ')}
              </p>
            ) : null}
          </Collapsible>
        ) : null}

        {d.embedding ? (
          <Collapsible title="Embedding" icon={Zap} defaultOpen>
            <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
              {d.embedding.model}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {d.embedding.reasoning}
            </p>
            <div className="mt-3">
              <BenchmarkTable rows={d.embedding.benchmarkResults} />
            </div>
          </Collapsible>
        ) : null}

        {d.retrieval ? (
          <Collapsible title="Retrieval" icon={Search} defaultOpen>
            <p className="text-neutral-800 dark:text-neutral-200">
              <span className="font-medium">{d.retrieval.strategy}</span>
              <span className="text-muted-foreground"> · top_k </span>
              <span className="font-medium tabular-nums">{d.retrieval.topK}</span>
              <span className="text-muted-foreground"> · rerank </span>
              <span className="font-medium">{d.retrieval.rerankingEnabled ? 'on' : 'off'}</span>
            </p>
            <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {d.retrieval.reasoning}
            </p>
            {d.retrieval.performance && Object.keys(d.retrieval.performance).length > 0 ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {Object.entries(d.retrieval.performance).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-900/80"
                  >
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {v.toFixed(4)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Collapsible>
        ) : null}

        {d.generation ? (
          <Collapsible title="Generation" icon={Sparkles}>
            <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
              {d.generation.model}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {d.generation.reasoning}
            </p>
          </Collapsible>
        ) : null}
      </div>
    );
  }, [build.result]);

  if (!result || !decisions) {
    return null;
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
        <div>
          <h2
            id={`${uid}-title`}
            className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
          >
            Decision explainer
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Structured rationale from each Autopilot specialist, aligned with{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              BuildResultSchema
            </code>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenDesigner}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          <Eye className="h-4 w-4" aria-hidden />
          Open in Designer
        </button>
      </div>

      <div className="mt-6">{sections}</div>
    </section>
  );
}
