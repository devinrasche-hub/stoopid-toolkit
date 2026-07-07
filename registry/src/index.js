// STOOPID SIGNAL REGISTRY — global hi-scores for STOOPID DEFENSE
// all scores are self-reported. like engagement.

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

async function ipHash(ip) {
  const data = new TextEncoder().encode("stoopid-grid-salt::" + ip);
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
        if (!body) return json({ ok: false, error: "bad json" }, 400);

        let { name, score, wave } = body;
        name = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
        score = Math.floor(Number(score));
        wave = Math.floor(Number(wave));

        if (name.length < 1 || !Number.isFinite(score) || !Number.isFinite(wave))
          return json({ ok: false, error: "bad fields" }, 400);
        // plausibility gate — the registry is trusting, not gullible
        if (score < 0 || wave < 1 || wave > 99 || score > 250000 || score > wave * 3000 + 5000)
          return json({ ok: false, error: "the registry doubts you" }, 422);

        const iph = await ipHash(req.headers.get("cf-connecting-ip") || "0");
        const hour = Math.floor(Date.now() / 3600000);
        const rl = await env.DB.prepare(
          "SELECT COUNT(*) AS cnt FROM scores WHERE iph=?1 AND hour=?2"
        ).bind(iph, hour).first();
        if (rl.cnt >= 12)
          return json({ ok: false, error: "rate limited. protect your peace." }, 429);

        await env.DB.prepare(
          "INSERT INTO scores (name, score, wave, ts, iph, hour) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        ).bind(name, score, wave, Date.now(), iph, hour).run();

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
