'use client';

import { Check, Copy, Download, Loader2, Package, RefreshCw, Rocket } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, apiClient } from '@/lib/api-client';
import { deployHintCaption, deployHintCommand } from '@/lib/deploy-hints';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { DesignerExportFormat, DesignerExportResponse, PipelineConfiguration } from '@/types/pipeline';

const DEBOUNCE_MS = 450;

const FORMAT_OPTIONS: { id: DesignerExportFormat; label: string; short: string }[] = [
  { id: 'python', label: 'Python (LangChain)', short: 'Python' },
  { id: 'yaml', label: 'YAML manifest', short: 'YAML' },
  { id: 'terraform', label: 'Terraform (HCL)', short: 'Terraform' },
  { id: 'docker-compose', label: 'Docker Compose', short: 'Compose' },
  { id: 'k8s', label: 'Kubernetes YAML', short: 'K8s' },
];

export function CodeExporter({
  className,
  id,
}: Readonly<{
  className?: string;
  id?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const [format, setFormat] = useState<DesignerExportFormat>('python');
  const [result, setResult] = useState<DesignerExportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const firstRun = useRef(true);
  const prevFormat = useRef(format);

  const draftDigest = useMemo(() => JSON.stringify(draft), [draft]);

  const fetchExport = useCallback(
    async (config: PipelineConfiguration, fmt: DesignerExportFormat, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.post<DesignerExportResponse>('/api/designer/export', {
          config,
          format: fmt,
        }, signal);
        if (!signal.aborted) {
          setResult(data);
          setLastOkAt(Date.now());
        }
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof ApiError) {
          const detail =
            e.data && typeof e.data === 'object' && 'detail' in e.data
              ? String((e.data as { detail?: unknown }).detail)
              : e.message;
          setError(detail || e.message);
        } else {
          setError(e instanceof Error ? e.message : 'Export request failed');
        }
        setResult(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const formatJustChanged = prevFormat.current !== format;
    prevFormat.current = format;
    const delay =
      formatJustChanged ? 0 : firstRun.current ? 0 : DEBOUNCE_MS;
    firstRun.current = false;
    const tid = window.setTimeout(() => {
      void fetchExport(draft, format, ctrl.signal);
    }, delay);
    return () => {
      window.clearTimeout(tid);
      ctrl.abort();
    };
  }, [draftDigest, format, draft, fetchExport]);

  const deployCmd = useMemo(() => {
    if (!result) return '';
    return deployHintCommand(result.format, result.filename);
  }, [result]);

  const copyCode = useCallback(async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setError('Clipboard unavailable — select the text manually.');
    }
  }, [result]);

  const copyDeploy = useCallback(async () => {
    if (!deployCmd) return;
    try {
      await navigator.clipboard.writeText(deployCmd);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      setError('Clipboard unavailable — copy the deploy command manually.');
    }
  }, [deployCmd]);

  const download = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.code], {
      type: result.contentType || 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <section
      id={id}
      className={cn(
        'w-full shrink-0 border-t border-neutral-200 bg-card/40 py-4 dark:border-neutral-800 scroll-mt-4',
        className
      )}
      aria-labelledby="code-exporter-heading"
    >
      <h2 id="code-exporter-heading" className="sr-only">
        Pipeline code export
      </h2>

      <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-sm font-medium text-foreground">Code export</span>
            <span className="text-xs text-muted-foreground">(from draft)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Generating…
              </span>
            ) : lastOkAt ? (
              <span className="tabular-nums">Updated {new Date(lastOkAt).toLocaleTimeString()}</span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const ctrl = new AbortController();
                void fetchExport(draft, format, ctrl.signal);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-background px-2 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-muted dark:border-neutral-600"
              title="Regenerate export now"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Generated artefacts match{' '}
          <span className="font-medium text-foreground">POST /api/designer/export</span> (Python LangChain sketch, YAML,
          Terraform, Docker Compose, or Kubernetes). Copy, download, or use the deploy hints as a starting point — review
          secrets and cloud context before production.
        </p>

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Export format"
        >
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={format === opt.id}
              onClick={() => setFormat(opt.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                format === opt.id
                  ? 'border-primary-600 bg-primary-600 text-primary-50 dark:border-primary-500 dark:bg-primary-600'
                  : 'border-neutral-200 bg-background text-muted-foreground hover:bg-muted dark:border-neutral-600'
              )}
            >
              {opt.short}
            </button>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result?.code || loading}
            onClick={() => void copyCode()}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600"
          >
            {copiedCode ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            disabled={!result?.code || loading}
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </button>
          <span className="text-xs text-muted-foreground">
            {result ? (
              <>
                Suggested file: <span className="font-mono text-foreground">{result.filename}</span>
              </>
            ) : null}
          </span>
        </div>

        <details className="mt-4 rounded-lg border border-neutral-200 bg-muted/15 dark:border-neutral-700">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground outline-none ring-offset-background marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" aria-hidden />
              Deploy hints
            </span>
          </summary>
          <div className="space-y-2 border-t border-neutral-200 px-3 py-3 text-sm dark:border-neutral-700">
            <p className="text-xs text-muted-foreground">
              {deployHintCaption(result?.format ?? format)}
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 font-mono text-xs text-foreground">
              {result ? deployCmd : 'Generate an export to see suggested commands.'}
            </pre>
            <button
              type="button"
              disabled={!deployCmd || loading}
              onClick={() => void copyDeploy()}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-background px-2 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600"
            >
              {copiedCmd ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copiedCmd ? 'Command copied' : 'Copy deploy command'}
            </button>
          </div>
        </details>

        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
          {loading && !result ? (
            <div className="flex items-center gap-2 bg-muted/20 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
              Generating {FORMAT_OPTIONS.find((f) => f.id === format)?.label ?? format}…
            </div>
          ) : (
            <pre
              className={cn(
                'max-h-[min(420px,50vh)] overflow-auto bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-neutral-100 transition-opacity dark:bg-neutral-950',
                loading && 'opacity-60'
              )}
              tabIndex={0}
            >
              <code>{result?.code ?? ''}</code>
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}
