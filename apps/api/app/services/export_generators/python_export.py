"""LangChain LCEL Python script generation — mirrors ``pythonCodeGenerator.ts``."""

from __future__ import annotations

import json
from pprint import pformat
from typing import Any

from app.schemas.pipeline import (
    ChunkingStrategy,
    MemoryType,
    OutputFormat,
    PipelineConfigurationSchema,
    PipelineStagesSchema,
    RetrievalStrategy,
    VectorStoreProvider,
)
from app.services.export_generators._compat import ev as _ev


def _human_in_the_loop_block(stages: PipelineStagesSchema) -> list[str]:
    h = stages.human_in_the_loop
    if h is None or not h.enabled:
        return []
    p = h.placement
    c = h.confidence
    w = h.workflow
    a = h.advanced
    cfg = {
        "tier": h.tier,
        "roles": list(h.roles),
        "placement": {
            "preIngestionValidation": p.pre_ingestion_validation,
            "retrievalTime": p.retrieval_time,
            "generationTime": p.generation_time,
            "postResponseFeedback": p.post_response_feedback,
        },
        "confidence": {
            "retrieverScoreThreshold": c.retriever_score_threshold,
            "rerankerScoreThreshold": c.reranker_score_threshold,
            "llmUncertaintySignals": c.llm_uncertainty_signals,
            "escalationMode": c.escalation_mode,
        },
        "workflow": {
            "synchronousReview": w.synchronous_review,
            "allowHumanEdit": w.allow_human_edit,
            "sequentialApprovalRoles": list(w.sequential_approval_roles),
        },
        "advanced": {
            "orchestrationHint": a.orchestration_hint,
            "agenticToolApproval": a.agentic_tool_approval,
            "multiReviewerConsensus": a.multi_reviewer_consensus,
            "auditLoggingRequired": a.audit_logging_required,
            "humanGuidedRetrieval": a.human_guided_retrieval,
            "activeLearningFeedback": a.active_learning_feedback,
        },
    }
    return [
        "",
        "# ─── Human in the Loop (designer configuration) ─────────────────────────────",
        "# Implement gates with interrupts, review queues, or BPM — not executed here.",
        "HITL_CONFIG = " + pformat(cfg, width=96, sort_dicts=False),
    ]


_EMBEDDING_IMPORTS: dict[str, str] = {
    "openai": "from langchain_openai import OpenAIEmbeddings",
    "cohere": "from langchain_cohere import CohereEmbeddings",
    "google": "from langchain_google_vertexai import VertexAIEmbeddings",
    "huggingface": "from langchain_huggingface import HuggingFaceEmbeddings",
    "nomic": "from langchain_community.embeddings import NomicEmbeddings",
    "custom": "# Custom embedding — implement BaseEmbeddings",
}

_EMBEDDING_CLASS: dict[str, str] = {
    "openai": "OpenAIEmbeddings",
    "cohere": "CohereEmbeddings",
    "google": "VertexAIEmbeddings",
    "huggingface": "HuggingFaceEmbeddings",
    "nomic": "NomicEmbeddings",
    "custom": "CustomEmbeddings",
}

_LLM_IMPORTS: dict[str, str] = {
    "openai": "from langchain_openai import ChatOpenAI",
    "anthropic": "from langchain_anthropic import ChatAnthropic",
    "google": "from langchain_google_vertexai import ChatVertexAI",
    "meta": "from langchain_community.chat_models import ChatOllama",
    "mistral": "from langchain_mistralai import ChatMistralAI",
    "cohere": "from langchain_cohere import ChatCohere",
    "custom": "# Custom LLM — implement BaseChatModel",
}

_LLM_CLASS: dict[str, str] = {
    "openai": "ChatOpenAI",
    "anthropic": "ChatAnthropic",
    "google": "ChatVertexAI",
    "meta": "ChatOllama",
    "mistral": "ChatMistralAI",
    "cohere": "ChatCohere",
    "custom": "CustomLLM",
}

