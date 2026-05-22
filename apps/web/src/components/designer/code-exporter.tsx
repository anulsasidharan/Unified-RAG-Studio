'use client';

import { Check, Copy, Download, Loader2, Package, RefreshCw, Rocket } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWhenVisible } from '@/hooks/use-when-visible';
import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { deployHintCaption, deployHintCommand } from '@/lib/deploy-hints';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import { useAuthStore } from '@/stores/auth-store';
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const [sectionRef, sectionVisible] = useWhenVisible<HTMLElement>();
  const [format, setFormat] = useState<DesignerExportFormat>('python');
  const [result, setResult] = useState<DesignerExportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const firstRun = useRef(true);
  const prevFormat = useRef(format);

  const draftDigest = useMemo(() => JSON.stringify(draft), [draft]);

  const fetchExport = useCallback(
    async (config: PipelineConfiguration, fmt: DesignerExportFormat, signal: AbortSignal) => {
      if (!useAuthStore.getState().accessToken?.trim()) {
        setLoading(false);
        setError('Sign in to export pipeline code.');
        setResult(null);
        return;
      }
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
          setError(formatApiErrorForUi(e));
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
    if (!sectionVisible) return;
    if (!accessToken?.trim()) {
      setLoading(false);
      setError('Sign in to export pipeline code.');
      setResult(null);
      return;
    }
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
  }, [draftDigest, format, draft, fetchExport, accessToken, sectionVisible]);

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
      ref={sectionRef}
      id={id}
      className={cn(
        'w-full shrink-0 border-t border-neutral-200 bg-neutral-950 py-6 dark:border-neutral-800 scroll-mt-4',
        className
      )}
      aria-labelledby="code-exporter-heading"
    >
      <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
              <Package className="h-4 w-4 text-neutral-300" aria-hidden />
            </div>
            <div>
              <h2 id="code-exporter-heading" className="font-display text-sm font-bold text-neutral-100">
                Code export
              </h2>
              <p className="text-[11px] text-neutral-400">From current draft · auto-updates</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
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
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-300 shadow-sm transition-all hover:border-neutral-600 hover:bg-neutral-700"
              title="Regenerate export now"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-1.5"
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
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                format === opt.id
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              )}
            >
              {opt.short}
            </button>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result?.code || loading}
            onClick={() => void copyCode()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 shadow-sm transition-all hover:border-neutral-600 hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {copiedCode ? (
              <Check className="h-4 w-4 text-emerald-400" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            disabled={!result?.code || loading}
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 shadow-sm transition-all hover:border-neutral-600 hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </button>
          {result ? (
            <span className="text-xs text-neutral-500">
              <span className="font-mono text-neutral-400">{result.filename}</span>
            </span>
          ) : null}
        </div>

        <details className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-neutral-300 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Rocket className="h-4 w-4 text-neutral-500" aria-hidden />
              Deploy hints
            </span>
          </summary>
          <div className="space-y-3 border-t border-neutral-800 px-4 py-3 text-sm">
            <p className="text-xs text-neutral-500">
              {deployHintCaption(result?.format ?? format)}
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-950 p-3 font-mono text-xs text-neutral-300">
              {result ? deployCmd : 'Generate an export to see suggested commands.'}
            </pre>
            <button
              type="button"
              disabled={!deployCmd || loading}
              onClick={() => void copyDeploy()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-all hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {copiedCmd ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copiedCmd ? 'Command copied' : 'Copy deploy command'}
            </button>
          </div>
        </details>

        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-800">
          {loading && !result ? (
            <div className="flex items-center gap-2 bg-neutral-900 p-6 text-sm text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
              Generating {FORMAT_OPTIONS.find((f) => f.id === format)?.label ?? format}…
            </div>
          ) : (
            <pre
              className={cn(
                'max-h-[min(420px,50vh)] overflow-auto bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-neutral-100 transition-opacity',
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
