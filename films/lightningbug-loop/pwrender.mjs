// Render a hand-drawn canvas film using Playwright's Chromium instead of
// puppeteer-core. Same contract as the skill's render.mjs: the page exposes
// window.__ready, window.__NDRAW, window.__size, window.__frame(i),
// window.__grid(n), window.__wav(). Frames come from the page's own canvas.
//
//   node pwrender.mjs <film.html> --grid 24
//   node pwrender.mjs <film.html> --only 0,12,24
//   node pwrender.mjs <film.html>                 # all frames -> mp4 + contact sheet
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const file = argv.find(a => a.endsWith('.html'));
if (!file) { console.error('usage: node pwrender.mjs film.html [--grid N] [--only a,b,c]'); process.exit(2); }
const flag = n => { const k = argv.indexOf(n); return k >= 0 ? argv[k + 1] : undefined; };
const only = flag('--only')?.split(',').map(Number).filter(Number.isFinite);
const grid = flag('--grid') ? +flag('--grid') || 24 : 0;
const ar = flag('--ar') || '9:16', width = flag('--width') ? +flag('--width') : 0;
const FFMPEG = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const name = path.basename(file, '.html');
const outDir = path.resolve(flag('--out') || path.join(path.dirname(path.resolve(file)), 'out'));
const framesDir = path.join(outDir, `${name}-frames`);
mkdirSync(framesDir, { recursive: true });

const url = pathToFileURL(path.resolve(file)).href
  + `?bare=1&frame=0&ar=${encodeURIComponent(ar)}` + (width ? `&w=${width}` : '');

const browser = await chromium.launch({ executablePath: CHROME });
const save = (f, dataUrl) => writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
const errors = [];
let total = 0, wavFile = null;
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const N = await page.evaluate(() => window.__NDRAW);
  const size = await page.evaluate(() => window.__size);
  if (!Number.isInteger(N) || N <= 0) throw new Error('window.__NDRAW missing');
  total = N;
  console.log(`${name}: ${N} drawn frames, logical ${size.W}x${size.H}, output ${size.w}x${size.h}`);

  if (grid) {
    const sheet = path.join(outDir, `${name}-grid.jpg`);
    save(sheet, await page.evaluate(n => window.__grid(n, 240), grid));
    console.log(`grid: ${sheet}`);
  }
  const list = grid ? [] : only ? only.filter(i => i >= 0 && i < N) : [...Array(N).keys()];
  const t0 = Date.now();
  let done = 0;
  for (const i of list) {
    try {
      save(path.join(framesDir, `${String(i).padStart(4, '0')}.png`), await page.evaluate(k => window.__frame(k), i));
      done++;
    } catch (e) {
      errors.push(`drawn frame ${i} (t=${(i / 12).toFixed(2)}s): ${String(e.message || e).split('\n')[0]}`);
    }
  }
  if (!only && !grid && !errors.length) {
    const b64 = await page.evaluate(() => window.__wav ? window.__wav() : null);
    if (b64) { wavFile = path.join(outDir, `${name}-score.wav`); writeFileSync(wavFile, Buffer.from(b64, 'base64')); }
  }
  if (list.length) console.log(`rendered ${done}/${list.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${framesDir}`);
} finally {
  await browser.close();
}
if (errors.length) { console.error('page errors (no mp4 built):\n  ' + [...new Set(errors)].slice(0, 12).join('\n  ')); process.exit(1); }
if (only || grid) process.exit();

const ff = args => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const mp4 = path.join(outDir, `${name}.mp4`), sheet = path.join(outDir, `${name}-contact.jpg`);
ff(['-framerate', '12', '-i', path.join(framesDir, '%04d.png'), '-r', '24', '-pix_fmt', 'yuv420p', '-crf', '18', mp4]);
const rows = Math.ceil(total / 6 / 6);
ff(['-i', mp4, '-vf', `select=not(mod(n\\,12)),scale=240:-1,tile=6x${rows}`, '-frames:v', '1', sheet]);
console.log(`mp4: ${mp4}\ncontact sheet: ${sheet}`);
if (wavFile) {
  const fin = path.join(outDir, `${name}-final.mp4`);
  ff(['-i', mp4, '-i', wavFile, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', fin]);
  console.log(`with sound: ${fin}`);
}
