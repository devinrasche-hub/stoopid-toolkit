// UI smoke test: load, aim, launch, run past the verdict, and a phone-sized view.
//   node scripts/e2e.mjs
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(resolve(here, '../dist/index.html')).href;
const out = resolve(here, '../shots');
mkdirSync(out, { recursive: true });
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const open = async (vp, q) => {
  const page = await (await browser.newContext({ viewport: vp, hasTouch: vp.width < 600 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url + q);
  await page.waitForFunction(() => window.PC && window.PC.ready(), null, { timeout: 120000 });
  return page;
};

const page = await open({ width: 1440, height: 900 }, '?mute=1&n=1024');
await page.click('#launch');
await page.waitForTimeout(300);
const label = await page.textContent('#launch');
await page.evaluate(() => { window.PC.state.paused = true; });
const r = await page.evaluate(() => window.PC.advance(window.PC.state.simT + 45));
await page.waitForSelector('#verdict:not([hidden])', { timeout: 30000 });
await page.screenshot({ path: `${out}/e2e-verdict.png` });
console.log('launch label while running:', label, '| outcome:', r.kind, '| verdict:', await page.textContent('#vKind'), await page.textContent('#vStamp'));
await page.click('#vAgain');
await page.waitForTimeout(500);
console.log('after CRASH AGAIN:', await page.textContent('#hState'));
await page.keyboard.press('h');
console.log('H hides UI:', await page.evaluate(() => getComputedStyle(document.getElementById('panel')).display === 'none'));

const phone = await open({ width: 390, height: 844 }, '?mute=1&n=1024');
await phone.waitForTimeout(500);
await phone.screenshot({ path: `${out}/e2e-phone.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
