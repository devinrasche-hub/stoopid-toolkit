// STOOPID SIGNAL REGISTRY — global hi-scores for STOOPID DEFENSE
// all scores are self-reported. like engagement.

import { validateSubmission } from "./validate.js";
import { RATE_LIMITED_INSERT } from "./sql.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

function json(obj, status = 200, cacheSec = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json",
      ...(cacheSec ? { "cache-control": "public, max-age=" + cacheSec } : {})
    }
  });
}

async function ipHash(ip, env) {
  // salt lives in a Worker secret (wrangler secret put IP_SALT), not in the repo
  const salt = (env && env.IP_SALT) || "stoopid-grid-salt";
  const data = new TextEncoder().encode(salt + "::" + ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (req.method === "GET" && url.pathname === "/top") {
        const n = Math.min(100, Math.max(1, parseInt(url.searchParams.get("n") || "25", 10) || 25));
        const { results } = await env.DB.prepare(
          "SELECT name, score, wave, ts FROM scores ORDER BY score DESC, ts ASC LIMIT ?1"
        ).bind(n).all();
        return json({ ok: true, top: results }, 200, 30);
      }

      if (req.method === "POST" && url.pathname === "/submit") {
        const body = await req.json().catch(() => null);
        const v = validateSubmission(body);
        if (!v.ok) return json({ ok: false, error: v.error }, v.status);
        const { name, score, wave } = v;

        const iph = await ipHash(req.headers.get("cf-connecting-ip") || "0", env);
        const hour = Math.floor(Date.now() / 3600000);
        const ins = await env.DB.prepare(RATE_LIMITED_INSERT)
          .bind(name, score, wave, Date.now(), iph, hour).run();
        if (!ins.meta || ins.meta.changes < 1)
          return json({ ok: false, error: "rate limited. protect your peace." }, 429);

        const r = await env.DB.prepare(
          "SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?1"
        ).bind(score).first();

        return json({ ok: true, rank: r.rank });
      }

      return json({ ok: false, error: "not found" }, 404);
    } catch (e) {
      return json({ ok: false, error: "registry glitch" }, 500);
    }
  }
};
