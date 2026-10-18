// THE CREDITS DEPARTMENT — Cloudflare Worker.
// Official Department of Unnecessary Appreciation. All appreciation is sincere; all endpoints are audited.
//
//   /public/*  approved, consented data only (open CORS for GETs, allowed origins for POSTs)
//   /admin/*   Bearer ADMIN_TOKEN, allowed origins only
//   cron       daily copy of the Beans feed + integration health

import { json, corsHeaders, HttpError, fail, readJson, int } from './lib.js';
import { requireAdmin } from './auth.js';
import * as P from './public.js';
import * as A from './admin.js';
import { liveFeed, recordHistory } from './beans.js';

const routes = [];
const on = (method, pattern, handler, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, ...opts });

// public
on('GET', '/public/health', async (c) => json({ ok: true, service: 'stoopid-credits', db: !!(await c.env.DB.prepare('SELECT 1 AS x').first()) }));
on('GET', '/public/hall', (c) => P.hall(c.env));
on('GET', '/public/creators', (c) => P.creators(c.env));
on('GET', '/public/hall-of-fame', (c) => P.hallOfFame(c.env));
on('GET', '/public/episodes', (c) => P.episodes(c.env, c.url));
on('GET', '/public/episodes/:n', (c) => P.episode(c.env, int(c.p.n), c.url));
on('GET', '/public/episodes/:n/sequence', (c) => P.episodeSequence(c.env, int(c.p.n), c.url));
on('GET', '/public/beans', (c) => P.beans(c.env, c.url));
on('POST', '/public/join', (c) => P.join(c.req, c.env), { origin: true });
on('POST', '/public/withdraw', (c) => P.withdraw(c.req, c.env), { origin: true });
on('POST', '/public/update', (c) => P.update(c.req, c.env), { origin: true });
on('POST', '/public/status', (c) => P.status(c.req, c.env), { origin: true });

