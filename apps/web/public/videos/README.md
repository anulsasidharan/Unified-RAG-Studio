# Landing page product videos

| File | Role |
|------|------|
| `product-tour-main.mp4` | **Pipeline Premiere** tab — full product tour (target ~2:50–3:00, 1920×1080, H.264). Currently a test-pattern placeholder; replace with final screen recording. |
| `product-tour-teaser.mp4` | **Lightning Look** tab — 30 s social cut. Replace placeholder with final recording. |
| `product-tour-chapters.vtt` | WebVTT `chapters` track for the full tour. Re-time after replacing the main MP4. |
| `product-tour-captions.vtt` | WebVTT `captions` track — full voiceover transcript, accessible subtitles. |
| `hero-demo-poster.svg` | Poster image shown before playback (branded dark theme, stage rail preview, play button). |
| `product-tour-demo.html` | **Animated screen-recording template.** Open in Chrome at 1920×1080, press SPACE or wait 2 s — then screen-record with OBS/Loom/Camtasia to produce the real MP4s. Arrow keys / number keys jump scenes. |
| `VOICEOVER_TTS_READY.md` | Per-segment voiceover text formatted for ElevenLabs (or any TTS). Import into your audio editor alongside the screen recording. |

---

## How to produce the real MP4s

### 1 — Record the demo

1. Open `product-tour-demo.html` in Chrome; set browser zoom to **100%**.
2. Set your screen recorder (OBS, Loom, Camtasia) to capture at **1920×1080, 60 fps**.
3. Press **SPACE** inside the tab — the demo auto-advances through all 8 scenes in ~3 min.
4. Use **arrow keys** or **number keys 1–8** to re-record individual scenes.

### 2 — Generate voiceover

1. Open `VOICEOVER_TTS_READY.md`.
2. Paste each segment into **ElevenLabs** (recommended voice: Liam or Will, Stability 0.55).
3. Export as WAV 44.1 kHz stereo.

### 3 — Assemble

1. Import screen recording + VO segments into DaVinci Resolve / Premiere / CapCut.
2. Sync VO to scenes using the timing table in `docs/public/video/PRODUCT_TOUR_VOICEOVER.md`.
3. Add bed music at −16 dB under voice.
4. Export: **H.264, 8–12 Mbps, AAC 192 kbps stereo**.

### 4 — Drop in place

```
apps/web/public/videos/product-tour-main.mp4    ← replace
apps/web/public/videos/product-tour-teaser.mp4  ← replace
```

Re-time `product-tour-chapters.vtt` and `product-tour-captions.vtt` to match your final edit timecodes.
