# RAG Studio

> **Build RAG systems your way: Design step-by-step or let AI build automatically**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

RAG Studio is a **unified platform** for building production-ready Retrieval-Augmented Generation (RAG) systems. It provides two complementary modes:

| Mode | Description |
|------|-------------|
| 🎨 **Designer Mode** | Interactive visual pipeline builder — configure every stage step-by-step |
| 🤖 **Autopilot Mode** | Autonomous AI agent that analyses your documents and builds an optimised pipeline automatically |

---

## ✨ Features

- Step-by-step visual pipeline builder (10 configurable stages)
- Real-time cost estimation per provider/model combination
- Autonomous AI optimisation with RAGAS evaluation
- Code export (Python LangChain, YAML, Terraform, Docker Compose, Kubernetes)
- Multi-cloud support (AWS, GCP, Azure, Multi-cloud)
- Production-ready deployment pipeline

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20
- [Node.js](https://nodejs.org/) ≥ 18 (for local frontend dev)
- [Python](https://www.python.org/) ≥ 3.11 (for local backend dev)
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### 1 — Clone & configure

```bash
git clone https://github.com/yourusername/rag-studio.git
cd rag-studio
cp .env.example .env
# Edit .env and add your API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
```

### 2 — Start all services

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.build.yml \
  up --build -d
```

This starts 8 services: `web` (Next.js), `api` (FastAPI), `db` (PostgreSQL), `redis`, `vector-db` (Qdrant), `mlflow`, `minio`, `worker` (Celery).

### 3 — Open the app

| Service | URL |
|---------|-----|
| RAG Studio UI | http://localhost:3000 |
| API (FastAPI docs) | http://localhost:8000/docs |
| MLflow | http://localhost:5000 |
| MinIO Console | http://localhost:9001 |
| Qdrant Dashboard | http://localhost:6333/dashboard |

### 4 — Run database migrations

```bash
docker compose -f docker/docker-compose.yml exec api alembic upgrade head
```

---

## 🏗️ Project Structure

```
rag-studio/
├── apps/
│   ├── web/          # Next.js 14 App Router frontend
│   └── api/          # FastAPI backend + LangGraph agents
├── data/             # Shared JSON model catalogs & pricing
├── docs/             # Documentation
├── docker/           # Docker Compose files + Nginx config
├── k8s/              # Kubernetes production manifests
├── scripts/          # Setup, migration, and deploy scripts
├── .env.example      # Environment variable template
└── package.json      # npm workspaces root
```

---

## 🛠️ Local Development

### Frontend only

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### Backend only

```bash
cd apps/api
uv venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Run tests

```bash
# Backend
cd apps/api && pytest

# Frontend
cd apps/web && npm test
```

---

## 📖 Documentation

| Guide | Link |
|-------|------|
| Installation | [docs/getting-started/installation.md](docs/getting-started/installation.md) |
| Designer Mode Tutorial | [docs/guides/designer-mode/pipeline-building.md](docs/guides/designer-mode/pipeline-building.md) |
| Autopilot Mode Tutorial | [docs/guides/autopilot-mode/build-configuration.md](docs/guides/autopilot-mode/build-configuration.md) |
| API Reference | [docs/api-reference/designer-api.md](docs/api-reference/designer-api.md) |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, PR workflow, and coding standards.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Made with ❤️ by the RAG Studio Team**
