"""Unit tests for the P2-1 Document Ingestion Service.

Covers loaders, preprocessors, extractors, and IngestionService integration.
External I/O (pypdf, python-docx, trafilatura) is mocked to keep tests fast
and deterministic.
"""

import io
import json
import sys
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

from app.core.ingestion import (
    IngestionConfig,
    IngestionService,
    IngestionSource,
    TextPreprocessor,
)
from app.core.ingestion.extractors import (
    extract_docx_metadata,
    extract_file_metadata,
    extract_html_metadata,
    extract_pdf_metadata,
    extract_section_headers,
    extract_url_metadata,
)
from app.core.ingestion.loaders import (
    CSVLoader,
    DOCXLoader,
    HTMLLoader,
    JSONLoader,
    LoaderFactory,
    PDFLoader,
    TextLoader,
    URLLoader,
)
from app.core.ingestion.preprocessors import (
    fix_encoding,
    normalize_whitespace,
    remove_headers_footers,
    strip_html_tags,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def simple_pdf_bytes():
    """Minimal valid PDF-like bytes; actual parsing is mocked."""
    return b"%PDF-1.4 fake pdf content"


@pytest.fixture
def simple_docx_bytes():
    """Placeholder bytes for DOCX; actual parsing is mocked."""
    return b"PK\x03\x04 fake docx content"


@pytest.fixture
def html_bytes():
    return b"""<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <meta name="description" content="A test page">
  <meta name="author" content="Test Author">
  <meta property="og:title" content="OG Title">
</head>
<body>
  <h1>Hello World</h1>
  <p>Some paragraph text.</p>
</body>
</html>"""


@pytest.fixture
def csv_bytes():
    return b"name,age,city\nAlice,30,NYC\nBob,25,LA\n"


@pytest.fixture
def json_list_bytes():
    data = [{"id": 1, "text": "hello"}, {"id": 2, "text": "world"}]
    return json.dumps(data).encode()


@pytest.fixture
def json_object_bytes():
    data = {"key": "value", "number": 42}
    return json.dumps(data).encode()


# ── TextLoader ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_text_loader_from_bytes():
    content = b"Hello, world!\nSecond line."
    loader = TextLoader()
    docs = loader.load(content, filename="sample.txt")
    assert len(docs) == 1
    assert docs[0].page_content == "Hello, world!\nSecond line."
    assert docs[0].metadata["file_type"] == "txt"
    assert docs[0].metadata["source"] == "sample.txt"


@pytest.mark.unit
def test_text_loader_from_bytes_markdown():
    content = b"# Heading\n\nParagraph."
    loader = TextLoader()
    docs = loader.load(content, filename="readme.md")
    assert docs[0].metadata["file_type"] == "md"


@pytest.mark.unit
def test_text_loader_from_file(tmp_path):
    f = tmp_path / "doc.txt"
    f.write_text("File content here.", encoding="utf-8")
    loader = TextLoader()
    docs = loader.load(str(f))
    assert docs[0].page_content == "File content here."
    assert docs[0].metadata["source"] == str(f)


@pytest.mark.unit
def test_text_loader_invalid_utf8_is_replaced():
    bad_bytes = b"Hello \xff World"
    loader = TextLoader()
    docs = loader.load(bad_bytes, filename="bad.txt")
    assert "Hello" in docs[0].page_content


# ── HTMLLoader ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_html_loader_strips_script_and_style(html_bytes):
    loader = HTMLLoader()
    docs = loader.load(html_bytes, filename="page.html")
    assert len(docs) == 1
    assert "Hello World" in docs[0].page_content
    assert "<script" not in docs[0].page_content
    assert docs[0].metadata["file_type"] == "html"


@pytest.mark.unit
def test_html_loader_extracts_title(html_bytes):
    loader = HTMLLoader()
    docs = loader.load(html_bytes, filename="page.html")
    assert docs[0].metadata.get("title") == "Test Page"


@pytest.mark.unit
def test_html_loader_from_file(tmp_path, html_bytes):
    f = tmp_path / "page.html"
    f.write_bytes(html_bytes)
    loader = HTMLLoader()
    docs = loader.load(str(f))
    assert "Hello World" in docs[0].page_content


# ── CSVLoader ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_csv_loader_produces_one_doc_per_row(csv_bytes):
    loader = CSVLoader()
    docs = loader.load(csv_bytes, filename="data.csv")
    assert len(docs) == 2
    assert "name: Alice" in docs[0].page_content
    assert "age: 30" in docs[0].page_content
    assert docs[0].metadata["row_index"] == 0
    assert docs[1].metadata["row_index"] == 1


@pytest.mark.unit
def test_csv_loader_includes_column_names(csv_bytes):
    loader = CSVLoader()
    docs = loader.load(csv_bytes, filename="data.csv")
    assert "name" in docs[0].metadata["columns"]
    assert "age" in docs[0].metadata["columns"]


@pytest.mark.unit
def test_csv_loader_file_type_metadata(csv_bytes):
    loader = CSVLoader()
    docs = loader.load(csv_bytes, filename="data.csv")
    assert docs[0].metadata["file_type"] == "csv"


# ── JSONLoader ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_json_loader_list_gives_one_doc_per_item(json_list_bytes):
    loader = JSONLoader()
    docs = loader.load(json_list_bytes, filename="items.json")
    assert len(docs) == 2
    assert docs[0].metadata["item_index"] == 0
    assert docs[1].metadata["item_index"] == 1


@pytest.mark.unit
def test_json_loader_object_gives_one_doc(json_object_bytes):
    loader = JSONLoader()
    docs = loader.load(json_object_bytes, filename="obj.json")
    assert len(docs) == 1
    parsed = json.loads(docs[0].page_content)
    assert parsed["key"] == "value"


@pytest.mark.unit
def test_json_loader_file_type_metadata(json_list_bytes):
    loader = JSONLoader()
    docs = loader.load(json_list_bytes, filename="items.json")
    assert docs[0].metadata["file_type"] == "json"


# ── PDFLoader ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_pdf_loader_from_bytes(simple_pdf_bytes):
    mock_page1 = MagicMock()
    mock_page1.extract_text.return_value = "Page one text."
    mock_page2 = MagicMock()
    mock_page2.extract_text.return_value = "Page two text."

    mock_reader = MagicMock()
    mock_reader.pages = [mock_page1, mock_page2]

    with patch("app.core.ingestion.loaders.PdfReader", return_value=mock_reader):
        loader = PDFLoader()
        docs = loader.load(simple_pdf_bytes, filename="doc.pdf")

    assert len(docs) == 2
    assert docs[0].page_content == "Page one text."
    assert docs[0].metadata["page_number"] == 1
    assert docs[0].metadata["total_pages"] == 2
    assert docs[1].metadata["page_number"] == 2
    assert docs[0].metadata["file_type"] == "pdf"


@pytest.mark.unit
def test_pdf_loader_empty_page_produces_empty_content(simple_pdf_bytes):
    mock_page = MagicMock()
    mock_page.extract_text.return_value = None  # pypdf returns None for blank pages

    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]

    with patch("app.core.ingestion.loaders.PdfReader", return_value=mock_reader):
        loader = PDFLoader()
        docs = loader.load(simple_pdf_bytes, filename="blank.pdf")

    assert docs[0].page_content == ""


