#!/usr/bin/env node
// CREDITS RENDER — frame-exact export of a credit sequence.
// Drives headless Chromium through the SAME engine the admin preview uses (credits/render/index.html),
// captures every frame as PNG and pipes it into FFmpeg.
//
//   node render.mjs --sequence sequence.json
//   node render.mjs --api https://stoopid-credits.stoopidshow.workers.dev --episode 23
//   options: --out DIR  --formats mp4,cards,alpha-cards,prores,animation,webm-alpha  --no-audio  --fps 24|30|60  --workers N
//
// Outputs (see docs/credits-video-export.md):
//   mp4         H.264 High, yuv420p, BT.709, AAC 48 kHz — CapCut / DaVinci Resolve / anywhere
//   cards       full-res opaque PNG per page
//   alpha-cards full-res transparent PNG per page (overlay over your own footage)
//   prores      ProRes 4444 .mov with alpha — DaVinci Resolve overlay track
//   animation   QuickTime Animation (qtrle) .mov with alpha — lossless, much smaller than ProRes; widely accepted by editors
//   webm-alpha  VP9 .webm with alpha — browsers / OBS / web overlays

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');                     // repo root: serves credits/engine + credits/render

// ── args ──
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
if (flag('help') || (!opt('sequence') && !opt('episode'))) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(flag('help') ? 0 : 1);
}
const formats = new Set(String(opt('formats', 'mp4,cards')).split(',').map((s) => s.trim()).filter(Boolean));
const known = ['mp4', 'cards', 'alpha-cards', 'prores', 'animation', 'webm-alpha'];
for (const f of formats) if (!known.includes(f)) die(`unknown format "${f}" (choose from ${known.join(', ')})`);

function die(msg) { console.error('✖ ' + msg); process.exit(1); }
const log = (...a) => console.log('·', ...a);

// ── tools ──
async function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { const m = await import('ffmpeg-static'); if (m.default && fs.existsSync(m.default)) return m.default; } catch {}
  const r = spawnSync('ffmpeg', ['-version']);
  if (r.status === 0) return 'ffmpeg';
  die('FFmpeg not found. Run `npm install` here (installs ffmpeg-static) or install FFmpeg and put it on PATH.');
}

