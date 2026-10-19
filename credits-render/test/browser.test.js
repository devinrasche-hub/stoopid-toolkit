// Browser-level tests: public pages, admin, preview/export parity, legibility, arcade regression, a real render.
// The Credits API runs in-process (the real Worker code on a node:sqlite D1 shim) on :8787, which is
// where the pages look for it on localhost. Static files are served from the repo root.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { world, addPerson, TOKEN } from '../../credits-api/test/helpers.js';
import { handle } from '../../credits-api/src/index.js';
import { FEED_2026_10_16 } from '../../credits-api/test/fixtures.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let w, apiSrv, webSrv, web, browser;

function staticServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.mp3': 'audio/mpeg' };
  return http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try { const b = await fsp.readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end(); }
  });
}

before(async () => {
  w = world(FEED_2026_10_16);
  w.env.ALLOWED_ORIGINS = 'http://localhost:8099,https://devinrasche-hub.github.io';
  apiSrv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    headers.set('cf-connecting-ip', '198.51.100.1');
    const r = await handle(new Request('http://localhost:8787' + req.url, { method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), w.env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  const listen = (srv, port) => new Promise((ok, no) => { srv.once('error', (e) => no(new Error(`port ${port}: ${e.code} (stop wrangler dev or whatever is using it)`))); srv.listen(port, '127.0.0.1', ok); });
  await listen(apiSrv, 8787);
  webSrv = staticServer();
  await listen(webSrv, 8099);
  web = 'http://localhost:8099';
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });

  // a small, realistic world
  const sup = await addPerson(w, { display_name: 'Ada Beanworth', memberships: [{ category_key: 'financially_irresponsible' }] });
  await addPerson(w, { display_name: '小豆 Azuki 🫘', memberships: [{ category_key: 'voluntary_witnesses', verification: 'self_reported' }] });
  await addPerson(w, { display_name: 'Hidden Harriet', visibility: 'private', memberships: [{ category_key: 'financially_irresponsible' }] });
  await addPerson(w, { display_name: 'Cass Pixel', accounts: [{ provider: 'x', handle: 'casspixel' }], memberships: [{ category_key: 'mutual_enablers', featured: true, label: 'pixel art', reason: 'Makes the internet feel handmade.' }] });
  const ep = (await w.call('POST', '/admin/episodes', { number: 7, title: 'TEST EPISODE' })).data.id;
  await w.call('POST', '/admin/contributions', { contributor_id: sup, episode_id: ep, role: 'Editor' });
  await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
});

after(async () => { await browser?.close(); apiSrv?.close(); webSrv?.close(); w?.restore(); });

async function open(url, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, errors };
}

test('14. public pages load without errors and fit a 375px phone', async () => {
  for (const p of ['/credits/', '/credits/episodes/', '/credits/episodes/?ep=7', '/credits/creators/', '/credits/hall-of-fame/', '/credits/join/', '/credits/privacy/', '/credits/admin/']) {
    const { page, errors } = await open(web + p, { width: 375, height: 800 });
    await page.waitForTimeout(400);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 375, `${p} scrolls sideways (${sw}px)`);
    assert.deepEqual(errors, [], `${p} console errors`);
    await page.close();
  }
});

test('7. the Hall shows consented people only, plus real Beans', async () => {
  const { page } = await open(web + '/credits/');
  await page.waitForSelector('#supporters .name-card');
  const text = await page.textContent('body');
  assert.ok(text.includes('Ada Beanworth') && text.includes('小豆 Azuki 🫘') && text.includes('Cass Pixel'));
  assert.ok(!text.includes('Hidden Harriet'));
  assert.ok(text.includes('@cowfartcop'));
  assert.ok(text.includes('SELF-REPORTED'));
  const link = await page.$$eval('a[target=_blank]', (as) => as.map((a) => a.rel));
  assert.ok(link.every((r) => r.includes('noopener') && r.includes('noreferrer')));
  await page.close();
});

