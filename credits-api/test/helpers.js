// Test harness: a D1-compatible shim over node:sqlite running the real migration, plus a fetch stub
// for the Beans feed. Lets the Worker be exercised end to end without Cloudflare.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handle, scheduled } from '../src/index.js';
import { DEFAULT_FEED_URL } from '../src/beans.js';

const MIGRATION = fs.readFileSync(fileURLToPath(new URL('../migrations/0001_credits_init.sql', import.meta.url)), 'utf8');
const conv = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.db, this.sql, p.map(conv)); }
  async all() { return { success: true, results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) }; }
  async first(col) { const r = this.db.prepare(this.sql).get(...this.params); return r === undefined ? null : col ? r[col] : { ...r }; }
  async run() { return this._run(); }
  _run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}

export function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(MIGRATION);
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map((s) => s._run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

export const TOKEN = 'test-admin-token-0123456789abcdefghijklmnop';
export const ORIGIN = 'https://devinrasche-hub.github.io';

/** A fresh world: database, env, and a controllable Beans feed. */
export function world(feedDoc) {
  const env = { DB: makeD1(), ADMIN_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, IP_SALT: 'test' };
  const state = { feed: structuredClone(feedDoc), feedStatus: 200, feedHits: 0, ip: '203.0.113.7', routes: new Map() };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === DEFAULT_FEED_URL) {
      state.feedHits++;
      if (state.feedStatus !== 200) return new Response('nope', { status: state.feedStatus });
      return new Response(typeof state.feed === 'string' ? state.feed : JSON.stringify(state.feed), { status: 200 });
    }
    if (state.routes.has(String(url))) return state.routes.get(String(url))();
    throw new Error(`unexpected network call in test: ${url}`);
  };
  const call = async (method, path, body, { token = TOKEN, origin = ORIGIN, headers = {} } = {}) => {
    const h = { 'cf-connecting-ip': state.ip, ...headers };
    if (origin) h.origin = origin;
    if (token) h.authorization = `Bearer ${token}`;
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await handle(new Request('https://credits.test' + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  return { env, state, call, scheduled: () => scheduled(env), restore: () => { globalThis.fetch = realFetch; } };
}

/** Add a contributor through the admin API and return its id. */
export async function addPerson(w, body) {
  const r = await w.call('POST', '/admin/contributors', { visibility: 'public', consent_public: true, ...body });
  if (r.status !== 201) throw new Error(`addPerson failed: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.id;
}
