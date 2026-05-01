"""Unit tests for the P2-2 Chunking Service.

Covers all 7 chunking strategies, ChunkerFactory, ChunkingService, and
ChunkQualityScorer. External dependencies (sentence-transformers, LangChain
splitters) are mocked where needed to keep tests fast and deterministic.
"""

import importlib
import re
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from langchain_core.documents import Document

from app.core.chunking import (
    Chunk,
    ChunkerFactory,
    ChunkingConfig,
    ChunkingService,
    ChunkQualityScorer,
    CodeAwareChunker,
    FixedSizeChunker,
    HTMLSectionChunker,
    MarkdownHeaderChunker,
    ParagraphChunker,
    RecursiveCharacterChunker,
    SemanticChunker,
    SentenceChunker,
)
from app.core.chunking.optimizers import ChunkQualityMetrics


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def simple_doc():
    return Document(
        page_content=(
            "First sentence here. Second sentence follows. Third sentence ends this."
        ),
        metadata={"source": "test.txt", "file_type": "txt", "page_number": 1},
    )


@pytest.fixture
def long_doc():
    text = (
        "Alpha paragraph has plenty of words. It continues with more text here.\n\n"
        "Beta paragraph covers a different topic. Even more content in this one.\n\n"
        "Gamma paragraph wraps the article up. Final words come last."
    )
    return Document(
        page_content=text,
        metadata={"source": "article.txt", "file_type": "txt"},
    )


@pytest.fixture
def markdown_doc():
    return Document(
        page_content=(
            "# Introduction\n\nThis is the intro text.\n\n"
            "## Methods\n\nDetails about methods here.\n\n"
            "### Subsection\n\nFurther detail in the subsection."
        ),
        metadata={"source": "paper.md", "file_type": "md"},
    )


@pytest.fixture
def html_doc():
    return Document(
        page_content=(
            "<html><body>"
            "<h1>Overview</h1><p>First paragraph.</p>"
            "<h2>Details</h2><p>Second paragraph.</p>"
            "</body></html>"
        ),
        metadata={"source": "page.html", "file_type": "html"},
    )


@pytest.fixture
def code_doc():
    code = (
        'def hello():\n    print("Hello")\n\n'
        'def goodbye():\n    print("Goodbye")\n\n'
        "class MyClass:\n    def method(self):\n        pass\n"
    )
    return Document(
        page_content=code,
        metadata={"source": "script.py", "file_extension": "py"},
    )


# ── FixedSizeChunker ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_fixed_size_chunker_produces_chunks(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy="fixed-size", chunk_size=30, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    assert len(chunks) > 1


