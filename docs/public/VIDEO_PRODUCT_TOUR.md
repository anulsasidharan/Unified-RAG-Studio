# Unified RAG Studio — Product tour video (production pack)

This pack is aligned with the current product and [`README.md`](../../README.md): **13 Designer stages** (`DESIGNER_STAGES` in `apps/web/src/lib/constants.ts`), Autopilot with Celery jobs and optional MLflow, guardrails, multi-format export, and optional Prometheus/Grafana.

**Deliverable format:** screen-capture demo (not slide deck), 1920×1080, H.264, AAC 192 kbps, 30 or 60 fps (prefer **60** for cursor legibility), voiceover + bed music ducked under VO.

**Companion files:** [Screen recording checklist](video/SCREEN_RECORDING_CHECKLIST.md) · [30s teaser VO](video/TEASER_30S_VOICEOVER.md) · [Full VO table](video/PRODUCT_TOUR_VOICEOVER.md) · [Chapter VTT](video/product-tour-chapters.vtt)

---

## 1. Truth-in-demo checklist (record the real app)

| Topic | What to show | Source of truth |
|--------|----------------|-----------------|
| Designer | Stage navigator + forms per route | `/designer` … `/designer/review` |
| Stage count | Say **13 configurable stages** (or “thirteen guided stages”) | `DESIGNER_STAGES` |
| Autopilot | Upload → job progress → open in Designer if applicable | `/autopilot`, `/autopilot/new` |
| Guardrails | Policies UI (PII, toxicity, etc.) | `/designer/guardrails` |
| Export | LangChain-style Python, YAML, Terraform, Compose, K8s | Code exporter in Designer / API |
| Cost | Live cost estimate where the UI exposes it | Designer cost components |
| Ops (optional) | Analytics route; observability as “optional stack” only if you film it | `/analytics`; Compose overlay |

Do **not** claim metrics (e.g. “70% faster”, “1000+ deployments”) unless marketing has substantiation. Prefer capability language.

---

## 2. The thirteen Designer stages (on-screen reference)

Use this order in VO or lower-third when summarizing “the full pipeline”:

1. **Cloud Provider** — `/designer`
2. **Data Ingestion** — `/designer/ingestion`
3. **Chunking** — `/designer/chunking`
4. **Embedding** — `/designer/embedding`
5. **Vector Store** — `/designer/vectorstore`
6. **Retrieval** — `/designer/retrieval`
7. **Reranking** — `/designer/reranking`
8. **Generation** — `/designer/generation`
9. **Routing** — `/designer/routing`
10. **Memory** — `/designer/memory`
11. **Evaluation** — `/designer/evaluation`
12. **Guardrails** — `/designer/guardrails`
13. **Review** — `/designer/review`

**Filming tip:** In a 2–3 minute cut, **visit ~5–7 stages** with real clicks; use a **single lower-third** or end card listing all 13 so the breadth is clear without exhausting the viewer.

Autopilot workflow labels (for B-roll / progress UI): Analyzing Documents → Optimizing Chunking → Testing Embeddings → Creating Vector Index → Optimizing Retrieval → Evaluating Pipeline → Deploying System (`AUTOPILOT_STAGES` in the same constants file).

---

## 3. Redesigned scene breakdown (≈2:50 total)

### Scene 1 — Hook (0:00–0:18)

- **Visual:** Fade in logo/title; **3–4 quick cuts** of real UI: stage rail, ingestion, embedding picker, guardrails panel, export modal. Text overlay (one line): **“From cloud to guardrails—one guided pipeline.”**
- **VO:** *“Retrieval-augmented generation shouldn’t mean stitching a dozen tools by hand. **Unified RAG Studio** is a single workspace: walk **thirteen** guided stages in the Designer, or start from your documents in **Autopilot**—then evaluate, harden, and export what you actually ship.”*

### Scene 2 — Modes at a glance (0:18–0:38)

- **Visual:** Home or app shell; cursor moves through **Designer** vs **Autopilot** entry; optional glimpse of **Templates** and **Projects**.
- **VO:** *“Two front doors, same truth under the hood. **Designer** is for explicit control—cloud, ingestion, chunking, embeddings, store, retrieval, rerank, generation, routing, memory, evaluation, **guardrails**, and a final **review**. **Autopilot** is for running optimisation passes over your corpus when you want the system to propose a strong baseline.”*

### Scene 3 — Designer: breadth + depth (0:38–1:15)

- **Visual:** Enter Designer; show **stage navigator** (`aria-label` area). Click through a **credible path** (example): **Cloud Provider** → **Data Ingestion** (set source) → **Chunking** (strategy + size) → **Embedding** (model) → **Vector Store** → **Retrieval** (strategy / top-k). Pause on **live validation** and **cost** if visible. Jump-cut once to **Reranking** or **Generation** to show later-stage polish. **Do not** simulate node-graph drag unless the UI is graph-based (this product is **stage-guided**).
- **Callouts (on-screen, short):** *13 guided stages* · *Live cost signals* · *Validation as you go*
- **VO:** *“You’re not hunting for the next file to edit—the **stage rail** is the contract. Configure cloud and ingestion, shape how documents become chunks, pick embeddings and the vector store, then tighten retrieval. As you move forward, the UI and estimates update so you catch bad pairings **before** you export.”*

