'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';
import { useDesignerStore } from '@/stores/designer-store';

export function DesignerToAutopilotHandoff({
  className,
}: Readonly<{
  className?: string;
}>) {
  const router = useRouter();
  const draft = useDesignerStore((s) => s.draft);
  const startFromDesigner = useAutopilotStore((s) => s.startFromDesigner);
  const [busy, setBusy] = useState(false);

  const onHandoff = useCallback(() => {
    const ok = window.confirm(
      [
        'Autopilot will use your current Designer draft as baseline configuration (chunking, embeddings, retrieval, etc.).',
        '',
        'Next you will choose a backend project, upload corpus files, adjust targets if needed, then start the build.',
        '',
        'Continue to Autopilot?',
      ].join('\n'),
    );
    if (!ok) return;
    setBusy(true);
    try {
      startFromDesigner(draft);
      router.push(`${ROUTES.autopilotNew}?from=designer`);
    } finally {
      setBusy(false);
    }
  }, [draft, router, startFromDesigner]);

  return (
    <div
      className={cn(
        'to-background rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 p-5 shadow-sm dark:border-violet-800/60 dark:from-violet-950/40',
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white dark:bg-violet-500">
          <Zap className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-base font-semibold">Optimize with Autopilot</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Send this pipeline draft to Autopilot as a starting point. Agents can benchmark
            alternatives and tune retrieval while respecting your cloud choice and targets.
          </p>
          <ul className="text-muted-foreground mt-3 list-inside list-disc text-sm">
            <li>
              Your draft stays saved in this browser; Autopilot stores a copy as{' '}
              <span className="font-medium">baseline config</span> for the next build.
            </li>
            <li>You still upload documents and start the build from the Autopilot wizard.</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onHandoff()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow transition-colors hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {busy ? 'Opening…' : 'Continue to Autopilot'}
        </button>
        <Link
          href={ROUTES.autopilot}
          className="bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-md border border-neutral-200 px-4 py-2.5 text-sm font-medium shadow-sm transition-colors dark:border-neutral-600"
        >
          Autopilot overview
        </Link>
      </div>
    </div>
  );
}
