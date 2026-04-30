"""Document-structure-aware chunkers for Markdown and HTML content.

MarkdownHeaderChunker   — splits on ATX header boundaries (# ## ###)
HTMLSectionChunker      — splits on HTML heading element (h1–h4) boundaries
"""

import structlog
from langchain_core.documents import Document

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

_DEFAULT_HEADERS: list[tuple[str, str]] = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
]


class MarkdownHeaderChunker(TextChunker):
    
    
    
    
    """Splits Markdown documents at header boundaries using LangChain.

    Each output chunk corresponds to a section demarcated by a Markdown ATX
    header. Header context (h1, h2, h3) is merged into chunk metadata so
    downstream retrieval can filter by section.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        from langchain_text_splitters import MarkdownHeaderTextSplitter

        headers = config.headers_to_split_on or _DEFAULT_HEADERS
        splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers,
            return_each_line=config.return_each_line,
        )

        result: list[Chunk] = []
        for doc in docs:
            if not doc.page_content.strip():
                continue

            splits = splitter.split_text(doc.page_content)
            total = len(splits)
            for i, split_doc in enumerate(splits):
                if not split_doc.page_content.strip():
                    continue
                # Merge parent metadata with LangChain's header metadata
                merged_meta = {**doc.metadata, **split_doc.metadata}
                result.append(
                    self._make_chunk(
                        split_doc.page_content, merged_meta, i, total, "markdown-header"
                    )
                )

        logger.info(
            "markdown_header_chunked", input_docs=len(docs), output_chunks=len(result)
        )
        return result


class HTMLSectionChunker(TextChunker):
    """Splits HTML documents at heading element (h1–h4) boundaries.

    Uses BeautifulSoup to walk the DOM and collect text blocks between headings.
    If the input contains no HTML tags the entire text is returned as one chunk.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        result: list[Chunk] = []

        for doc in docs:
            text = doc.page_content
            if not text.strip():
                continue

            if "<" in text and ">" in text:
                sections = self._extract_sections(text)
            else:
                sections = [text]

            sections = [s.strip() for s in sections if s.strip()]
            if not sections:
                continue

            total = len(sections)
            for i, section_text in enumerate(sections):
                result.append(
                    self._make_chunk(section_text, doc.metadata, i, total, "html-section")
                )

        logger.info(
            "html_section_chunked", input_docs=len(docs), output_chunks=len(result)
        )
        return result

    def _extract_sections(self, html: str) -> list[str]:
        """Walk the DOM and collect text blocks between heading elements."""
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        heading_tags = {"h1", "h2", "h3", "h4"}
        leaf_tags = {"p", "li", "td", "th", "blockquote", "pre", "code"}

        sections: list[str] = []
        current: list[str] = []

        for element in soup.find_all(True):
            if element.name in heading_tags:
                if current:
                    sections.append(" ".join(current))
                    current = []
                heading_text = element.get_text(strip=True)
                if heading_text:
                    current.append(heading_text)
            elif element.name in leaf_tags:
                text = element.get_text(strip=True)
                if text:
                    current.append(text)

        if current:
            sections.append(" ".join(current))

        return sections
