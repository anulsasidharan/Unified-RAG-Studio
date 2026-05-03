'use client';

import mermaid from 'mermaid';
import { Loader2, Network } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  generateMermaidDiagram,
  generatePipelineHighlights,
  generatePipelineSummary,
} from '@/lib/generators/mermaidGenerator';
import { useDesignerStore } from '@/stores/designer-store';
import { cn } from '@/lib/utils';

/**
 * Match viewport without hydration mismatch: server + first client paint use `false`,
 * then subscribe after hydration so wide screens match SSR markup until the next paint.
 */
function useMatchMedia(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia(query);
      const onChange = () => onStoreChange();
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

function useColorSchemeDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      setDark(
        root.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    };
    sync();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', sync);
      mo.disconnect();
    };
  }, []);

  return dark;
}

function MermaidDiagram({
  definition,
  className,
}: Readonly<{
  definition: string;
  className?: string;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dark = useColorSchemeDark();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: dark ? 'dark' : 'default',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    });

    const id = `mmd-${Math.random().toString(36).slice(2, 11)}`;

    void (async () => {
      try {
        const { svg } = await mermaid.render(id, definition);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not render diagram');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [definition, dark]);

  return (
    <div className={cn('relative min-h-[120px]', className)}>
      {busy ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-muted/40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Rendering pipeline diagram</span>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : (
        <div
          ref={containerRef}
          className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-none"
          role="img"
          aria-label="Pipeline flow diagram"
        />
      )}
    </div>
  );
}

export type PipelineVisualizerPlacement = 'sidebar' | 'main';

export function PipelineVisualizer({
  placement,
  className,
}: Readonly<{
  placement: PipelineVisualizerPlacement;
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const isLg = useMatchMedia('(min-width: 1024px)');

  const definition = useMemo(
    () => generateMermaidDiagram(draft.stages, draft.cloudProvider),
    [draft.stages, draft.cloudProvider]
  );

  const oneLine = useMemo(() => generatePipelineSummary(draft.stages), [draft.stages]);
  const bullets = useMemo(
    () => generatePipelineHighlights(draft.stages, draft.cloudProvider),
    [draft.stages, draft.cloudProvider]
  );

  if (placement === 'sidebar' && !isLg) return null;
  if (placement === 'main' && isLg) return null;

  const panel = (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live pipeline
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground" title={oneLine}>
          {oneLine}
        </p>
      </div>

      <ul className="space-y-1 border-l-2 border-primary-600/30 pl-3 text-[11px] leading-relaxed text-muted-foreground dark:border-primary-400/30">
        {bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <MermaidDiagram definition={definition} />
    </div>
  );

  if (placement === 'sidebar') {
    return (
      <section
        className={cn(
          'border-t border-neutral-200 px-2 pb-4 pt-4 dark:border-neutral-800',
          className
        )}
        aria-labelledby="pipeline-viz-heading"
      >
        <h2 id="pipeline-viz-heading" className="sr-only">
          Pipeline visualizer
        </h2>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Network className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-xs font-medium">Graph preview</span>
        </div>
        <div className="mt-3 rounded-lg border border-neutral-200 bg-muted/20 p-3 dark:border-neutral-700">
          {panel}
        </div>
      </section>
    );
  }

  return (
    <section className={cn('border-b border-neutral-200 bg-card/50 dark:border-neutral-800', className)}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium outline-none ring-offset-background marker:hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Network className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-left">Pipeline preview</span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="border-t border-neutral-200 px-4 pb-4 dark:border-neutral-800">{panel}</div>
      </details>
    </section>
  );
}