async function launchBrowser() {
  let pw;
  try { pw = await import('playwright-core'); } catch { die('playwright-core missing. Run `npm install` in credits-render/.'); }
  const { chromium } = pw;
  const tries = [];
  if (process.env.CHROME_PATH) tries.push({ executablePath: process.env.CHROME_PATH });
  if (fs.existsSync('/opt/pw-browsers/chromium')) tries.push({ executablePath: '/opt/pw-browsers/chromium' });
  tries.push({}, { channel: 'chrome' }, { channel: 'msedge' });
  for (const t of tries) {
    try { return await chromium.launch({ headless: true, ...t, args: ['--autoplay-policy=no-user-gesture-required'] }); } catch {}
  }
  die('No Chromium found. Install Google Chrome or Microsoft Edge, or set CHROME_PATH.');
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
  const srv = http.createServer(async (req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || !/^credits[/\\](engine|render)[/\\]/.test(p)) { res.writeHead(404); return res.end(); }
    try { const b = await fsp.readFile(file); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function loadSequence() {
  if (opt('sequence')) return JSON.parse(await fsp.readFile(opt('sequence'), 'utf8'));
  const api = opt('api', 'https://stoopid-credits.stoopidshow.workers.dev').replace(/\/$/, '');
  const url = `${api}/public/episodes/${encodeURIComponent(opt('episode'))}/sequence`;
  const r = await fetch(url);
  if (!r.ok) die(`${url} → HTTP ${r.status}. Is the episode finalised?`);
  const j = await r.json();
  return j.sequence;
}

function ffmpegProc(bin, argv) {
  const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['pipe', 'inherit', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${err.slice(-800)}`)))));
  return { p, done };
}

/** Render frames on several headless pages at once; write them to FFmpeg strictly in order. */
async function pumpFrames(pages, n, transparent, stdin, label) {
  const t0 = Date.now(), done = new Map();
  let next = 0, written = 0, wake = null;
  const worker = async (page) => {
    while (next < n) {
      const i = next++;
      done.set(i, Buffer.from(await page.evaluate(([i, tr]) => window.__credits.frame(i, tr), [i, transparent]), 'base64'));
      if (wake) { const w = wake; wake = null; w(); }
      while (done.size > pages.length * 4 && i > written + pages.length * 4) await new Promise((r) => setTimeout(r, 5));
    }
  };
  const writer = (async () => {
    while (written < n) {
      if (!done.has(written)) { await new Promise((r) => { wake = r; setTimeout(r, 50); }); continue; }
      const buf = done.get(written); done.delete(written);
      if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
      written++;
      if (written % 60 === 0 || written === n) process.stdout.write(`\r· ${label}: ${written}/${n} frames (${((Date.now() - t0) / 1000).toFixed(0)}s)   `);
    }
    stdin.end();
  })();
  await Promise.all([...pages.map(worker), writer]);
  process.stdout.write('\n');
}

function probe(file) {
  const bin = process.env.FFPROBE_PATH || 'ffprobe';
  const r = spawnSync(bin, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate:stream_tags=alpha_mode:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout) : { unavailable: 'ffprobe not on PATH' };
}

// ── main ──
const seq = await loadSequence();
if (!seq || !Array.isArray(seq.segments)) die('That file is not a credit sequence.');
if (opt('fps')) { const f = Number(opt('fps')); if (![24, 30, 60].includes(f)) die('--fps must be 24, 30 or 60'); seq.fps = f; }
const audio = seq.audio && !flag('no-audio');
const slug = `stoopid_ep${String(seq.episode.number).padStart(3, '0')}_credits_${seq.theme}`;
const outDir = path.resolve(opt('out', path.join(process.cwd(), 'out', slug)));
await fsp.mkdir(outDir, { recursive: true });
const ffmpeg = await findFfmpeg();
const srv = await serve();
const browser = await launchBrowser();
const workers = Math.max(1, Math.min(8, Number(opt('workers', Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2)))))));
const pages = [];
for (let k = 0; k < workers; k++) {
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', (e) => console.error('page error:', e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/credits/render/index.html`);
  await pg.waitForFunction(() => window.__creditsReady === true);
  await pg.evaluate((s) => window.__credits.load(s), seq);
  pages.push(pg);
}
const page = pages[0];
const info = await page.evaluate((s) => window.__credits.load(s), seq);
log(`${workers} render worker(s) · EP ${seq.episode.number} "${seq.episode.title}" · theme ${seq.theme} · ${info.duration}s · ${info.fps} fps · ${info.frames} frames · ${info.pages} pages`);
const outputs = [];
const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'credits-'));
try {
  let wav = null;
  if (audio && (formats.has('mp4') || formats.has('prores') || formats.has('webm-alpha'))) {
    wav = path.join(outDir, `${slug}_audio.wav`);
    await fsp.writeFile(wav, Buffer.from(await page.evaluate(() => window.__credits.wav()), 'base64'));
    outputs.push(wav); log('audio →', path.basename(wav));
  }
  const vin = ['-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-'];
  const ain = wav ? ['-i', wav] : [];

  if (formats.has('mp4')) {
    const f = path.join(outDir, `${slug}_1080p${info.fps}.mp4`);
    const { p, done } = ffmpegProc(ffmpeg, [...vin, ...ain,
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-tune', 'animation',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-g', String(info.fps * 2), ...(wav ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []),
      '-movflags', '+faststart', '-shortest', f]);
    await pumpFrames(pages, info.frames, false, p.stdin, 'mp4');
    await done; outputs.push(f); log('mp4 →', path.basename(f));
  }

  if (formats.has('prores') || formats.has('animation') || formats.has('webm-alpha')) {
    const outs = [];
    if (formats.has('prores')) {
      const f = path.join(outDir, `${slug}_overlay_prores4444.mov`);
      outs.push('-map', '0:v', ...(wav ? ['-map', '1:a', '-c:a', 'pcm_s16le'] : []),
        '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', f);
      outputs.push(f);
    }
    if (formats.has('animation')) {
      const f = path.join(outDir, `${slug}_overlay_animation.mov`);
      outs.push('-map', '0:v', ...(wav ? ['-map', '1:a', '-c:a', 'pcm_s16le'] : []), '-c:v', 'qtrle', '-pix_fmt', 'argb', f);
      outputs.push(f);
    }
    if (formats.has('webm-alpha')) {
      const f = path.join(outDir, `${slug}_overlay_vp9alpha.webm`);
      outs.push('-map', '0:v', ...(wav ? ['-map', '1:a', '-c:a', 'libopus', '-b:a', '160k'] : []),
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '22', '-auto-alt-ref', '0', '-row-mt', '1', f);
      outputs.push(f);
    }
    const { p, done } = ffmpegProc(ffmpeg, [...vin, ...ain, ...outs]);
    await pumpFrames(pages, info.frames, true, p.stdin, 'alpha');
    await done; log('alpha overlays →', outs.filter((x) => typeof x === 'string' && /\.(mov|webm)$/.test(x)).map((x) => path.basename(x)).join(', '));
  }

  for (const [fmt, tr, dir] of [['cards', false, 'cards'], ['alpha-cards', true, 'cards_alpha']]) {
    if (!formats.has(fmt)) continue;
    const d = path.join(outDir, dir); await fsp.mkdir(d, { recursive: true });
    for (let i = 0; i < info.pages; i++) {
      const c = await page.evaluate(([i, tr]) => window.__credits.card(i, tr), [i, tr]);
      const f = path.join(d, `${c.name}${tr ? '_alpha' : ''}.png`);
      await fsp.writeFile(f, Buffer.from(c.b64, 'base64')); outputs.push(f);
    }
    log(`${fmt} → ${dir}/ (${info.pages} PNG)`);
  }

  await fsp.writeFile(path.join(outDir, 'sequence.json'), JSON.stringify(seq, null, 2));
  const warnings = await page.evaluate(() => window.__credits.warnings());
  const manifest = { episode: seq.episode, theme: seq.theme, fps: info.fps, duration: info.duration, frames: info.frames,
    rendered_at: new Date().toISOString(), warnings,
    outputs: outputs.map((f) => ({ file: path.relative(outDir, f), bytes: fs.statSync(f).size, probe: /\.(mp4|mov|webm)$/.test(f) ? probe(f) : undefined })) };
  await fsp.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (warnings.length) log(`${warnings.length} render warning(s) — see manifest.json`);
  log('done →', outDir);
} finally {
  await browser.close(); srv.close(); await fsp.rm(tmp, { recursive: true, force: true });
}