### Scene 4 — Guardrails & responsibility (1:15–1:38)

- **Visual:** Navigate to **`/designer/guardrails`**. Show policy categories (align with README: PII, toxicity, bias patterns, hallucination/factuality). Toggle or expand one panel; avoid showing real harmful content—use neutral demo labels.
- **Callouts:** *Configurable policies* · *Input/output path*
- **VO:** *“Production RAG isn’t only accuracy—it’s **what you allow through**. Guardrails let you set **input and output** policies so safety and quality checks ride with the orchestration layer, not as an afterthought.”*

### Scene 5 — Autopilot (1:38–2:05)

- **Visual:** **Autopilot** new flow: attach documents, enter requirements (e.g. customer-support PDFs, high factual precision). Show **job/progress** (Celery-backed). If the UI offers it, **open the result in Designer** for review. Optional split: left = stage-by-stage mental model, right = Autopilot suggesting parameters—**honest** comparison only.
- **Callouts:** *Document-driven optimisation* · *RAGAS-style evaluation* · *Refine in Designer*
- **VO:** *“When you’d rather iterate from real files, Autopilot runs structured passes—chunking, embeddings, retrieval, **evaluation**—and you get something you can **inspect and edit** back in Designer. Treat it as a smart draft, not a black box.”*

### Scene 6 — Try it against your corpus (2:05–2:28)

- **Visual:** Evaluation or playground: run a sample query (**e.g.** “How do I reset my password?”). Show **retrieved chunks**, **scores**, **latency**. Adjust **top-k** or chunk settings; **re-run** to show delta.
- **VO:** *“Before you freeze the config, you want receipts: what retrieved, with what scores, how fast. Tweak retrieval or chunking, rerun, and decide with data—not vibes.”*

### Scene 7 — Export & ops (2:28–2:45)

- **Visual:** Open **export**: Python (LangChain-style), YAML, Terraform, Docker Compose, Kubernetes—show **real** filenames/preview pane. Optionally **analytics** (`/analytics`) or a single chart; if using Grafana/Prometheus overlay, caption **“Observability (optional Compose overlay)”**.
- **VO:** *“When the pipeline is grounded, export the artifacts your team expects—**Python, YAML, Terraform, Compose, Kubernetes**—and wire into deployment. Operational signals live where you already run the stack.”*

### Scene 8 — CTA (2:45–3:00)

- **Visual:** Hero with **Start building** / **Book a demo**; subtle loop of UI or pipeline diagram.
- **Overlay:** **Unified RAG Studio** · **Thirteen stages. One studio. Export-ready.**
- **VO:** *“If you’re done duct-taping RAG pipelines, open **Unified RAG Studio**, walk the thirteen stages—or let Autopilot draft your first-pass config. Start free or book a walkthrough—we’ll meet you where you ship.”*

---

## 4. Chapter markers

Use [`video/product-tour-chapters.vtt`](video/product-tour-chapters.vtt) with `<track kind="chapters">` or your player’s chapter UI.

Suggested labels: Intro · Modes · Designer (13 stages) · Guardrails · Autopilot · Evaluate · Export · CTA.

---

## 5. Voice & audio

- **Tone:** Practitioner explaining to a teammate; warm, concise; **avoid** loud infomercial cadence.
- **Pacing:** ~140–155 WPM average; slower on guardrails and export lists.
- **Music:** Modern tech instrumental, **well ducked**; no lyrical bed under VO.

---

## 6. Landing page embed (hero)

- Muted autoplay, prominent **Unmute**, **Fullscreen**, accessible **Pause**, **captions**, **chapter** track (linked VTT).
- Poster: crisp frame from **Designer stage rail** or **Review** screen (readable at small width).

---

## 7. Derivative cuts (optional)

| Asset | Length | Focus |
|--------|--------|--------|
| Social teaser | 0:30 | Hook + 3 stage clicks + Autopilot progress + CTA — script: [`video/TEASER_30S_VOICEOVER.md`](video/TEASER_30S_VOICEOVER.md) |
| “13 stages in 90s” | 1:30 | Accelerated navigator pass + one export click |
| Guardrails clip | 0:45 | Scene 4 only |
| Autopilot clip | 1:00 | Scene 5 only |

---

## 8. MP4 generation

Produce the MP4 with **OBS Studio**, **ScreenFlow**, **Camtasia**, or **DaVinci Resolve** using the scene timings above; master audio in your DAW or Resolve Fairlight. Re-use [`video/product-tour-chapters.vtt`](video/product-tour-chapters.vtt) after adjusting timestamps to the final edit.

**Shipping on the landing hero:** place exported files at **`apps/web/public/videos/product-tour-main.mp4`** and **`apps/web/public/videos/product-tour-teaser.mp4`** (see [`apps/web/public/videos/README.md`](../../apps/web/public/videos/README.md)). The repo may contain short **placeholder** clips so the player works before marketing swaps in the real screen recording.

---

*Last aligned with README and `DESIGNER_STAGES` (13 stages) as of the doc author’s pass on this branch.*
