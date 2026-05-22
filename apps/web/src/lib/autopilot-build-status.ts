import type {
  AutopilotBuild,
  AutopilotDashboardMetrics,
  BuildMessage,
  BuildResult,
  BuildStatus,
  DashboardEmbeddingBenchRow,
  DashboardQualitySnapshot,
  DashboardRetrievalSummary,
  StageStatus,
} from '@/types/autopilot';

/** Matches ``AUTOPILOT_STAGE_ORDER`` in ``apps/api/app/core/agents/state.py``. */
export const AUTOPILOT_STAGE_ORDER = [
  'analyze',
  'chunking',
  'embedding',
  'retrieval',
  'generation',
  'evaluation',
  'deployment',
] as const;

export const AUTOPILOT_STAGE_LABELS: Record<string, string> = {
  analyze: 'Document analysis',
  chunking: 'Chunking',
  embedding: 'Embeddings',
  retrieval: 'Retrieval',
  generation: 'Generation',
  evaluation: 'Evaluation',
  deployment: 'Deployment',
  queued: 'Queued',
  orchestrate: 'Orchestration',
  pending: 'Pending',
};

type StageWire = {
  status?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  message?: string | null;
};

function coerceStageStatus(raw: string | undefined): StageStatus['status'] {
  if (raw === 'running' || raw === 'complete' || raw === 'failed' || raw === 'pending') {
    return raw;
  }
  return 'pending';
}

function normalizeStage(cell: StageWire | undefined): StageStatus {
  return {
    status: coerceStageStatus(cell?.status),
    startedAt: cell?.startedAt ?? undefined,
    completedAt: cell?.completedAt ?? undefined,
    message: cell?.message ?? undefined,
  };
}

export function normalizeStagesFromApi(
  raw: Record<string, StageWire> | undefined | null,
): Record<string, StageStatus> {
  const out: Record<string, StageStatus> = {};
  for (const key of AUTOPILOT_STAGE_ORDER as readonly string[]) {
    out[key] = normalizeStage(raw?.[key]);
  }
  if (raw) {
    for (const key of Object.keys(raw)) {
      if (!out[key]) {
        out[key] = normalizeStage(raw[key]);
      }
    }
  }
  return out;
}

function coerceBuildStatus(raw: string | undefined): BuildStatus {
  if (
    raw === 'pending' ||
    raw === 'running' ||
    raw === 'complete' ||
    raw === 'failed' ||
    raw === 'cancelled'
  ) {
    return raw;
  }
  return 'failed';
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

function parseDashboardQuality(
  raw: Record<string, unknown> | undefined,
): DashboardQualitySnapshot | undefined {
  if (!raw) return undefined;
  const out: DashboardQualitySnapshot = {};
  const f = numOrUndef(raw.faithfulness);
  const ar = numOrUndef(raw.answerRelevance);
  const cp = numOrUndef(raw.contextPrecision);
  const cr = numOrUndef(raw.contextRecall);
  const lat = numOrUndef(raw.avgLatencyMs);
  if (f !== undefined) out.faithfulness = f;
  if (ar !== undefined) out.answerRelevance = ar;
  if (cp !== undefined) out.contextPrecision = cp;
  if (cr !== undefined) out.contextRecall = cr;
  if (lat !== undefined) out.avgLatencyMs = lat;
  if (typeof raw.meetsTargets === 'boolean') out.meetsTargets = raw.meetsTargets;
  return Object.keys(out).length ? out : undefined;
}

function parseDashboardEmbeddingRows(raw: unknown): DashboardEmbeddingBenchRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardEmbeddingBenchRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label : '';
    if (!label) continue;
    out.push({
      label,
      latencyMs: numOrUndef(r.latencyMs),
      compositeScore: numOrUndef(r.compositeScore),
      textsPerSecond: numOrUndef(r.textsPerSecond),
    });
  }
  return out;
}

