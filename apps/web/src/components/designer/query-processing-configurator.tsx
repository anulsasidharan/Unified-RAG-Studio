'use client';

import { useCallback, useMemo } from 'react';
import { Wand2 } from 'lucide-react';

import { createDefaultQueryProcessingConfig } from '@/lib/default-pipeline';
import { QueryProcessingConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { QueryProcessingConfig } from '@/types/pipeline';

const DEFAULT_QP = createDefaultQueryProcessingConfig();

function mergeQueryProcessing(
  current: QueryProcessingConfig | undefined,
  patch: Partial<QueryProcessingConfig>,
): QueryProcessingConfig {
  const base = current ?? DEFAULT_QP;
  return { ...base, ...patch };
}

const FLAGS: { key: keyof QueryProcessingConfig; label: string; hint: string }[] = [
  {
    key: 'queryRewrite',
    label: 'Query rewriting',
    hint: 'Adds a semantic paraphrase line for retrieval.',
  },
  { key: 'hyde', label: 'HyDE', hint: 'Adds a hypothetical passage aligned to the question.' },
  {
    key: 'multiQueryExpansion',
    label: 'Multi-query expansion',
    hint: 'Splits on sentence boundaries for extra queries.',
  },
  {
    key: 'decomposition',
    label: 'Query decomposition',
    hint: 'When the question contains “and”, emits sub-queries.',
  },
  { key: 'stepBack', label: 'Step-back prompting', hint: 'Adds a high-level abstraction query.' },
  {
    key: 'intentClassification',
    label: 'Intent classification',
    hint: 'Adds an intent-aware reformulation.',
  },
  { key: 'entityExtraction', label: 'Entity extraction', hint: 'Adds an entity-focused variant.' },
  {
    key: 'keywordAugmentation',
    label: 'Keyword augmentation',
    hint: 'Duplicates salient tokens for hybrid recall.',
  },
];

export function QueryProcessingConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.queryProcessing ?? DEFAULT_QP;

  const setCfg = useCallback(
    (next: QueryProcessingConfig) => {
      updateStages({ queryProcessing: next });
    },
    [updateStages],
  );

  const patch = useCallback(
    (p: Partial<QueryProcessingConfig>) => {
      setCfg(mergeQueryProcessing(draft.stages.queryProcessing, p));
    },
    [draft.stages.queryProcessing, setCfg],
  );

  const validation = useMemo(() => QueryProcessingConfigSchema.safeParse(cfg), [cfg]);

  return (
    <div className={cn('space-y-6', className)}>
      <section className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Query processing</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Optional transforms before retrieval. Autopilot benchmarks apply deterministic
              variants (no live LLM) so jobs stay reproducible; exports can target full LLM
              pipelines.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cfg.enabled}
            onClick={() => patch({ enabled: !cfg.enabled })}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              cfg.enabled
                ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30'
                : 'border-border bg-muted/30',
            )}
          >
            <span>{cfg.enabled ? 'Enabled' : 'Disabled'}</span>
            <span
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                cfg.enabled ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted',
              )}
              aria-hidden
            >
              <span
                className={cn(
                  'bg-background pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full shadow transition',
                  cfg.enabled ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </div>

        {cfg.enabled ? (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="qp-llm" className="text-foreground text-sm font-medium">
                LLM model id (for future live transforms / export)
              </label>
              <input
                id="qp-llm"
                type="text"
                autoComplete="off"
                value={cfg.llmModel ?? ''}
                onChange={(e) => patch({ llmModel: e.target.value || undefined })}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full max-w-md rounded-md border px-3 py-2 font-mono text-sm shadow-sm outline-none focus-visible:ring-2"
                placeholder="gpt-4o-mini"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {FLAGS.map((f) => (
                <label
                  key={f.key}
                  className="border-border bg-muted/10 hover:bg-muted/20 flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="border-input mt-1 h-4 w-4 rounded"
                    checked={Boolean(cfg[f.key])}
                    onChange={(e) =>
                      patch({ [f.key]: e.target.checked } as Partial<QueryProcessingConfig>)
                    }
                  />
                  <span>
                    <span className="text-foreground font-medium">{f.label}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {!validation.success ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-lg border px-4 py-3 text-sm"
          >
            <ul className="list-inside list-disc text-xs">
              {validation.error.issues.slice(0, 6).map((issue) => (
                <li key={issue.path.join('.')}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
            <Wand2 className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>
              Settings are stored on{' '}
              <strong className="text-foreground">draft.stages.queryProcessing</strong>.
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