_VECTORSTORE_IMPORTS: dict[str, str] = {
    "qdrant": (
        "from langchain_qdrant import QdrantVectorStore\n" "from qdrant_client import QdrantClient"
    ),
    "pinecone": (
        "from langchain_pinecone import PineconeVectorStore\nfrom pinecone import Pinecone"
    ),
    "weaviate": (
        "from langchain_weaviate.vectorstores import WeaviateVectorStore\nimport weaviate"
    ),
    "chroma": "from langchain_chroma import Chroma",
    "faiss": "from langchain_community.vectorstores import FAISS",
    "opensearch": "from langchain_community.vectorstores import OpenSearchVectorSearch",
    "vertex-ai-vector-search": (
        "from langchain_google_vertexai.vectorstores import VectorSearchVectorStore"
    ),
    "azure-ai-search": "from langchain_community.vectorstores import AzureSearch",
    "pgvector": "from langchain_postgres import PGVector",
}

_RETRIEVAL_SEARCH_TYPE: dict[str, str] = {
    "similarity": "similarity",
    "mmr": "mmr",
    "hybrid": "similarity",
    "parent-child": "similarity",
    "multi-query": "similarity",
    "ensemble": "similarity",
}


def generate_python_code(config: PipelineConfigurationSchema) -> str:
    stages = config.stages
    cp = _ev(config.cloud_provider)
    sections = [
        _build_header(config, cp),
        "",
        _build_imports(stages),
        "",
        "",
        _build_config(config),
        "",
        "",
        _build_vector_store(stages),
        "",
        "",
        _build_retriever(stages),
        "",
        "",
        _build_prompt_and_chain(stages),
        "",
        "",
        _build_indexing_section(stages),
    ]
    return "\n".join(sections)


def _build_header(config: PipelineConfigurationSchema, cloud: str) -> str:
    gen = config.stages.generation
    vs = config.stages.vector_store
    ch = config.stages.chunking
    return f'''"""
RAG Pipeline — {config.name}
Generated by RAG Studio
Cloud Provider: {cloud}
Model: {gen.model}
Vector Store: {_ev(vs.provider)}
Chunking: {_ev(ch.strategy)} ({ch.chunk_size} tokens)
"""'''


def _build_imports(stages: PipelineStagesSchema) -> str:
    ep = _ev(stages.embedding.provider)
    gp = _ev(stages.generation.provider)
    vp = _ev(stages.vector_store.provider)

    lines = [
        "import os",
        "from typing import List",
        "",
        "# LangChain core",
        "from langchain_core.prompts import ChatPromptTemplate",
        "from langchain_core.output_parsers import StrOutputParser",
        "from langchain_core.runnables import RunnablePassthrough, RunnableParallel",
        "from langchain_core.documents import Document",
        "",
        "# Text splitting",
        "from langchain_text_splitters import RecursiveCharacterTextSplitter",
        "",
        f"# Embeddings\n{_EMBEDDING_IMPORTS.get(ep, _EMBEDDING_IMPORTS['custom'])}",
        "",
        f"# LLM\n{_LLM_IMPORTS.get(gp, _LLM_IMPORTS['custom'])}",
        "",
        f"# Vector store\n{_VECTORSTORE_IMPORTS.get(vp, '# Vector store — add provider import')}",
    ]

    rr = stages.reranking
    if rr and rr.enabled:
        lines.extend(
            [
                "",
                "# Reranking",
            ]
        )
        if _ev(rr.provider or "") == "cohere":
            lines.append("from langchain_cohere import CohereRerank")
            lines.append(
                "from langchain.retrievers.contextual_compression import "
                "ContextualCompressionRetriever"
            )
        else:
            lines.append(
                "from langchain.retrievers.contextual_compression import "
                "ContextualCompressionRetriever"
            )
            lines.append(
                "from langchain.retrievers.document_compressors import CrossEncoderReranker"
            )
            lines.append("from langchain_community.cross_encoders import HuggingFaceCrossEncoder")

    mem = stages.memory
    if mem and _ev(mem.type) != MemoryType.NONE.value:
        lines.extend(
            [
                "",
                "# Memory",
                "from langchain.memory import ConversationBufferWindowMemory",
                "from langchain_core.chat_history import BaseChatMessageHistory",
                "from langchain_core.runnables.history import RunnableWithMessageHistory",
            ]
        )

    if _ev(stages.retrieval.strategy) == RetrievalStrategy.MULTI_QUERY.value:
        lines.extend(
            [
                "",
                "# Multi-query retrieval",
                "from langchain.retrievers.multi_query import MultiQueryRetriever",
            ]
        )

    return "\n".join(lines)


