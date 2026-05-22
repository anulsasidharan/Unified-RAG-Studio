"""Code-aware chunker — language-specific structural splitting for source code.

Uses LangChain's RecursiveCharacterTextSplitter.from_language() which applies
language-aware separator sequences (class/function boundaries, block delimiters)
before falling back to line and character splitting.

Supported languages: python, js, ts, java, go, rust, cpp.
Language is auto-detected from file extension metadata when config.language="auto".
"""

import importlib
from typing import Any

from langchain_core.documents import Document
import structlog

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

# Maps file extension → internal language name
_EXTENSION_TO_LANG: dict[str, str] = {
    "py": "python",
    "js": "js",
    "jsx": "js",
    "ts": "ts",
    "tsx": "ts",
    "java": "java",
    "go": "go",
    "rs": "rust",
    "cpp": "cpp",
    "c": "cpp",
    "cc": "cpp",
    "h": "cpp",
    "hpp": "cpp",
}


def _get_lc_language(lang: str) -> Any:
    """Map an internal language name to a LangChain Language enum member."""
    lcts = importlib.import_module("langchain_text_splitters")
    Language = lcts.Language  # noqa: N806

    _MAP = {  # noqa: N806
        "python": Language.PYTHON,
        "js": Language.JS,
        "ts": Language.TS,
        "java": Language.JAVA,
        "go": Language.GO,
        "rust": Language.RUST,
        "cpp": Language.CPP,
    }
    return _MAP.get(lang, Language.PYTHON)


def _detect_language(doc: Document, explicit: str) -> str:
    """Resolve programming language from config, then metadata, then default."""
    if explicit != "auto":
        return explicit

    for key in ("file_extension", "source"):
        value = doc.metadata.get(key, "")
        if not value:
            continue
        ext = value.rsplit(".", 1)[-1].lower() if "." in value else value.lower()
        if ext in _EXTENSION_TO_LANG:
            return _EXTENSION_TO_LANG[ext]

    return "python"


class CodeAwareChunker(TextChunker):
    """Splits source-code documents at language-structural boundaries.

    The language is resolved per-document: explicit config.language wins, then
    file extension metadata, then "python" as the safe default.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        lcts = importlib.import_module("langchain_text_splitters")
        rcts = lcts.RecursiveCharacterTextSplitter

        result: list[Chunk] = []

        for doc in docs:
            if not doc.page_content.strip():
                continue

            lang_str = _detect_language(doc, config.language)
            lc_lang = _get_lc_language(lang_str)

            splitter = rcts.from_language(
                language=lc_lang,
                chunk_size=config.chunk_size,
                chunk_overlap=config.chunk_overlap,
            )

            splits = splitter.split_text(doc.page_content)
            total = len(splits)

            for i, text in enumerate(splits):
                if text.strip():
                    meta = {**doc.metadata, "detected_language": lang_str}
                    result.append(self._make_chunk(text, meta, i, total, "code-aware"))

        logger.info("code_aware_chunked", input_docs=len(docs), output_chunks=len(result))
        return result
