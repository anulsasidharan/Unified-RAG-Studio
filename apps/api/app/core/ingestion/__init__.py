"""Document Ingestion Service — P2-1.

Entry point for the ingestion layer. Provides IngestionService, which accepts
a source description (file path, URL, or raw bytes) and returns a list of
LangChain Documents with clean text and rich metadata.

Both Designer and Autopilot modes consume this service.

Typical usage:

    service = IngestionService()

    # Load from disk
    docs = service.load(IngestionSource(source_type="file", path="report.pdf"))

    # Load from uploaded bytes
    docs = service.load(
        IngestionSource(source_type="bytes", content=pdf_bytes, file_type="pdf")
    )

    # Load from URL
    docs = service.load(IngestionSource(source_type="url", url="https://example.com"))

    # Load multiple sources at once
    docs = service.load_many([source_a, source_b])
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog
from langchain_core.documents import Document

from .extractors import (
    extract_docx_metadata,
    extract_file_metadata,
    extract_html_metadata,
    extract_pdf_metadata,
    extract_section_headers,
    extract_url_metadata,
)
from .loaders import LoaderFactory

# Re-export for convenience
from .preprocessors import TextPreprocessor

logger = structlog.get_logger(__name__)

__all__ = [
    "IngestionService",
    "IngestionSource",
    "IngestionConfig",
    "TextPreprocessor",
]


# ── Source specification ───────────────────────────────────────────────────────


@dataclass
class IngestionSource:
    """Describes a single ingestion source.

    Attributes:
        source_type:     One of "file", "url", or "bytes".
        path:            File system path (source_type="file").
        url:             Remote URL (source_type="url").
        content:         Raw bytes payload (source_type="bytes").
        filename:        Filename hint for bytes sources — used to infer extension.
        file_type:       Explicit extension override, e.g. "pdf" (skips inference).
        custom_metadata: Arbitrary key/value metadata merged into every Document.
    """

    source_type: str  # "file" | "url" | "bytes"
    path: str | Path | None = None
    url: str | None = None
    content: bytes | None = None
    filename: str | None = None
    file_type: str | None = None
    custom_metadata: dict[str, Any] = field(default_factory=dict)


# ── Ingestion config ───────────────────────────────────────────────────────────


@dataclass
class IngestionConfig:
    """Controls preprocessing and metadata extraction behaviour.

    Mirrors DataIngestionPreprocessingSchema / DataIngestionMetadataSchema fields.
    """

    strip_html: bool = False
    normalize_whitespace: bool = True
    extract_metadata: bool = True
    include_source: bool = True
    include_page_number: bool = True


# ── Service ───────────────────────────────────────────────────────────────────


class IngestionService:
    """Loads, cleans, and enriches documents from diverse sources.

    The pipeline for each source is:
    1. Dispatch to the correct DocumentLoader based on source type / file extension.
    2. Clean each Document's text via TextPreprocessor.
    3. Augment metadata from format-specific extractors.
    4. Filter out empty documents.
    5. Merge any custom metadata from the IngestionSource.
    """

    def load(
        self,
        source: IngestionSource,
        config: IngestionConfig | None = None,
    ) -> list[Document]:
        """Load a single source and return cleaned, enriched Documents."""
        cfg = config or IngestionConfig()
        raw_docs = self._load_raw(source)

        preprocessor = TextPreprocessor(
            strip_html=cfg.strip_html,
            normalize_whitespace_=cfg.normalize_whitespace,
        )

        result: list[Document] = []
        for doc in raw_docs:
            cleaned = preprocessor.preprocess(doc.page_content)
            if not cleaned.strip():
                continue  # Drop empty documents (blank PDF pages, empty rows, etc.)

            meta = dict(doc.metadata)
            if cfg.extract_metadata:
                meta.update(self._extract_metadata(source, doc))
            meta.update(source.custom_metadata)

            if not cfg.include_source:
                meta.pop("source", None)
            if not cfg.include_page_number:
                meta.pop("page_number", None)

            result.append(Document(page_content=cleaned, metadata=meta))

        logger.info(
            "ingestion_complete",
            source_type=source.source_type,
            docs_loaded=len(result),
        )
        return result

    def load_many(
        self,
        sources: list[IngestionSource],
        config: IngestionConfig | None = None,
    ) -> list[Document]:
        """Load multiple sources and concatenate their Documents."""
        all_docs: list[Document] = []
        for src in sources:
            all_docs.extend(self.load(src, config))
        return all_docs

    # ── Private helpers ────────────────────────────────────────────────────────

    def _load_raw(self, source: IngestionSource) -> list[Document]:
        """Dispatch to the appropriate loader and return raw (uncleaned) Documents."""
        if source.source_type == "url":
            loader = LoaderFactory.for_url()
            return loader.load(source.url or "")

        if source.source_type == "bytes":
            if not source.file_type and not source.filename:
                raise ValueError(
                    "IngestionSource with source_type='bytes' requires "
                    "file_type or filename to infer the loader."
                )
            ext = source.file_type or Path(source.filename or "").suffix.lstrip(".")
            loader = LoaderFactory.from_extension(ext)
            return loader.load(
                source.content or b"",
                filename=source.filename or f"upload.{ext}",
            )

        if source.source_type == "file":
            if source.path is None:
                raise ValueError(
                    "IngestionSource with source_type='file' requires path."
                )
            loader = LoaderFactory.from_path(source.path)
            return loader.load(source.path)

        raise ValueError(f"Unsupported source_type: {source.source_type!r}")

    def _extract_metadata(
        self, source: IngestionSource, doc: Document
    ) -> dict[str, Any]:
        """Run format-specific metadata extraction and return enriching fields."""
        extra: dict[str, Any] = {}
        file_type = doc.metadata.get("file_type", "")

        if file_type == "pdf":
            raw = (
                source.content
                if source.source_type == "bytes"
                else source.path
            )
            if raw is not None:
                extra.update(
                    extract_pdf_metadata(
                        raw if isinstance(raw, bytes) else str(raw)
                    )
                )

        elif file_type == "docx":
            raw = (
                source.content
                if source.source_type == "bytes"
                else source.path
            )
            if raw is not None:
                extra.update(
                    extract_docx_metadata(
                        raw if isinstance(raw, bytes) else str(raw)
                    )
                )

        elif file_type in ("html", "htm"):
            extra.update(extract_html_metadata(doc.page_content))

        elif file_type == "url":
            extra.update(extract_url_metadata(source.url or ""))

        if source.source_type == "file" and source.path:
            extra.update(extract_file_metadata(source.path))

        # Add section headers as a lightweight structure signal (capped at 10)
        headers = extract_section_headers(doc.page_content)
        if headers:
            extra["section_headers"] = headers[:10]

        return extra