def _build_pipeline_extras(config: PipelineConfigurationSchema) -> list[str]:
    """Emit designer-only blocks (compression, observability, prompt hints) for operators."""
    lines: list[str] = []
    stages = config.stages
    cc = stages.context_compression
    if cc is not None and cc.enabled and cc.mode and str(cc.mode) != "none":
        lines.extend(
            [
                "",
                "# ─── Context compression (post-retrieval) ───────────────────────────",
                "CONTEXT_COMPRESSION = "
                + pformat(
                    {
                        "enabled": cc.enabled,
                        "mode": cc.mode,
                        "min_score": cc.min_score,
                        "max_token_budget": cc.max_token_budget,
                    },
                    width=88,
                    sort_dicts=False,
                ),
            ]
        )
    obs = config.observability
    if obs is not None:
        lines.extend(
            [
                "",
                "# ─── Observability flags ──────────────────────────────────────────────",
                "OBSERVABILITY = " + pformat(obs.model_dump(), width=88, sort_dicts=False),
            ]
        )
    at = config.agent_tools
    if at is not None:
        lines.extend(
            [
                "",
                "# ─── Agent / tool flags ───────────────────────────────────────────────",
                "AGENT_TOOLS = " + pformat(at.model_dump(), width=88, sort_dicts=False),
            ]
        )
    ap = config.adaptive_policies
    if ap:
        lines.extend(
            [
                "",
                "# ─── Adaptive policies (Designer hints) ───────────────────────────────",
                "ADAPTIVE_POLICIES = "
                + pformat([r.model_dump() for r in ap], width=88, sort_dicts=False),
            ]
        )
    gen = stages.generation
    if gen.few_shot_messages:
        lines.extend(
            [
                "",
                "# ─── Few-shot examples (prompt engineering) ──────────────────────────",
                "FEW_SHOT_MESSAGES = "
                + pformat(
                    [{"role": m.role, "content": m.content} for m in gen.few_shot_messages],
                    width=88,
                    sort_dicts=False,
                ),
            ]
        )
    if gen.persona:
        lines.extend(["", f"PERSONA_HINT = {json.dumps(gen.persona)}"])
    if gen.citation_grounding:
        lines.extend(["", "CITATION_GROUNDING = True"])
    return lines


def _build_config(config: PipelineConfigurationSchema) -> str:
    stages = config.stages
    cloud_provider = _ev(config.cloud_provider)
    emb = stages.embedding
    gen = stages.generation
    ch = stages.chunking
    vs = stages.vector_store
    ret = stages.retrieval

    ep = _ev(emb.provider)
    gp = _ev(gen.provider)
    emb_class = _EMBEDDING_CLASS.get(ep, "CustomEmbeddings")
    llm_class = _LLM_CLASS.get(gp, "CustomLLM")

    lines: list[str] = [
        "# ─── Configuration ──────────────────────────────────────────────────────────",
        "",
        f'CLOUD_PROVIDER = "{cloud_provider}"',
        f'INDEX_NAME = "{vs.index_name}"',
        f'EMBEDDING_MODEL = "{emb.model}"',
        f"EMBEDDING_DIMENSIONS = {emb.dimensions}",
        f'LLM_MODEL = "{gen.model}"',
        f"TEMPERATURE = {gen.temperature}",
        f"MAX_TOKENS = {gen.max_tokens}",
        f"CHUNK_SIZE = {ch.chunk_size}",
        f"CHUNK_OVERLAP = {ch.chunk_overlap}",
        f"TOP_K = {ret.top_k}",
        "",
        "# ─── Embeddings ─────────────────────────────────────────────────────────────",
        "",
        "embeddings = " + _build_embedding_init(emb, emb_class),
        "",
        "# ─── LLM ────────────────────────────────────────────────────────────────────",
        "",
        "llm = " + _build_llm_init(gen, llm_class),
        "",
        "# ─── Text splitter ──────────────────────────────────────────────────────────",
        "",
        *_build_text_splitter(stages),
        *_human_in_the_loop_block(stages),
        *_build_pipeline_extras(config),
    ]
    return "\n".join(lines)