// admin
const ad = (method, pattern, handler, opts = {}) => on(method, pattern, handler, { admin: true, ...opts });
ad('GET', '/admin/me', (c) => json({ ok: true, actor: c.actor }));
ad('GET', '/admin/overview', (c) => A.overview(c.env));
ad('GET', '/admin/contributors', (c) => A.listContributors(c.env, c.url));
ad('POST', '/admin/contributors', async (c) => json({ ok: true, id: await A.createContributor(c.env, await c.body(), c.actor) }, 201));
ad('GET', '/admin/contributors/:id', (c) => A.getContributor(c.env, int(c.p.id)));
ad('PUT', '/admin/contributors/:id', async (c) => A.updateContributor(c.env, int(c.p.id), await c.body(), c.actor));
ad('DELETE', '/admin/contributors/:id', (c) => A.eraseContributor(c.env, int(c.p.id), c.actor));
ad('GET', '/admin/contributors/:id/export', (c) => A.exportContributor(c.env, int(c.p.id)));
ad('POST', '/admin/contributors/:id/merge', async (c) => A.mergeContributor(c.env, int(c.p.id), int((await c.body()).into), c.actor));
ad('PUT', '/admin/contributors/:id/memberships/:key', async (c) => A.setMembership(c.env, int(c.p.id), c.p.key, await c.body(), c.actor));
ad('DELETE', '/admin/contributors/:id/memberships/:key', (c) => A.removeMembership(c.env, int(c.p.id), c.p.key, c.actor));
ad('POST', '/admin/contributors/:id/accounts', async (c) => A.postAccount(c.env, int(c.p.id), await c.body(), c.actor));
ad('DELETE', '/admin/accounts/:id', (c) => A.deleteAccount(c.env, int(c.p.id), c.actor));
ad('POST', '/admin/contributions', async (c) => A.postContribution(c.env, await c.body(), c.actor));
ad('DELETE', '/admin/contributions/:id', (c) => A.deleteContribution(c.env, int(c.p.id), c.actor));
ad('GET', '/admin/categories', (c) => A.listCategories(c.env));
ad('PUT', '/admin/categories/:key', async (c) => A.putCategory(c.env, c.p.key, await c.body(), c.actor));
ad('GET', '/admin/settings', (c) => A.getSettingsAdmin(c.env));
ad('PUT', '/admin/settings', async (c) => A.putSettings(c.env, await c.body(), c.actor));
ad('GET', '/admin/episodes', (c) => A.listEpisodes(c.env));
ad('POST', '/admin/episodes', async (c) => A.createEpisode(c.env, await c.body(), c.actor));
ad('GET', '/admin/episodes/:id', (c) => A.getEpisode(c.env, int(c.p.id)));
ad('PUT', '/admin/episodes/:id', async (c) => A.updateEpisode(c.env, int(c.p.id), await c.body(64 * 1024), c.actor));
ad('POST', '/admin/episodes/:id/preview', async (c) => A.previewEpisode(c.env, int(c.p.id), await c.body(64 * 1024)));
ad('POST', '/admin/episodes/:id/snapshot', async (c) => A.snapshotEpisode(c.env, int(c.p.id), await c.body(), c.actor));
ad('POST', '/admin/episodes/:id/finalize', async (c) => A.finalizeEpisode(c.env, int(c.p.id), await c.body(), c.actor));
ad('GET', '/admin/versions/:id', (c) => A.getVersion(c.env, int(c.p.id)));
ad('GET', '/admin/beans', (c) => A.beansAdmin(c.env));
ad('PUT', '/admin/beans/rules/:handle', async (c) => A.putBeansRule(c.env, c.p.handle, await c.body(), c.actor));
ad('DELETE', '/admin/beans/rules/:handle', (c) => A.deleteBeansRule(c.env, c.p.handle, c.actor));
ad('POST', '/admin/beans/backfill', (c) => A.backfill(c.env, c.actor));
ad('POST', '/admin/beans/record', (c) => A.recordNow(c.env, c.actor));
ad('GET', '/admin/submissions', (c) => A.listSubmissions(c.env, c.url));
ad('POST', '/admin/submissions/:id/approve', async (c) => A.approveSubmission(c.env, int(c.p.id), await c.body(), c.actor));
ad('POST', '/admin/submissions/:id/reject', async (c) => A.rejectSubmission(c.env, int(c.p.id), await c.body(), c.actor));
for (const t of A.TABLE_NAMES) {
  ad('GET', `/admin/${t}`, (c) => A.listTable(c.env, t));
  ad('POST', `/admin/${t}`, async (c) => A.saveRow(c.env, t, null, await c.body(), c.actor));
  ad('PUT', `/admin/${t}/:id`, async (c) => A.saveRow(c.env, t, int(c.p.id), await c.body(), c.actor));
  ad('DELETE', `/admin/${t}/:id`, (c) => A.deleteRow(c.env, t, int(c.p.id), c.actor));
}
ad('POST', '/admin/import', async (c) => A.importCsv(c.env, await c.body(2 * 1024 * 1024), c.actor));
ad('GET', '/admin/imports', (c) => A.listImports(c.env));
ad('GET', '/admin/export', (c) => A.exportAll(c.env, c.url));
ad('GET', '/admin/audit', (c) => A.auditLog(c.env, c.url));
ad('GET', '/admin/integrations', (c) => A.integrations(c.env));
ad('POST', '/admin/integrations/:provider/check', (c) => A.checkIntegration(c.env, c.p.provider));

export async function handle(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const isAdmin = path.startsWith('/admin');
  const openCors = !isAdmin && req.method === 'GET';
  const cors = corsHeaders(req, env, { open: openCors });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  let res;
  try {
    const match = routes.map((r) => ({ r, m: r.method === req.method && r.re.exec(path) })).find((x) => x.m);
    if (!match) {
      const exists = routes.some((r) => r.re.test(path));
      fail(exists ? 405 : 404, exists ? 'Method not allowed.' : 'Not found. The department has no such office.');
    }
    const { r, m } = match;
    const origin = req.headers.get('origin');
    if ((r.origin || r.admin) && origin && !cors['access-control-allow-origin']) fail(403, 'This origin is not allowed.');
    const c = { req, env, url, p: m.groups || {}, body: (max) => readJson(req, max), actor: null };
    if (r.admin) c.actor = (await requireAdmin(req, env)).actor;
    res = await r.handler(c);
  } catch (e) {
    if (e instanceof HttpError) res = json({ ok: false, error: e.message, ...(e.extra || {}) }, e.status);
    else { console.error('credits-api error', e && e.stack || e); res = json({ ok: false, error: 'The department had a glitch. Nothing was published.' }, 500); }
  }
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  if (isAdmin) h.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, headers: h });
}

/** Daily: copy the Beans feed into history (the only source for weekly/monthly views). Failures are visible in Integrations. */
export async function scheduled(env) {
  const r = await liveFeed(env);
  if (r) await recordHistory(env, r.feed, r.raw, 'cron');
  await env.DB.prepare('DELETE FROM rate_limits WHERE hour < ?').bind(Math.floor(Date.now() / 3_600_000) - 48).run();
  return !!r;
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (_event, env, ctx) => ctx.waitUntil(scheduled(env)),
};
