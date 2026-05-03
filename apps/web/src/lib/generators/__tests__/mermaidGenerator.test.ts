import { describe, it, expect } from 'vitest';
import {
  generateMermaidDiagram,
  generatePipelineHighlights,
  generatePipelineSummary,
} from '../mermaidGenerator';
import { minimalConfig, fullConfig } from './fixtures';

describe('generateMermaidDiagram', () => {
  it('starts with flowchart LR directive', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, minimalConfig.cloudProvider);
    expect(result).toMatch(/^flowchart LR/);
  });

  it('includes cloud provider name in indexing subgraph label', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('AWS');
  });

  it('includes chunking strategy and chunk size', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('recursive-character');
    expect(result).toContain('512');
  });

  it('includes embedding model and dimensions', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('text-embedding-3-small');
    expect(result).toContain('1536');
  });

  it('includes vector store provider and index name', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('qdrant');
    expect(result).toContain('rag-documents');
  });

  it('includes retrieval strategy and topK', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('similarity');
    expect(result).toContain('top-5');
  });

  it('omits reranking node when disabled', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).not.toContain('Rerank');
  });

  it('includes reranking node when enabled', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toContain('Rerank');
    expect(result).toContain('cohere-rerank-v3');
  });

  it('includes ingestion node when dataIngestion is configured', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toContain('Ingest');
  });

  it('omits ingestion node when dataIngestion is absent', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).not.toContain('Ingest');
  });

  it('includes memory node when memory type is not none', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toContain('Memory');
    expect(result).toContain('conversation-buffer');
  });

  it('omits memory node when type is none', () => {
    const stagesWithNoMemory = {
      ...minimalConfig.stages,
      memory: { type: 'none' as const },
    };
    const result = generateMermaidDiagram(stagesWithNoMemory, 'aws');
    expect(result).not.toContain('Memory');
  });

  it('includes evaluation node when enabled', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toContain('Evaluate');
  });

  it('includes routing node when enabled', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toContain('Route');
  });

  it('cross-graph edge VS --> RET is present', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toContain('VS --> RET');
  });

  it('matches snapshot for minimal config', () => {
    const result = generateMermaidDiagram(minimalConfig.stages, 'aws');
    expect(result).toMatchSnapshot();
  });

  it('matches snapshot for full config', () => {
    const result = generateMermaidDiagram(fullConfig.stages, 'gcp');
    expect(result).toMatchSnapshot();
  });
});

describe('generatePipelineSummary', () => {
  it('returns a string with arrow-separated stage labels', () => {
    const result = generatePipelineSummary(minimalConfig.stages);
    expect(result).toContain('→');
    expect(result).toContain('recursive-character');
    expect(result).toContain('text-embedding-3-small');
    expect(result).toContain('qdrant');
    expect(result).toContain('similarity');
    expect(result).toContain('gpt-4o-mini');
  });

  it('includes reranker model when reranking is enabled', () => {
    const result = generatePipelineSummary(fullConfig.stages);
    expect(result).toContain('cohere-rerank-v3');
  });

  it('omits reranker when reranking is disabled', () => {
    const result = generatePipelineSummary(minimalConfig.stages);
    expect(result).not.toContain('cohere');
  });
});

describe('generatePipelineHighlights', () => {
  it('lists cloud, stages, and toggles for minimal draft', () => {
    const lines = generatePipelineHighlights(minimalConfig.stages, minimalConfig.cloudProvider);
    expect(lines.some((l) => l.startsWith('Cloud:'))).toBe(true);
    expect(lines.some((l) => l.includes('Reranking: off'))).toBe(true);
    expect(lines.some((l) => l.includes('Routing: off'))).toBe(true);
  });

  it('includes routing and evaluation when enabled', () => {
    const lines = generatePipelineHighlights(fullConfig.stages, fullConfig.cloudProvider);
    expect(lines.some((l) => l.includes('Reranking: on'))).toBe(true);
    expect(lines.some((l) => l.includes('Routing: on'))).toBe(true);
    expect(lines.some((l) => l.includes('Evaluation: on'))).toBe(true);
  });
});
