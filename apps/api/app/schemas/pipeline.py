"""Core pipeline configuration Pydantic schemas.

These mirror the TypeScript types in apps/web/src/types/pipeline.ts and the
JSON catalogs in data/. Both sides validate against the same domain model —
model IDs, strategies, and provider names must match the JSON catalog values.
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# ─── Base Model ───────────────────────────────────────────────────────────────


class RAGBaseModel(BaseModel):
    """Shared base: camelCase JSON aliases + enum serialised as values."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,   # accept snake_case in Python code
        use_enum_values=True,    # serialise enums as their string values
        from_attributes=True,    # ORM → schema conversion via model_validate(orm_obj)
    )


# ─── Primitive Enumerations ───────────────────────────────────────────────────


class CloudProvider(StrEnum):
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    MULTI_CLOUD = "multi-cloud"


class ModelTier(StrEnum):
    FAST = "fast"
    BALANCED = "balanced"
    ADVANCED = "advanced"


class ChunkingStrategy(StrEnum):
    FIXED_SIZE = "fixed-size"
    RECURSIVE_CHARACTER = "recursive-character"
    SEMANTIC = "semantic"
    MARKDOWN_HEADER = "markdown-header"
    SENTENCE_BASED = "sentence-based"
    PARAGRAPH_BASED = "paragraph-based"
    CODE_AWARE = "code-aware"


class VectorStoreProvider(StrEnum):
    PINECONE = "pinecone"
    WEAVIATE = "weaviate"
    QDRANT = "qdrant"
    CHROMA = "chroma"
    FAISS = "faiss"
    OPENSEARCH = "opensearch"
    VERTEX_AI_VECTOR_SEARCH = "vertex-ai-vector-search"
    AZURE_AI_SEARCH = "azure-ai-search"
    PGVECTOR = "pgvector"


class RetrievalStrategy(StrEnum):
    SIMILARITY = "similarity"
    MMR = "mmr"
    HYBRID = "hybrid"
    PARENT_CHILD = "parent-child"
    MULTI_QUERY = "multi-query"
    ENSEMBLE = "ensemble"


class EmbeddingProvider(StrEnum):
    OPENAI = "openai"
    COHERE = "cohere"
    GOOGLE = "google"
    HUGGINGFACE = "huggingface"
    NOMIC = "nomic"
    CUSTOM = "custom"


class GenerationProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    META = "meta"
    MISTRAL = "mistral"
    COHERE = "cohere"
    CUSTOM = "custom"


class MemoryType(StrEnum):
    NONE = "none"
    CONVERSATION_BUFFER = "conversation-buffer"
    SUMMARY_BUFFER = "summary-buffer"
    VECTOR_MEMORY = "vector-memory"


class OutputFormat(StrEnum):
    TEXT = "text"
    JSON = "json"
    MARKDOWN = "markdown"