test('12. the archive page shows the finalised record and replays it', async () => {
  const { page, errors } = await open(web + '/credits/episodes/?ep=7');
  await page.waitForSelector('#player:not([hidden])');
  const text = await page.textContent('#d-body');
  assert.ok(text.includes('Ada Beanworth') && text.includes('EDITOR'));
  assert.ok(text.includes('@cowfartcop'));
  const lit = await page.evaluate(() => { const c = document.getElementById('cv'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n; });
  assert.ok(lit > 50, 'player canvas is drawing');
  assert.deepEqual(errors, []);
  await page.close();
});

test('13. join form files a request that stays unpublished until reviewed', async () => {
  const { page } = await open(web + '/credits/join/');
  await page.fill('#display_name', 'Browser Ben');
  await page.selectOption('#contribution', 'arcade');
  await page.check('#age_ok');
  await page.waitForTimeout(3100);                               // the form's anti-bot minimum
  await page.click('#submit');
  await page.waitForSelector('.receipt');
  const ref = await page.textContent('.receipt code');
  assert.match(ref, /^CR-/);
  const subs = (await w.call('GET', '/admin/submissions')).data.submissions;
  assert.ok(subs.some((s) => s.display_name === 'Browser Ben'));
  assert.ok(!JSON.stringify((await w.call('GET', '/public/hall', undefined, { token: null })).data).includes('Browser Ben'));
  await page.close();
});

test('9. admin: nothing loads without a valid token', async () => {
  const { page } = await open(web + '/credits/admin/');
  assert.equal(await page.isVisible('#app'), false);
  await page.fill('#token', 'definitely-not-the-token-definitely-not');
  await page.click('#signin button[type=submit]');
  await page.waitForSelector('#gate-err:not([hidden])');
  assert.equal(await page.isVisible('#app'), false);
  await page.fill('#token', TOKEN);
  await page.click('#signin button[type=submit]');
  await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.isVisible('#gate'), false);
  await page.close();
});

async function signedIn(hash) {
  const r = await open(web + '/credits/admin/');
  await r.page.fill('#token', TOKEN);
  await r.page.click('#signin button[type=submit]');
  await r.page.waitForSelector('#app:not([hidden])');
  await r.page.evaluate((h) => { location.hash = h; }, hash);
  return r;
}

