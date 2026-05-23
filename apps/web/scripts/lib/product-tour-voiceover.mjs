/**
 * Timeline aligned to product-tour-demo.html: script t=0 begins 2s after page load.
 * Segment copy from docs/public/video/PRODUCT_TOUR_VOICEOVER.md (table column).
 */

import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// Package "main" points at .ts; resolve compiled build (Node 24+ otherwise errors).
import { ttsSave } from 'edge-tts/out/index.js';

/** Seconds from recording start when demo clock starts (HTML setTimeout 2s). */
export const DEMO_CLOCK_OFFSET_SEC = 2;

/** Scene boundaries in demo script seconds (matches SCENE_TIMES in product-tour-demo.html). */
const SCENE_ENDS = [18, 38, 75, 98, 125, 148, 165, 180];

export const VO_SEGMENTS = [
  {
    text: `Retrieval-augmented generation shouldn't mean stitching a dozen tools by hand. Unified RAG Studio is a single workspace: walk seventeen guided stages in the Designer, or start from your documents in Autopilot, then evaluate, harden, and export what you actually ship.`,
  },
  {
    text: `Two front doors, same truth under the hood. Designer is for explicit control: cloud through vector store, query processing and retrieval, optional context compression and reranking, generation and routing, memory and evaluation, observability and tool hints, guardrails, human-in-the-loop, and a final review. Autopilot is for running optimisation passes over your corpus when you want the system to propose a strong baseline.`,
  },
  {
    text: `You're not hunting for the next file to edit. The stage rail is the contract. Configure ingestion and chunking, pick embeddings and the vector store, optionally shape the query before retrieval, then tighten retrieval and downstream steps. As you move forward, the UI and estimates update so you catch bad pairings before you export.`,
  },
  {
    text: `Production RAG isn't only accuracy. It's what you allow through. Guardrails let you set input and output policies so safety and quality checks ride with the orchestration layer. When you need explicit human gates, Human in the Loop is its own stage. Placement and escalation live next to the rest of the pipeline config.`,
  },
  {
    text: `When you'd rather iterate from real files, Autopilot runs structured passes: chunking, embeddings, retrieval, evaluation, and you get something you can inspect and edit back in Designer. Treat it as a smart draft, not a black box.`,
  },
  {
    text: `Before you freeze the config, you want receipts: what retrieved, with what scores, how fast. Tweak retrieval or chunking, rerun, and decide with data, not vibes.`,
  },
  {
    text: `When the pipeline is grounded, export the artifacts your team expects: Python, YAML, Terraform, Compose, Kubernetes, and wire into deployment. Operational signals live where you already run the stack.`,
  },
  {
    text: `If you're done duct-taping RAG pipelines, open Unified RAG Studio. Walk the seventeen stages, or let Autopilot draft your first-pass config. Start free or book a walkthrough. We'll meet you where you ship.`,
  },
];

function segmentWindows() {
  let prev = 0;
  return SCENE_ENDS.map((end) => {
    const w = { scriptStartSec: prev, scriptEndSec: end };
    prev = end;
    return w;
  });
}

export function wallStartSec(scriptStartSec) {
  return DEMO_CLOCK_OFFSET_SEC + scriptStartSec;
}

export function slotDurationSec(scriptStartSec, scriptEndSec) {
  return Math.max(0.4, scriptEndSec - scriptStartSec - 0.12);
}

