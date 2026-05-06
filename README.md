# Unified RAG Studio

> Build RAG systems your way: design step-by-step in the UI or let autopilot optimise a pipeline from your documents.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

**Unified RAG Studio** is a full-stack platform for designing, evaluating, exporting, and operating retrieval-augmented generation (RAG) pipelines.

| Mode | Description |
|------|-------------|
| **Designer** | Guided visual workflow across cloud choice, ingestion, chunking, embeddings, vector store, retrieval, reranking, generation, routing, memory, evaluation, guardrails, and review — with live cost estimates and artifact export. |
| **Autopilot** | Document-driven flow that runs optimisation passes (chunking, embeddings, retrieval, RAGAS-style evaluation, etc.) with Celery-backed jobs and optional MLflow tracking. |

---

## Features

- **Designer pipeline**: 13 configurable stages from cloud/provider through guardrails and review (`DESIGNER_STAGES` in `apps/web/src/lib/constants.ts`).
- **API surface**: Authentication, projects, templates, designer CRUD/sync, autopilot builds, evaluation, deployment hints, utilities (incl. cost), jobs, analytics, health, and Prometheus-oriented monitoring routes (`apps/api/app/main.py`).
- **Guardrails**: Configurable input/output policies (PII, toxicity, bias patterns, hallucination/factuality checks) wired through the orchestration layer (`apps/api/app/core/guardrails/`).
- **Export**: Python (LangChain-style), YAML, Terraform (HCL), Docker Compose, and Kubernetes YAML via `/api/designer/export` (`apps/web/src/components/designer/code-exporter.tsx`).
- **Data catalogs**: Shared JSON under `data/` (models, chunking strategies, retrieval, vector stores, pricing, templates, cloud providers) consumed by the web app and mounted into containers in dev.
- **Observability (optional)**: Prometheus + Grafana overlay (`docker/docker-compose.observability.yml`).
- **Deploy artifacts**: Compose stacks for dev/prod/build, nginx reverse proxy on port 80, and Kustomize-ready manifests under `k8s/production/`.

---

## Quick start

### Prerequisites

