import { describe, expect, it } from 'vitest';

import { parseBuildStatusPayload } from '@/lib/autopilot-build-status';

describe('parseBuildStatusPayload', () => {
  it('parses dashboardMetrics from API camelCase payload', () => {
    const raw = {
      buildId: 'b1',
      status: 'complete',
      progress: 100,
      currentStage: 'deployment_complete',
      iteration: 1,
      stages: {},
      messages: [],
      dashboardMetrics: {
        quality: {
          faithfulness: 0.9,
          answerRelevance: 0.85,
          meetsTargets: true,
        },
        embeddingBenchmarks: [
          { label: 'openai/text-embedding-3-small', latencyMs: 40, compositeScore: 0.8 },
        ],
        selectedEmbeddingLabel: 'openai/text-embedding-3-small',
        retrieval: { strategy: 'similarity', topK: 5, performance: { ndcg: 0.7 } },
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:01:00Z',
    };
    const parsed = parseBuildStatusPayload(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.dashboardMetrics?.quality?.faithfulness).toBe(0.9);
    expect(parsed!.dashboardMetrics?.quality?.meetsTargets).toBe(true);
    expect(parsed!.dashboardMetrics?.embeddingBenchmarks).toHaveLength(1);
    expect(parsed!.dashboardMetrics?.embeddingBenchmarks[0].latencyMs).toBe(40);
    expect(parsed!.dashboardMetrics?.retrieval?.topK).toBe(5);
  });
});
