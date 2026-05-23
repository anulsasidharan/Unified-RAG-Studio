'use client';

import { useCallback, useMemo } from 'react';
import { Cloud, Database, FileUp, Globe, Link2, Server } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import {
  buildIngestionConfigWithSources,
  ensureIngestionSources,
  getEnabledIngestionSourceTypes,
} from '@/lib/data-ingestion-sources';
import { DataIngestionConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type {
  DataIngestionConfig,
  DataIngestionSourceSlot,
  DataIngestionSourceType,
} from '@/types/pipeline';

const DEFAULT_INGESTION = createDefaultPipelineConfiguration().stages.dataIngestion!;

const SOURCE_OPTIONS: {
  id: DataIngestionSourceType;
  label: string;
  description: string;
  icon: typeof FileUp;
}[] = [
  {
    id: 'file-upload',
    label: 'File upload',
    description: 'Upload PDFs, docs, and text from your machine or build artifacts.',
    icon: FileUp,
  },
  {
    id: 's3',
    label: 'Amazon S3',
    description: 'Ingest objects from an S3 bucket (batch or event-driven).',
    icon: Cloud,
  },
  {
    id: 'gcs',
    label: 'Google Cloud Storage',
    description: 'Read documents from a GCS bucket.',
    icon: Cloud,
  },
  {
    id: 'azure-blob',
    label: 'Azure Blob Storage',
    description: 'Pull blobs from an Azure Storage container.',
    icon: Cloud,
  },
  {
    id: 'url',
    label: 'URL / Web',
    description: 'Fetch content from HTTP(S) endpoints or crawled URLs.',
    icon: Globe,
  },
  {
    id: 'database',
    label: 'Database',
    description: 'Connect to SQL or document stores for structured exports.',
    icon: Database,
  },
  {
    id: 'api',
    label: 'HTTP API',
    description: 'Call a REST or GraphQL API that returns documents or chunks.',
    icon: Server,
  },
];

const FILE_TYPE_OPTIONS = ['pdf', 'md', 'txt', 'html', 'docx', 'csv', 'json'] as const;

type ConnField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
};

const CONNECTION_FIELDS: Record<DataIngestionSourceType, ConnField[]> = {
  'file-upload': [
    {
      key: 'watchPath',
      label: 'Watch path (optional)',
      placeholder: '/data/inbox or ./uploads',
    },
  ],
  s3: [
    { key: 'bucket', label: 'Bucket name', placeholder: 'my-rag-corpus' },
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'prefix', label: 'Object prefix', placeholder: 'documents/' },
  ],
  gcs: [
    { key: 'bucket', label: 'Bucket name', placeholder: 'my-rag-corpus' },
    { key: 'prefix', label: 'Object prefix', placeholder: 'documents/' },
  ],
  'azure-blob': [
    { key: 'accountName', label: 'Storage account', placeholder: 'mystorageaccount' },
    { key: 'containerName', label: 'Container', placeholder: 'rag-docs' },
    { key: 'prefix', label: 'Blob prefix', placeholder: 'incoming/' },
  ],
  url: [
    {
      key: 'seedUrls',
      label: 'Seed URLs',
      placeholder: 'https://example.com/docs, https://docs.example.com',
    },
  ],
  database: [
    { key: 'host', label: 'Host', placeholder: 'db.example.com' },
    { key: 'port', label: 'Port', placeholder: '5432' },
    { key: 'database', label: 'Database name', placeholder: 'app_db' },
    { key: 'sslMode', label: 'SSL mode', placeholder: 'require' },
  ],
  api: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com/v1' },
    {
      key: 'authHeaderEnv',
      label: 'Auth env var name (reference only)',
      placeholder: 'MY_API_TOKEN',
    },
  ],
};

