'use client';

import { useCallback, useMemo } from 'react';
import { Database } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { MemoryConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { MemoryConfig, MemoryType } from '@/types/pipeline';

const DEFAULT_MEMORY = createDefaultPipelineConfiguration().stages.memory!;

function mergeMemory(current: MemoryConfig | undefined, patch: Partial<MemoryConfig>): MemoryConfig {
  const base = current ?? DEFAULT_MEMORY;
  return { ...base, ...patch };
}

const MEMORY_OPTIONS: { id: MemoryType; title: string; description: string }[] = [
  {
    id: 'none',
    title: 'None',
    description: 'Stateless RAG — each query is independent.',
  },
  {
    id: 'conversation-buffer',
    title: 'Conversation buffer',
    description: 'Recent turns kept in a sliding window for follow-up context.',
  },
  {
    id: 'summary-buffer',
    title: 'Summary buffer',
    description: 'Summarize older turns to fit long sessions within token limits.',
  },
  {
    id: 'vector-memory',
    title: 'Vector memory',
    description: 'Store and retrieve prior exchanges via embeddings (higher cost).',
  },
];

export function MemoryConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.memory ?? DEFAULT_MEMORY;

  const setMemory = useCallback(
    (next: MemoryConfig) => {
      updateStages({ memory: next });
    },
    [updateStages]
  );

  const patchMemory = useCallback(
    (patch: Partial<MemoryConfig>) => {
      setMemory(mergeMemory(draft.stages.memory, patch));
    },
    [draft.stages.memory, setMemory]
  );

  const validation = useMemo(() => MemoryConfigSchema.safeParse(cfg), [cfg]);

  const showAdvanced = cfg.type !== 'none';

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="memory-main-heading"
      >
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="memory-main-heading" className="text-lg font-semibold text-foreground">
              Conversation memory
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how multi-turn context is retained. Updates{' '}
              <strong className="font-medium text-foreground">draft.stages.memory</strong> for exports (e.g. LangChain
              memory in Python codegen).
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MEMORY_OPTIONS.map((opt) => {
            const selected = cfg.type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patchMemory({ type: opt.id })}
                className={cn(
                  'rounded-lg border p-4 text-left text-sm transition-colors',
                  selected
                    ? 'border-primary-600 bg-primary-600/10 ring-2 ring-primary-600/30 dark:border-primary-500'
                    : 'border-neutral-200 bg-background hover:bg-accent dark:border-neutral-700'
                )}
              >
                <span className="font-semibold text-foreground">{opt.title}</span>
                <span className="mt-1 block text-muted-foreground">{opt.description}</span>
              </button>
            );
          })}
        </div>

        {showAdvanced ? (
          <div className="mt-8 space-y-4 rounded-lg border border-neutral-200 bg-muted/15 p-4 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-foreground">Parameters</h3>

            {(cfg.type === 'conversation-buffer' || cfg.type === 'summary-buffer') && (
              <div>
                <label htmlFor="memory-window" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Window size (messages)
                </label>
                <input
                  id="memory-window"
                  type="number"
                  min={1}
                  max={100}
                  className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={cfg.windowSize ?? 10}
                  onChange={(e) => patchMemory({ windowSize: Number(e.target.value) })}
                />
              </div>
            )}

            {(cfg.type === 'summary-buffer' || cfg.type === 'vector-memory') && (
              <div>
                <label htmlFor="memory-max-tokens" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Max memory tokens (optional cap)
                </label>
                <input
                  id="memory-max-tokens"
                  type="number"
                  min={1}
                  max={1000000}
                  className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={cfg.maxTokens ?? ''}
                  placeholder="e.g. 2000"
                  onChange={(e) =>
                    patchMemory({
                      maxTokens: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.sessionPersistence ?? false}
                onChange={(e) => patchMemory({ sessionPersistence: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Persist session across server restarts (when backend supports it)
            </label>
          </div>
        ) : null}
      </section>

      {!validation.success ? (
        <p className="text-sm text-destructive" role="alert">
          Invalid memory configuration — adjust window or token limits.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validated with <code className="rounded bg-muted px-1">MemoryConfigSchema</code>.
        </p>
      )}
    </div>
  );
}
