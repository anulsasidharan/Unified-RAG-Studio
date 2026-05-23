/**
 * Records public/videos/product-tour-demo.html (1920×1080, ~3 min) via Playwright,
 * writes product-tour-main.mp4 and product-tour-teaser.mp4 (H.264 + AAC narration).
 *
 * Voiceover:
 * - OPENAI_API_KEY — OpenAI TTS (recommended for quality / CI / Linux).
 * - Windows default — Windows SAPI (offline). TRY_EDGE_TTS=1 tries Microsoft Edge online first.
 * - macOS/Linux without OpenAI — Edge online TTS (edge-tts on npm).
 *
 * SKIP_VOICEOVER=1 — silent MP4 only (no narration).
 * SKIP_RECORD=1 — reuse public/videos/product-tour-main.silent.tmp.mp4; still muxes narration.
 *
 * Requires: playwright + Chromium; ffmpeg-static (or ffmpeg on PATH).
 * Run: npm run record:product-tour --workspace=apps/web
 */

import ffmpegStatic from 'ffmpeg-static';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import {
  buildVoiceoverMix,
  hasAudioStream,
  muxVoiceoverToMp4,
} from './lib/product-tour-voiceover.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const demoHtml = path.join(webRoot, 'public', 'videos', 'product-tour-demo.html');
const outDir = path.join(webRoot, 'public', 'videos');
const tmpDir = path.join(webRoot, '.cache', 'product-tour-record');
const silentIntermediate = path.join(outDir, 'product-tour-main.silent.tmp.mp4');
const RECORD_MS = 190_000;

function resolveFfmpeg() {
  if (ffmpegStatic) return ffmpegStatic;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    return 'ffmpeg';
  } catch {
    console.error('No ffmpeg: install ffmpeg-static failed or add ffmpeg to PATH.');
    process.exit(1);
  }
}

function toMp4Silent(ffmpegBin, webmPath, mp4Path) {
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      webmPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-an',
      mp4Path,
    ],
    { stdio: 'inherit' },
  );
}

function excerptTeaser(ffmpegBin, mainMp4, teaserMp4) {
  const args = [
    '-y',
    '-ss',
    '2',
    '-i',
    mainMp4,
    '-t',
    '30',
    '-map',
    '0:v:0',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
  ];
  if (hasAudioStream(ffmpegBin, mainMp4)) {
    args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push(teaserMp4);
  execFileSync(ffmpegBin, args, { stdio: 'inherit' });
}

async function main() {
  if (!fs.existsSync(demoHtml)) {
    console.error('Missing demo:', demoHtml);
    process.exit(1);
  }
  const ffmpegBin = resolveFfmpeg();
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'vo'), { recursive: true });

  const mainMp4 = path.join(outDir, 'product-tour-main.mp4');
  const teaserMp4 = path.join(outDir, 'product-tour-teaser.mp4');
  const skipVoice = process.env.SKIP_VOICEOVER === '1';

  const skipRecord = process.env.SKIP_RECORD === '1';
  if (!skipRecord) {
    const demoUrl = `${pathToFileURL(demoHtml).href}?record=1`;
    console.log('Recording', demoUrl);
    console.log(`Duration ~${RECORD_MS / 1000}s`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: tmpDir, size: { width: 1920, height: 1080 } },
    });
    const page = await context.newPage();
    await page.goto(demoUrl, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, RECORD_MS));
    const webmPath = await page.video().path();
    await context.close();
    await browser.close();

    console.log('Encoding silent video →', silentIntermediate);
    toMp4Silent(ffmpegBin, webmPath, silentIntermediate);

    try {
      fs.unlinkSync(webmPath);
    } catch {
      /* ignore */
    }
  } else {
    console.log('SKIP_RECORD=1 — expecting', silentIntermediate);
    if (!fs.existsSync(silentIntermediate)) {
      console.error('Missing silent intermediate — run record without SKIP_RECORD first.');
      process.exit(1);
    }
  }

  if (!skipVoice) {
    if (process.env.OPENAI_API_KEY) {
      console.log('Synthesizing voiceover (OpenAI TTS)...');
    } else if (process.platform === 'win32') {
      console.log(
        'Synthesizing voiceover (Windows SAPI — OPENAI_API_KEY for premium; TRY_EDGE_TTS=1 for Edge online)...',
      );
    } else {
      console.log(
        'Synthesizing voiceover (Edge online TTS — set OPENAI_API_KEY for hosted voice)...',
      );
    }

    const voWork = path.join(tmpDir, 'vo');
    const rawMix = await buildVoiceoverMix(ffmpegBin, voWork, console.log);
    console.log('Muxing narration →', mainMp4);
    fs.copyFileSync(silentIntermediate, mainMp4);
    muxVoiceoverToMp4(ffmpegBin, mainMp4, rawMix, mainMp4);
  } else {
    console.log('SKIP_VOICEOVER=1 — copying silent video');
    fs.copyFileSync(silentIntermediate, mainMp4);
  }

  console.log('Teaser clip →', teaserMp4);
  excerptTeaser(ffmpegBin, mainMp4, teaserMp4);

  if (!skipRecord && fs.existsSync(silentIntermediate)) {
    try {
      fs.unlinkSync(silentIntermediate);
    } catch {
      /* ignore */
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