def _build_embedding_init(emb: Any, cls: str) -> str:
    p = _ev(emb.provider)
    if p == "openai":
        return f'{cls}(\n    model="{emb.model}"\n)'
    if p == "cohere":
        return f'{cls}(\n    model="{emb.model}"\n)'
    if p in ("google", "huggingface"):
        return f'{cls}(\n    model_name="{emb.model}"\n)'
    return f'{cls}(model="{emb.model}")'


def _build_llm_init(gen: Any, cls: str) -> str:
    p = _ev(gen.provider)
    base = (
        f'model="{gen.model}",\n    temperature={gen.temperature},\n    max_tokens={gen.max_tokens}'
    )
    if p == "openai":
        return f"{cls}(\n    {base}\n)"
    if p == "anthropic":
        return (
            f'{cls}(\n    model="{gen.model}",\n    temperature={gen.temperature},'
            f"\n    max_tokens={gen.max_tokens}\n)"
        )
    if p == "google":
        return (
            f'{cls}(\n    model_name="{gen.model}",\n    temperature={gen.temperature},'
            f"\n    max_output_tokens={gen.max_tokens}\n)"
        )
    return f"{cls}(\n    {base}\n)"


def _build_text_splitter(stages: PipelineStagesSchema) -> list[str]:
    c = stages.chunking
    strategy = _ev(c.strategy)
    if strategy == ChunkingStrategy.RECURSIVE_CHARACTER.value:
        sep = (
            f"    separators={json.dumps(c.separators)},"
            if c.separators
            else '    separators=["\\n\\n", "\\n", " ", ""],'
        )
        return [
            "text_splitter = RecursiveCharacterTextSplitter(",
            f"    chunk_size={c.chunk_size},",
            f"    chunk_overlap={c.chunk_overlap},",
            sep,
            ")",
        ]
    if strategy == ChunkingStrategy.FIXED_SIZE.value:
        return [
            "from langchain_text_splitters import CharacterTextSplitter",
            "",
            "text_splitter = CharacterTextSplitter(",
            f"    chunk_size={c.chunk_size},",
            f"    chunk_overlap={c.chunk_overlap},",
            '    separator="",',
            ")",
        ]
    if strategy == ChunkingStrategy.MARKDOWN_HEADER.value:
        return [
            "from langchain_text_splitters import MarkdownHeaderTextSplitter",
            "",
            "text_splitter = MarkdownHeaderTextSplitter(",
            "    headers_to_split_on=[",
            '        ("#", "Header 1"),',
            '        ("##", "Header 2"),',
            '        ("###", "Header 3"),',
            "    ]",
            ")",
        ]
    if strategy == ChunkingStrategy.SENTENCE_BASED.value:
        return [
            "# Sentence-based splitter via NLTK",
            "from langchain_text_splitters import NLTKTextSplitter",
            "",
            f"text_splitter = NLTKTextSplitter(chunk_size={c.chunk_size})",
        ]
    if strategy == ChunkingStrategy.SEMANTIC.value:
        return [
            "# Semantic chunking requires sentence-transformers",
            "from langchain_experimental.text_splitter import SemanticChunker",
            "",
            "text_splitter = SemanticChunker(",
            "    embeddings,",
            '    breakpoint_threshold_type="percentile",',
            ")",
        ]
    return [
        "text_splitter = RecursiveCharacterTextSplitter(",
        f"    chunk_size={c.chunk_size},",
        f"    chunk_overlap={c.chunk_overlap},",
        ")",
    ]


