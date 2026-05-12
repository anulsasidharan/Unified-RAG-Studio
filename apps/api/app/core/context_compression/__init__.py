"""Context compression between retrieval and reranking."""

from .apply import ContextCompressionRuntimeConfig, apply_context_compression
from .pipeline_bridge import context_compression_runtime_from_pipeline

__all__ = [
    "ContextCompressionRuntimeConfig",
    "apply_context_compression",
    "context_compression_runtime_from_pipeline",
]