function parseDashboardRetrieval(
  raw: Record<string, unknown> | undefined,
): DashboardRetrievalSummary | undefined {
  if (!raw) return undefined;
  const out: DashboardRetrievalSummary = {};
  if (typeof raw.strategy === 'string') out.strategy = raw.strategy;
  if (typeof raw.topK === 'number' && Number.isFinite(raw.topK)) out.topK = raw.topK;
  const perf = raw.performance;
  if (perf && typeof perf === 'object') {
    const pm: Record<string, number> = {};
    for (const [k, v] of Object.entries(perf as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) pm[k] = v;
    }
    if (Object.keys(pm).length) out.performance = pm;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseDashboardMetricsPayload(raw: unknown): AutopilotDashboardMetrics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  const quality = parseDashboardQuality(
    d.quality && typeof d.quality === 'object' ? (d.quality as Record<string, unknown>) : undefined,
  );
  const embeddingBenchmarks = parseDashboardEmbeddingRows(d.embeddingBenchmarks);
  const selectedEmbeddingLabel =
    typeof d.selectedEmbeddingLabel === 'string' ? d.selectedEmbeddingLabel : undefined;
  const retrieval = parseDashboardRetrieval(
    d.retrieval && typeof d.retrieval === 'object'
      ? (d.retrieval as Record<string, unknown>)
      : undefined,
  );
  if (!quality && embeddingBenchmarks.length === 0 && !selectedEmbeddingLabel && !retrieval) {
    return undefined;
  }
  return {
    quality,
    embeddingBenchmarks,
    selectedEmbeddingLabel,
    retrieval,
  };
}

function normalizeMessage(m: Record<string, unknown>): BuildMessage | null {
  const ts = m.timestamp;
  const text = m.text;
  const type = m.type;
  if (typeof ts !== 'string' || typeof text !== 'string') return null;
  const t =
    type === 'success' || type === 'warning' || type === 'error' || type === 'info' ? type : 'info';
  const agent = typeof m.agent === 'string' ? m.agent : undefined;
  return { timestamp: ts, text, type: t, agent };
}

/** Parses ``BuildStatusResponse`` JSON (camelCase) from poll or SSE. */
export function parseBuildStatusPayload(data: unknown): Omit<AutopilotBuild, 'input'> | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  if (o.error === 'not_found') {
    return null;
  }

  const buildId = o.buildId;
  if (typeof buildId !== 'string' || !buildId) return null;

  const stagesRaw = o.stages;
  const stagesObj =
    stagesRaw && typeof stagesRaw === 'object' ? (stagesRaw as Record<string, StageWire>) : {};

  const messagesRaw = o.messages;
  const messages: BuildMessage[] = [];
  if (Array.isArray(messagesRaw)) {
    for (const item of messagesRaw) {
      if (item && typeof item === 'object') {
        const m = normalizeMessage(item as Record<string, unknown>);
        if (m) messages.push(m);
      }
    }
  }

  const progress = typeof o.progress === 'number' ? Math.min(100, Math.max(0, o.progress)) : 0;
  const iteration =
    typeof o.iteration === 'number' && Number.isFinite(o.iteration) ? o.iteration : 0;
  const currentStage = typeof o.currentStage === 'string' ? o.currentStage : 'queued';

  let result: BuildResult | undefined;
  if (o.result && typeof o.result === 'object') {
    result = o.result as BuildResult;
  }

  const dashboardMetrics = parseDashboardMetricsPayload(o.dashboardMetrics);

  return {
    id: buildId,
    status: coerceBuildStatus(typeof o.status === 'string' ? o.status : undefined),
    progress,
    currentStage,
    iteration,
    stages: normalizeStagesFromApi(stagesObj),
    messages,
    result,
    dashboardMetrics,
    error: typeof o.error === 'string' ? o.error : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    completedAt: typeof o.completedAt === 'string' ? o.completedAt : undefined,
  };
}

export function mergeBuildFromServer(
  prev: AutopilotBuild | undefined,
  server: Omit<AutopilotBuild, 'input'>,
): AutopilotBuild {
  return {
    ...server,
    input:
      prev?.input ??
      ({
        documents: [],
        requirements: { targetMetrics: {} },
      } as AutopilotBuild['input']),
  };
}
