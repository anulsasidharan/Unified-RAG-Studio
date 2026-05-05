"""Shared JSON payloads for integration tests."""

from __future__ import annotations

from app.schemas.pipeline import PipelineConfigurationSchema


def minimal_pipeline_payload(temp_id: str = "integration-config-id") -> dict:
    """Valid minimal :class:`PipelineConfigurationSchema` (camelCase-compatible)."""
    raw = {
        "id": temp_id,
        "name": "Integration Pipeline",
        "description": "integration test configuration",
        "cloud_provider": "aws",
        "stages": {
            "chunking": {
                "strategy": "recursive-character",
                "chunk_size": 512,
                "chunk_overlap": 50,
            },
            "embedding": {
                "model": "text-embedding-3-small",
                "provider": "openai",
                "dimensions": 1536,
            },
            "vector_store": {
                "provider": "qdrant",
                "index_name": "integration-index",
            },
            "retrieval": {
                "strategy": "similarity",
                "top_k": 5,
            },
            "generation": {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        },
        "metadata": {
            "created_at": "2026-01-01T00:00:00+00:00",
            "version": "1.0.0",
            "source": "designer",
        },
    }
    PipelineConfigurationSchema.model_validate(raw)
    return raw