function mergeIngestion(
  current: DataIngestionConfig | undefined,
  patch: Partial<DataIngestionConfig> & {
    preprocessing?: Partial<DataIngestionConfig['preprocessing']>;
    metadata?: Partial<DataIngestionConfig['metadata']>;
    sources?: DataIngestionSourceSlot[];
  },
): DataIngestionConfig {
  const base = current ?? DEFAULT_INGESTION;
  return {
    ...base,
    ...patch,
    preprocessing: {
      ...base.preprocessing,
      ...patch.preprocessing,
    },
    metadata: {
      ...base.metadata,
      ...patch.metadata,
    },
    fileTypes: patch.fileTypes ?? base.fileTypes,
    sources: patch.sources !== undefined ? patch.sources : base.sources,
    connectionConfig:
      patch.connectionConfig !== undefined ? patch.connectionConfig : base.connectionConfig,
  };
}

export function DataIngestionConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.dataIngestion ?? DEFAULT_INGESTION;
  const sourceSlots = useMemo(() => ensureIngestionSources(cfg), [cfg]);

  const setIngestion = useCallback(
    (next: DataIngestionConfig) => {
      updateStages({ dataIngestion: next });
    },
    [updateStages],
  );

  const patchIngestion = useCallback(
    (patch: Parameters<typeof mergeIngestion>[1]) => {
      setIngestion(mergeIngestion(draft.stages.dataIngestion, patch));
    },
    [draft.stages.dataIngestion, setIngestion],
  );

  const commitSourceSlots = useCallback(
    (nextSlots: DataIngestionSourceSlot[]) => {
      const base = draft.stages.dataIngestion ?? DEFAULT_INGESTION;
      setIngestion(buildIngestionConfigWithSources(base, nextSlots));
    },
    [draft.stages.dataIngestion, setIngestion],
  );

  const toggleSourceEnabled = useCallback(
    (sourceType: DataIngestionSourceType, enabled: boolean) => {
      const slots = ensureIngestionSources(cfg);
      const next = slots.map((s) => (s.sourceType === sourceType ? { ...s, enabled } : s));
      const stillHas = next.some((s) => s.enabled);
      if (!stillHas) return;
      commitSourceSlots(next);
    },
    [cfg, commitSourceSlots],
  );

  const patchSlotConnection = useCallback(
    (sourceType: DataIngestionSourceType, key: string, value: string) => {
      const slots = ensureIngestionSources(cfg);
      const next = slots.map((s) => {
        if (s.sourceType !== sourceType) return s;
        const raw = { ...(s.connectionConfig as Record<string, string> | undefined) };
        if (!value.trim()) delete raw[key];
        else raw[key] = value.trim();
        return {
          ...s,
          connectionConfig: Object.keys(raw).length ? raw : undefined,
        };
      });
      commitSourceSlots(next);
    },
    [cfg, commitSourceSlots],
  );

  const validation = useMemo(() => DataIngestionConfigSchema.safeParse(cfg), [cfg]);

  const toggleFileType = (ext: string) => {
    const lower = ext.toLowerCase();
    const set = new Set(cfg.fileTypes.map((x) => x.toLowerCase()));
    if (set.has(lower)) {
      if (set.size <= 1) return;
      set.delete(lower);
    } else {
      set.add(lower);
    }
    patchIngestion({ fileTypes: Array.from(set) });
  };

  const connValueFor = (sourceType: DataIngestionSourceType, key: string): string => {
    const slot = sourceSlots.find((s) => s.sourceType === sourceType);
    const raw = slot?.connectionConfig?.[key];
    if (raw === undefined || raw === null) return '';
    return typeof raw === 'string' ? raw : String(raw);
  };

  const customRulesText = (cfg.preprocessing.customRules ?? []).join('\n');

  const metaEntries = useMemo(() => {
    const cm = cfg.metadata.customMetadata;
    const pairs = cm ? Object.entries(cm) : [];
    return pairs.length ? pairs : [['', '']];
  }, [cfg.metadata.customMetadata]);

  const updateMetaEntries = (rows: [string, string][]) => {
    const obj: Record<string, string> = {};
    for (const [k, v] of rows) {
      const key = k.trim();
      if (key) obj[key] = v;
    }
    patchIngestion({
      metadata: {
        ...cfg.metadata,
        customMetadata: Object.keys(obj).length ? obj : undefined,
      },
    });
  };

  return (
    <div className={cn('space-y-8', className)}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Enable every channel you want to ingest from in parallel. Connection hints are stored per
          source.
        </p>
        <div role="group" aria-label="Ingestion sources" className="grid gap-4 sm:grid-cols-2">
          {SOURCE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const slot = sourceSlots.find((s) => s.sourceType === opt.id);
            const selected = Boolean(slot?.enabled);
            return (
              <button
                key={opt.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggleSourceEnabled(opt.id, !selected)}
                className={cn(
                  'flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  selected
                    ? 'border-primary-600 bg-primary-600/[0.06] ring-primary-600 dark:bg-primary-500/10 ring-2'
                    : 'bg-card hover:border-primary-400/60 hover:bg-accent/40 border-neutral-200 dark:border-neutral-700',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                      selected
                        ? 'border-primary-600 text-primary-700 dark:text-primary-200'
                        : 'border-muted',
                    )}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground font-semibold">{opt.label}</span>
                    <p className="text-muted-foreground mt-1 text-sm">{opt.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="ingestion-file-types-heading"
      >
        <h2 id="ingestion-file-types-heading" className="text-foreground text-lg font-semibold">
          Allowed file types
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Extensions included when scanning or validating uploads. At least one type is required.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILE_TYPE_OPTIONS.map((ext) => {
            const active = cfg.fileTypes.map((x) => x.toLowerCase()).includes(ext);
            return (
              <button
                key={ext}
                type="button"
                onClick={() => toggleFileType(ext)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary-600 bg-primary-600/15 text-primary-900 dark:bg-primary-500/20 dark:text-primary-50'
                    : 'border-border bg-muted/40 text-muted-foreground hover:border-primary-400/50',
                )}
              >
                .{ext}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="ingestion-prep-heading"
      >
        <h2 id="ingestion-prep-heading" className="text-foreground text-lg font-semibold">
          Preprocessing
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Normalization runs before chunking; aligns with the backend ingestion service.
        </p>
        <ul className="mt-4 space-y-3">
          {(
            [
              ['stripHtml', 'Strip HTML tags', cfg.preprocessing.stripHtml],
              [
                'normalizeWhitespace',
                'Normalize whitespace',
                cfg.preprocessing.normalizeWhitespace,
              ],
              [
                'extractMetadata',
                'Extract document metadata (title, dates, etc.)',
                cfg.preprocessing.extractMetadata,
              ],
            ] as const
          ).map(([key, label, checked]) => (
            <li
              key={key}
              className="border-border bg-muted/20 flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
            >
              <span className="text-foreground text-sm">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() =>
                  patchIngestion({
                    preprocessing: { ...cfg.preprocessing, [key]: !checked },
                  })
                }
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  checked ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted',
                )}
              >
                <span
                  className={cn(
                    'bg-background pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full shadow transition',
                    checked ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <label htmlFor="custom-rules" className="text-foreground text-sm font-medium">
            Custom rules (one per line)
          </label>
          <p id="custom-rules-hint" className="text-muted-foreground text-xs">
            Optional regex or pipeline hints interpreted by your deployment&apos;s preprocessor.
          </p>
          <textarea
            id="custom-rules"
            aria-describedby="custom-rules-hint"
            rows={4}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-2 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
            value={customRulesText}
            onChange={(e) => {
              const lines = e.target.value
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
              patchIngestion({
                preprocessing: {
                  ...cfg.preprocessing,
                  customRules: lines.length ? lines : undefined,
                },
              });
            }}
          />
        </div>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="ingestion-meta-heading"
      >
        <h2 id="ingestion-meta-heading" className="text-foreground text-lg font-semibold">
          Chunk / document metadata
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Controls optional fields attached to each chunk for tracing and filtering.
        </p>
        <ul className="mt-4 space-y-3">
          {(
            [
              ['includeSource', 'Include source path or URI', cfg.metadata.includeSource],
              ['includePageNumber', 'Include page numbers (PDFs)', cfg.metadata.includePageNumber],
            ] as const
          ).map(([key, label, checked]) => (
            <li
              key={key}
              className="border-border bg-muted/20 flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
            >
              <span className="text-foreground text-sm">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() =>
                  patchIngestion({
                    metadata: { ...cfg.metadata, [key]: !checked },
                  })
                }
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
                  checked ? 'border-primary-600 bg-primary-600' : 'border-muted bg-muted',
                )}
              >
                <span
                  className={cn(
                    'bg-background pointer-events-none inline-block h-5 w-5 translate-y-0 rounded-full shadow transition',
                    checked ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <h3 className="text-foreground text-sm font-semibold">Custom metadata fields</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Static key/value pairs merged onto every document (for example tenant or product IDs).
          </p>
          <ul className="mt-3 space-y-2">
            {metaEntries.map((pair, idx) => {
              const row = pair as [string, string];
              return (
                <li key={idx} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    type="text"
                    aria-label={`Custom metadata key ${idx + 1}`}
                    placeholder="Key"
                    className="border-input bg-background min-w-[120px] flex-1 rounded-md border px-3 py-2 text-sm"
                    value={row[0]}
                    onChange={(e) => {
                      const next = [...metaEntries] as [string, string][];
                      next[idx] = [e.target.value, row[1]];
                      updateMetaEntries(next);
                    }}
                  />
                  <input
                    type="text"
                    aria-label={`Custom metadata value ${idx + 1}`}
                    placeholder="Value"
                    className="border-input bg-background min-w-[120px] flex-1 rounded-md border px-3 py-2 text-sm"
                    value={row[1]}
                    onChange={(e) => {
                      const next = [...metaEntries] as [string, string][];
                      next[idx] = [row[0], e.target.value];
                      updateMetaEntries(next);
                    }}
                  />
                  <button
                    type="button"
                    className="border-border text-muted-foreground hover:bg-muted rounded-md border px-2 py-2 text-xs"
                    onClick={() => {
                      const next = (metaEntries as [string, string][]).filter((_, i) => i !== idx);
                      updateMetaEntries(next.length ? next : [['', '']]);
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="text-primary-600 dark:text-primary-400 mt-2 text-sm font-medium hover:underline"
            onClick={() => {
              updateMetaEntries([...(metaEntries as [string, string][]), ['', '']]);
            }}
          >
            Add field
          </button>
        </div>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="ingestion-conn-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="ingestion-conn-heading" className="text-foreground text-lg font-semibold">
              Connection hints
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              One block per enabled source. Non-secret placeholders are saved under each slot&apos;s{' '}
              <code className="bg-muted rounded px-1 text-xs">connectionConfig</code>. Primary
              source (<span className="text-foreground font-medium">{cfg.sourceType}</span>) stays
              first in the enabled list for exports that still expect a single{' '}
              <code className="bg-muted rounded px-1 text-xs">sourceType</code>.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Reference only
          </span>
        </div>
        <div className="mt-6 space-y-8">
          {getEnabledIngestionSourceTypes(cfg).map((stype) => {
            const label = SOURCE_OPTIONS.find((o) => o.id === stype)?.label ?? stype;
            return (
              <div
                key={stype}
                className="border-border bg-muted/10 dark:bg-muted/5 rounded-lg border p-4"
                aria-label={`Connection hints for ${label}`}
              >
                <h3 className="text-foreground text-sm font-semibold">{label}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {CONNECTION_FIELDS[stype].map((field) => (
                    <div
                      key={field.key}
                      className={cn(field.key === 'seedUrls' && 'sm:col-span-2')}
                    >
                      <label
                        htmlFor={`conn-${stype}-${field.key}`}
                        className="text-foreground text-sm font-medium"
                      >
                        {field.label}
                      </label>
                      <input
                        id={`conn-${stype}-${field.key}`}
                        type={field.type ?? 'text'}
                        autoComplete="off"
                        placeholder={field.placeholder}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
                        value={connValueFor(stype, field.key)}
                        onChange={(e) => patchSlotConnection(stype, field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
      ) : (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Ingestion settings are valid and saved with your pipeline draft (local storage).
        </p>
      )}
    </div>
  );
}
