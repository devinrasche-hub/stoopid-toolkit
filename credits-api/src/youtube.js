// OPTIONAL: "Verify with YouTube" for VOLUNTARY WITNESSES.
// A viewer who filed a join request can sign in with Google once; the Worker asks YouTube whether
// *that viewer* subscribes to the show's channel (subscriptions.list?mine=true&forChannelId=…), then
// immediately revokes the token. Nothing from Google is stored except the yes/no result and its time.
//
// Off unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set (see docs/credits-integrations.md).

import { json, fail, readJson, now, origins, rateLimit, ipHash, audit } from './lib.js';

export const DEFAULT_CHANNEL = 'UC9vFe9XBT7lrvJ-uU4zjqtw';          // youtube.com/@STOOPIDshow ("STOOPID")
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const SUBS = 'https://www.googleapis.com/youtube/v3/subscriptions';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const STATE_TTL_MS = 15 * 60 * 1000;

export const enabled = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const channel = (env) => env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL;
const redirectUri = (url) => `${url.origin}/public/youtube/callback`;
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode('yt-state::' + env.GOOGLE_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signState(env, payload) {
  const body = b64u(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(body)));
  return `${body}.${b64u(sig)}`;
}
async function readState(env, state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(env), unb64u(sig), new TextEncoder().encode(body)); } catch { return null; }
  if (!ok) return null;
  try { const p = JSON.parse(new TextDecoder().decode(unb64u(body))); return p.exp > Date.now() ? p : null; } catch { return null; }
}

/** Where to send the viewer back to: only pages on an allowed origin. */
function safeReturn(env, ret) {
  try { const u = new URL(ret); if (origins(env).includes(u.origin)) return u.origin + u.pathname; } catch {}
  const first = origins(env)[0];
  return first ? `${first}/stoopid-toolkit/credits/join/` : null;
}

/** POST /public/youtube/start { ref, key, return } → { url } to send the browser to Google. */
export async function start(req, env, url, verifyKey) {
  if (!enabled(env)) fail(404, 'YouTube verification is not switched on.');
  const b = await readJson(req);
  if (!(await rateLimit(env, 'yt-start', await ipHash(req, env), 10))) fail(429, 'Too many attempts this hour.');
  const s = await verifyKey(env, b.ref, b.key);
  if (s.status === 'withdrawn' || s.status === 'rejected') fail(409, 'This request is closed.');
  const state = await signState(env, { ref: s.ref, ret: safeReturn(env, b.return), exp: Date.now() + STATE_TTL_MS });
  const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(url), response_type: 'code', scope: SCOPE,
    access_type: 'online', include_granted_scopes: 'false', prompt: 'select_account', state });
  return json({ ok: true, url: `${AUTH}?${q}` });
}

/** GET /public/youtube/callback?code&state — Google sends the viewer here. Always redirects back to the join page. */
export async function callback(env, url) {
  const st = enabled(env) ? await readState(env, url.searchParams.get('state')) : null;
  const back = (result) => new Response(null, { status: 302, headers: { location: `${(st && st.ret) || safeReturn(env, '') || '/'}#yt=${result}`, 'cache-control': 'no-store' } });
  if (!st) return back('expired');
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code) return back('error');
  let token = null;
  try {
    const t = await fetch(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(url), grant_type: 'authorization_code' }) });
    if (!t.ok) throw new Error(`token HTTP ${t.status}`);
    token = (await t.json()).access_token;
    if (!token) throw new Error('no access token');
    const r = await fetch(`${SUBS}?${new URLSearchParams({ part: 'id', mine: 'true', forChannelId: channel(env), maxResults: '1' })}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`subscriptions HTTP ${r.status}`);
    const items = (await r.json()).items;
    const result = Array.isArray(items) && items.length > 0 ? 'subscribed' : 'not_subscribed';
    await record(env, st.ref, result);
    return back(result === 'subscribed' ? 'verified' : 'not-subscribed');
  } catch (e) {
    console.error('youtube verify failed', e && e.message);
    return back('error');
  } finally {
    if (token) fetch(REVOKE, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }).catch(() => {});
  }
}

async function record(env, ref, result) {
  const t = now();
  await env.DB.prepare('UPDATE submissions SET yt_status = ?, yt_checked_at = ? WHERE ref = ? OR parent_ref = ?').bind(result, t, ref, ref).run();
  const s = await env.DB.prepare('SELECT contributor_id, status FROM submissions WHERE ref = ?').bind(ref).first();
  // Already approved → upgrade the existing membership from self-reported to verified (never the other way).
  if (result === 'subscribed' && s?.contributor_id && s.status === 'approved') {
    await env.DB.prepare("UPDATE category_memberships SET verification = 'verified', updated_at = ? WHERE contributor_id = ? AND category_key = 'voluntary_witnesses' AND verification != 'verified'").bind(t, s.contributor_id).run();
  }
  await audit(env, 'self', 'youtube_check', 'submission', ref, { result });
}
