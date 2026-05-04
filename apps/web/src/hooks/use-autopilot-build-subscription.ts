'use client';

import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { mergeBuildFromServer, parseBuildStatusPayload } from '@/lib/autopilot-build-status';
import { useAutopilotStore } from '@/stores/autopilot-store';

const API_BASE =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const POLL_MS = 2000;

/**
 * Subscribes to build status for ``buildId``: tries **Server-Sent Events** first
 * (``GET /api/autopilot/build/{id}/stream``), then falls back to polling
 * ``GET /api/autopilot/build/{id}`` if the stream errors.
 */
export function useAutopilotBuildSubscription(buildId: string | null) {
  const upsertBuild = useAutopilotStore((s) => s.upsertBuild);
  const build = useAutopilotStore((s) => (buildId ? s.builds[buildId] : undefined));
  const [connectionMode, setConnectionMode] = useState<'sse' | 'poll' | null>(null);
  const transportRef = useRef<'sse' | 'poll' | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!buildId) {
      setConnectionMode(null);
      return;
    }

    let cancelled = false;

    const applyPayload = (raw: unknown) => {
      if (cancelled) return;
      const parsed = parseBuildStatusPayload(raw);
      if (!parsed) return;
      const prev = useAutopilotStore.getState().builds[parsed.id];
      const merged = mergeBuildFromServer(prev, parsed);
      upsertBuild(merged);
      const terminal = ['complete', 'failed', 'cancelled'].includes(merged.status);
      return terminal;
    };

    const pollOnce = async () => {
      try {
        const raw = await apiClient.get<unknown>(`/api/autopilot/build/${buildId}`);
        const done = applyPayload(raw);
        if (done && pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch {
        // leave prior UI; next tick retries
      }
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      transportRef.current = 'poll';
      setConnectionMode('poll');
      void pollOnce();
      pollTimerRef.current = setInterval(() => void pollOnce(), POLL_MS);
    };

    const closeEs = () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const streamUrl = `${API_BASE}/api/autopilot/build/${encodeURIComponent(buildId)}/stream`;
    transportRef.current = 'sse';
    setConnectionMode('sse');

    try {
      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const raw = JSON.parse(ev.data as string) as unknown;
          const done = applyPayload(raw);
          if (done) {
            closeEs();
            stopPolling();
          }
        } catch {
          startPolling();
          closeEs();
        }
      };

      es.onerror = () => {
        const row = useAutopilotStore.getState().builds[buildId];
        if (row && ['complete', 'failed', 'cancelled'].includes(row.status)) {
          closeEs();
          return;
        }
        closeEs();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      closeEs();
      stopPolling();
      transportRef.current = null;
      setConnectionMode(null);
    };
  }, [buildId, upsertBuild]);

  return { build, connectionMode };
}
