# RAG Studio — Task tracker

> Canonical descriptions and full matrix: `docs/internal/project_status.md`  
> This file is a concise checklist for GitHub-visible progress.

## Phase 2 — Backend RAG services

| Task | Branch | Status |
|------|--------|--------|
| P2-1 · Document Ingestion Service | `feature/p2-ingestion-service` | ✅ done |
| P2-2 · Chunking Service | `feature/p2-chunking-service` | ✅ done |
| P2-3 · Embedding Service | `feature/p2-embedding-service` | ✅ done |
| P2-4 · Vector Store Service | `feature/p2-vectorstore-service` | ✅ done |
| P2-5 · Retrieval Service | `feature/p2-retrieval-service` | ✅ done |
| P2-6 · Generation Service | `feature/p2-generation-service` | ✅ done |
| P2-7 · Evaluation Engine | `feature/p2-evaluation-engine` | ✅ done |
| P2-8 · Celery Worker & Task Queue | `feature/p2-celery-worker` | ✅ done |
| P2-9 · Health & Utility Endpoints | `feature/p2-health-endpoints` | ✅ done |

## Phase 3 — Frontend foundation

| Task | Branch | Status |
|------|--------|--------|
| P3-1 · shadcn/ui Component Library Setup | `feature/p3-shadcn-components` | ✅ done |
| P3-2 · Zustand State Stores | `feature/p3-zustand-stores` | ✅ done |
| P3-3 · App Layout & Navigation | `feature/p3-app-layout` | ✅ done |

## Phase 4 — Designer mode backend

| Task | Branch | Status |
|------|--------|--------|
| P4-1 · Projects API | `feature/p4-projects-api` | ✅ done |
| P4-2 · Designer Config API | `feature/p4-designer-config-api` | ✅ done |
| P4-3 · Cost Calculation API | `feature/p4-cost-api` | ✅ done |
| P4-4 · Export API | `feature/p4-export-api` | ✅ done |
| P4-5 · Templates API | `feature/p4-templates-api` | ✅ done |

## Phase 4.5 — Guardrails

| Task | Branch | Status |
|------|--------|--------|
| P4.5-1 · Guardrails Core Infrastructure | `feature/p4-guardrails-infra` | ✅ done |
| P4.5-2 · Input Guardrails | `feature/p4-guardrails-input` | ✅ done |
| P4.5-3 · Output Guardrails | `feature/p4-guardrails-output` | ✅ done |
| P4.5-4 · Retrieval Guardrails | `feature/p4-guardrails-retrieval` | ✅ done |
| P4.5-5 · RAG Pipeline Integration | `feature/p4-guardrails-integration` | ✅ done |
| P4.5-6 · Monitoring & Metrics | `feature/p4-guardrails-monitoring` | ✅ done |
| P4.5-7 · Configuration & Testing | `feature/p4-guardrails-testing` | ✅ done |

## Phase 5 — Designer mode UI

| Task | Branch | Status |
|------|--------|--------|
| P5-1 · Designer Layout & Stage Navigator | `feature/p5-designer-layout` | ✅ done |
| P5-2 · Cloud Provider Selector | `feature/p5-cloud-provider-selector` | ✅ done |
| P5-3 · Data Ingestion Configuration | `feature/p5-ingestion-config` | ✅ done |
| P5-4 · Chunking Configuration | `feature/p5-chunking-config` | ✅ done |
| P5-5 · Embedding Model Selector | `feature/p5-embedding-selector` | ✅ done |
| P5-6 · Vector Store Selector | `feature/p5-vectorstore-selector` | ✅ done |
| P5-7 · Retrieval Configuration | `feature/p5-retrieval-config` | ✅ done |
| P5-8 · Generation Model Selector | `feature/p5-generation-selector` | ✅ done |
| P5-9 · Routing, Memory & Evaluation Config | `feature/p5-routing-memory-eval` | ✅ done |
| P5-10 · Pipeline Visualizer | `feature/p5-pipeline-visualizer` | ✅ done |
| P5-11 · Cost Estimator Component | `feature/p5-cost-estimator` | ✅ done |
| P5-12 · Code Export Component | `feature/p5-code-exporter` | ✅ done |
| P5-13 · Designer Review Page | `feature/p5-designer-review` | ✅ done |
| P5-14 · Template Gallery Page | `feature/p5-template-gallery` | ✅ done |

## Phase 6 — Autopilot (LangGraph)

| Task | Branch | Status |
|------|--------|--------|
| P6-1 · LangGraph Agent Infrastructure | `feature/p6-langgraph-infrastructure` | ✅ done |
| P6-2 · Document Analyst Agent | `feature/p6-document-analyst-agent` | ✅ done |
| P6-3 · Chunking Optimizer Agent | `feature/p6-chunking-optimizer-agent` | ✅ done |
| P6-4 · Embedding Tester Agent | `feature/p6-embedding-tester-agent` | ✅ done |
| P6-5 · Retrieval Optimizer Agent | `feature/p6-retrieval-optimizer-agent` | ✅ done |
| P6-6 · Evaluation Agent | `feature/p6-evaluation-agent` | ✅ done |
| P6-7 · Deployment Agent | `feature/p6-deployment-agent` | ✅ done |
| P6-8 · Autopilot Orchestrator | `feature/p6-autopilot-orchestrator` | ✅ done |
| P6-9 · Autopilot API Endpoints | `feature/p6-autopilot-api` | ✅ done |

## Phase 7 — Autopilot frontend

| Task | Branch | Status |
|------|--------|--------|
| P7-1 · Document Uploader | `feature/p7-document-uploader` | ✅ done |
| P7-2 · Requirements Form | `feature/p7-requirements-form` | ✅ done |
| P7-3 · Build Progress Monitor | `feature/p7-build-progress` | ✅ done |
| P7-4 · Agent Activity Feed | `feature/p7-agent-activity-feed` | ✅ done |
| P7-5 · Metrics Dashboard | `feature/p7-metrics-dashboard` | ✅ done |
| P7-6 · Decision Explainer & Results | `feature/p7-results-summary` | ✅ done |
| P7-7 · Autopilot Entry & History Pages | `feature/p7-autopilot-pages` | ✅ done |

## Phase 8 — Designer ↔ Autopilot integration

| Task | Branch | Status |
|------|--------|--------|
| P8-1 · Designer → Autopilot Handoff | `feature/p8-designer-to-autopilot` | ✅ done |
| P8-2 · Autopilot → Designer Visualization | `feature/p8-autopilot-to-designer` | ✅ done |
| P8-3 · Evaluation API Endpoints | `feature/p8-evaluation-api` | ✅ done |
| P8-4 · Deployment API Endpoints | `feature/p8-deployment-api` | ✅ done |

## Phase 9 — MLflow experiment tracking

| Task | Branch | Status |
|------|--------|--------|
| P9-1 · MLflow Integration | `feature/p9-mlflow-integration` | ✅ done |

## Phase 10 — Testing & quality gates

| Task | Branch | Status |
|------|--------|--------|
| P10-1 · Backend Unit Tests | `feature/p10-backend-unit-tests` | ✅ done |
