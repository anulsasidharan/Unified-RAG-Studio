"""RAG prompt assembly for the Generation Service."""

from __future__ import annotations

from langchain_core.documents import Document

DEFAULT_RAG_SYSTEM_PROMPT = (
    "You are a precise assistant. Answer using only the retrieved context below. "
    "If the context does not contain enough information, say so clearly. "
    "Do not invent facts not supported by the context."
)


def format_context_block(documents: list[Document]) -> str:
    """Numbered context blocks with optional source hints from metadata."""
    parts: list[str] = []
    for i, doc in enumerate(documents, start=1):
        meta = doc.metadata or {}
        src = meta.get("source") or meta.get("file_path") or meta.get("url")
        header = f"[{i}]"
        if src:
            header = f"[{i}] (source: {src})"
        parts.append(f"{header}\n{doc.page_content.strip()}")
    return "\n\n".join(parts)


def build_rag_user_message(
    query: str,
    documents: list[Document],
    *,
    output_format: str | None,
) -> str:
    """User message: numbered context + question + optional format hint."""
    ctx = format_context_block(documents)
    body = (
        "Use the following context to answer the question.\n\n"
        f"{ctx}\n\n"
        f"Question: {query.strip()}"
    )
    if output_format == "json":
        body += "\n\nRespond with valid JSON only (no markdown code fences)."
    elif output_format == "markdown":
        body += "\n\nFormat your answer in Markdown (headings, lists) where helpful."
    return body