def _build_vector_store(stages: PipelineStagesSchema) -> str:
    vs = stages.vector_store
    metric = _ev(vs.configuration.metric).upper() if vs.configuration.metric else "COSINE"
    p = _ev(vs.provider)

    if p == VectorStoreProvider.QDRANT.value:
        return "\n".join(
            [
                "# ─── Vector Store (Qdrant) ──────────────────────────────────────────────────",
                "",
                "qdrant_client = QdrantClient(",
                '    url=os.environ["QDRANT_URL"],',
                '    api_key=os.environ.get("QDRANT_API_KEY"),',
                ")",
                "",
                "vector_store = QdrantVectorStore(",
                "    client=qdrant_client,",
                f'    collection_name="{vs.index_name}",',
                "    embedding=embeddings,",
                f'    distance="{metric}",',
                ")",
            ]
        )
    if p == VectorStoreProvider.PINECONE.value:
        return "\n".join(
            [
                "# ─── Vector Store (Pinecone) ────────────────────────────────────────────────",
                "",
                'pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])',
                f'index = pc.Index("{vs.index_name}")',
                "",
                "vector_store = PineconeVectorStore(",
                "    index=index,",
                "    embedding=embeddings,",
                ")",
            ]
        )
    if p == VectorStoreProvider.CHROMA.value:
        return "\n".join(
            [
                "# ─── Vector Store (Chroma) ──────────────────────────────────────────────────",
                "",
                "vector_store = Chroma(",
                f'    collection_name="{vs.index_name}",',
                "    embedding_function=embeddings,",
                '    persist_directory="./chroma_db",',
                ")",
            ]
        )
    if p == VectorStoreProvider.PGVECTOR.value:
        return "\n".join(
            [
                "# ─── Vector Store (pgvector) ────────────────────────────────────────────────",
                "",
                "vector_store = PGVector(",
                f'    collection_name="{vs.index_name}",',
                '    connection=os.environ["DATABASE_URL"],',
                "    embeddings=embeddings,",
                ")",
            ]
        )
    pv = p
    return "\n".join(
        [
            f"# ─── Vector Store ({pv}) ─────────────────────────────────",
            "",
            "# TODO: configure your vector store connection",
            "vector_store = None  # replace with actual initialisation",
        ]
    )


def _build_retriever(stages: PipelineStagesSchema) -> str:
    retrieval = stages.retrieval
    reranking = stages.reranking
    strat = _ev(retrieval.strategy)
    search_type = _RETRIEVAL_SEARCH_TYPE.get(strat, "similarity")
    lines: list[str] = [
        "# ─── Retriever ──────────────────────────────────────────────────────────────",
        "",
    ]

    if strat == RetrievalStrategy.MMR.value:
        lines.extend(
            [
                "base_retriever = vector_store.as_retriever(",
                '    search_type="mmr",',
                "    search_kwargs={"
                f'"k": {retrieval.top_k}, "fetch_k": {retrieval.top_k * 4}'
                "},",
                ")",
            ]
        )
    elif strat == RetrievalStrategy.HYBRID.value:
        alpha = retrieval.hybrid_search.alpha if retrieval.hybrid_search else 0.5
        w_dense = alpha
        w_sparse = 1 - alpha
        lines.extend(
            [
                "# Hybrid dense+sparse retrieval",
                "base_retriever = vector_store.as_retriever(",
                '    search_type="similarity",',
                f'    search_kwargs={{"k": {retrieval.top_k}}},',
                ")",
                "# TODO: combine with BM25Retriever using EnsembleRetriever:",
                "# from langchain.retrievers import EnsembleRetriever, BM25Retriever",
                "# bm25 = BM25Retriever.from_documents(docs, k=TOP_K)",
                "# retriever = EnsembleRetriever(retrievers=[bm25, base_retriever], "
                f"weights=[{w_sparse}, {w_dense}])",
            ]
        )
    elif strat == RetrievalStrategy.MULTI_QUERY.value:
        lines.extend(
            [
                "base_retriever = MultiQueryRetriever.from_llm(",
                "    retriever=vector_store.as_retriever(",
                f'        search_kwargs={{"k": {retrieval.top_k}}}',
                "    ),",
                "    llm=llm,",
                ")",
            ]
        )
    else:
        lines.extend(
            [
                "base_retriever = vector_store.as_retriever(",
                f'    search_type="{search_type}",',
                f'    search_kwargs={{"k": {retrieval.top_k}}},',
                ")",
            ]
        )

    if reranking and reranking.enabled:
        lines.append("")
        lines.append("# Reranking with contextual compression")
        if _ev(reranking.provider or "") == "cohere":
            top_n = reranking.top_n or 5
            lines.append(f"compressor = CohereRerank(top_n={top_n})")
        else:
            model_name = reranking.model or "cross-encoder/ms-marco-MiniLM-L-6-v2"
            top_n = reranking.top_n or 5
            lines.append(f'model = HuggingFaceCrossEncoder(model_name="{model_name}")')
            lines.append(f"compressor = CrossEncoderReranker(model=model, top_n={top_n})")
        lines.extend(
            [
                "retriever = ContextualCompressionRetriever(",
                "    base_compressor=compressor,",
                "    base_retriever=base_retriever,",
                ")",
            ]
        )
    else:
        lines.append("retriever = base_retriever")

    return "\n".join(lines)