# ── DOCXLoader ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_docx_loader_from_bytes(simple_docx_bytes):
    mock_para1 = MagicMock()
    mock_para1.text = "First paragraph."
    mock_para2 = MagicMock()
    mock_para2.text = ""  # Empty paragraph — should be excluded
    mock_para3 = MagicMock()
    mock_para3.text = "Third paragraph."

    mock_doc = MagicMock()
    mock_doc.paragraphs = [mock_para1, mock_para2, mock_para3]

    with patch("app.core.ingestion.loaders.docx.Document", return_value=mock_doc):
        loader = DOCXLoader()
        docs = loader.load(simple_docx_bytes, filename="report.docx")

    assert len(docs) == 1
    assert "First paragraph." in docs[0].page_content
    assert "Third paragraph." in docs[0].page_content
    assert docs[0].metadata["file_type"] == "docx"


# ── URLLoader ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_url_loader_returns_extracted_text():
    mock_traf = MagicMock()
    mock_traf.fetch_url.return_value = "<html>raw</html>"
    mock_traf.extract.return_value = "Extracted body text."
    with patch.dict(sys.modules, {"trafilatura": mock_traf}):
        loader = URLLoader()
        docs = loader.load("https://example.com")

    assert len(docs) == 1
    assert docs[0].page_content == "Extracted body text."
    assert docs[0].metadata["source"] == "https://example.com"
    assert docs[0].metadata["file_type"] == "url"


