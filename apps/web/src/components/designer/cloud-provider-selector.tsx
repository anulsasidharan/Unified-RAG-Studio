'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Check, Cloud, Layers, Shield } from 'lucide-react';

import { getCloudProviderMeta, listCloudProviders } from '@/lib/cloud-providers-catalog';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { CloudProvider } from '@/types/pipeline';

function tierStyles(tier: string): string {
  const t = tier.toLowerCase();
  if (t.includes('enterprise')) {
    return 'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-100';
  }
  if (t.includes('flexible')) {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-neutral-200 bg-muted text-muted-foreground';
}

export function CloudProviderSelector({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const patchDraft = useDesignerStore((s) => s.patchDraft);
  const providers = listCloudProviders();
  const selectedId = draft.cloudProvider;
  const selectedMeta = getCloudProviderMeta(selectedId);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  return (
    <div className={cn('space-y-8', className)}>
      <div role="radiogroup" aria-label="Cloud provider" className="grid gap-4 sm:grid-cols-2">
        {providers.map((p) => {
          const isSelected = p.id === selectedId;
          const showFallback = logoFailed[p.id];
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => patchDraft({ cloudProvider: p.id as CloudProvider })}
              className={cn(
                'flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary-600 bg-primary-600/[0.06] ring-primary-600 dark:bg-primary-500/10 ring-2'
                  : 'bg-card hover:border-primary-400/60 hover:bg-accent/40 border-neutral-200 dark:border-neutral-700',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'bg-background relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-lg font-bold tracking-tight',
                    isSelected
                      ? 'border-primary-600 text-primary-700 dark:text-primary-200'
                      : 'border-muted',
                  )}
                  aria-hidden
                >
                  {!showFallback ? (
                    <Image
                      src={p.logo}
                      alt=""
                      width={48}
                      height={48}
                      className="object-contain p-1"
                      onError={() =>
                        setLogoFailed((prev) => ({
                          ...prev,
                          [p.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <span>{p.shortName.slice(0, 3)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-semibold">{p.shortName}</span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        tierStyles(p.pricingTier),
                      )}
                    >
                      {p.pricingTier}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{p.description}</p>
                </div>
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-primary-600 bg-primary-600 text-primary-foreground'
                      : 'border-muted bg-muted/50 text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="h-4 w-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedMeta ? (
        <section
          className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
          aria-live="polite"
        >
          <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-foreground text-lg font-semibold tracking-tight">
                {selectedMeta.name}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{selectedMeta.description}</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Selection is saved with your pipeline draft (local storage).
            </p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-foreground mb-2 flex items-center gap-2 text-sm font-semibold">
                <Cloud className="text-primary-600 h-4 w-4" aria-hidden />
                Best for
              </h3>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {selectedMeta.bestFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-foreground mb-2 flex items-center gap-2 text-sm font-semibold">
                <Layers className="text-primary-600 h-4 w-4" aria-hidden />
                Strengths
              </h3>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {selectedMeta.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-foreground mb-3 text-sm font-semibold">
              Native services (high level)
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['LLM / models', selectedMeta.nativeServices.llm],
                  ['Vector store', selectedMeta.nativeServices.vectorStore],
                  ['Object storage', selectedMeta.nativeServices.objectStorage],
                  ['Orchestration', selectedMeta.nativeServices.containerOrchestration],
                  ['Monitoring', selectedMeta.nativeServices.monitoring],
                  ['Secrets', selectedMeta.nativeServices.secretsManagement],
                ] as const
              ).map(([label, items]) => (
                <div key={label} className="border-border bg-muted/30 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {label}
                  </dt>
                  <dd className="text-foreground mt-1 text-sm">{items.join(' · ')}</dd>
                </div>
              ))}
              {selectedMeta.nativeServices.computeOptions?.length ? (
                <div className="border-border bg-muted/30 rounded-lg border p-3 sm:col-span-2">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Compute options
                  </dt>
                  <dd className="text-foreground mt-1 text-sm">
                    {selectedMeta.nativeServices.computeOptions.join(' · ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="border-border mt-6 flex flex-wrap gap-6 border-t pt-5">
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                RAG Studio defaults (hints for later stages)
              </h3>
              <dl className="grid gap-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Vector store</dt>
                  <dd className="text-foreground font-medium">
                    {selectedMeta.ragStudioDefaults.vectorStore}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Object storage</dt>
                  <dd className="text-foreground font-medium">
                    {selectedMeta.ragStudioDefaults.objectStorage}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Deployment</dt>
                  <dd className="text-foreground font-medium">
                    {selectedMeta.ragStudioDefaults.deployment}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="min-w-[200px] flex-1">
              <h3 className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Compliance &amp; pricing signals
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {selectedMeta.compliance.map((c) => (
                  <span
                    key={c}
                    className="border-border bg-muted/50 text-foreground rounded-md border px-2 py-0.5 text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
