// Shared plumbing for the Credits API: responses, CORS, validation, rate limits, audit, settings.

import { DEFAULT_TIMING } from '../../credits/engine/sequence.js';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

export const now = () => new Date().toISOString();

export function origins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(req, env, { open = false } = {}) {
  const origin = req.headers.get('origin');
  const allowed = origins(env);
  const h = { 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,x-admin-name', 'access-control-max-age': '600', vary: 'origin' };
  if (origin && allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  else if (open) h['access-control-allow-origin'] = '*';
  return h;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...headers } });
}

export async function readJson(req, maxBytes = 16 * 1024) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) fail(413, 'Request too large.');
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'Request too large.');
  try { const v = JSON.parse(text || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; }
  catch { fail(400, 'Body must be a JSON object.'); }
}

export const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);
export const int = (v, d = 0) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : d; };
export const oneOf = (v, list, d) => (list.includes(v) ? v : d);
export const isoDate = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ipHash(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  return (await sha256hex((env.IP_SALT || 'stoopid-credits-salt') + '::' + ip)).slice(0, 20);
}

/** Fixed-window limiter in D1. Returns true when the call is allowed. */
export async function rateLimit(env, bucket, iph, max) {
  const hour = Math.floor(Date.now() / 3_600_000);
  await env.DB.prepare('INSERT INTO rate_limits (bucket, iph, hour, hits) VALUES (?, ?, ?, 1) ON CONFLICT(bucket, iph, hour) DO UPDATE SET hits = hits + 1')
    .bind(bucket, iph, hour).run();
  const row = await env.DB.prepare('SELECT hits FROM rate_limits WHERE bucket = ? AND iph = ? AND hour = ?').bind(bucket, iph, hour).first();
  return (row?.hits || 0) <= max;
}

export function randomToken(n = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function audit(env, actor, action, entity, entityId, detail) {
  await env.DB.prepare('INSERT INTO audit_log (at, actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(now(), actor, action, entity, entityId == null ? null : String(entityId), detail == null ? null : JSON.stringify(detail)).run();
}

// ── settings ──
export const DEFAULT_SETTINGS = {
  timing: {
    theme: DEFAULT_TIMING.theme, fps: DEFAULT_TIMING.fps, identSeconds: DEFAULT_TIMING.identSeconds, finalSeconds: DEFAULT_TIMING.finalSeconds,
    minPageSeconds: DEFAULT_TIMING.minPageSeconds, overflow: DEFAULT_TIMING.overflow, emptyCategories: DEFAULT_TIMING.emptyCategories,
    endCard: DEFAULT_TIMING.endCard, audio: true, archiveUrl: DEFAULT_TIMING.archiveUrl,
  },
  leaderboard_top_n: 5,
  dedupe: true,
  hall_supporters_shown: 24,
  beans_auto_approve: true,
  name_blocklist: ['fuck', 'shit', 'cunt', 'nazi', 'porn', 'xxx', 'rape', 'kill'],
  episode_title_format: 'EP {number} — {title}',
  archive_public: true,
  join_open: true,
  export_formats: ['mp4', 'cards'],
  links: {
    youtube: 'https://youtube.com/@STOOPIDshow',
    x: 'https://x.com/STOOPIDshow',
    arcade: 'https://www.stoopidtv.com/arcade',
    episodes: 'https://www.stoopidtv.com/episodes',
  },
};

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value_json FROM settings').all();
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const r of results || []) {
    try {
      const v = JSON.parse(r.value_json);
      s[r.key] = v && typeof v === 'object' && !Array.isArray(v) && typeof s[r.key] === 'object' && !Array.isArray(s[r.key]) ? { ...s[r.key], ...v } : v;
    } catch { /* ignore a corrupt row; defaults stand */ }
  }
  return s;
}

export async function setIntegration(env, provider, ok, detail) {
  const t = now();
  if (ok) await env.DB.prepare("UPDATE integrations SET status = 'ok', detail = COALESCE(?, detail), last_checked = ?, last_ok = ?, last_error = NULL WHERE provider = ?").bind(detail ?? null, t, t, provider).run();
  else await env.DB.prepare("UPDATE integrations SET status = 'error', last_checked = ?, last_error = ? WHERE provider = ?").bind(t, String(detail).slice(0, 500), provider).run();
}

/** Label for the audit log; defaults to "admin". */
export function cleanActor(s) {
  const v = String(s || '').replace(/[^\w .@-]/g, '').trim().slice(0, 40);
  return v || 'admin';
}
