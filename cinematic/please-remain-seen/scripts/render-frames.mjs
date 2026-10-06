// Frame-accurate offline capture: renders every frame of the broadcast to PNG
// through a headless browser, independent of real-time performance.
//
//   npm i -D playwright            (once)
//   npm run build
//   node scripts/render-frames.mjs [--fps 30] [--quality high] [--from 0] [--to 90] [--out frames]
//
// Pair the frames with the soundtrack (WAV button in the player) in any editor,
// or: ffmpeg -framerate 30 -i frames/%05d.png -i please-remain-seen-soundtrack.wav \
//            -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k please-remain-seen.mp4
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => s.trim().split(/\s+/)));
const fps = Number(args.fps || 30);
const quality = args.quality || 'high';
const from = Number(args.from || 0), to = Number(args.to || 90);
const out = resolve(args.out || 'frames');
const here = dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(resolve(here, '../dist/index.html')).href + `?frames=1&quality=${quality}&mute=1&cc=${args.cc ?? 1}`;

const { chromium } = await import('playwright');
const size = { high: [1920, 1080], medium: [1280, 720], low: [960, 540] }[quality];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
const p = await ctx.newPage();
await p.goto(page);
await p.waitForFunction(() => window.PRS);
mkdirSync(out, { recursive: true });
const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
for (let i = n0; i < n1; i++) {
  await p.evaluate((t) => window.PRS.renderAt(t), i / fps);
  const shot = await p.locator('#stage').screenshot({ type: 'png' });
  writeFileSync(`${out}/${String(i).padStart(5, '0')}.png`, shot);
  if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)}s / ${to}s`);
}
await browser.close();
console.log(`\nwrote ${n1 - n0} frames to ${out}`);
