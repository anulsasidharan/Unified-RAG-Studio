import type {
  DataIngestionConfig,
  DataIngestionSourceSlot,
  DataIngestionSourceType,
} from '@/types/pipeline';

/** Stable UI / export order for ingestion source types. */
export const INGESTION_SOURCE_TYPE_ORDER: readonly DataIngestionSourceType[] = [
  'file-upload',
  's3',
  'gcs',
  'azure-blob',
  'url',
  'database',
  'api',
] as const;

function cloneConn(raw: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!raw || Object.keys(raw).length === 0) return undefined;
  return { ...raw };
}

/**
 * Normalises optional `sources` into one slot per known source type (legacy drafts
 * only had `sourceType` + root `connectionConfig`).
 */
export function ensureIngestionSources(cfg: DataIngestionConfig): DataIngestionSourceSlot[] {
  const fromCfg = cfg.sources;
  if (fromCfg?.length) {
    const byType = new Map(fromCfg.map((s) => [s.sourceType, s]));
    return INGESTION_SOURCE_TYPE_ORDER.map((id) => {
      const row = byType.get(id);
      return {
        sourceType: id,
        enabled: row?.enabled ?? id === cfg.sourceType,
        connectionConfig: cloneConn(
          (row?.connectionConfig as Record<string, unknown> | undefined) ??
            (id === cfg.sourceType
              ? (cfg.connectionConfig as Record<string, unknown> | undefined)
              : undefined),
        ),
      };
    });
  }
  return INGESTION_SOURCE_TYPE_ORDER.map((id) => ({
    sourceType: id,
    enabled: id === cfg.sourceType,
    connectionConfig: cloneConn(
      id === cfg.sourceType
        ? (cfg.connectionConfig as Record<string, unknown> | undefined)
        : undefined,
    ),
  }));
}

export function getEnabledIngestionSourceTypes(
  cfg: DataIngestionConfig,
): DataIngestionSourceType[] {
  const slots = ensureIngestionSources(cfg);
  return INGESTION_SOURCE_TYPE_ORDER.filter(
    (id) => slots.find((s) => s.sourceType === id)?.enabled,
  );
}

/** Primary source for legacy fields (`sourceType`, root `connectionConfig`). */
export function primaryIngestionSource(slots: DataIngestionSourceSlot[]): {
  sourceType: DataIngestionSourceType;
  connectionConfig?: Record<string, unknown>;
} {
  const enabled = INGESTION_SOURCE_TYPE_ORDER.map((id) =>
    slots.find((s) => s.sourceType === id),
  ).filter((s): s is DataIngestionSourceSlot => Boolean(s?.enabled));
  const first = enabled[0];
  if (!first) {
    return { sourceType: 'file-upload', connectionConfig: undefined };
  }
  const cc = first.connectionConfig as Record<string, unknown> | undefined;
  return {
    sourceType: first.sourceType,
    connectionConfig: cc && Object.keys(cc).length ? { ...cc } : undefined,
  };
}

export function buildIngestionConfigWithSources(
  base: DataIngestionConfig,
  slots: DataIngestionSourceSlot[],
): DataIngestionConfig {
  const primary = primaryIngestionSource(slots);
  return {
    ...base,
    sources: slots,
    sourceType: primary.sourceType,
    connectionConfig: primary.connectionConfig,
  };
}