export function probeDurationSec(ffmpegBin, filePath) {
  const r = spawnSync(ffmpegBin, ['-hide_banner', '-nostdin', '-i', filePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const text = `${r.stderr || ''}${r.stdout || ''}`;
  const m = text.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  if (!m) throw new Error(`Could not read duration for ${filePath}`);
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

export function hasAudioStream(ffmpegBin, filePath) {
  const r = spawnSync(ffmpegBin, ['-hide_banner', '-nostdin', '-i', filePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return /Stream #\d+:\d+.*Audio:/.test(`${r.stderr || ''}`);
}

function synthesizeWindowsSapi(text, outWav) {
  const ps1 = path.join(
    path.dirname(outWav),
    `_tts_sapi_${Date.now()}_${Math.random().toString(16).slice(2)}.ps1`,
  );
  const quotedPath = JSON.stringify(outWav);
  const quotedText = JSON.stringify(text);
  const body =
    `Add-Type -AssemblyName System.Speech\r\n` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\r\n` +
    `$s.SetOutputToWaveFile(${quotedPath})\r\n` +
    `$s.Speak(${quotedText})\r\n` +
    `$s.Dispose()\r\n`;
  fs.writeFileSync(ps1, body, 'utf8');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
      stdio: 'inherit',
    });
  } finally {
    try {
      fs.unlinkSync(ps1);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Writes MP3 (OpenAI / Edge) or WAV (Windows SAPI). Returns that file path for ffmpeg.
 */
async function synthesizeSpeechFile(text, outBasePath) {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    const outMp3 = `${outBasePath}.mp3`;
    const voice = process.env.PRODUCT_TOUR_OPENAI_VOICE ?? 'onyx';
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.PRODUCT_TOUR_OPENAI_TTS_MODEL ?? 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI TTS failed: ${res.status} ${err}`);
    }
    fs.writeFileSync(outMp3, Buffer.from(await res.arrayBuffer()));
    return outMp3;
  }

  // On Windows without OpenAI: Edge commonly returns 403 for scripted sessions.
  const useWindowsSapiDefaultWin =
    process.platform === 'win32' &&
    process.env.DISABLE_WINDOWS_SAPI !== '1' &&
    process.env.TRY_EDGE_TTS !== '1';

  if (useWindowsSapiDefaultWin) {
    const outWav = `${outBasePath}.wav`;
    synthesizeWindowsSapi(text, outWav);
    return outWav;
  }

  const voice = process.env.PRODUCT_TOUR_EDGE_VOICE ?? 'en-US-GuyNeural';
  const rate = process.env.PRODUCT_TOUR_EDGE_RATE ?? '-4%';
  const outMp3 = `${outBasePath}.mp3`;
  try {
    await ttsSave(text, outMp3, { voice, rate, pitch: '+0Hz', volume: '+0%' });
    return outMp3;
  } catch (e) {
    if (process.platform === 'win32') {
      console.warn(`[product-tour] Edge TTS failed (${e.message}). Falling back to Windows SAPI.`);
      const outWav = `${outBasePath}.wav`;
      synthesizeWindowsSapi(text, outWav);
      return outWav;
    }
    throw new Error(
      `${e.message}. Set OPENAI_API_KEY, or TRY_EDGE_TTS=1 may work on Edge-friendly networks.`,
    );
  }
}

function fitSegmentWav(ffmpegBin, inAudio, outWav, maxSec) {
  const dur = probeDurationSec(ffmpegBin, inAudio);
  let tempo = 1;
  if (dur > maxSec) {
    tempo = Math.min(1.85, dur / (maxSec - 0.08));
  }
  const af =
    tempo === 1
      ? `aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${maxSec},asetpts=PTS-STARTPTS`
      : `atempo=${tempo},aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${maxSec},asetpts=PTS-STARTPTS`;
  execFileSync(ffmpegBin, ['-y', '-i', inAudio, '-af', af, outWav], { stdio: 'pipe' });
}

/**
 * Generates mixed narration WAV for full video length, muxed loosely to wall clock.
 */
export async function buildVoiceoverMix(ffmpegBin, workDir, onProgress) {
  fs.mkdirSync(workDir, { recursive: true });
  const windows = segmentWindows();

  let i = 0;
  for (const seg of VO_SEGMENTS) {
    onProgress?.(`TTS segment ${i + 1}/${VO_SEGMENTS.length}`);
    const rawBase = path.join(workDir, `seg-${i}-raw`);
    const rawFile = await synthesizeSpeechFile(seg.text, rawBase);
    const maxSec = slotDurationSec(windows[i].scriptStartSec, windows[i].scriptEndSec);
    const wav = path.join(workDir, `seg-${i}.wav`);
    fitSegmentWav(ffmpegBin, rawFile, wav, maxSec);
    try {
      fs.unlinkSync(rawFile);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 350));
    i++;
  }

  const delaysMs = windows.map((w, j) => Math.round(wallStartSec(w.scriptStartSec) * 1000));

  const inputs = VO_SEGMENTS.map((_, j) => ['-i', path.join(workDir, `seg-${j}.wav`)]).flat();

  const labeled = [];
  const parts = [];
  for (let j = 0; j < VO_SEGMENTS.length; j++) {
    const lab = `[vo${j}]`;
    labeled.push(lab);
    parts.push(`[${j}:a]adelay=${delaysMs[j]}|${delaysMs[j]}${lab}`);
  }
  parts.push(
    `${labeled.join('')}amix=inputs=${labeled.length}:normalize=0:duration=longest:dropout_transition=0[aout]`,
  );
  const filterComplex = parts.join(';');

  const rawMix = path.join(workDir, 'mix-raw.wav');
  execFileSync(
    ffmpegBin,
    ['-y', ...inputs, '-filter_complex', filterComplex, '-map', '[aout]', rawMix],
    { stdio: 'inherit' },
  );

  return rawMix;
}

/**
 * Trim or pad mixed narration to video duration and mux AAC into mp4 (-c:v copy).
 */
export function muxVoiceoverToMp4(ffmpegBin, videoMp4Path, rawMixWavPath, outMp4Path) {
  const videoDur = probeDurationSec(ffmpegBin, videoMp4Path);
  const narrDur = probeDurationSec(ffmpegBin, rawMixWavPath);
  const padSec = Math.max(0, videoDur - narrDur + 0.12);
  const finalWav = path.join(path.dirname(rawMixWavPath), 'mix-final.wav');

  if (padSec > 0.02) {
    execFileSync(
      ffmpegBin,
      ['-y', '-i', rawMixWavPath, '-af', `apad=pad_dur=${padSec}`, finalWav],
      { stdio: 'pipe' },
    );
  } else if (narrDur > videoDur + 0.05) {
    execFileSync(ffmpegBin, ['-y', '-i', rawMixWavPath, '-t', String(videoDur), finalWav], {
      stdio: 'pipe',
    });
  } else {
    fs.copyFileSync(rawMixWavPath, finalWav);
  }

  const tmpOut = `${outMp4Path}.muxing.tmp.mp4`;
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      videoMp4Path,
      '-i',
      finalWav,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      tmpOut,
    ],
    { stdio: 'inherit' },
  );
  try {
    fs.unlinkSync(outMp4Path);
  } catch {
    /* ignore */
  }
  fs.renameSync(tmpOut, outMp4Path);
}