class SimilarityMetric(StrEnum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT = "dot"


class FilterOperator(StrEnum):
    EQ = "eq"
    NE = "ne"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NIN = "nin"
    CONTAINS = "contains"


# ─── Shared Sub-Structures ────────────────────────────────────────────────────


class MetadataFilter(RAGBaseModel):
    key: str
    operator: FilterOperator
    # Mirrors TypeScript: string | number | boolean | string[]
    value: str | int | float | bool | list[str]


class HybridSearchConfig(RAGBaseModel):
    """Dense/sparse weighting for hybrid retrieval.

    alpha=1.0 → pure dense (vector); alpha=0.0 → pure sparse (BM25).
    """

    alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    sparse_weight: float | None = None
    dense_weight: float | None = None


# ─── Stage Configuration Schemas ─────────────────────────────────────────────


class DataIngestionPreprocessingSchema(RAGBaseModel):
    strip_html: bool = False
    normalize_whitespace: bool = True
    extract_metadata: bool = True
    custom_rules: list[str] | None = None


class DataIngestionMetadataSchema(RAGBaseModel):
    include_source: bool = True
    include_page_number: bool = True
    custom_metadata: dict[str, str] | None = None


class DataIngestionConfigSchema(RAGBaseModel):
    source_type: Literal[
        "file-upload", "s3", "gcs", "azure-blob", "url", "database", "api"
    ]
    file_types: list[str] = Field(default_factory=list)
    preprocessing: DataIngestionPreprocessingSchema = Field(
        default_factory=DataIngestionPreprocessingSchema
    )
    metadata: DataIngestionMetadataSchema = Field(
        default_factory=DataIngestionMetadataSchema
    )
    connection_config: dict[str, object] | None = None


class ChunkingConfigSchema(RAGBaseModel):
    strategy: ChunkingStrategy
    chunk_size: int = Field(default=512, ge=128, le=4096)
    chunk_overlap: int = Field(default=50, ge=0, le=512)
    separators: list[str] | None = None


class EmbeddingConfigSchema(RAGBaseModel):
    model: str = Field(description="Model ID from data/models/embeddings.json")
    provider: EmbeddingProvider
    dimensions: int = Field(ge=64, le=8192)
    batch_size: int | None = Field(default=None, ge=1, le=2048)
    max_tokens: int | None = Field(default=None, ge=1)


class VectorStoreCloudConfigSchema(RAGBaseModel):
    region: str
    instance_type: str | None = None


class VectorStoreConfigurationSchema(RAGBaseModel):
    metric: SimilarityMetric = SimilarityMetric.COSINE
    replicas: int | None = Field(default=None, ge=1)
    shards: int | None = Field(default=None, ge=1)
    namespace: str | None = None
    cloud: VectorStoreCloudConfigSchema | None = None


class VectorStoreConfigSchema(RAGBaseModel):
    provider: VectorStoreProvider
    index_name: str = Field(min_length=1, max_length=128)
    configuration: VectorStoreConfigurationSchema = Field(
        default_factory=VectorStoreConfigurationSchema
    )


class ParentChildConfigSchema(RAGBaseModel):
    parent_chunk_size: int = Field(ge=256, le=8192)
    child_chunk_size: int = Field(ge=64, le=2048)


class MultiQueryConfigSchema(RAGBaseModel):
    num_variants: int = Field(default=3, ge=1, le=10)
    llm_model: str


class RetrievalConfigSchema(RAGBaseModel):
    strategy: RetrievalStrategy
    top_k: int = Field(default=5, ge=1, le=100)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    filters: list[MetadataFilter] | None = None
    hybrid_search: HybridSearchConfig | None = None
    parent_child_config: ParentChildConfigSchema | None = None
    multi_query_config: MultiQueryConfigSchema | None = None


class RerankingConfigSchema(RAGBaseModel):
    enabled: bool = False
    model: str | None = Field(default=None, description="Reranker model ID from data/models/rerankers.json")
    top_n: int | None = Field(default=None, ge=1, le=50)
    provider: Literal["cohere", "huggingface", "custom"] | None = None


class GenerationConfigSchema(RAGBaseModel):
    model: str = Field(description="Model ID from data/models/generation.json")
    provider: GenerationProvider
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    system_prompt: str | None = None
    output_format: OutputFormat | None = None


class RoutingRuleSchema(RAGBaseModel):
    condition: Literal["keyword", "query-length", "semantic-complexity"]
    threshold: float | None = None
    keywords: list[str] | None = None
    target_model: str


class RoutingConfigSchema(RAGBaseModel):
    enabled: bool = False
    rules: list[RoutingRuleSchema] | None = None
    default_model: str | None = None


class MemoryConfigSchema(RAGBaseModel):
    type: MemoryType = MemoryType.NONE
    window_size: int | None = Field(default=None, ge=1, le=100)
    max_tokens: int | None = Field(default=None, ge=256)
    session_persistence: bool | None = None


EvaluationMetricName = Literal[
    "faithfulness",
    "answer_relevance",
    "context_precision",
    "context_recall",
    "latency",
]


class EvaluationConfigSchema(RAGBaseModel):
    enabled: bool = False
    metrics: list[EvaluationMetricName] | None = None
    test_set_size: int | None = Field(default=None, ge=10, le=1000)
    schedule: Literal["on-demand", "continuous"] | None = None


# ─── Pipeline Stages ──────────────────────────────────────────────────────────


class PipelineStagesSchema(RAGBaseModel):
    """All ten stages of the RAG pipeline.

    Required stages must always be present.
    Optional stages (reranking, routing, memory, evaluation) are features
    the user opts into.
    """

    data_ingestion: DataIngestionConfigSchema | None = None
    chunking: ChunkingConfigSchema
    embedding: EmbeddingConfigSchema
    vector_store: VectorStoreConfigSchema
    retrieval: RetrievalConfigSchema
    reranking: RerankingConfigSchema | None = None
    generation: GenerationConfigSchema
    routing: RoutingConfigSchema | None = None
    memory: MemoryConfigSchema | None = None
    evaluation: EvaluationConfigSchema | None = None


# ─── Pipeline Metadata ────────────────────────────────────────────────────────


class PipelineMetadataSchema(RAGBaseModel):
    created_at: str
    updated_at: str | None = None
    version: str = "1.0.0"
    author: str | None = None
    source: Literal["designer", "autopilot", "template"] | None = None
    build_id: str | None = None


# ─── Cost & Performance ───────────────────────────────────────────────────────


class CostBreakdownSchema(RAGBaseModel):
    component: str
    unit_cost: float = Field(ge=0.0)
    estimated_usage: float = Field(ge=0.0)
    total_cost: float = Field(ge=0.0)
    percentage: float = Field(ge=0.0, le=100.0)


class CostEstimateSchema(RAGBaseModel):
    embedding: float = Field(ge=0.0)
    storage: float = Field(ge=0.0)
    retrieval: float = Field(ge=0.0)
    reranking: float = Field(ge=0.0)
    generation: float = Field(ge=0.0)
    total: float = Field(ge=0.0)
    per_query: float = Field(ge=0.0)
    per_month: float = Field(ge=0.0)
    currency: Literal["USD"] = "USD"
    breakdown: list[CostBreakdownSchema]


class PerformanceEstimateSchema(RAGBaseModel):
    avg_latency_ms: float = Field(ge=0.0)
    p95_latency_ms: float = Field(ge=0.0)
    faithfulness: float = Field(ge=0.0, le=1.0)
    relevance: float = Field(ge=0.0, le=1.0)
    tier: Literal["budget", "balanced", "premium"]


# ─── Top-Level Pipeline Configuration ────────────────────────────────────────


class PipelineConfigurationSchema(RAGBaseModel):
    """Complete RAG pipeline configuration.

    Accepted by both the Designer save endpoint and the Autopilot build
    endpoint (as optional base_config). Validated on both sides against
    the shared JSON catalogs in data/.
    """

    id: str
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    cloud_provider: CloudProvider
    stages: PipelineStagesSchema
    metadata: PipelineMetadataSchema
    estimated_cost: CostEstimateSchema | None = None
    estimated_performance: PerformanceEstimateSchema | None = None
