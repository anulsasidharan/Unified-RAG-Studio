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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AutopilotDesignerImportBanner } from '@/components/designer/autopilot-designer-import-banner';
import { DesignerToAutopilotHandoff } from '@/components/designer/designer-to-autopilot-handoff';
import { getEnabledIngestionSourceTypes } from '@/lib/data-ingestion-sources';
import { createDefaultHumanInTheLoopConfig } from '@/lib/default-pipeline';
import { hitlHighlightBullet } from '@/lib/hitl-summary';
import { guardrailPolicyMermaidSubtitle, resolveGuardrailsConfig } from '@/lib/guardrails-summary';
import { DESIGNER_DOM_SECTION_IDS } from '@/lib/designer-section-anchors';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import {
  generatePipelineHighlights,
  generatePipelineSummary,
} from '@/lib/generators/mermaidGenerator';
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
        'bg-card rounded-lg border border-neutral-200 p-4 shadow-sm dark:border-neutral-700',
        className,
      )}
    >
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="text-foreground mt-1.5 break-words text-sm font-semibold">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
    </div>
  );
}

export function DesignerReviewPage({
  className,
}: Readonly<{
  className?: string;
}>) {
  const scrolledToPipelineRef = useRef(false);
  const draft = useDesignerStore((s) => s.draft);
  const resetDraft = useDesignerStore((s) => s.resetDraft);
  const autopilotImportSnapshot = useDesignerStore((s) => s.autopilotImportSnapshot);
  const syncAutopilotSnapshotFromStores = useDesignerStore(
    (s) => s.syncAutopilotSnapshotFromStores,
  );
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  /** Avoid hydration mismatch: server vs client differ on `new Date().toLocaleString()` and default draft timestamps. */
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('—');

  useEffect(() => {
    syncAutopilotSnapshotFromStores();
  }, [syncAutopilotSnapshotFromStores, draft.metadata.buildId, draft.metadata.source]);

  useEffect(() => {
    if (typeof window === 'undefined' || scrolledToPipelineRef.current) return;
    const source = new URLSearchParams(window.location.search).get('source');
    if (source !== 'autopilot') return;
    scrolledToPipelineRef.current = true;
    const t = window.requestAnimationFrame(() => {
      scrollToSection(DESIGNER_DOM_SECTION_IDS.pipeline);
    });
    return () => window.cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const iso = draft.metadata.updatedAt ?? draft.metadata.createdAt;
    setLastUpdatedLabel(iso ? new Date(iso).toLocaleString() : '—');
  }, [draft.metadata.updatedAt, draft.metadata.createdAt]);

  const meta = DESIGNER_STAGES.find((s) => s.id === 'review')!;
  const index = DESIGNER_STAGES.findIndex((s) => s.id === 'review');
  const prev = index > 0 ? DESIGNER_STAGES[index - 1] : null;
  const next = index < DESIGNER_STAGES.length - 1 ? DESIGNER_STAGES[index + 1] : null;

  const fullStageIndex = DESIGNER_STAGES.length - 1;

  const oneLine = useMemo(
    () => generatePipelineSummary(draft.stages, fullStageIndex),
    [draft.stages, fullStageIndex],
  );
  const bullets = useMemo(
    () =>
      generatePipelineHighlights(
        draft.stages,
        draft.cloudProvider,
        fullStageIndex,
        draft.guardrails,
      ),
    [draft.stages, draft.cloudProvider, draft.guardrails, fullStageIndex],
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
        'Reset the pipeline draft to defaults? This clears local designer state (persisted in this browser).',
      )
    ) {
      resetDraft();
    }
  }, [resetDraft]);

  const stages = draft.stages;
  const di = stages.dataIngestion;
  const ingestionCard = useMemo(() => {
    if (!di) return { value: 'Not set' as string, sub: undefined as string | undefined };
    const active = getEnabledIngestionSourceTypes(di);
    const parts = active.length
      ? active.map((t) => t.replace(/-/g, ' '))
      : [di.sourceType.replace(/-/g, ' ')];
    return {
      value: parts.join(' · '),
      sub: di.fileTypes?.length ? `Types: ${di.fileTypes.join(', ')}` : undefined,
    };
  }, [di]);
  const gr = resolveGuardrailsConfig(draft.guardrails);
  const hitl = stages.humanInTheLoop ?? createDefaultHumanInTheLoopConfig();

  const showAutopilotBanner =
    autopilotImportSnapshot &&
    draft.metadata.source === 'autopilot' &&
    draft.metadata.buildId === autopilotImportSnapshot.buildId;

  return (
    <div className={cn('mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10', className)}>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Stage {index + 1} of {DESIGNER_STAGES.length}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {meta.label}
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Confirm your RAG pipeline draft before export or handoff. Use the links below to jump to the
        live diagram, cost model, and generated artefacts — each strip stays in sync with your
        Zustand draft (local storage).
      </p>

      {showAutopilotBanner ? (
        <AutopilotDesignerImportBanner className="mt-8" snapshot={autopilotImportSnapshot} />
      ) : null}

      <DesignerToAutopilotHandoff className="mt-8" />

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.cost)}
          className="bg-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          <Calculator className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          Cost estimate
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.export)}
          className="bg-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          <Package className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          Code export
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(DESIGNER_DOM_SECTION_IDS.pipeline)}
          className="bg-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          <LayoutDashboard className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          Pipeline graph
          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copySummary()}
          className="bg-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          <ClipboardCopy className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          {copiedSummary ? 'Summary copied' : 'Copy text summary'}
        </button>
        <button
          type="button"
          onClick={() => void copyJson()}
          className="bg-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          <FileJson2 className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          {copiedJson ? 'JSON copied' : 'Copy draft JSON'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="border-destructive/30 bg-background text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition-colors"
        >
          Reset draft…
        </button>
      </div>

      <div className="bg-muted/20 mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Draft</p>
        <p className="text-foreground mt-1 text-lg font-semibold">
          {draft.name || 'Untitled pipeline'}
        </p>
        {draft.description ? (
          <p className="text-muted-foreground mt-2 text-sm">{draft.description}</p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-xs">Last updated: {lastUpdatedLabel}</p>
      </div>

      <div className="mt-6">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Flow summary
        </p>
        <p className="text-foreground mt-2 text-sm leading-relaxed">{oneLine}</p>
        <ul className="border-primary-600/30 text-muted-foreground dark:border-primary-400/30 mt-3 space-y-1 border-l-2 pl-3 text-sm">
          {bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Cloud" value={draft.cloudProvider.toUpperCase()} />
        <SummaryCard title="Ingestion" value={ingestionCard.value} sub={ingestionCard.sub} />
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
          sub={stages.routing?.enabled ? `${stages.routing.rules?.length ?? 0} rule(s)` : undefined}
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
        <SummaryCard
          title="Guardrails"
          value={
            [
              gr.input.enabled && 'Input',
              gr.retrieval.enabled && 'Retrieval',
              gr.output.enabled && 'Output',
            ]
              .filter(Boolean)
              .join(' · ') || 'All layers off'
          }
          sub={guardrailPolicyMermaidSubtitle(gr)}
        />
        <SummaryCard
          title="Human in the loop"
          value={hitl.enabled ? `${hitl.tier} tier` : 'Off'}
          sub={hitl.enabled ? hitlHighlightBullet(hitl) : undefined}
        />
      </div>

      <div className="mt-10">
        <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="text-muted-foreground h-4 w-4" aria-hidden />
          Stage checklist
        </div>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
          {DESIGNER_STAGES.filter((s) => s.id !== 'review').map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="text-foreground">{s.label}</span>
              <Link
                href={s.path}
                className="text-primary-600 dark:text-primary-400 shrink-0 font-medium hover:underline"
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
              className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">First stage</span>
          )}
        </div>
        <div>
          {next ? (
            <Link
              href={next.path}
              className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
            >
              {next.label} →
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">Last stage</span>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href={ROUTES.home}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Browse templates
        </Link>
        <Link
          href={ROUTES.projects}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Projects
        </Link>
      </div>
    </div>
  );
}
