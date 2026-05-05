'use client';

import { Sparkles, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';

export function AutopilotDesignerBaselineBanner({
  className,
}: Readonly<{
  className?: string;
}>) {
  const baseConfig = useAutopilotStore((s) => s.baseConfig);
  const clearHandoff = useAutopilotStore((s) => s.clearHandoff);

  if (!baseConfig) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border border-violet-200 bg-violet-50/80 p-4 text-sm dark:border-violet-800/70 dark:bg-violet-950/35',
        className
      )}
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Designer baseline loaded</p>
        <p className="mt-1 text-muted-foreground">
          Pipeline <span className="font-medium text-foreground">{baseConfig.name || 'Untitled'}</span> will be sent as{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">baseConfig</code> when you start a build. Requirements
          default to balanced optimization; cloud is prefilled from Designer ({baseConfig.cloudProvider}).
        </p>
      </div>
      <button
        type="button"
        onClick={() => clearHandoff()}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Clear baseline
      </button>
    </div>
  );
}
