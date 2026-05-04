'use client';

import { FileUp, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ApiError, apiClient, formatApiErrorForUi, postFormData } from '@/lib/api-client';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';
import type { AutopilotUploadResponse } from '@/types/autopilot';

type ProjectSummaryRow = { id: string; name: string; description?: string | null };

type PaginatedProjects = {
  items: ProjectSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader({ className }: Readonly<{ className?: string }>) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProjectId = useAutopilotStore((s) => s.selectedBackendProjectId);
  const setSelectedProjectId = useAutopilotStore((s) => s.setSelectedBackendProjectId);
  const uploadedDocuments = useAutopilotStore((s) => s.uploadedDocuments);
  const addUploadedDocuments = useAutopilotStore((s) => s.addUploadedDocuments);
  const removeUploadedDocument = useAutopilotStore((s) => s.removeUploadedDocument);
  const clearUploadedDocuments = useAutopilotStore((s) => s.clearUploadedDocuments);

  const [apiProjects, setApiProjects] = useState<ProjectSummaryRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const data = await apiClient.get<PaginatedProjects>('/api/projects?page=1&page_size=50');
        if (cancelled) return;
        setApiProjects(data.items);
        const prev = useAutopilotStore.getState().selectedBackendProjectId;
        if (!prev || !data.items.some((p) => p.id === prev)) {
          setSelectedProjectId(data.items[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setProjectsError(e instanceof ApiError ? formatApiErrorForUi(e) : String(e));
          setApiProjects([]);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSelectedProjectId]);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) return;
      if (!selectedProjectId) {
        setUploadError('Select a backend project first (create one from Templates if the list is empty).');
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.set('projectId', selectedProjectId);
        for (const f of files) {
          form.append('files', f, f.name);
        }
        const res = await postFormData<AutopilotUploadResponse>('/api/autopilot/upload', form);
        addUploadedDocuments(
          res.documents.map((d) => ({
            objectId: d.objectId,
            originalName: d.originalFilename,
            sizeBytes: d.sizeBytes,
          }))
        );
      } catch (e) {
        setUploadError(e instanceof ApiError ? formatApiErrorForUi(e) : String(e));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [addUploadedDocuments, selectedProjectId]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (list?.length) void uploadFiles(list);
    },
    [uploadFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles]
  );

  return (
    <section className={cn('rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950', className)}>
      <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Document upload
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Files are stored in the MinIO bucket configured for this environment. Object IDs are sent as{' '}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">documentIds</code> when you
        start a build from the progress panel below.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor={`${inputId}-project`} className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Backend project
          </label>
          <select
            id={`${inputId}-project`}
            className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            disabled={projectsLoading || apiProjects.length === 0}
          >
            {apiProjects.length === 0 && !projectsLoading ? (
              <option value="">No projects — create one first</option>
            ) : null}
            {apiProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projectsLoading ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading projects…
            </p>
          ) : null}
          {projectsError ? (
            <p className="mt-1 text-xs text-destructive">{projectsError}</p>
          ) : null}
          {apiProjects.length === 0 && !projectsLoading && !projectsError ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No server projects yet.{' '}
              <Link href={ROUTES.templates} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                Open Templates
              </Link>{' '}
              to create a project, or use the{' '}
              <Link href={ROUTES.projects} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                Projects
              </Link>{' '}
              page.
            </p>
          ) : null}
        </div>

        <div>
          <input
            ref={fileInputRef}
            id={`${inputId}-files`}
            type="file"
            multiple
            className="sr-only"
            accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.htm,.docx"
            onChange={onInputChange}
            disabled={uploading || !selectedProjectId}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
              dragActive
                ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-950/30'
                : 'border-neutral-300 bg-neutral-50/50 hover:border-primary-400 hover:bg-primary-50/40 dark:border-neutral-600 dark:bg-neutral-900/40',
              (!selectedProjectId || uploading) && 'pointer-events-none opacity-60'
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" aria-hidden />
            ) : (
              <FileUp className="h-8 w-8 text-neutral-400 dark:text-neutral-500" aria-hidden />
            )}
            <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, TXT, Markdown, CSV, JSON, HTML, DOCX — up to 25 files, 50 MiB each
            </p>
          </div>
          {uploadError ? <p className="mt-2 text-sm text-destructive">{uploadError}</p> : null}
        </div>

        {uploadedDocuments.length > 0 ? (
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Uploaded for this session</h3>
              <button
                type="button"
                onClick={() => clearUploadedDocuments()}
                className="text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                Clear all
              </button>
            </div>
            <ul className="mt-2 divide-y rounded-md border border-neutral-200 dark:border-neutral-800">
              {uploadedDocuments.map((doc, index) => (
                <li key={`${doc.objectId}-${index}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{doc.originalName}</p>
                    <p className="truncate text-xs text-muted-foreground" title={doc.objectId}>
                      {doc.objectId}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatBytes(doc.sizeBytes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedDocument(index)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${doc.originalName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