@pytest.mark.unit
def test_url_loader_returns_empty_on_fetch_failure():
    mock_traf = MagicMock()
    mock_traf.fetch_url.return_value = None
    with patch.dict(sys.modules, {"trafilatura": mock_traf}):
        loader = URLLoader()
        docs = loader.load("https://unreachable.example")

    assert docs == []


@pytest.mark.unit
def test_url_loader_returns_empty_when_extraction_yields_nothing():
    mock_traf = MagicMock()
    mock_traf.fetch_url.return_value = "<html></html>"
    mock_traf.extract.return_value = None
    with patch.dict(sys.modules, {"trafilatura": mock_traf}):
        loader = URLLoader()
        docs = loader.load("https://example.com")

    assert docs == []


# ── LoaderFactory ─────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_loader_factory_from_extension_pdf():
    loader = LoaderFactory.from_extension("pdf")
    assert isinstance(loader, PDFLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_docx():
    assert isinstance(LoaderFactory.from_extension("docx"), DOCXLoader)
    assert isinstance(LoaderFactory.from_extension("doc"), DOCXLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_text_variants():
    for ext in ("txt", "md", "markdown", "rst"):
        assert isinstance(LoaderFactory.from_extension(ext), TextLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_html():
    assert isinstance(LoaderFactory.from_extension("html"), HTMLLoader)
    assert isinstance(LoaderFactory.from_extension("htm"), HTMLLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_csv_json():
    assert isinstance(LoaderFactory.from_extension("csv"), CSVLoader)
    assert isinstance(LoaderFactory.from_extension("json"), JSONLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_case_insensitive():
    assert isinstance(LoaderFactory.from_extension("PDF"), PDFLoader)
    assert isinstance(LoaderFactory.from_extension(".PDF"), PDFLoader)


@pytest.mark.unit
def test_loader_factory_from_extension_unsupported_raises():
    with pytest.raises(ValueError, match="Unsupported file extension"):
        LoaderFactory.from_extension("xyz")


@pytest.mark.unit
def test_loader_factory_from_path():
    loader = LoaderFactory.from_path("/some/path/report.pdf")
    assert isinstance(loader, PDFLoader)


@pytest.mark.unit
def test_loader_factory_for_url():
    assert isinstance(LoaderFactory.for_url(), URLLoader)


@pytest.mark.unit
def test_loader_factory_supported_extensions():
    exts = LoaderFactory.supported_extensions()
    assert "pdf" in exts
    assert "docx" in exts
    assert "csv" in exts
    assert "json" in exts


# ── strip_html_tags ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_strip_html_tags_removes_simple_tags():
    assert strip_html_tags("<p>Hello</p>") == "Hello"


@pytest.mark.unit
def test_strip_html_tags_removes_nested_tags():
    assert strip_html_tags("<div><span>Text</span></div>") == "Text"


@pytest.mark.unit
def test_strip_html_tags_leaves_plain_text_unchanged():
    assert strip_html_tags("Just plain text") == "Just plain text"


@pytest.mark.unit
def test_strip_html_tags_handles_empty_string():
    assert strip_html_tags("") == ""


# ── normalize_whitespace ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_normalize_whitespace_collapses_spaces():
    assert normalize_whitespace("hello   world") == "hello world"


@pytest.mark.unit
def test_normalize_whitespace_caps_newlines():
    result = normalize_whitespace("a\n\n\n\nb")
    assert "\n\n\n" not in result
    assert "a\n\nb" == result


@pytest.mark.unit
def test_normalize_whitespace_strips_trailing_spaces():
    result = normalize_whitespace("line one   \nline two   ")
    lines = result.splitlines()
    assert all(not line.endswith(" ") for line in lines)


@pytest.mark.unit
def test_normalize_whitespace_collapses_tabs():
    result = normalize_whitespace("col1\t\tcol2")
    assert result == "col1 col2"


# ── fix_encoding ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_fix_encoding_removes_null_bytes():
    text = "hello\x00world"
    assert fix_encoding(text) == "helloworld"


@pytest.mark.unit
def test_fix_encoding_normalizes_nfc():
    # Combining characters → precomposed form
    decomposed = "é"  # e + combining acute accent
    result = fix_encoding(decomposed)
    assert result == "\xe9"  # precomposed é


@pytest.mark.unit
def test_fix_encoding_plain_text_unchanged():
    text = "All ASCII text."
    assert fix_encoding(text) == "All ASCII text."


# ── remove_headers_footers ────────────────────────────────────────────────────


@pytest.mark.unit
def test_remove_headers_footers_strips_repeated_lines():
    header = "Company Confidential"
    footer = "Page 1 of 10"
    # Build 4 pages (above min_occurrences=3)
    page_template = f"{header}\n\nBody text for page.\n\n{footer}"
    text = "\f".join([page_template] * 4)

    result = remove_headers_footers(text)
    assert header not in result
    assert footer not in result
    assert "Body text for page." in result


@pytest.mark.unit
def test_remove_headers_footers_skips_short_documents():
    # Only 2 pages — below min_occurrences, should be unchanged
    text = "Header\n\nPage 1 body.\n\nFooter\fHeader\n\nPage 2 body.\n\nFooter"
    result = remove_headers_footers(text)
    assert result == text


# ── TextPreprocessor ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_text_preprocessor_default_pipeline():
    preprocessor = TextPreprocessor()
    text = "Hello\x00 <b>World</b>   "
    result = preprocessor.preprocess(text)
    assert "\x00" not in result
    assert result.strip() == result


@pytest.mark.unit
def test_text_preprocessor_strip_html_disabled_by_default():
    preprocessor = TextPreprocessor()
    text = "<p>text</p>"
    result = preprocessor.preprocess(text)
    assert "<p>" in result  # HTML NOT stripped when strip_html=False


@pytest.mark.unit
def test_text_preprocessor_strip_html_enabled():
    preprocessor = TextPreprocessor(strip_html=True)
    result = preprocessor.preprocess("<p>text</p>")
    assert "<p>" not in result
    assert "text" in result


@pytest.mark.unit
def test_text_preprocessor_normalize_whitespace_disabled():
    preprocessor = TextPreprocessor(normalize_whitespace_=False)
    text = "a   b"
    assert preprocessor.preprocess(text) == "a   b"


@pytest.mark.unit
def test_text_preprocessor_from_config():
    config = {"strip_html": True, "normalize_whitespace": False}
    preprocessor = TextPreprocessor.from_config(config)
    result = preprocessor.preprocess("<b>text</b>   extra spaces")
    assert "<b>" not in result
    assert "extra spaces" in result  # whitespace preserved (normalize=False)


# ── extract_html_metadata ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_html_metadata_title(html_bytes):
    meta = extract_html_metadata(html_bytes.decode())
    assert meta.get("title") == "Test Page"


@pytest.mark.unit
def test_extract_html_metadata_description(html_bytes):
    meta = extract_html_metadata(html_bytes.decode())
    assert meta.get("description") == "A test page"


@pytest.mark.unit
def test_extract_html_metadata_author(html_bytes):
    meta = extract_html_metadata(html_bytes.decode())
    assert meta.get("author") == "Test Author"


@pytest.mark.unit
def test_extract_html_metadata_no_tags():
    meta = extract_html_metadata("Just plain text, no HTML.")
    assert meta == {}


@pytest.mark.unit
def test_extract_html_metadata_og_title_used_as_fallback():
    html = '<html><head><meta property="og:title" content="OG Title"/></head></html>'
    meta = extract_html_metadata(html)
    assert meta.get("title") == "OG Title"


# ── extract_section_headers ───────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_section_headers_markdown():
    text = "# Introduction\n\nSome text.\n\n## Background\n\nMore text."
    headers = extract_section_headers(text)
    assert "Introduction" in headers
    assert "Background" in headers


@pytest.mark.unit
def test_extract_section_headers_title_case():
    text = "Overview\n\nThis is a paragraph of text with more information."
    headers = extract_section_headers(text)
    assert "Overview" in headers


@pytest.mark.unit
def test_extract_section_headers_excludes_long_lines():
    long_line = "This Is A Very Long Title That Exceeds One Hundred And Twenty Characters " + "X" * 60
    headers = extract_section_headers(long_line)
    assert long_line.strip() not in headers


@pytest.mark.unit
def test_extract_section_headers_empty_text():
    assert extract_section_headers("") == []


# ── extract_url_metadata ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_url_metadata_includes_source_url():
    meta = extract_url_metadata("https://example.com/page")
    assert meta["source_url"] == "https://example.com/page"


@pytest.mark.unit
def test_extract_url_metadata_with_html():
    html = "<html><head><title>My Page</title></head></html>"
    meta = extract_url_metadata("https://example.com", html_content=html)
    assert meta.get("title") == "My Page"


# ── extract_file_metadata ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_file_metadata_filename_and_extension(tmp_path):
    f = tmp_path / "report.pdf"
    f.write_bytes(b"fake")
    meta = extract_file_metadata(str(f))
    assert meta["filename"] == "report.pdf"
    assert meta["file_extension"] == "pdf"
    assert meta["file_size_bytes"] == 4


@pytest.mark.unit
def test_extract_file_metadata_nonexistent_file():
    meta = extract_file_metadata("/no/such/file.txt")
    assert meta["filename"] == "file.txt"
    assert meta["file_extension"] == "txt"
    assert "file_size_bytes" not in meta


# ── extract_pdf_metadata ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_pdf_metadata_from_bytes():
    mock_info = {"/Title": "My Report", "/Author": "Alice", "/CreationDate": "D:20240101"}
    mock_reader = MagicMock()
    mock_reader.metadata = mock_info
    mock_reader.pages = [MagicMock(), MagicMock()]

    with patch("app.core.ingestion.extractors.PdfReader", return_value=mock_reader):
        meta = extract_pdf_metadata(b"fake pdf bytes")

    assert meta["title"] == "My Report"
    assert meta["author"] == "Alice"
    assert meta["page_count"] == 2


@pytest.mark.unit
def test_extract_pdf_metadata_returns_empty_on_error():
    with patch("app.core.ingestion.extractors.PdfReader", side_effect=Exception("corrupt")):
        meta = extract_pdf_metadata(b"bad bytes")
    assert meta == {}


# ── extract_docx_metadata ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_docx_metadata_from_bytes():
    mock_props = MagicMock()
    mock_props.title = "Q4 Report"
    mock_props.author = "Bob"
    mock_props.description = None
    mock_props.created = None
    mock_props.modified = None

    mock_doc = MagicMock()
    mock_doc.core_properties = mock_props
    mock_doc.paragraphs = [MagicMock(), MagicMock()]

    with patch("app.core.ingestion.extractors.docx.Document", return_value=mock_doc):
        meta = extract_docx_metadata(b"fake docx bytes")

    assert meta["title"] == "Q4 Report"
    assert meta["author"] == "Bob"
    assert meta["paragraph_count"] == 2


@pytest.mark.unit
def test_extract_docx_metadata_returns_empty_on_error():
    with patch("app.core.ingestion.extractors.docx.Document", side_effect=Exception("bad zip")):
        meta = extract_docx_metadata(b"bad bytes")
    assert meta == {}


# ── IngestionService ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_ingestion_service_load_text_file(tmp_path):
    f = tmp_path / "notes.txt"
    f.write_text("Meeting notes here.", encoding="utf-8")

    svc = IngestionService()
    docs = svc.load(IngestionSource(source_type="file", path=str(f)))

    assert len(docs) == 1
    assert "Meeting notes here." in docs[0].page_content


@pytest.mark.unit
def test_ingestion_service_load_bytes_csv(csv_bytes):
    svc = IngestionService()
    docs = svc.load(
        IngestionSource(source_type="bytes", content=csv_bytes, filename="data.csv")
    )
    assert len(docs) == 2


@pytest.mark.unit
def test_ingestion_service_load_filters_empty_docs():
    mock_loader = MagicMock()
    mock_loader.load.return_value = [
        Document(page_content="  \n  ", metadata={}),
        Document(page_content="Real content.", metadata={}),
    ]

    svc = IngestionService()
    with patch.object(svc, "_load_raw", return_value=mock_loader.load.return_value):
        docs = svc.load(IngestionSource(source_type="file", path="dummy.txt"))

    assert len(docs) == 1
    assert docs[0].page_content.strip() == "Real content."


@pytest.mark.unit
def test_ingestion_service_load_merges_custom_metadata(tmp_path):
    f = tmp_path / "notes.txt"
    f.write_text("Content.", encoding="utf-8")

    svc = IngestionService()
    source = IngestionSource(
        source_type="file",
        path=str(f),
        custom_metadata={"project_id": "abc123"},
    )
    docs = svc.load(source)

    assert docs[0].metadata.get("project_id") == "abc123"


@pytest.mark.unit
def test_ingestion_service_load_removes_source_when_disabled(tmp_path):
    f = tmp_path / "notes.txt"
    f.write_text("Content.", encoding="utf-8")

    svc = IngestionService()
    cfg = IngestionConfig(include_source=False)
    docs = svc.load(IngestionSource(source_type="file", path=str(f)), config=cfg)

    assert "source" not in docs[0].metadata


@pytest.mark.unit
def test_ingestion_service_load_url():
    mock_traf = MagicMock()
    mock_traf.fetch_url.return_value = "<html>x</html>"
    mock_traf.extract.return_value = "URL body text."
    with patch.dict(sys.modules, {"trafilatura": mock_traf}):
        svc = IngestionService()
        docs = svc.load(IngestionSource(source_type="url", url="https://example.com"))

    assert len(docs) == 1
    assert "URL body text." in docs[0].page_content


@pytest.mark.unit
def test_ingestion_service_load_bytes_requires_file_type_or_filename():
    svc = IngestionService()
    with pytest.raises(ValueError, match="file_type or filename"):
        svc.load(IngestionSource(source_type="bytes", content=b"data"))


@pytest.mark.unit
def test_ingestion_service_load_file_requires_path():
    svc = IngestionService()
    with pytest.raises(ValueError, match="requires path"):
        svc.load(IngestionSource(source_type="file"))


@pytest.mark.unit
def test_ingestion_service_unsupported_source_type():
    svc = IngestionService()
    with pytest.raises(ValueError, match="Unsupported source_type"):
        svc.load(IngestionSource(source_type="ftp"))


@pytest.mark.unit
def test_ingestion_service_load_many(tmp_path):
    f1 = tmp_path / "a.txt"
    f2 = tmp_path / "b.txt"
    f1.write_text("Document A.", encoding="utf-8")
    f2.write_text("Document B.", encoding="utf-8")

    svc = IngestionService()
    docs = svc.load_many([
        IngestionSource(source_type="file", path=str(f1)),
        IngestionSource(source_type="file", path=str(f2)),
    ])

    assert len(docs) == 2
    contents = {d.page_content for d in docs}
    assert "Document A." in contents
    assert "Document B." in contents


@pytest.mark.unit
def test_ingestion_service_extract_metadata_disabled(tmp_path):
    f = tmp_path / "doc.txt"
    f.write_text("Content.", encoding="utf-8")

    svc = IngestionService()
    cfg = IngestionConfig(extract_metadata=False)
    docs = svc.load(IngestionSource(source_type="file", path=str(f)), config=cfg)

    # extract_metadata=False means no extra enrichment fields like filename, section_headers, etc.
    assert "filename" not in docs[0].metadata
    assert "section_headers" not in docs[0].metadata


@pytest.mark.unit
def test_ingestion_service_html_bytes(html_bytes):
    svc = IngestionService()
    docs = svc.load(
        IngestionSource(source_type="bytes", content=html_bytes, filename="page.html")
    )
    assert len(docs) == 1
    assert "Hello World" in docs[0].page_content