def _build_prompt_and_chain(stages: PipelineStagesSchema) -> str:
    gen = stages.generation
    default_sys = (
        "You are a helpful assistant. Use the provided context to answer the question accurately."
    )
    system_prompt = gen.system_prompt or default_sys
    of = _ev(gen.output_format) if gen.output_format is not None else ""
    if of == OutputFormat.JSON.value:
        format_instruction = "Return your answer as valid JSON."
    elif of == OutputFormat.MARKDOWN.value:
        format_instruction = "Format your answer using Markdown."
    else:
        format_instruction = ""

    # Escape for Python source
    sys_esc = system_prompt.replace("\\", "\\\\").replace('"""', '\\"\\"\\"')

    lines = [
        "# ─── Prompt ─────────────────────────────────────────────────────────────────",
        "",
        "prompt = ChatPromptTemplate.from_messages([",
        f'    ("system", """{sys_esc}',
        "",
        "Context:",
        "{context}",
    ]
    if format_instruction:
        lines.append(format_instruction)
        lines.append('"""),')
    else:
        lines.append('"""),')
    lines.extend(
        [
            '    ("human", "{question}"),',
            "])",
            "",
            "# ─── Chain (LCEL) ───────────────────────────────────────────────────────────",
            "",
            "def format_docs(docs: List[Document]) -> str:",
            '    return "\\n\\n".join(doc.page_content for doc in docs)',
            "",
            "rag_chain = (",
            "    RunnableParallel(",
            "        context=retriever | format_docs,",
            "        question=RunnablePassthrough(),",
            "    )",
            "    | prompt",
            "    | llm",
            "    | StrOutputParser()",
            ")",
        ]
    )

    mem = stages.memory
    if mem and _ev(mem.type) != MemoryType.NONE.value:
        ws = mem.window_size or 10
        lines.extend(
            [
                "",
                "# ─── Memory ─────────────────────────────────────────────────────────────────",
                "",
                "store: dict[str, BaseChatMessageHistory] = {}",
                "",
                "def get_session_history(session_id: str) -> BaseChatMessageHistory:",
                "    from langchain_core.chat_history import InMemoryChatMessageHistory",
                "    if session_id not in store:",
                "        store[session_id] = InMemoryChatMessageHistory()",
                "    return store[session_id]",
                "",
                f"memory = ConversationBufferWindowMemory(k={ws}, return_messages=True)",
                "",
                "rag_chain_with_history = RunnableWithMessageHistory(",
                "    rag_chain,",
                "    get_session_history,",
                '    input_messages_key="question",',
                '    history_messages_key="chat_history",',
                ")",
            ]
        )

    return "\n".join(lines)


def _build_indexing_section(stages: PipelineStagesSchema) -> str:
    mem = stages.memory
    use_hist = mem and _ev(mem.type) != MemoryType.NONE.value
    q_invoke = (
        "    return rag_chain_with_history.invoke(\n"
        '        {"question": question},\n'
        '        config={"configurable": {"session_id": session_id}},\n'
        "    )"
        if use_hist
        else "    return rag_chain.invoke(question)"
    )
    return "\n".join(
        [
            "# ─── Indexing helper ────────────────────────────────────────────────────────",
            "",
            "def index_documents(file_paths: list[str]) -> int:",
            '    """Load, chunk, embed, and store documents. Returns chunk count."""',
            "    from langchain_community.document_loaders import UnstructuredFileLoader",
            "    ",
            "    all_docs: List[Document] = []",
            "    for path in file_paths:",
            "        loader = UnstructuredFileLoader(path)",
            "        all_docs.extend(loader.load())",
            "    ",
            "    chunks = text_splitter.split_documents(all_docs)",
            "    vector_store.add_documents(chunks)",
            "    return len(chunks)",
            "",
            "",
            "# ─── Inference ──────────────────────────────────────────────────────────────",
            "",
            'def query(question: str, session_id: str = "default") -> str:',
            '    """Run a RAG query and return the generated answer."""',
            q_invoke,
            "",
            "",
            'if __name__ == "__main__":',
            "    # Quick smoke test",
            '    answer = query("What is this document about?")',
            "    print(answer)",
        ]
    )
