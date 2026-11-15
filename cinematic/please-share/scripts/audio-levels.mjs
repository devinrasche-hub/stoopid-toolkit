// Render the soundtrack offline and print peak / RMS (dBFS) for every second.
// Use it after any sound change: it catches clipping, beds that never switch
// off, and silences that aren't silent. (It found a reverb send bug in v1.)
//
//   npm run build && node scripts/audio-levels.mjs
//
// Targets used for PLEASE REMAIN SEEN: peaks ≤ -6 dBFS, RMS roughly -26 → -17
// across the build, quiet beats below -45, true silence reads -120.
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(pathToFileURL(resolve(here, '../dist/index.html')).href + '?frames=1&mute=1&quality=low');
await page.waitForFunction(() => window.PRS);
const levels = await page.evaluate(() => window.PRS.audioLevels());
let worst = -120;
for (const [s, pk, rms] of levels) {
  worst = Math.max(worst, Number(pk));
  const bar = '#'.repeat(Math.max(0, Math.round((Number(rms) + 60) / 2)));
  console.log(`${String(s).padStart(2)}s  peak ${pk.padStart(6)}  rms ${rms.padStart(6)}  ${bar}`);
}
console.log(`\nloudest peak: ${worst.toFixed(1)} dBFS${worst > -3 ? '  <-- too hot' : ''}`);
await browser.close();
