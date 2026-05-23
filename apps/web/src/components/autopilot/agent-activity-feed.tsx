'use client';

import { FileJson, FileText, ListFilter, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useAutopilotStore } from '@/stores/autopilot-store';
import type { BuildMessage } from '@/types/autopilot';

const MESSAGE_TYPES: BuildMessage['type'][] = ['info', 'success', 'warning', 'error'];

function messageAccent(type: BuildMessage['type']): string {
  switch (type) {
    case 'error':
      return 'border-l-red-500 bg-red-50/40 dark:bg-red-950/20';
    case 'warning':
      return 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20';
    case 'success':
      return 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20';
    default:
      return 'border-l-neutral-300 bg-neutral-50/50 dark:border-l-neutral-600 dark:bg-neutral-900/30';
  }
}

function downloadText(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

export function AgentActivityFeed({ className }: Readonly<{ className?: string }>) {
  const uid = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  const activeBuildId = useAutopilotStore((s) => s.activeBuildId);
  const builds = useAutopilotStore((s) => s.builds);
  const build = activeBuildId ? builds[activeBuildId] : undefined;
  const messages = useMemo(() => build?.messages ?? [], [build]);

  const [query, setQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('__all__');
  const [typeMask, setTypeMask] = useState<Record<BuildMessage['type'], boolean>>({
    info: true,
    success: true,
    warning: true,
    error: true,
  });

  useEffect(() => {
    setQuery('');
    setAgentFilter('__all__');
    setTypeMask({ info: true, success: true, warning: true, error: true });
  }, [activeBuildId]);

  const agents = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) {
      if (m.agent) s.add(m.agent);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [messages]);

  const anyTypeOn = useMemo(() => MESSAGE_TYPES.some((t) => typeMask[t]), [typeMask]);
  const typeFilterActive = useMemo(
    () => anyTypeOn && MESSAGE_TYPES.some((t) => !typeMask[t]),
    [typeMask, anyTypeOn],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (typeFilterActive && !typeMask[m.type]) return false;
      if (agentFilter !== '__all__' && (m.agent ?? '') !== agentFilter) return false;
      if (!q) return true;
      const hay = `${m.text} ${m.agent ?? ''} ${m.timestamp}`.toLowerCase();
      return hay.includes(q);
    });
  }, [messages, query, agentFilter, typeMask, typeFilterActive]);

  const toggleType = useCallback((t: BuildMessage['type']) => {
    setTypeMask((prev) => ({ ...prev, [t]: !prev[t] }));
  }, []);

  const resetFilters = useCallback(() => {
    setQuery('');
    setAgentFilter('__all__');
    setTypeMask({ info: true, success: true, warning: true, error: true });
  }, []);

  const exportJson = useCallback(() => {
    if (!build) return;
    const payload = {
      buildId: build.id,
      buildStatus: build.status,
      exportedAt: new Date().toISOString(),
      filters: {
        query: query.trim() || undefined,
        agent: agentFilter === '__all__' ? undefined : agentFilter,
        typesIncluded: typeFilterActive ? MESSAGE_TYPES.filter((t) => typeMask[t]) : undefined,
      },
      messageCount: filtered.length,
      messages: filtered,
    };
    downloadText(
      `autopilot-activity-${build.id.slice(0, 8)}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      'application/json',
    );
  }, [build, filtered, query, agentFilter, typeMask, typeFilterActive]);

  const exportTxt = useCallback(() => {
    if (!build) return;
    const lines = filtered.map((m) => {
      const who = m.agent ? `${m.agent} · ` : '';
      return `[${m.timestamp}] ${who}${m.type.toUpperCase()} — ${m.text}`;
    });
    const header = `# Autopilot agent activity · build ${build.id}\n# exported ${new Date().toISOString()}\n\n`;
    downloadText(
      `autopilot-activity-${build.id.slice(0, 8)}.txt`,
      header + lines.join('\n') + '\n',
      'text/plain;charset=utf-8',
    );
  }, [build, filtered]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, messages.length]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickBottomRef.current = near;
  }, []);

  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Agent activity feed
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Stream of{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              messages
            </code>{' '}
            from the active build (same SSE / poll updates as Build progress). Filter and export the
            visible slice.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={!build || filtered.length === 0}
            onClick={() => exportJson()}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <FileJson className="h-3.5 w-3.5" aria-hidden />
            JSON
          </button>
          <button
            type="button"
            disabled={!build || filtered.length === 0}
            onClick={() => exportTxt()}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Text
          </button>
        </div>
      </div>

      {!activeBuildId ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Choose an <strong>Active build</strong> in Build progress to load agent log lines here.
        </p>
      ) : !build ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Build row not in memory yet — start streaming or pick another build.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label
                  htmlFor={`${uid}-q`}
                  className="flex items-center gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  <Search className="h-3 w-3" aria-hidden />
                  Search
                </label>
                <input
                  id={`${uid}-q`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by text, agent, or timestamp…"
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                />
              </div>
              <div className="min-w-[10rem]">
                <label
                  htmlFor={`${uid}-agent`}
                  className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Agent
                </label>
                <select
                  id={`${uid}-agent`}
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                >
                  <option value="__all__">All agents</option>
                  {agents.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <ListFilter className="h-3 w-3" aria-hidden />
                Message types
              </p>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                      typeMask[t]
                        ? 'border-primary-500 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-950/50 dark:text-primary-100'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-500 line-through dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500',
                    )}
                  >
                    {t}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-muted-foreground rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs hover:border-neutral-400 hover:text-neutral-800 dark:border-neutral-600 dark:hover:text-neutral-200"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground mt-4 flex items-center justify-between gap-2 text-xs">
            <span>
              Showing{' '}
              <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                {filtered.length}
              </span>
              {' / '}
              <span className="tabular-nums">{messages.length}</span> lines
            </span>
            <span className="truncate font-mono text-[10px] text-neutral-500" title={build.id}>
              {build.id}
            </span>
          </div>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="mt-2 max-h-[min(24rem,50vh)] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/30 dark:border-neutral-800 dark:bg-neutral-900/20"
          >
            {filtered.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                {messages.length === 0
                  ? 'No agent messages yet — they appear as the orchestrator emits progress.'
                  : 'No lines match the current filters.'}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((m, i) => (
                  <li
                    key={`${m.timestamp}-${i}`}
                    className={cn('border-l-4 px-3 py-2.5 text-sm', messageAccent(m.type))}
                  >
                    <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <time className="font-mono tabular-nums">{m.timestamp}</time>
                      {m.agent ? (
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {m.agent}
                        </span>
                      ) : null}
                      <span className="uppercase tracking-wide">{m.type}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-neutral-900 dark:text-neutral-100">
                      {m.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
