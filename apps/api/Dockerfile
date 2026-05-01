# ─────────────────────────────────────────────────────────────
# Stage 1 · Builder — install all dependencies
# ─────────────────────────────────────────────────────────────
# bookworm = stable Debian 12; explicit tag tracks security rebuilds from Docker Library
FROM python:3.11-slim-bookworm AS builder

WORKDIR /build

# Install build tools; dist-upgrade patches glibc/openssl etc. reported by image scanners
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies first (cache layer)
COPY requirements.txt .
# Refresh bootstrapping packages (base image may ship vulnerable wheel / jaraco.context — see pip audit / Trivy)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --upgrade \
        "setuptools>=78.1.0" \
        "wheel>=0.46.2" \
        "jaraco.context>=6.1.0" && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────
# Stage 2 · Development — hot-reload, debug tools
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS development

WORKDIR /app

# Runtime system dependencies + security patches (match builder base)
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy dev requirements and install
COPY requirements-dev.txt .
RUN pip install --no-cache-dir --upgrade \
        "setuptools>=78.1.0" \
        "wheel>=0.46.2" \
        "jaraco.context>=6.1.0" && \
    pip install --no-cache-dir -r requirements-dev.txt

# Source code is bind-mounted in dev (see docker-compose.dev.yml)
# This COPY is here so the image can also run standalone
COPY . .

EXPOSE 8000 5678

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ─────────────────────────────────────────────────────────────
# Stage 3 · Runtime — minimal production image
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS runtime

WORKDIR /app

# Minimal runtime system dependencies + security patches
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser \
    && useradd -r -g appuser appuser

# Copy only installed packages from builder (no dev tools)
COPY --from=builder /install /usr/local

# Align system site-packages with patched bootstrapping wheels (still as root)
RUN pip install --no-cache-dir --upgrade \
        "setuptools>=78.1.0" \
        "wheel>=0.46.2" \
        "jaraco.context>=6.1.0"

# Copy application source
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default: run API server
# Override command for worker: celery -A app.worker:celery_app worker ...
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
