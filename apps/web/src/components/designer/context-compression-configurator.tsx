'use client';

import { useCallback, useMemo } from 'react';
import { Filter } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { ContextCompressionConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { ContextCompressionConfig, ContextCompressionMode } from '@/types/pipeline';

const DEFAULT_CC = createDefaultPipelineConfiguration().stages.contextCompression!;

function mergeContextCompression(
  current: ContextCompressionConfig | undefined,
  patch: Partial<ContextCompressionConfig>,
): ContextCompressionConfig {
  const base = current ?? DEFAULT_CC;
  return { ...base, ...patch };
}

const MODE_LABEL: Record<ContextCompressionMode, string> = {
  none: 'None',
  relevance_filter: 'Relevance filter (min score)',
  dedupe: 'Near-duplicate removal',
  summarize_stub: 'Summarize (stub — trims to first chunks)',
};

export function ContextCompressionConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.contextCompression ?? DEFAULT_CC;

  const setCfg = useCallback(
    (next: ContextCompressionConfig) => {
      updateStages({ contextCompression: next });
    },
    [updateStages],
  );

  const patch = useCallback(
    (p: Partial<ContextCompressionConfig>) => {
      setCfg(mergeContextCompression(draft.stages.contextCompression, p));
    },
    [draft.stages.contextCompression, setCfg],
  );

  const validation = useMemo(() => ContextCompressionConfigSchema.safeParse(cfg), [cfg]);

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="cc-main-heading"
      >
        <div className="flex items-start gap-3">
          <Filter
            className="text-primary-600 dark:text-primary-400 mt-0.5 h-5 w-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 id="cc-main-heading" className="text-foreground text-lg font-semibold">
              Context compression
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Post-retrieval shaping before reranking and generation. Updates{' '}
              <strong className="text-foreground font-medium">
                draft.stages.contextCompression
              </strong>
              ; the API applies this in{' '}
              <strong className="text-foreground font-medium">RetrievalService</strong> when
              configured.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="border-input h-4 w-4 rounded"
            />
            Enable compression pass
          </label>
        </div>

        {cfg.enabled ? (
          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="cc-mode" className="text-foreground text-sm font-medium">
                Mode
              </label>
              <select
                id="cc-mode"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full max-w-md rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                value={cfg.mode}
                onChange={(e) => patch({ mode: e.target.value as ContextCompressionMode })}
              >
                {(Object.keys(MODE_LABEL) as ContextCompressionMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            {cfg.mode === 'relevance_filter' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="cc-min" className="text-foreground text-sm font-medium">
                    Minimum chunk score
                  </label>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {cfg.minScore != null ? cfg.minScore.toFixed(2) : '—'}
                  </span>
                </div>
                <input
                  id="cc-min"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cfg.minScore ?? 0.35}
                  onChange={(e) => patch({ minScore: Number(e.target.value) })}
                  className="accent-primary-600 h-2 w-full max-w-md cursor-pointer"
                />
                <p className="text-muted-foreground text-xs">
                  Chunks below this similarity score are dropped before rerank (at least one chunk
                  is kept).
                </p>
              </div>
            ) : null}

            {cfg.mode === 'summarize_stub' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="cc-budget" className="text-foreground text-sm font-medium">
                    Token budget hint (optional)
                  </label>
                </div>
                <input
                  id="cc-budget"
                  type="number"
                  min={256}
                  max={32000}
                  step={256}
                  placeholder="e.g. 4096"
                  value={cfg.maxTokenBudget ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch({ maxTokenBudget: v === '' ? null : Number(v) });
                  }}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full max-w-xs rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                />
                <p className="text-muted-foreground text-xs">
                  Runtime stub currently trims to the first few chunks; full summarisation belongs
                  in a worker job.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {!validation.success ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          <p className="font-medium">Configuration needs adjustment</p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {validation.error.issues.slice(0, 6).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