test('8/10. admin creates an episode and the preview reflects saved data', async () => {
  const { page, errors } = await signedIn('#produce');
  await page.click('text=+ NEW EPISODE');
  await page.fill('form.drawer input[name=number]', '8');
  await page.fill('form.drawer input[name=title]', 'MADE IN THE BROWSER');
  await page.click('form.drawer button[type=submit]');
  await page.waitForSelector('.report .sec');
  await page.waitForFunction(() => location.hash.startsWith('#produce/') && document.querySelector('.report .sec'));
  const report = await page.textContent('.report');
  assert.ok(report.includes('Ada Beanworth'));
  assert.ok(report.includes('@cowfartcop'));
  const eps = (await w.call('GET', '/admin/episodes')).data.episodes;
  assert.ok(eps.some((e) => e.number === 8 && e.title === 'MADE IN THE BROWSER'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('10/11. preview and export draw identical frames from the same sequence', async () => {
  const seq = (await w.call('GET', '/public/episodes/7/sequence', undefined, { token: null })).data.sequence;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(web + '/credits/render/index.html');
  await page.waitForFunction(() => window.__creditsReady);
  await page.evaluate((s) => window.__credits.load(s), seq);
  const hashes = await page.evaluate(async (s) => {
    const { CreditsPlayer } = await import('/credits/engine/player.js');
    const out = [];
    for (const t of [1.5, 6.2, 14.0, s.duration - 0.5]) {
      const b64 = await window.__credits.frame(Math.round(t * s.fps), false);
      const c = document.createElement('canvas');
      const p = new CreditsPlayer(c); p.load(s); p.seek(Math.round(t * s.fps) / s.fps);
      const a = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
      const bb = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const h = async (u) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map((x) => x.toString(16).padStart(2, '0')).join('');
      out.push([await h(a), await h(bb)]);
    }
    return out;
  }, seq);
  for (const [a, b] of hashes) assert.equal(a, b);
  await page.close();
});

test('15/16. names stay ≥ 40px at 1080p in every theme, including empty and crowded episodes', async () => {
  const { selectCredits } = await import('../../credits/engine/selection.js');
  const { buildSequence } = await import('../../credits/engine/sequence.js');
  const { CATEGORIES } = await import('../../credits-api/test/fixtures.js');
  const many = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: i % 3 ? `Supporter Number ${i} 🫘` : `Ünïcødé Wolfeschlegelsteinhausenberger ${i}`, visibility: 'public', consentPublic: 1, handles: {},
    memberships: [{ category: i % 2 ? 'financially_irresponsible' : 'voluntary_witnesses', status: 'active' }], lastShown: null, timesShown: 0 }));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(web + '/credits/render/index.html');
  await page.waitForFunction(() => window.__creditsReady);
  for (const theme of ['terminal', 'midnight', 'beans']) {
    for (const people of [many, []]) {
      const sel = selectCredits({ episode: { number: 1 }, categories: CATEGORIES, people, seed: 's', leaderboard: people.length ? null : { entries: [], topN: 5 } });
      const { sequence } = buildSequence(sel, { number: 1, title: 'LEGIBILITY' }, { theme, emptyCategories: 'card' }, { categories: CATEGORIES });
      const names = new Set(sequence.segments.flatMap((s) => s.pages.flatMap((p) => p.items.map((i) => i.name))));
      const sizes = await page.evaluate(async ([s, names]) => {
        const { renderFrame } = await import('/credits/engine/themes.js');
        const { timeline, cardTime } = await import('/credits/engine/sequence.js');
        const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const ctx = c.getContext('2d');
        const seen = []; const orig = ctx.fillText.bind(ctx);
        ctx.fillText = (txt, x, y) => { if (names.some((n) => n && String(txt).length > 2 && (n.startsWith(String(txt).replace('…', '')) || String(txt).replace('…', '').startsWith(n)))) seen.push(parseInt(/(\d+)px/.exec(ctx.font)[1], 10)); return orig(txt, x, y); };
        for (const e of timeline(s)) renderFrame(ctx, s, cardTime(e), {});
        return seen;
      }, [sequence, [...names]]);
      if (people.length) assert.ok(sizes.length > 10, `${theme}: names drawn`);
      assert.ok(sizes.every((z) => z >= 40), `${theme}: smallest name ${Math.min(...sizes)}px`);
    }
  }
  await page.close();
});

test('11. a complete sequence renders to a valid H.264 MP4 with the local command', { timeout: 300_000 }, async () => {
  const seq = (await w.call('GET', '/public/episodes/7/sequence', undefined, { token: null })).data.sequence;
  for (const s of seq.segments) s.duration = s.kind === 'final' ? 4 : 1;      // short, but every segment
  seq.duration = seq.segments.reduce((a, s) => a + s.duration, 0);
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'credits-test-'));
  await fsp.writeFile(path.join(dir, 'seq.json'), JSON.stringify(seq));
  execFileSync(process.execPath, [path.join(ROOT, 'credits-render/render.mjs'), '--sequence', path.join(dir, 'seq.json'), '--out', dir, '--formats', 'mp4,cards'], { stdio: 'pipe', timeout: 280_000 });
  const mp4 = (await fsp.readdir(dir)).find((f) => f.endsWith('.mp4'));
  const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,pix_fmt:format=duration', '-of', 'json', path.join(dir, mp4)], { encoding: 'utf8' }).stdout);
  const v = probe.streams.find((s) => s.codec_name === 'h264');
  assert.ok(v, 'has H.264'); assert.equal(v.width, 1920); assert.equal(v.height, 1080); assert.equal(v.pix_fmt, 'yuv420p');
  assert.ok(probe.streams.some((s) => s.codec_name === 'aac'), 'has audio');
  assert.ok(Math.abs(Number(probe.format.duration) - seq.duration) < 0.1);
  assert.equal((await fsp.readdir(path.join(dir, 'cards'))).length, seq.segments.reduce((a, s) => a + s.pages.length, 0));
  await fsp.rm(dir, { recursive: true, force: true });
});

test('1. arcade games still load and run without errors', async () => {
  for (const g of ['stoopid_snake.html', 'stoopid_defense.html', 'stoopid_clash.html', 'stoopid_trail.html', 'stoopid_mine.html', 'stoopid_press_me_cube.html', 'stoopid_signal_coin.html']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());     // offline: games must not depend on the network to start
    await page.goto(`${web}/${g}`, { waitUntil: 'load' });
    await page.keyboard.press('Space'); await page.mouse.click(640, 400);
    await page.waitForTimeout(700);
    assert.deepEqual(errors, [], g);
    assert.ok(await page.$('canvas, svg, button'), `${g} renders something`);
    await page.close();
  }
});

