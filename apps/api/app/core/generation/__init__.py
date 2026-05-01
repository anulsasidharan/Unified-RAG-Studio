"""Generation Service — P2-6.

Multi-provider chat models (OpenAI, Anthropic, Google, Cohere, Mistral,
OpenAI-compatible for meta/custom) with RAG prompt assembly and optional streaming.

Typical usage::

    from app.core.generation import (
        GenerationResult,
        GenerationRuntimeConfig,
        GenerationService,
        generation_runtime_from_pipeline,
    )
    from app.schemas.pipeline import GenerationConfigSchema

    svc = GenerationService()
    cfg = generation_runtime_from_pipeline(pipeline.generation)
    result = await svc.generate(
        "What is RAG?",
        retrieved_documents,
        cfg,
    )
"""

from .pipeline_bridge import generation_runtime_from_pipeline
from .service import GenerationService
from .strategies import GenerationResult, GenerationRuntimeConfig

__all__ = [
    "GenerationResult",
    "GenerationRuntimeConfig",
    "GenerationService",
    "generation_runtime_from_pipeline",
]
