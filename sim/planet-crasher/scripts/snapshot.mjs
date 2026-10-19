// Run a crash headless and screenshot it at chosen sim times (the look-at-it loop).
//
//   npm run build
//   node scripts/snapshot.mjs --scn moon --t 0,4,8,16,30 --n 1024 --out shots
//
// Times are sim units after launch. Prints HUD numbers at each time and any console
// errors. Software GL is slow; keep --n small for quick checks.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => s.trim().split(/\s+/)));
const times = String(args.t || '0,3,6,12,24').split(',').map(Number);
const scn = args.scn || 'moon';
const n = args.n || 1024;
const out = resolve(args.out || 'shots');
const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../dist/index.html');
const [w, h] = (args.size || '1280x720').split('x').map(Number);

const { chromium } = await import('playwright');
const exe = process.env.CHROMIUM_PATH || (await import('node:fs')).existsSync('/opt/pw-browsers/chromium') && '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
const errors = new Set();
page.on('pageerror', (e) => errors.add('pageerror: ' + e.message));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.add(m.type() + ': ' + m.text().slice(0, 400)));
await page.goto(pathToFileURL(file).href + `?mute=1&n=${n}&scn=${scn}${args.q ? '&' + args.q : ''}`);
await page.waitForFunction(() => window.PC && window.PC.ready(), null, { timeout: 120000 });
mkdirSync(out, { recursive: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/${scn}-aim.png` });
await page.evaluate(() => { window.PC.launch(); window.PC.state.paused = true; });
let t = 0;
for (const target of times) {
  const r = await page.evaluate((u) => window.PC.advance(u), Math.max(0, target - t));
  t = target;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${scn}${args.tag || ''}-t${String(target).replace('.', '_')}.png` });
  console.log(`t=${target}`, JSON.stringify(r));
  if (args.energy) console.log('   energy', JSON.stringify(await page.evaluate(() => window.PC.energy())));
}
console.log(errors.size ? [...errors].join('\n') : 'no console errors');
await browser.close();
