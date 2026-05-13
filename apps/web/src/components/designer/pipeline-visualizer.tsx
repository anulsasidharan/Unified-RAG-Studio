'use client';

import mermaid from 'mermaid';
import {
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  PictureInPicture2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  generateMermaidDiagram,
  generatePipelineHighlights,
  generatePipelineSummary,
} from '@/lib/generators/mermaidGenerator';
import { useDesignerStore } from '@/stores/designer-store';
import { cn } from '@/lib/utils';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const DEFAULT_INLINE_ZOOM = 0.85;
const DEFAULT_PIP_ZOOM = 1;

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
  zoom = 1,
}: Readonly<{
  definition: string;
  className?: string;
  /** CSS zoom factor (layout + rendering); default 1. */
  zoom?: number;
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
          style={{ zoom }}
          role="img"
          aria-label="Pipeline flow diagram"
        />
      )}
    </div>
  );
}

function ZoomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: Readonly<{
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-md border border-neutral-200 bg-background/95 px-1 py-0.5 text-xs dark:border-neutral-700',
        className
      )}
      role="toolbar"
      aria-label="Diagram zoom"
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN + 1e-6}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="min-w-[3.25rem] rounded-md px-2 py-1 font-mono text-[11px] tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Reset zoom to default"
        aria-label={`Zoom ${Math.round(zoom * 100)} percent, reset to default`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX - 1e-6}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PipelineVisualizer({
  className,
  id,
}: Readonly<{
  className?: string;
  id?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const diagramMaxVisitedStageIndex = useDesignerStore((s) => s.diagramMaxVisitedStageIndex);

  const [pipOpen, setPipOpen] = useState(false);
  const [pipMaximized, setPipMaximized] = useState(false);
  const [inlineZoom, setInlineZoom] = useState(DEFAULT_INLINE_ZOOM);
  const [pipZoom, setPipZoom] = useState(DEFAULT_PIP_ZOOM);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!pipOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPipOpen(false);
        setPipMaximized(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pipOpen]);

  const clampZoom = useCallback((z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)), []);

  const bumpInlineZoom = useCallback(
    (delta: number) => setInlineZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100)),
    [clampZoom]
  );

  const bumpPipZoom = useCallback(
    (delta: number) => setPipZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100)),
    [clampZoom]
  );

  const definition = useMemo(
    () =>
      generateMermaidDiagram(
        draft.stages,
        draft.cloudProvider,
        diagramMaxVisitedStageIndex,
        draft.guardrails
      ),
    [draft.stages, draft.cloudProvider, diagramMaxVisitedStageIndex, draft.guardrails]
  );

  const oneLine = useMemo(
    () => generatePipelineSummary(draft.stages, diagramMaxVisitedStageIndex),
    [draft.stages, diagramMaxVisitedStageIndex]
  );
  const bullets = useMemo(
    () =>
      generatePipelineHighlights(
        draft.stages,
        draft.cloudProvider,
        diagramMaxVisitedStageIndex,
        draft.guardrails
      ),
    [draft.stages, draft.cloudProvider, diagramMaxVisitedStageIndex, draft.guardrails]
  );

  const openPip = useCallback(() => {
    setPipZoom(DEFAULT_PIP_ZOOM);
    setPipOpen(true);
  }, []);

  const summaryPanel = (
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
    </div>
  );

  const pipOverlay =
    portalReady && pipOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[200]">
            <button
              type="button"
              className="absolute inset-0 z-0 bg-black/40 backdrop-blur-[1px] dark:bg-black/60"
              aria-label="Close picture-in-picture overlay"
              onClick={() => {
                setPipOpen(false);
                setPipMaximized(false);
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pip-graph-title"
              className={cn(
                'absolute z-10 flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-background shadow-2xl dark:border-neutral-700',
                pipMaximized
                  ? 'left-4 top-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]'
                  : 'bottom-6 right-6 h-[min(72vh,560px)] w-[min(92vw,640px)] min-h-[220px] min-w-[min(100%,320px)] resize'
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-muted/30 px-3 py-2 dark:border-neutral-700">
                <div className="flex min-w-0 items-center gap-2">
                  <PictureInPicture2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span id="pip-graph-title" className="truncate text-sm font-medium">
                    Pipeline graph
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ZoomToolbar
                    zoom={pipZoom}
                    onZoomIn={() => bumpPipZoom(ZOOM_STEP)}
                    onZoomOut={() => bumpPipZoom(-ZOOM_STEP)}
                    onReset={() => setPipZoom(DEFAULT_PIP_ZOOM)}
                  />
                  <button
                    type="button"
                    onClick={() => setPipMaximized((m) => !m)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={pipMaximized ? 'Restore window size' : 'Maximize'}
                    aria-label={pipMaximized ? 'Restore window size' : 'Maximize'}
                  >
                    {pipMaximized ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPipOpen(false);
                      setPipMaximized(false);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Close"
                    aria-label="Close picture-in-picture"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <MermaidDiagram key={definition} definition={definition} zoom={pipZoom} />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <section
      id={id}
      className={cn(
        'w-full shrink-0 border-t border-neutral-200 bg-card/40 py-4 dark:border-neutral-800 scroll-mt-4',
        className
      )}
      aria-labelledby="pipeline-viz-heading"
    >
      <h2 id="pipeline-viz-heading" className="sr-only">
        Pipeline visualizer
      </h2>

      <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8">
        <div className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Network className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Graph preview</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ZoomToolbar
                zoom={inlineZoom}
                onZoomIn={() => bumpInlineZoom(ZOOM_STEP)}
                onZoomOut={() => bumpInlineZoom(-ZOOM_STEP)}
                onReset={() => setInlineZoom(DEFAULT_INLINE_ZOOM)}
              />
              <button
                type="button"
                onClick={openPip}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground dark:border-neutral-600"
                title="Open graph in a floating resizable window"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden />
                Pop out
              </button>
            </div>
          </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          The drawing starts empty on Cloud Provider; each stage you move into adds the next blocks. Labels use
          your draft values; optional stages (rerank, routing, memory, evaluation, guardrails, human-in-the-loop)
          appear once you reach those steps.
        </p>
        </div>

        {/* Full-width strip: summary + diagram side-by-side on large screens */}
        <div className="mt-4 min-h-0 rounded-lg border border-neutral-200 bg-muted/20 dark:border-neutral-700 lg:grid lg:max-h-[min(560px,52vh)] lg:grid-cols-[minmax(200px,22rem)_minmax(0,1fr)] lg:overflow-hidden lg:divide-x lg:divide-neutral-200 dark:lg:divide-neutral-700">
          <div className="min-h-0 max-h-[min(420px,45vh)] overflow-y-auto p-3 lg:max-h-none">
            {summaryPanel}
          </div>
          <div className="min-h-0 min-w-0 border-t border-neutral-200 p-3 dark:border-neutral-700 lg:border-t-0 lg:overflow-auto">
            <MermaidDiagram key={definition} definition={definition} zoom={inlineZoom} />
          </div>
        </div>
      </div>
      {pipOverlay}
    </section>
  );
}
