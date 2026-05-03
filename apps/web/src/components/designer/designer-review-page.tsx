'use client';

import Link from 'next/link';
import {
  ArrowDown,
  Calculator,
  ClipboardCopy,
  FileJson2,
  LayoutDashboard,
  ListChecks,
  Package,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { DESIGNER_DOM_SECTION_IDS } from '@/lib/designer-section-anchors';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import { generatePipelineHighlights, generatePipelineSummary } from '@/lib/generators/mermaidGenerator';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';

function scrollToSection(id: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SummaryCard({
  title,
  value,
  sub,
  className,
}: Readonly<{
  title: string;
  value: string;
  sub?: string;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-card p-4 shadow-sm dark:border-neutral-700',
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1.5 break-words text-sm font-semibold text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function DesignerReviewPage({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const resetDraft = useDesignerStore((s) => s.resetDraft);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const meta = DESIGNER_STAGES.find((s) => s.id === 'review')!;
  const index = DESIGNER_STAGES.findIndex((s) => s.id === 'review');
  const prev = index > 0 ? DESIGNER_STAGES[index - 1] : null;
  const next = index < DESIGNER_STAGES.length - 1 ? DESIGNER_STAGES[index + 1] : null;

  const fullStageIndex = DESIGNER_STAGES.length - 1;

  const oneLine = useMemo(
    () => generatePipelineSummary(draft.stages, fullStageIndex),
    [draft.stages]
  );
  const bullets = useMemo(
    () => generatePipelineHighlights(draft.stages, draft.cloudProvider, fullStageIndex),
    [draft.stages, draft.cloudProvider]
  );

  const copySummary = useCallback(async () => {
    const text = [draft.name, oneLine, '', ...bullets.map((b) => `• ${b}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      /* ignore */
    }
  }, [bullets, draft.name, oneLine]);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      /* ignore */
    }
  }, [draft]);

  const onReset = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      window.confirm(
        'Reset the pipeline draft to defaults? This clears local designer state (persisted in this browser).'
      )
    ) {
      resetDraft();
    }
  }, [resetDraft]);

  const stages = draft.stages;
  const di = stages.dataIngestion;

  return (
    <div className={cn('mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stage {index + 1} of {DESIGNER_STAGES.length}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {meta.label}
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Confirm your RAG pipeline draft before export or handoff. Use the links below to jump to the live diagram, cost
        model, and generated artefacts — each strip stays in sync with your Zustand draft (local storage).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.cost)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
        >
          <Calculator className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Cost estimate
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.export)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
        >
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Code export
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.pipeline)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Pipeline graph
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copySummary()}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
        >
          <ClipboardCopy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {copiedSummary ? 'Summary copied' : 'Copy text summary'}
        </button>
        <button
          type="button"
          onClick={() => void copyJson()}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
        >
          <FileJson2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {copiedJson ? 'JSON copied' : 'Copy draft JSON'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/10"
        >
          Reset draft…
        </button>
      </div>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-muted/20 p-4 dark:border-neutral-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draft</p>
        <p className="mt-1 text-lg font-semibold text-foreground">{draft.name || 'Untitled pipeline'}</p>
        {draft.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{draft.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Last updated:{' '}
          {draft.metadata.updatedAt
            ? new Date(draft.metadata.updatedAt).toLocaleString()
            : draft.metadata.createdAt
              ? new Date(draft.metadata.createdAt).toLocaleString()
              : '—'}
        </p>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flow summary</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{oneLine}</p>
        <ul className="mt-3 space-y-1 border-l-2 border-primary-600/30 pl-3 text-sm text-muted-foreground dark:border-primary-400/30">
          {bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Cloud" value={draft.cloudProvider.toUpperCase()} />
        <SummaryCard
          title="Ingestion"
          value={di ? di.sourceType.replace(/-/g, ' ') : 'Not set'}
          sub={di?.fileTypes?.length ? `Types: ${di.fileTypes.join(', ')}` : undefined}
        />
        <SummaryCard
          title="Chunking"
          value={stages.chunking.strategy}
          sub={`${stages.chunking.chunkSize} tokens · overlap ${stages.chunking.chunkOverlap}`}
        />
        <SummaryCard
          title="Embedding"
          value={stages.embedding.model}
          sub={`${stages.embedding.provider} · ${stages.embedding.dimensions}d`}
        />
        <SummaryCard
          title="Vector store"
          value={stages.vectorStore.provider}
          sub={stages.vectorStore.indexName}
        />
        <SummaryCard
          title="Retrieval"
          value={stages.retrieval.strategy}
          sub={`top-${stages.retrieval.topK}`}
        />
        <SummaryCard
          title="Reranking"
          value={stages.reranking?.enabled ? 'On' : 'Off'}
          sub={stages.reranking?.enabled ? stages.reranking.model : undefined}
        />
        <SummaryCard
          title="Generation"
          value={stages.generation.model}
          sub={`${stages.generation.provider} · T=${stages.generation.temperature}`}
        />
        <SummaryCard
          title="Routing"
          value={stages.routing?.enabled ? 'On' : 'Off'}
          sub={
            stages.routing?.enabled
              ? `${stages.routing.rules?.length ?? 0} rule(s)`
              : undefined
          }
        />
        <SummaryCard title="Memory" value={stages.memory?.type?.replace(/-/g, ' ') ?? 'none'} />
        <SummaryCard
          title="Evaluation"
          value={stages.evaluation?.enabled ? 'On' : 'Off'}
          sub={
            stages.evaluation?.enabled
              ? `${stages.evaluation.metrics?.length ?? 0} metric(s)`
              : undefined
          }
        />
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />
          Stage checklist
        </div>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
          {DESIGNER_STAGES.filter((s) => s.id !== 'review').map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="text-foreground">{s.label}</span>
              <Link
                href={s.path}
                className="shrink-0 font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Edit →
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          {prev ? (
            <Link
              href={prev.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">First stage</span>
          )}
        </div>
        <div>
          {next ? (
            <Link
              href={next.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {next.label} →
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Last stage</span>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href={ROUTES.home} className="text-muted-foreground hover:text-foreground hover:underline">
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Browse templates
        </Link>
        <Link href={ROUTES.projects} className="text-muted-foreground hover:text-foreground hover:underline">
          Projects
        </Link>
      </div>
    </div>
  );
}
