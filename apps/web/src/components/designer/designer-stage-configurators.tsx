'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import type { DesignerStageId } from '@/lib/constants';

type ConfiguratorProps = Readonly<{ className?: string }>;

function StageConfiguratorSkeleton() {
  return <div className="mt-8 h-40 animate-pulse rounded-lg bg-muted/40" aria-hidden />;
}

function lazyConfigurator(
  loader: () => Promise<{ default: ComponentType<ConfiguratorProps> }>
) {
  return dynamic(loader, { loading: () => <StageConfiguratorSkeleton /> });
}

export const DesignerReviewPage = dynamic(
  () => import('./designer-review-page').then((m) => ({ default: m.DesignerReviewPage })),
  { loading: () => <StageConfiguratorSkeleton /> }
);

/** One configurator chunk per stage — only the active route's module is downloaded. */
export const STAGE_CONFIGURATORS: Partial<
  Record<Exclude<DesignerStageId, 'review'>, ComponentType<ConfiguratorProps>>
> = {
  cloud: lazyConfigurator(() =>
    import('./cloud-provider-selector').then((m) => ({ default: m.CloudProviderSelector }))
  ),
  ingestion: lazyConfigurator(() =>
    import('./data-ingestion-configurator').then((m) => ({ default: m.DataIngestionConfigurator }))
  ),
  chunking: lazyConfigurator(() =>
    import('./chunking-configurator').then((m) => ({ default: m.ChunkingConfigurator }))
  ),
  embedding: lazyConfigurator(() =>
    import('./embedding-configurator').then((m) => ({ default: m.EmbeddingConfigurator }))
  ),
  vectorstore: lazyConfigurator(() =>
    import('./vector-store-configurator').then((m) => ({ default: m.VectorStoreConfigurator }))
  ),
  queryTransform: lazyConfigurator(() =>
    import('./query-processing-configurator').then((m) => ({
      default: m.QueryProcessingConfigurator,
    }))
  ),
  retrieval: lazyConfigurator(() =>
    import('./retrieval-configurator').then((m) => ({ default: m.RetrievalConfigurator }))
  ),
  contextCompression: lazyConfigurator(() =>
    import('./context-compression-configurator').then((m) => ({
      default: m.ContextCompressionConfigurator,
    }))
  ),
  reranking: lazyConfigurator(() =>
    import('./retrieval-configurator').then((m) => ({
      default: function RerankFocusConfigurator(props: ConfiguratorProps) {
        return <m.RetrievalConfigurator {...props} variant="rerank-focus" />;
      },
    }))
  ),
  generation: lazyConfigurator(() =>
    import('./generation-configurator').then((m) => ({ default: m.GenerationConfigurator }))
  ),
  routing: lazyConfigurator(() =>
    import('./routing-configurator').then((m) => ({ default: m.RoutingConfigurator }))
  ),
  memory: lazyConfigurator(() =>
    import('./memory-configurator').then((m) => ({ default: m.MemoryConfigurator }))
  ),
  evaluation: lazyConfigurator(() =>
    import('./evaluation-configurator').then((m) => ({ default: m.EvaluationConfigurator }))
  ),
  observability: lazyConfigurator(() =>
    import('./observability-configurator').then((m) => ({ default: m.ObservabilityConfigurator }))
  ),
  guardrails: lazyConfigurator(() =>
    import('./guardrails-configurator').then((m) => ({ default: m.GuardrailsConfigurator }))
  ),
  hitl: lazyConfigurator(() =>
    import('./hitl-configurator').then((m) => ({ default: m.HitlConfigurator }))
  ),
};