- [Docker](https://www.docker.com/) ≥ 24 and [Compose](https://docs.docker.com/compose/) ≥ v2  
- [Node.js](https://nodejs.org/) ≥ 18 and npm ≥ 9 (local frontend/monorepo scripts)  
- [Python](https://www.python.org/) ≥ 3.11 and [uv](https://docs.astral.sh/uv/) (recommended for the API locally)

### 1 — Clone and environment

```bash
git clone <your-fork-or-mirror-url>
cd Unified_RAG_Studio   # or your checkout directory name
cp .env.example .env
# Set API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, …) and review AUTH_* settings.
```

`AUTH_BOOTSTRAP_USERS` in `.env.example` defines default dev accounts (for example `admin@ragstudio.local` / `admin123`). The API middleware expects a JWT **Bearer** token on `/api/*` except `/api/auth/*` (`apps/api/app/main.py`): sign in via the auth routes, then call the designer, projects, export, etc.

### 2 — Run with Docker Compose

**Local images (build `web`, `api`, `worker`):**

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.build.yml \
  up --build -d
```

**Development overlay** (hot reload, host ports for Postgres/Redis/Qdrant/MLflow/MinIO, debugpy on `5678`):

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.build.yml \
  -f docker/docker-compose.dev.yml \
  up --build -d
```

**Observability** (adds Prometheus `:9090` and Grafana `:3100`; merge after the files you already use):

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.build.yml \
  -f docker/docker-compose.observability.yml \
  up --build -d
```

Base stack services (nine): `web`, `api`, `worker`, `db` (PostgreSQL 16), `redis`, `vector-db` (Qdrant), `mlflow`, `minio`, `nginx`.

### 3 — URLs and ports

| What | Typical URL |
|------|--------------|
| App (Next.js) | http://localhost:3000 |
| API | http://localhost:8000 |
| nginx (combined entry) | http://localhost |
| MLflow | http://localhost:5000 (when the service port is published — see `docker-compose.dev.yml`) |
| MinIO Console | http://localhost:9001 (with dev overlay) |
| Qdrant REST / dashboard | http://localhost:6333/dashboard (with dev overlay; base compose talks to Qdrant on the internal network only) |
| Prometheus / Grafana | http://localhost:9090 · http://localhost:3100 (observability overlay) |

Interactive OpenAPI (**`/docs`**, **`/redoc`**) is enabled only when `APP_ENV=development` (for example via `docker-compose.dev.yml` or your `.env`). The default Compose API environment uses `production`, which disables public OpenAPI routes.

### 4 — Database migrations

With the stack running and `APP_ENV=production` (or whenever you rely on Postgres rather than ORM auto-create in dev):

```bash
docker compose -f docker/docker-compose.yml exec api alembic upgrade head
```

From the repo root on the host:

```bash
./scripts/migrate.sh
```

On Windows without Bash, run the same Alembic command from `apps/api` (after activating your venv if you use one): `alembic upgrade head`.

---

## Repository layout

```
Unified_RAG_Studio/
├── apps/
│   ├── web/                 # Next.js 14 App Router, React 18, Tailwind, Vitest (+ Playwright)
│   └── api/                 # FastAPI, LangGraph/LangChain RAG plumbing, Celery worker, Alembic
├── data/                    # Shared catalogs (pricing, templates, strategies, models, …)
├── docker/                  # Compose files (base, build, dev, prod, observability), nginx, Prometheus/Grafana
├── docs/
│   ├── public/             # Contributor-facing docs (architecture, deployment, FAQ, …)
│   └── internal/           # Design evolution notes (not required for onboarding)
├── k8s/production/         # Namespace, workloads, ingress/HPA stubs, secrets example
├── scripts/                 # migrations helper (minimal; see migrate.sh)
├── .env.example
└── package.json             # npm workspaces + dev:full (web + api)
```

Backend Python dependencies are pinned in `apps/api/requirements.txt`; `apps/api/pyproject.toml` configures Ruff, mypy, and pytest.

---

## Local development (without Docker for apps)

Install dependencies once at the repo root, then run the UI and API together:

```bash
npm install
npm run dev:full
```

- Web: http://localhost:3000  
- API: http://localhost:8000 (`uv run uvicorn` via `npm run dev:api`)

**Frontend only:**

```bash
cd apps/web
npm install
npm run dev
```

**Backend only:**

```bash
cd apps/api
uv venv && .venv\Scripts\activate   # Windows PowerShell
# macOS/Linux: source .venv/bin/activate
uv pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

With `APP_ENV=development`, the API can create SQLite/Postgres schema from SQLAlchemy metadata on startup; for Postgres in Docker, prefer Alembic as above.

### Tests

```bash
# API (from apps/api, with deps installed)
pytest

# Web unit tests (Vitest)
cd apps/web && npm test

# Web E2E (Playwright)
cd apps/web && npm run test:e2e
```

CI: `.github/workflows/tests.yml` (integration backend + selective E2E).

---

## Documentation

| Topic | Location |
|--------|-----------|
| Architecture | [`docs/public/ARCHITECTURE.md`](docs/public/ARCHITECTURE.md) |
| Deployment | [`docs/public/DEPLOYMENT.md`](docs/public/DEPLOYMENT.md) |
| Production runbook | [`docs/public/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](docs/public/PRODUCTION_DEPLOYMENT_RUNBOOK.md) |
| Troubleshooting | [`docs/public/TROUBLESHOOTING.md`](docs/public/TROUBLESHOOTING.md) |
| Security | [`docs/public/SECURITY.md`](docs/public/SECURITY.md) |
| FAQ | [`docs/public/FAQ.md`](docs/public/FAQ.md) |
| Roadmap / changelog | [`docs/public/ROADMAP.md`](docs/public/ROADMAP.md) · [`docs/public/CHANGELOG.md`](docs/public/CHANGELOG.md) |
| Product tour video (brief, VO, chapters, checklist, 30s teaser) | [`docs/public/VIDEO_PRODUCT_TOUR.md`](docs/public/VIDEO_PRODUCT_TOUR.md) |

---

## Contributing

See [`docs/public/CONTRIBUTING.md`](docs/public/CONTRIBUTING.md) and [`docs/public/CODE_OF_CONDUCT.md`](docs/public/CODE_OF_CONDUCT.md).

---

## License

MIT — see [`package.json`](package.json) `license` field. This checkout may not include a root `LICENSE` file; confirm with your maintainer fork if you need a standalone copy.

---

Made for teams building reproducible RAG systems from design through export and deployment.