test('1/2. no arcade, Beans or existing tool file was modified by the credits work', () => {
  // --diff-filter=a: new tools may be added; existing ones must not change or disappear
  const r = spawnSync('git', ['-C', ROOT, 'diff', '--name-only', '--diff-filter=a', 'origin/main', '--', 'stoopid_*.html', 'registry', 'ask-dev', 'ask-dev-api', 'brand', 'cinematic'], { encoding: 'utf8' });
  if (r.status !== 0) return;                                                  // no git history available (e.g. tarball); skip
  assert.equal(r.stdout.trim(), '', 'changed: ' + r.stdout);
});

test('18. no secrets or private fields in client-side files', async () => {
  const files = [];
  const walk = async (d) => { for (const e of await fsp.readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? await walk(p) : files.push(p); } };
  await walk(path.join(ROOT, 'credits'));
  for (const f of files) {
    const t = await fsp.readFile(f, 'utf8');
    assert.ok(!/ADMIN_TOKEN\s*[:=]\s*['"][^'"]{8,}/.test(t), f);
    assert.ok(!/(sk|pk|ghp|xox[bp])_[A-Za-z0-9]{16,}/.test(t), f);
    assert.ok(!t.includes(TOKEN), f);
  }
});

test('in-browser exports: PNG-card ZIP and realtime recording produce valid files', { timeout: 120_000 }, async () => {
  const seq = (await w.call('GET', '/public/episodes/7/sequence', undefined, { token: null })).data.sequence;
  for (const s of seq.segments) s.duration = 1.2;
  seq.duration = seq.segments.reduce((a, s) => a + s.duration, 0);
  const page = await browser.newPage();
  await page.goto(web + '/credits/render/index.html');
  const r = await page.evaluate(async (s) => {
    const { exportCards, recordRealtime } = await import('/credits/engine/export.js');
    const b64 = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let x = ''; for (let i = 0; i < u.length; i += 0x8000) x += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(x); };
    const zip = await exportCards(s, { transparent: true });
    const rec = await recordRealtime(s);
    return { zip: await b64(zip), rec: await b64(rec.blob), type: rec.type };
  }, seq);
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'credits-zip-'));
  const zf = path.join(dir, 'cards.zip');
  await fsp.writeFile(zf, Buffer.from(r.zip, 'base64'));
  const list = spawnSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("\\n".join(z.namelist()))', zf], { encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  const names = list.stdout.trim().split('\n');
  assert.ok(names.includes('sequence.json'));
  assert.equal(names.filter((n) => n.endsWith('_alpha.png')).length, seq.segments.reduce((a, s) => a + s.pages.length, 0));
  const vf = path.join(dir, r.type.includes('mp4') ? 'rec.mp4' : 'rec.webm');
  await fsp.writeFile(vf, Buffer.from(r.rec, 'base64'));
  const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', vf], { encoding: 'utf8' }).stdout);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  assert.equal(v.width, 1920); assert.equal(v.height, 1080);
  console.log(`# realtime recorder produced ${r.type}`);
  await fsp.rm(dir, { recursive: true, force: true });
  await page.close();
});

test('join page: “Verify with YouTube” appears only when switched on, goes to Google, reports back', { timeout: 60_000 }, async () => {
  w.env.GOOGLE_CLIENT_ID = 'client-123.apps.googleusercontent.com'; w.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  try {
    const page = await browser.newPage();
    let googleUrl = null;
    await page.route('https://accounts.google.com/**', (r) => { googleUrl = r.request().url(); r.fulfill({ status: 200, body: 'google' }); });
    await page.goto(web + '/credits/join/', { waitUntil: 'networkidle' });
    assert.equal(await page.isVisible('#m-yt'), true);
    await page.fill('#display_name', 'Tube Tester');
    await page.selectOption('#contribution', 'youtube_witness');
    await page.check('#age_ok');
    await page.waitForTimeout(3100);
    await page.click('#submit');
    await page.waitForSelector('text=VERIFY WITH YOUTUBE');
    await page.click('#yt-offer button');
    await page.waitForURL(/accounts\.google\.com/);
    const u = new URL(googleUrl);
    assert.equal(u.searchParams.get('client_id'), 'client-123.apps.googleusercontent.com');
    assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.readonly');
    await page.goto(web + '/credits/join/#yt=verified', { waitUntil: 'networkidle' });
    assert.match(await page.textContent('#yt-result'), /VERIFIED/);
    assert.equal(await page.isVisible('.receipt'), true, 'receipt restored after the round trip');
    await page.close();
  } finally { delete w.env.GOOGLE_CLIENT_ID; delete w.env.GOOGLE_CLIENT_SECRET; }
});
