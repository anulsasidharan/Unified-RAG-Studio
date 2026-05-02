import { describe, it, expect } from 'vitest';
import { generatePythonCode } from '../pythonCodeGenerator';
import { minimalConfig, fullConfig } from './fixtures';

describe('generatePythonCode', () => {
  it('includes the pipeline name in the header comment', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('Test RAG Pipeline');
  });

  it('imports OpenAI embeddings for openai provider', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('from langchain_openai import OpenAIEmbeddings');
  });

  it('imports Anthropic LLM for anthropic provider', () => {
    const result = generatePythonCode(fullConfig);
    expect(result).toContain('from langchain_anthropic import ChatAnthropic');
  });

  it('imports Qdrant for qdrant vector store', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('QdrantVectorStore');
  });

  it('imports Pinecone for pinecone vector store', () => {
    const result = generatePythonCode(fullConfig);
    expect(result).toContain('PineconeVectorStore');
  });

  it('includes model name constant', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('LLM_MODEL = "gpt-4o-mini"');
  });

  it('includes chunk size and overlap constants', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('CHUNK_SIZE = 512');
    expect(result).toContain('CHUNK_OVERLAP = 50');
  });

  it('includes top-k constant', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('TOP_K = 5');
  });

  it('uses RecursiveCharacterTextSplitter for recursive-character strategy', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('RecursiveCharacterTextSplitter');
  });

  it('uses SemanticChunker for semantic strategy', () => {
    const result = generatePythonCode(fullConfig);
    expect(result).toContain('SemanticChunker');
  });

  it('includes Cohere reranking imports when reranking is enabled with cohere provider', () => {
    const result = generatePythonCode(fullConfig);
    expect(result).toContain('CohereRerank');
    expect(result).toContain('ContextualCompressionRetriever');
  });

  it('does not import reranking when disabled', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).not.toContain('CohereRerank');
    expect(result).not.toContain('ContextualCompressionRetriever');
  });

  it('includes memory imports when memory type is not none', () => {
    const result = generatePythonCode(fullConfig);
    expect(result).toContain('ConversationBufferWindowMemory');
    expect(result).toContain('RunnableWithMessageHistory');
  });

  it('does not include memory imports when memory type is none', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).not.toContain('RunnableWithMessageHistory');
  });

  it('includes the LCEL chain definition', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('rag_chain = (');
    expect(result).toContain('RunnableParallel');
    expect(result).toContain('StrOutputParser');
  });

  it('defines index_documents helper function', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('def index_documents(');
  });

  it('defines query function', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toContain('def query(');
  });

  it('includes multi-query imports when strategy is multi-query', () => {
    const configWithMultiQuery = {
      ...minimalConfig,
      stages: {
        ...minimalConfig.stages,
        retrieval: { strategy: 'multi-query' as const, topK: 5 },
      },
    };
    const result = generatePythonCode(configWithMultiQuery);
    expect(result).toContain('MultiQueryRetriever');
  });

  it('matches snapshot for minimal config', () => {
    const result = generatePythonCode(minimalConfig);
    expect(result).toMatchSnapshot();
  });
});