@pytest.mark.unit
def test_fixed_size_chunker_chunk_size_respected(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy="fixed-size", chunk_size=20, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    # All chunks except the last should be exactly chunk_size characters
    for chunk in chunks[:-1]:
        assert len(chunk.page_content) <= 20


@pytest.mark.unit
def test_fixed_size_chunker_overlap_creates_extra_chunks(simple_doc):
    no_overlap = ChunkingConfig(strategy="fixed-size", chunk_size=20, chunk_overlap=0)
    with_overlap = ChunkingConfig(strategy="fixed-size", chunk_size=20, chunk_overlap=10)
    chunker = FixedSizeChunker()
    chunks_no_overlap = chunker.chunk([simple_doc], no_overlap)
    chunks_with_overlap = chunker.chunk([simple_doc], with_overlap)
    assert len(chunks_with_overlap) >= len(chunks_no_overlap)


@pytest.mark.unit
def test_fixed_size_chunker_metadata_propagated(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy="fixed-size", chunk_size=20, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    for chunk in chunks:
        assert chunk.metadata["source"] == "test.txt"
        assert chunk.metadata["chunk_strategy"] == "fixed-size"
        assert "chunk_index" in chunk.metadata
        assert "total_chunks" in chunk.metadata


@pytest.mark.unit
def test_fixed_size_chunker_chunk_indices_are_sequential(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy="fixed-size", chunk_size=20, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    indices = [c.metadata["chunk_index"] for c in chunks]
    assert indices == list(range(len(chunks)))


@pytest.mark.unit
def test_fixed_size_chunker_empty_doc_skipped():
    empty_doc = Document(page_content="   ", metadata={})
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy="fixed-size", chunk_size=50, chunk_overlap=0)
    chunks = chunker.chunk([empty_doc], config)
    assert chunks == []


# ── RecursiveCharacterChunker ─────────────────────────────────────────────────


@pytest.mark.unit
def test_recursive_chunker_basic(long_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["Chunk A.", "Chunk B.", "Chunk C."]

        chunker = RecursiveCharacterChunker()
        config = ChunkingConfig(strategy="recursive-character", chunk_size=64)
        chunks = chunker.chunk([long_doc], config)

    assert len(chunks) == 3
    assert chunks[0].page_content == "Chunk A."


@pytest.mark.unit
def test_recursive_chunker_metadata_propagated(long_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["Part one.", "Part two."]

        chunker = RecursiveCharacterChunker()
        chunks = chunker.chunk([long_doc], ChunkingConfig())

    for chunk in chunks:
        assert chunk.metadata["source"] == "article.txt"
        assert chunk.metadata["chunk_strategy"] == "recursive-character"
        assert chunk.metadata["total_chunks"] == 2


@pytest.mark.unit
def test_recursive_chunker_uses_custom_separators(long_doc):
    custom_seps = ["\n\n", " "]
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["x"]

        config = ChunkingConfig(separators=custom_seps)
        RecursiveCharacterChunker().chunk([long_doc], config)

    call_kwargs = MockSplitter.call_args[1]
    assert call_kwargs["separators"] == custom_seps


@pytest.mark.unit
def test_recursive_chunker_empty_splits_filtered(simple_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["  ", "Real content.", ""]

        chunks = RecursiveCharacterChunker().chunk([simple_doc], ChunkingConfig())

    assert len(chunks) == 1
    assert chunks[0].page_content == "Real content."


# ── SemanticChunker ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_semantic_chunker_splits_on_low_similarity(simple_doc):
    """Similarity below threshold should produce multiple chunks."""
    mock_model = MagicMock()
    # Three sentences → three embeddings; adjacent similarities all below threshold
    mock_model.encode.return_value = np.array([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ])

    chunker = SemanticChunker()
    chunker._model_cache["test-model"] = mock_model

    config = ChunkingConfig(
        strategy="semantic",
        embedding_model="test-model",
        breakpoint_threshold=0.99,  # very high → all pairs below threshold
    )
    chunks = chunker.chunk([simple_doc], config)
    assert len(chunks) >= 2


@pytest.mark.unit
def test_semantic_chunker_no_split_on_high_similarity(simple_doc):
    """Similarity above threshold should keep document as one chunk."""
    mock_model = MagicMock()
    # Identical embeddings → cosine similarity = 1.0 everywhere
    identical_vec = np.array([1.0, 0.0, 0.0])
    mock_model.encode.return_value = np.array([identical_vec] * 3)

    chunker = SemanticChunker()
    chunker._model_cache["test-model"] = mock_model

    config = ChunkingConfig(
        strategy="semantic",
        embedding_model="test-model",
        breakpoint_threshold=0.50,  # very low → no pair falls below
    )
    chunks = chunker.chunk([simple_doc], config)
    assert len(chunks) == 1


@pytest.mark.unit
def test_semantic_chunker_single_sentence_doc():
    """A document with one sentence is returned as-is without model call."""
    doc = Document(page_content="Just one sentence.", metadata={"source": "a.txt"})
    chunker = SemanticChunker()
    mock_model = MagicMock()
    chunker._model_cache["all-MiniLM-L6-v2"] = mock_model

    chunks = chunker.chunk([doc], ChunkingConfig(strategy="semantic"))
    assert len(chunks) == 1
    mock_model.encode.assert_not_called()


@pytest.mark.unit
def test_semantic_chunker_metadata_propagated(simple_doc):
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([[1, 0], [0, 1], [1, 0]])

    chunker = SemanticChunker()
    chunker._model_cache["test-model"] = mock_model

    config = ChunkingConfig(
        strategy="semantic",
        embedding_model="test-model",
        breakpoint_threshold=0.99,
    )
    chunks = chunker.chunk([simple_doc], config)
    for chunk in chunks:
        assert chunk.metadata["source"] == "test.txt"
        assert chunk.metadata["chunk_strategy"] == "semantic"


# ── MarkdownHeaderChunker ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_markdown_header_chunker_splits_on_headers(markdown_doc):
    with patch("app.core.chunking.document_based.MarkdownHeaderTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = [
            Document(page_content="Intro text.", metadata={"h1": "Introduction"}),
            Document(page_content="Methods text.", metadata={"h2": "Methods"}),
        ]

        chunker = MarkdownHeaderChunker()
        chunks = chunker.chunk([markdown_doc], ChunkingConfig(strategy="markdown-header"))

    assert len(chunks) == 2
    assert chunks[0].metadata["h1"] == "Introduction"
    assert chunks[0].metadata["chunk_strategy"] == "markdown-header"


@pytest.mark.unit
def test_markdown_header_chunker_merges_parent_metadata(markdown_doc):
    with patch("app.core.chunking.document_based.MarkdownHeaderTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = [
            Document(page_content="Content.", metadata={"h1": "Sec"}),
        ]

        chunker = MarkdownHeaderChunker()
        chunks = chunker.chunk([markdown_doc], ChunkingConfig())

    # Parent metadata (source, file_type) should be present
    assert chunks[0].metadata.get("source") == "paper.md"
    assert chunks[0].metadata.get("h1") == "Sec"


@pytest.mark.unit
def test_markdown_header_chunker_uses_default_headers(markdown_doc):
    with patch("app.core.chunking.document_based.MarkdownHeaderTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = []

        MarkdownHeaderChunker().chunk([markdown_doc], ChunkingConfig())

    call_kwargs = MockSplitter.call_args[1]
    headers = call_kwargs["headers_to_split_on"]
    assert ("#", "h1") in headers
    assert ("##", "h2") in headers


# ── HTMLSectionChunker ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_html_section_chunker_splits_on_headings(html_doc):
    chunker = HTMLSectionChunker()
    chunks = chunker.chunk([html_doc], ChunkingConfig(strategy="html-section"))
    assert len(chunks) >= 2
    all_text = " ".join(c.page_content for c in chunks)
    assert "Overview" in all_text
    assert "Details" in all_text


@pytest.mark.unit
def test_html_section_chunker_plain_text_as_one_chunk():
    doc = Document(page_content="Plain text with no HTML.", metadata={})
    chunker = HTMLSectionChunker()
    chunks = chunker.chunk([doc], ChunkingConfig())
    assert len(chunks) == 1
    assert chunks[0].page_content == "Plain text with no HTML."


@pytest.mark.unit
def test_html_section_chunker_metadata_propagated(html_doc):
    chunker = HTMLSectionChunker()
    chunks = chunker.chunk([html_doc], ChunkingConfig())
    for chunk in chunks:
        assert chunk.metadata["source"] == "page.html"
        assert chunk.metadata["chunk_strategy"] == "html-section"


# ── SentenceChunker ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_sentence_chunker_groups_n_sentences(simple_doc):
    chunker = SentenceChunker()
    config = ChunkingConfig(strategy="sentence-based", sentences_per_chunk=1, sentence_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    # 3 sentences → 3 chunks with n=1, overlap=0
    assert len(chunks) == 3


@pytest.mark.unit
def test_sentence_chunker_overlap_adds_repeated_sentences():
    doc = Document(
        page_content="A. B. C. D. E.",
        metadata={"source": "s.txt"},
    )
    chunker = SentenceChunker()
    config = ChunkingConfig(sentences_per_chunk=2, sentence_overlap=1)
    chunks = chunker.chunk([doc], config)
    # With n=2, overlap=1, step=1: A+B, B+C, C+D, D+E → 4 chunks
    assert len(chunks) == 4


@pytest.mark.unit
def test_sentence_chunker_metadata_propagated(simple_doc):
    chunker = SentenceChunker()
    config = ChunkingConfig(sentences_per_chunk=1, sentence_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    for chunk in chunks:
        assert chunk.metadata["source"] == "test.txt"
        assert chunk.metadata["chunk_strategy"] == "sentence-based"


@pytest.mark.unit
def test_sentence_chunker_empty_doc_skipped():
    empty_doc = Document(page_content="", metadata={})
    chunker = SentenceChunker()
    chunks = chunker.chunk([empty_doc], ChunkingConfig())
    assert chunks == []


# ── ParagraphChunker ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_paragraph_chunker_splits_on_double_newlines(long_doc):
    chunker = ParagraphChunker()
    config = ChunkingConfig(strategy="paragraph-based", chunk_size=1024)
    chunks = chunker.chunk([long_doc], config)
    # long_doc has 3 paragraphs separated by \n\n
    assert len(chunks) == 3


@pytest.mark.unit
def test_paragraph_chunker_oversized_paragraph_split():
    long_para = "Word " * 300  # ~1500 chars
    doc = Document(page_content=long_para, metadata={"source": "big.txt"})

    with patch("app.core.chunking.sentence.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["Part 1.", "Part 2.", "Part 3."]

        chunker = ParagraphChunker()
        config = ChunkingConfig(strategy="paragraph-based", chunk_size=100)
        chunks = chunker.chunk([doc], config)

    assert len(chunks) == 3


@pytest.mark.unit
def test_paragraph_chunker_metadata_propagated(long_doc):
    chunker = ParagraphChunker()
    config = ChunkingConfig(chunk_size=1024)
    chunks = chunker.chunk([long_doc], config)
    for chunk in chunks:
        assert chunk.metadata["source"] == "article.txt"
        assert chunk.metadata["chunk_strategy"] == "paragraph-based"


# ── CodeAwareChunker ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_code_aware_chunker_basic(code_doc):
    with patch("app.core.chunking.code_aware.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.from_language.return_value
        instance.split_text.return_value = ["def hello():\n    pass", "class MyClass:\n    pass"]

        chunker = CodeAwareChunker()
        config = ChunkingConfig(strategy="code-aware", chunk_size=256)
        chunks = chunker.chunk([code_doc], config)

    assert len(chunks) == 2
    assert chunks[0].metadata["chunk_strategy"] == "code-aware"


@pytest.mark.unit
def test_code_aware_chunker_auto_detects_python(code_doc):
    with patch("app.core.chunking.code_aware.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.from_language.return_value
        instance.split_text.return_value = ["snippet"]

        CodeAwareChunker().chunk([code_doc], ChunkingConfig(language="auto"))

    # Should detect Python from file_extension="py"
    call_args = MockSplitter.from_language.call_args
    lcts = importlib.import_module("langchain_text_splitters")
    Language = getattr(lcts, "Language")

    assert call_args[1]["language"] == Language.PYTHON


@pytest.mark.unit
def test_code_aware_chunker_explicit_language():
    doc = Document(page_content="func main() {}", metadata={"source": "main.go"})

    with patch("app.core.chunking.code_aware.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.from_language.return_value
        instance.split_text.return_value = ["func main() {}"]

        CodeAwareChunker().chunk([doc], ChunkingConfig(language="go"))

    lcts = importlib.import_module("langchain_text_splitters")
    Language = getattr(lcts, "Language")

    call_args = MockSplitter.from_language.call_args
    assert call_args[1]["language"] == Language.GO


@pytest.mark.unit
def test_code_aware_chunker_detected_language_in_metadata(code_doc):
    with patch("app.core.chunking.code_aware.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.from_language.return_value
        instance.split_text.return_value = ["snippet"]

        chunks = CodeAwareChunker().chunk([code_doc], ChunkingConfig(language="auto"))

    assert chunks[0].metadata["detected_language"] == "python"


# ── ChunkerFactory ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_factory_returns_correct_chunkers():
    assert isinstance(ChunkerFactory.from_strategy("fixed-size"), FixedSizeChunker)
    assert isinstance(ChunkerFactory.from_strategy("recursive-character"), RecursiveCharacterChunker)
    assert isinstance(ChunkerFactory.from_strategy("semantic"), SemanticChunker)
    assert isinstance(ChunkerFactory.from_strategy("markdown-header"), MarkdownHeaderChunker)
    assert isinstance(ChunkerFactory.from_strategy("html-section"), HTMLSectionChunker)
    assert isinstance(ChunkerFactory.from_strategy("sentence-based"), SentenceChunker)
    assert isinstance(ChunkerFactory.from_strategy("paragraph-based"), ParagraphChunker)
    assert isinstance(ChunkerFactory.from_strategy("code-aware"), CodeAwareChunker)


@pytest.mark.unit
def test_factory_unsupported_strategy_raises():
    with pytest.raises(ValueError, match="Unsupported chunking strategy"):
        ChunkerFactory.from_strategy("unknown-strategy")


@pytest.mark.unit
def test_factory_supported_strategies_returns_sorted_list():
    strategies = ChunkerFactory.supported_strategies()
    assert "fixed-size" in strategies
    assert "recursive-character" in strategies
    assert "semantic" in strategies
    assert "code-aware" in strategies
    assert strategies == sorted(strategies)


# ── ChunkingService ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_chunking_service_default_config(simple_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["Part A.", "Part B."]

        svc = ChunkingService()
        chunks = svc.chunk([simple_doc])  # uses default ChunkingConfig

    assert len(chunks) == 2


@pytest.mark.unit
def test_chunking_service_returns_list_of_documents(simple_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["text"]

        chunks = ChunkingService().chunk([simple_doc])

    assert all(isinstance(c, Document) for c in chunks)


@pytest.mark.unit
def test_chunking_service_chunk_many(simple_doc, long_doc):
    with patch("app.core.chunking.recursive.RecursiveCharacterTextSplitter") as MockSplitter:
        instance = MockSplitter.return_value
        instance.split_text.return_value = ["x", "y"]

        svc = ChunkingService()
        chunks = svc.chunk_many([[simple_doc], [long_doc]])

    # Both doc groups contribute 2 chunks each → total 4
    assert len(chunks) == 4


@pytest.mark.unit
def test_chunking_service_passes_config_to_factory(simple_doc):
    with patch("app.core.chunking.sentence.SentenceChunker.chunk", return_value=[]) as mock_chunk:
        ChunkingService().chunk(
            [simple_doc],
            ChunkingConfig(strategy="sentence-based", sentences_per_chunk=5),
        )
        called_config = mock_chunk.call_args[0][1]

    assert called_config.sentences_per_chunk == 5


# ── ChunkQualityScorer ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_quality_scorer_high_density_sentence_ending():
    chunk = Document(page_content="Dense text with no extra spaces.", metadata={})
    scorer = ChunkQualityScorer(target_size=len("Dense text with no extra spaces."))
    metrics = scorer.score(chunk)
    assert metrics.content_density > 0.8
    assert metrics.completeness == 1.0
    assert metrics.size_score == 1.0
    assert 0.0 <= metrics.overall <= 1.0


@pytest.mark.unit
def test_quality_scorer_empty_chunk():
    chunk = Document(page_content="", metadata={})
    scorer = ChunkQualityScorer()
    metrics = scorer.score(chunk)
    assert metrics.overall == 0.0


@pytest.mark.unit
def test_quality_scorer_completeness_zero_for_incomplete():
    chunk = Document(page_content="This chunk ends mid-sentence with no", metadata={})
    scorer = ChunkQualityScorer()
    metrics = scorer.score(chunk)
    assert metrics.completeness == 0.0


@pytest.mark.unit
def test_quality_scorer_weights_must_sum_to_one():
    with pytest.raises(ValueError, match="must equal 1.0"):
        ChunkQualityScorer(density_weight=0.5, completeness_weight=0.5, size_weight=0.5)


@pytest.mark.unit
def test_quality_scorer_score_batch():
    docs = [
        Document(page_content="Complete sentence here.", metadata={}),
        Document(page_content="Another complete sentence.", metadata={}),
    ]
    scorer = ChunkQualityScorer()
    metrics = scorer.score_batch(docs)
    assert len(metrics) == 2
    assert all(isinstance(m, ChunkQualityMetrics) for m in metrics)


@pytest.mark.unit
def test_quality_scorer_filter_low_quality():
    docs = [
        Document(page_content="Good quality text ends here.", metadata={}),
        Document(page_content="  ", metadata={}),  # whitespace-only → low score
    ]
    scorer = ChunkQualityScorer(target_size=30)
    kept = scorer.filter_low_quality(docs, min_score=0.3)
    # Whitespace chunk should be filtered out
    assert len(kept) == 1
    assert "Good quality" in kept[0].page_content


# ── Metadata propagation integration ─────────────────────────────────────────


@pytest.mark.unit
def test_all_chunks_carry_chunk_index_and_total(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(chunk_size=20, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)

    for chunk in chunks:
        assert "chunk_index" in chunk.metadata
        assert "total_chunks" in chunk.metadata
        assert chunk.metadata["total_chunks"] == len(chunks)


@pytest.mark.unit
def test_chunk_indices_are_contiguous(simple_doc):
    chunker = FixedSizeChunker()
    config = ChunkingConfig(chunk_size=20, chunk_overlap=0)
    chunks = chunker.chunk([simple_doc], config)
    indices = [c.metadata["chunk_index"] for c in chunks]
    assert indices == list(range(len(chunks)))


@pytest.mark.unit
def test_parent_metadata_fully_propagated():
    doc = Document(
        page_content="Text with rich metadata.",
        metadata={
            "source": "doc.txt",
            "page_number": 5,
            "author": "Alice",
            "project_id": "abc123",
        },
    )
    chunker = FixedSizeChunker()
    chunks = chunker.chunk([doc], ChunkingConfig(chunk_size=1000, chunk_overlap=0))
    assert len(chunks) == 1
    meta = chunks[0].metadata
    assert meta["source"] == "doc.txt"
    assert meta["page_number"] == 5
    assert meta["author"] == "Alice"
    assert meta["project_id"] == "abc123"
