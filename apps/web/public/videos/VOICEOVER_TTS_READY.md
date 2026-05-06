# Voiceover — ElevenLabs / TTS-ready script

Recommended voice: **Liam** or **Will** (ElevenLabs) — clear, measured, builder-to-builder tone.  
Settings: Stability **0.55**, Similarity **0.75**, Style **0.20**, Speaker Boost **on**.  
Target WPM: **148–158** (≈ 175 words → ~68s for main VO segments = 3 min with pauses).

Paste each segment as a separate generation. Use the `[pause Xs]` markers as silence inserts between segments in your editor. Bold text = natural stress points — do not over-emphasise.

---

## Segment 1 — Hook (0:00–0:18)

```
Retrieval-augmented generation shouldn't mean stitching a dozen tools by hand.
[pause 0.4s]
Unified RAG Studio is a single workspace: walk thirteen guided stages in the Designer,
or start from your documents in Autopilot —
then evaluate, harden, and export what you actually ship.
```

---

## Segment 2 — Modes (0:18–0:38)

```
Two front doors. Same truth under the hood.
[pause 0.3s]
Designer is for explicit control —
cloud, ingestion, chunking, embeddings, store, retrieval,
rerank, generation, routing, memory, evaluation, guardrails,
and a final review.
[pause 0.4s]
Autopilot is for running optimisation passes over your corpus
when you want the system to propose a strong baseline.
```

---

## Segment 3 — Designer (0:38–1:15)

```
You're not hunting for the next file to edit —
the stage rail is the contract.
[pause 0.3s]
Configure cloud and ingestion,
shape how documents become chunks,
pick embeddings and the vector store,
then tighten retrieval.
[pause 0.3s]
As you move forward, the UI and cost estimates update —
so you catch bad pairings before you export.
```

---

## Segment 4 — Guardrails (1:15–1:38)

```
Production RAG isn't only accuracy —
it's what you allow through.
[pause 0.4s]
Guardrails let you set input and output policies
so safety and quality checks ride with the orchestration layer —
not as an afterthought.
```

---

## Segment 5 — Autopilot (1:38–2:05)

```
When you'd rather iterate from real files,
Autopilot runs structured passes —
chunking, embeddings, retrieval, evaluation —
and you get something you can inspect and edit back in Designer.
[pause 0.4s]
Treat it as a smart draft. Not a black box.
```

---

## Segment 6 — Evaluation (2:05–2:28)

```
Before you freeze the config, you want receipts:
what retrieved, with what scores, how fast.
[pause 0.3s]
Tweak retrieval or chunking, rerun,
and decide with data — not vibes.
```

---

## Segment 7 — Export (2:28–2:45)

```
When the pipeline is grounded,
export the artifacts your team expects —
Python, YAML, Terraform, Compose, Kubernetes —
and wire into deployment.
[pause 0.3s]
Operational signals live where you already run the stack.
```

---

## Segment 8 — CTA (2:45–3:00)

```
If you're done duct-taping RAG pipelines,
open Unified RAG Studio.
[pause 0.3s]
Walk the thirteen stages —
or let Autopilot draft your first-pass config.
[pause 0.3s]
Start free, or book a walkthrough —
we'll meet you where you ship.
```

---

## Post-production notes

- Export each segment as **WAV 44.1kHz stereo**, then assemble in DaVinci Resolve / Premiere / CapCut.
- Bed music: duck to **−16 dB** under voice; fade out **1.5 s** before final CTA line.
- Add **0.5 s silence** at head and tail of every segment for crossfade handles.
- Align chapter start times to `product-tour-chapters.vtt` after final edit.
- Burn captions from `product-tour-captions.vtt` or use platform auto-captions.
