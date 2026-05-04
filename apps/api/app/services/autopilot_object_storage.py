"""MinIO (S3-compatible) uploads for Autopilot corpus files (P7-1)."""

from __future__ import annotations

from dataclasses import dataclass
import io
import re
from urllib.parse import urlparse
import uuid

import structlog
import urllib3
from urllib3.exceptions import MaxRetryError
from urllib3.util import Timeout
from urllib3.util.retry import Retry

from app.config import Settings

# Default urllib3 retries on connection errors (~5 attempts) can exceed Next.js dev-proxy
# patience and surface as ``ECONNRESET`` / HTTP 500 in the browser while the API eventually
# returns 503. Fail fast with no automatic retries (MinIO SDK may still retry in some paths).
_MINIO_HTTP = urllib3.PoolManager(
    timeout=Timeout(connect=5.0, read=300.0),
    retries=Retry(total=0),
    maxsize=10,
    block=True,
)

logger = structlog.get_logger(__name__)

# Conservative allow-list; extend as ingestion supports more loaders.
_ALLOWED_SUFFIXES: frozenset[str] = frozenset(
    {
        ".pdf",
        ".txt",
        ".md",
        ".markdown",
        ".csv",
        ".json",
        ".html",
        ".htm",
        ".docx",
    }
)


class AutopilotUploadError(Exception):
    """User-facing validation failures (mapped to HTTP 400)."""


class AutopilotStorageUnavailableError(Exception):
    """MinIO / network failures (mapped to HTTP 503)."""


def _storage_unreachable_message(settings: Settings, *, context: str) -> str:
    ep = (settings.minio_endpoint or "").strip() or "http://localhost:9000"
    return (
        f"Cannot reach object storage at {ep} ({context}). "
        "Start MinIO on that host and port, or set MINIO_ENDPOINT (and credentials) to a "
        "reachable S3-compatible service. If you use Docker, run the stack that exposes MinIO "
        "(often port 9000)."
    )


@dataclass(frozen=True)
class UploadedBlobMeta:
    object_id: str
    original_filename: str
    size_bytes: int
    content_type: str | None


def _minio_client(settings: Settings):
    try:
        from minio import Minio
    except ModuleNotFoundError as exc:
        raise AutopilotStorageUnavailableError(
            "The MinIO Python client is not installed in this environment. "
            "From apps/api run: uv pip install minio==7.2.7 "
            "(or pip install -r requirements.txt)."
        ) from exc

    raw = (settings.minio_endpoint or "").strip()
    if not raw:
        raise AutopilotStorageUnavailableError("MINIO_ENDPOINT is not configured")
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    host = parsed.hostname
    if not host:
        raise AutopilotStorageUnavailableError("MINIO_ENDPOINT must include a hostname")
    port = parsed.port
    secure = parsed.scheme == "https"
    endpoint = f"{host}:{port}" if port else host
    return Minio(
        endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
        http_client=_MINIO_HTTP,
    )


def _ensure_bucket(client, bucket: str, settings: Settings) -> None:
    from minio.error import S3Error

    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    except S3Error as exc:
        logger.warning("minio_bucket_ensure_failed", bucket=bucket, code=exc.code)
        raise AutopilotStorageUnavailableError(
            f"Cannot access object storage bucket: {exc}"
        ) from exc
    except (MaxRetryError, ConnectionError, TimeoutError) as exc:
        logger.warning("minio_bucket_transport_failed", bucket=bucket, exc_info=True)
        raise AutopilotStorageUnavailableError(
            _storage_unreachable_message(settings, context="bucket check")
        ) from exc


def _suffix(name: str) -> str:
    base = name.rsplit("/", 1)[-1]
    if "." not in base:
        return ""
    return "." + base.rsplit(".", 1)[-1].lower()


def sanitize_filename(name: str) -> str:
    base = name.rsplit("/", 1)[-1].strip() or "upload"
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", base)
    return cleaned[:200] if len(cleaned) > 200 else cleaned


def validate_upload_candidate(
    original_filename: str,
    size_bytes: int,
    *,
    max_bytes: int,
) -> None:
    if size_bytes <= 0:
        raise AutopilotUploadError("Empty files are not allowed")
    if size_bytes > max_bytes:
        raise AutopilotUploadError(f"File exceeds maximum size of {max_bytes // (1024 * 1024)} MiB")
    suf = _suffix(original_filename)
    if suf not in _ALLOWED_SUFFIXES:
        allowed = ", ".join(sorted(_ALLOWED_SUFFIXES))
        raise AutopilotUploadError(
            f"Unsupported file type ({suf or 'no extension'}). Allowed: {allowed}",
        )


def upload_blobs_sync(
    settings: Settings,
    *,
    user_id: uuid.UUID,
    project_id: uuid.UUID,
    payloads: list[tuple[str, bytes, str | None]],
) -> list[UploadedBlobMeta]:
    """Upload bytes to MinIO (``autopilot/{user}/{project}/…``); runs in a worker thread."""

    if not payloads:
        raise AutopilotUploadError("No files provided")

    bucket = settings.minio_bucket
    client = _minio_client(settings)
    _ensure_bucket(client, bucket, settings)

    out: list[UploadedBlobMeta] = []
    from minio.error import S3Error

    for original_name, data, content_type in payloads:
        safe = sanitize_filename(original_name)
        key = f"autopilot/{user_id}/{project_id}/{uuid.uuid4().hex}_{safe}"
        length = len(data)
        stream = io.BytesIO(data)
        ct = (content_type or "application/octet-stream").split(";")[
            0
        ].strip() or "application/octet-stream"
        try:
            client.put_object(
                bucket,
                key,
                stream,
                length=length,
                content_type=ct,
            )
        except S3Error as exc:
            logger.warning("minio_put_failed", key=key, code=exc.code)
            raise AutopilotStorageUnavailableError(f"Upload failed: {exc}") from exc
        except (MaxRetryError, ConnectionError, TimeoutError) as exc:
            logger.warning("minio_put_transport_failed", key=key, exc_info=True)
            raise AutopilotStorageUnavailableError(
                _storage_unreachable_message(settings, context="upload")
            ) from exc
        out.append(
            UploadedBlobMeta(
                object_id=key,
                original_filename=original_name.rsplit("/", 1)[-1],
                size_bytes=length,
                content_type=ct if ct != "application/octet-stream" else None,
            ),
        )
    return out
