import { describe, it, expect } from 'vitest';
import { generateYAML } from '../yamlGenerator';
import { minimalConfig, fullConfig } from './fixtures';

describe('generateYAML', () => {
  it('starts with a comment header', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toMatch(/^# RAG Studio/);
  });

  it('includes pipeline id', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('id: test-pipeline-001');
  });

  it('includes pipeline name', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('name: Test RAG Pipeline');
  });

  it('includes cloud provider', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('cloudProvider: aws');
  });

  it('serialises chunking strategy and chunk size', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('strategy: recursive-character');
    expect(result).toContain('chunkSize: 512');
    expect(result).toContain('chunkOverlap: 50');
  });

  it('serialises embedding model and dimensions', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('model: text-embedding-3-small');
    expect(result).toContain('dimensions: 1536');
  });

  it('serialises vector store provider and index name', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('provider: qdrant');
    expect(result).toContain('indexName: rag-documents');
  });

  it('serialises retrieval strategy and topK', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('strategy: similarity');
    expect(result).toContain('topK: 5');
  });

  it('serialises reranking as disabled by default', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('enabled: false');
  });

  it('serialises generation model and temperature', () => {
    const result = generateYAML(minimalConfig);
    expect(result).toContain('model: gpt-4o-mini');
    expect(result).toContain('temperature: 0.1');
  });

  it('includes dataIngestion block for full config', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('dataIngestion:');
    expect(result).toContain('sourceType: gcs');
  });

  it('serialises hybrid search alpha', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('alpha: 0.6');
  });

  it('serialises reranking when enabled', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('enabled: true');
    expect(result).toContain('model: cohere-rerank-v3');
    expect(result).toContain('topN: 5');
  });

  it('serialises system prompt using block scalar (|)', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('systemPrompt: |');
    expect(result).toContain('You are a helpful assistant.');
  });

  it('serialises memory configuration', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('type: conversation-buffer');
    expect(result).toContain('windowSize: 10');
  });

  it('serialises evaluation metrics as YAML list', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('- faithfulness');
    expect(result).toContain('- answer_relevance');
  });

  it('serialises routing rules', () => {
    const result = generateYAML(fullConfig);
    expect(result).toContain('routing:');
    expect(result).toContain('condition: keyword');
  });

  it('does not produce tabs — only spaces', () => {
    const result = generateYAML(minimalConfig);
    expect(result).not.toContain('\t');
  });

  it('matches snapshot for minimal config', () => {
    const result = generateYAML(minimalConfig, '2026-05-01T00:00:00.000Z');
    expect(result).toMatchSnapshot();
  });

  it('matches snapshot for full config', () => {
    const result = generateYAML(fullConfig, '2026-05-01T00:00:00.000Z');
    expect(result).toMatchSnapshot();
  });
});
