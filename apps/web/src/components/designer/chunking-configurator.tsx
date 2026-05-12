'use client';

import { useCallback, useMemo } from 'react';
import {
  AlignLeft,
  Brain,
  Code,
  Hash,
  Heading,
  LayoutGrid,
  Scissors,
  TextQuote,
} from 'lucide-react';

import {
  chunkingDefaultsFromCatalog,
  getChunkingStrategyMeta,
  listChunkingStrategies,
} from '@/lib/chunking-strategies-catalog';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { ChunkingConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { ChunkingConfig, ChunkingStrategy } from '@/types/pipeline';

const DEFAULT_CHUNKING = createDefaultPipelineConfiguration().stages.chunking;

const STRATEGY_ICONS: Record<ChunkingStrategy, typeof LayoutGrid> = {
  'fixed-size': LayoutGrid,
  'recursive-character': Scissors,
  semantic: Brain,
  'markdown-header': Heading,
  'sentence-based': TextQuote,
  'paragraph-based': AlignLeft,
  'code-aware': Code,
  'token-aware': Hash,
};

function complexityBadgeStyles(level: string): string {
  const l = level.toLowerCase();
  if (l === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100';
  }
  if (l === 'medium') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
}

function separatorsToDisplay(seps: string[]): string {
  return seps
    .map((s) =>
      s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
    )
    .join('\n');
}

function displayToSeparators(text: string): string[] {
  const lines = text.split('\n');
  return lines.map((line) =>
    line.replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
  );
}

function mergeChunking(
  current: ChunkingConfig | undefined,
  patch: Partial<ChunkingConfig> & { metadata?: Partial<NonNullable<ChunkingConfig['metadata']>> }
): ChunkingConfig {
  const base = current ?? DEFAULT_CHUNKING;
  const metaBase = base.metadata ?? {
    includeSource: true,
    includePageNumber: false,
  };
  return {
    ...base,
    ...patch,
    metadata:
      patch.metadata !== undefined
        ? {
            ...metaBase,
            ...patch.metadata,
            customMetadata: patch.metadata.customMetadata ?? metaBase.customMetadata,
          }
        : base.metadata,
    separators: patch.separators !== undefined ? patch.separators : base.separators,
  };
}

export function ChunkingConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.chunking ?? DEFAULT_CHUNKING;

  const setChunking = useCallback(
    (next: ChunkingConfig) => {
      updateStages({ chunking: next });
    },
    [updateStages]
  );

  const patchChunking = useCallback(
    (patch: Parameters<typeof mergeChunking>[1]) => {
      setChunking(mergeChunking(draft.stages.chunking, patch));
    },
    [draft.stages.chunking, setChunking]
  );

  const validation = useMemo(() => ChunkingConfigSchema.safeParse(cfg), [cfg]);

  const strategies = listChunkingStrategies();

  const selectStrategy = (id: ChunkingStrategy) => {
    const defaults = chunkingDefaultsFromCatalog(id);
    patchChunking({
      ...defaults,
      strategy: id,
    });
  };

  const metaEntries = useMemo(() => {
    const cm = cfg.metadata?.customMetadata;
    if (!cm || typeof cm !== 'object') return [['', '']] as [string, string][];
    const pairs = Object.entries(cm).filter(
      ([k, v]) => typeof k === 'string' && (typeof v === 'string' || typeof v === 'number')
    ) as [string, string][];
    return pairs.length ? pairs : [['', '']];
  }, [cfg.metadata?.customMetadata]);

  const updateMetaEntries = (rows: [string, string][]) => {
    const obj: Record<string, string> = {};
    for (const [k, v] of rows) {
      const key = k.trim();
      if (key) obj[key] = v;
    }
    patchChunking({
      metadata: {
        includeSource: cfg.metadata?.includeSource ?? true,
        includePageNumber: cfg.metadata?.includePageNumber ?? false,
        customMetadata: Object.keys(obj).length ? obj : undefined,
      },
    });
  };

  const separatorsText = useMemo(
    () => separatorsToDisplay(cfg.separators ?? ['\n\n', '\n', ' ']),
    [cfg.separators]
  );

  const overlapMax = Math.min(1024, Math.max(0, cfg.chunkSize - 1));

  return (
    <div className={cn('space-y-8', className)}>
      <div
        role="radiogroup"
        aria-label="Chunking strategy"
        className="grid gap-4 sm:grid-cols-2"
      >
        {strategies.map((s) => {
          const Icon = STRATEGY_ICONS[s.id as ChunkingStrategy] ?? Scissors;
          const selected = cfg.strategy === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectStrategy(s.id as ChunkingStrategy)}
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
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{s.name}</span>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        complexityBadgeStyles(s.implementationComplexity)
                      )}
                    >
                      {s.implementationComplexity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {(() => {
        const active = getChunkingStrategyMeta(cfg.strategy);
        if (!active) return null;
        return (
          <section
            className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
            aria-labelledby="chunk-strategy-detail-heading"
          >
            <h2 id="chunk-strategy-detail-heading" className="text-lg font-semibold text-foreground">
              About this strategy
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Best for
                </h3>
                <ul className="mt-2 list-inside list-disc text-sm text-foreground">
                  {active.bestFor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                    Pros
                  </h3>
                  <ul className="mt-2 list-inside list-disc text-xs text-foreground">
                    {active.pros.slice(0, 4).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200">
                    Cons
                  </h3>
                  <ul className="mt-2 list-inside list-disc text-xs text-foreground">
                    {active.cons.slice(0, 4).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="chunk-params-heading"
      >
        <h2 id="chunk-params-heading" className="text-lg font-semibold text-foreground">
          Size & overlap
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Token-oriented bounds match the shared pipeline schema (128–4096 tokens). Adjust overlap to preserve context
          across chunk boundaries.
        </p>
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="chunk-size" className="text-sm font-medium text-foreground">
                Chunk size (tokens)
              </label>
              <span className="tabular-nums text-sm text-muted-foreground">{cfg.chunkSize}</span>
            </div>
            <input
              id="chunk-size"
              type="range"
              min={128}
              max={4096}
              step={32}
              value={cfg.chunkSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                const maxOv = Math.min(1024, Math.max(0, nextSize - 1));
                let ov = cfg.chunkOverlap;
                if (ov > maxOv) ov = maxOv;
                patchChunking({ chunkSize: nextSize, chunkOverlap: ov });
              }}
              className="mt-2 h-2 w-full cursor-pointer accent-primary-600"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="chunk-overlap" className="text-sm font-medium text-foreground">
                Chunk overlap (tokens)
              </label>
              <span className="tabular-nums text-sm text-muted-foreground">{cfg.chunkOverlap}</span>
            </div>
            <input
              id="chunk-overlap"
              type="range"
              min={0}
              max={overlapMax}
              step={8}
              value={Math.min(cfg.chunkOverlap, overlapMax)}
              onChange={(e) => patchChunking({ chunkOverlap: Number(e.target.value) })}
              className="mt-2 h-2 w-full cursor-pointer accent-primary-600"
            />
            <p className="mt-1 text-xs text-muted-foreground">Maximum overlap for current size: {overlapMax}.</p>
          </div>
        </div>
      </section>

      {cfg.strategy === 'recursive-character' ? (
        <section
          className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
          aria-labelledby="chunk-sep-heading"
        >
          <h2 id="chunk-sep-heading" className="text-lg font-semibold text-foreground">
            Separator ladder
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One separator per line. Use escape sequences <code className="rounded bg-muted px-1">\n</code>,{' '}
            <code className="rounded bg-muted px-1">\t</code> for control characters. Order is tried from top to bottom
            (largest structure first), matching LangChain&apos;s recursive splitter.
          </p>
          <textarea
            id="chunk-separators"
            rows={6}
            className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            value={separatorsText}
            onChange={(e) => {
              const seps = displayToSeparators(e.target.value);
              patchChunking({ separators: seps.length ? seps : undefined });
            }}
          />
        </section>
      ) : null}

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="chunk-meta-heading"
      >
        <h2 id="chunk-meta-heading" className="text-lg font-semibold text-foreground">
          Chunk metadata
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional fields carried on chunk documents for filtering and traceability in exports.
        </p>
        <ul className="mt-4 space-y-3">
          {(
            [
              ['includeSource', 'Include source path or URI', cfg.metadata?.includeSource ?? true],
              ['includePageNumber', 'Include page numbers (PDFs)', cfg.metadata?.includePageNumber ?? false],
            ] as const
          ).map(([key, label, checked]) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2"
            >
              <span className="text-sm text-foreground">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() =>
                  patchChunking({
                    metadata: {
                      includeSource: key === 'includeSource' ? !checked : (cfg.metadata?.includeSource ?? true),
                      includePageNumber:
                        key === 'includePageNumber' ? !checked : (cfg.metadata?.includePageNumber ?? false),
                      customMetadata: cfg.metadata?.customMetadata,
                    },
                  })
                }
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  checked ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full bg-background shadow transition',
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Custom metadata fields</h3>
          <p className="mt-1 text-xs text-muted-foreground">Static key/value pairs merged onto chunk metadata.</p>
          <ul className="mt-3 space-y-2">
            {metaEntries.map((pair, idx) => {
              const row = pair as [string, string];
              return (
                <li key={idx} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    type="text"
                    aria-label={`Chunk custom metadata key ${idx + 1}`}
                    placeholder="Key"
                    className="min-w-[120px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={row[0]}
                    onChange={(e) => {
                      const next = [...metaEntries] as [string, string][];
                      next[idx] = [e.target.value, row[1]];
                      updateMetaEntries(next);
                    }}
                  />
                  <input
                    type="text"
                    aria-label={`Chunk custom metadata value ${idx + 1}`}
                    placeholder="Value"
                    className="min-w-[120px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={row[1]}
                    onChange={(e) => {
                      const next = [...metaEntries] as [string, string][];
                      next[idx] = [row[0], e.target.value];
                      updateMetaEntries(next);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      const next = (metaEntries as [string, string][]).filter((_, i) => i !== idx);
                      updateMetaEntries(next.length ? next : [['', '']]);
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            onClick={() => {
              updateMetaEntries([...(metaEntries as [string, string][]), ['', '']]);
            }}
          >
            Add field
          </button>
        </div>
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
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Chunking settings are valid and saved with your pipeline draft (local storage).
        </p>
      )}
    </div>
  );
}
