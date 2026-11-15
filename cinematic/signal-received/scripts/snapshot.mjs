// Render stills at chosen times and a contact sheet, through headless Chromium.
// This is the look-at-it loop: change something, snapshot, look, repeat.
//
//   npm i -D playwright   (once)
//   npm run build
//   node scripts/snapshot.mjs --t 4.5,13,22.4,33.5,52,79,87 --quality low --out shots
//
// Writes shots/t<time>.png for each time plus shots/contact-sheet.png (2 columns),
// and prints any console errors from the page. Software GL is slow (~5 s/frame at 540p);
// that is fine for checking composition, not for judging frame rate.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => s.trim().split(/\s+/)));
const times = String(args.t || '4.5,13,22.4,29,33.5,44,52,61,70,79,83.5,87').split(',').map(Number);
const quality = args.quality || 'low';
const out = resolve(args.out || 'shots');
const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, args.file || '../dist/index.html');
const [w, h] = { high: [1920, 1080], medium: [1280, 720], low: [960, 540] }[quality];

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
const errors = new Set();
page.on('pageerror', (e) => errors.add('pageerror: ' + e.message));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.add(m.type() + ': ' + m.text().slice(0, 300)));
await page.goto(pathToFileURL(file).href + `?frames=1&mute=1&quality=${quality}&cc=${args.cc ?? 1}`);
await page.waitForFunction(() => window.PRS, null, { timeout: 60000 });
mkdirSync(out, { recursive: true });

const shots = [];
for (const t of times) {
  await page.evaluate((t) => window.PRS.renderAt(t), t);
  await page.evaluate((t) => window.PRS.renderAt(t), t); // second pass settles double-buffered feeds
  const png = await page.locator('#stage').screenshot({ type: 'png' });
  writeFileSync(`${out}/t${String(t).replace('.', '_')}.png`, png);
  shots.push(png.toString('base64'));
  console.log(`t=${t}`);
}

// Contact sheet, composed in the page so no image library is needed.
const sheet = await page.evaluate(async ({ shots, w, h }) => {
  const cols = 2, rows = Math.ceil(shots.length / cols);
  const c = document.createElement('canvas');
  c.width = w * cols; c.height = h * rows;
  const g = c.getContext('2d');
  for (let i = 0; i < shots.length; i++) {
    const img = new Image();
    img.src = 'data:image/png;base64,' + shots[i];
    await img.decode();
    g.drawImage(img, (i % cols) * w, Math.floor(i / cols) * h, w, h);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { shots, w, h });
writeFileSync(`${out}/contact-sheet.png`, Buffer.from(sheet, 'base64'));
console.log(`contact sheet: ${out}/contact-sheet.png`);
console.log(errors.size ? [...errors].join('\n') : 'no console errors');
await browser.close();
