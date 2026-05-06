# Screen recording checklist — Unified RAG Studio product tour

Use with [`VIDEO_PRODUCT_TOUR.md`](../VIDEO_PRODUCT_TOUR.md) and [`PRODUCT_TOUR_VOICEOVER.md`](PRODUCT_TOUR_VOICEOVER.md). Goal: **one continuous-feeling demo** with retakes only where scripted.

---

## 1. Environment

| Step | Detail |
|------|--------|
| Stack | Run the app via Docker Compose (see root [`README.md`](../../../README.md)) or `npm run dev:full` so **web** and **api** match what you describe in VO. |
| URL | Record against `http://localhost:3000` (or staging) consistently; avoid mixing domains in one cut. |
| Auth | If auth is on, sign in before capture. Dev bootstrap users (from `.env.example`): `admin@ragstudio.local` / `admin123`, or `user@ragstudio.local` / `user123`. With `AUTH_REQUIRED=false`, confirm you still match what production marketing shows. |
| API keys | Pre-fill `.env` so **embedding / generation** dropdowns succeed and evaluations do not stall mid-recording—or use mocked/offline-safe demo data if your build supports it. |
| Celery worker | For Autopilot progress UI, ensure **worker** is up; otherwise record only Designer + static Autopilot screens and adjust VO. |
| Time / locale | Set OS clock and browser locale to what you want on screen; avoid “tomorrow’s date” confusion. |

---

## 2. Capture settings

| Setting | Recommendation |
|---------|----------------|
| Resolution | **1920×1080** canvas; browser zoom **100%** (not 125% OS scaling on the capture monitor if it blurs text). |
| Frame rate | **60 fps** for cursor clarity; **30 fps** acceptable for file size if cursor motion is gentle. |
| Cursor | OS default or a **high-contrast** pointer; enable “click ripple” only if subtle. |
| Chrome / Edge | Single window, **clean profile**: no bookmark bar clutter, no extension toolbars in frame. |
| Notifications | Enable **Do Not Disturb**; hide taskbar badges if recording full screen. |
| Cursor motion | Move in **arcs**, **hover 250–400 ms** before click; **double-click** only if required. |

---

## 3. Rehearsed path (≈ match main tour)

Run this **twice dry** before rolling video. Adjust if your branch’s labels differ (`apps/web/src/lib/constants.ts`).

1. **Landing / home** — establish app name; navigate to Designer.
2. **Designer** — stage rail visible: click **Cloud Provider** → **Data Ingestion** → **Chunking** → **Embedding** → **Vector Store** → **Retrieval** (fill minimal valid fields where required).
3. **Quick jump** — **Reranking** or **Generation** (one setting change).
4. **Guardrails** — `/designer/guardrails`; expand one policy section; no real harmful sample text.
5. **Autopilot** — `/autopilot/new` (or entry flow): attach **small PDF(s)** you are allowed to use; start run; show progress; if available, **open in Designer**.
6. **Eval / playground** — one query, show chunks/scores/latency; tweak **top-k** or similar; rerun.
7. **Export** — open exporter; flash **Python / YAML / Terraform / Compose / K8s** without exposing secrets.
8. **Analytics (optional)** — `/analytics` only if data is populated and on-message.
9. **CTA** — return to hero or full-screen end card.

**No fake UI:** do not simulate a node graph unless the product shows one.

---

## 4. Demo data kit

Prepare before recording:

| Item | Note |
|------|------|
| Project name | Short, professional (e.g. `Demo · Support KB`). |
| Documents | 1–3 small PDFs or text files; **no PII**, **no third-party copyright** issues. |
| Sample query | e.g. “How do I reset my password?” — consistent across takes. |
| Autopilot prompt | One sentence: customer support docs, high factual precision. |
| API / model choices | Pick **stable** defaults that always load (avoid rate-limited experimental models on record day). |

---

## 5. Legal & brand

- No customer logos or internal URLs in the address bar unless approved.
- If you show **pricing**, ensure it matches the live site at ship time.
- Font and colors: match **Tailwind / theme** in `apps/web`; avoid ad-hoc browser themes.

---

## 6. Audio / VO sync

- Record **system audio off** during screen capture unless you need UI chimes; add **subtle** clicks in post if desired.
- VO in a **separate take** (typical) or live guide track for timing—clap or remote flash for sync markers.
- Leave **1 s handles** at head/tail of each B-roll clip for crossfades.

---

## 7. Post handoff

- [ ] Rename master: `product-tour-2026-1080p60-master.mp4` (or your convention).
- [ ] Export **h264** 8–12 Mbps, **AAC** 192 kbps stereo.
- [ ] Generate **captions** (SRT/VTT) from final VO; align [`product-tour-chapters.vtt`](product-tour-chapters.vtt) to final timecode.
- [ ] Poster frame: Designer stage rail or Review (export PNG 1920×1080).
- [ ] **Landing page:** copy finals into the web app as **`apps/web/public/videos/product-tour-main.mp4`** (full tour) and **`apps/web/public/videos/product-tour-teaser.mp4`** (quick cut); overwrite the placeholders and refresh [`apps/web/public/videos/product-tour-chapters.vtt`](../../../apps/web/public/videos/product-tour-chapters.vtt) if chapter times changed. See [`apps/web/public/videos/README.md`](../../../apps/web/public/videos/README.md).

---

## 8. Failure recovery

| Problem | Mitigation |
|---------|------------|
| Autopilot job hangs | Cut to completed build from prior take; VO line: “When the run finishes…” |
| Rate limit / 429 | Switch to pre-recorded “success” webm in edit only if clearly labeled B-roll—prefer fixing keys or model. |
| Scroll jump | Lock scroll between cuts; use smooth scroll extension sparingly. |
