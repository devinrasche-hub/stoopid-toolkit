// ASK DEV — request-for-quote intake for Dev's Magic Errands.
// Write-only: POST /request saves a request. There is no endpoint that reads requests back;
// Dev reads them in the Cloudflare dashboard (D1 → ask_dev_requests) or with wrangler.

const CATEGORIES = { local: "Local help", business: "Business help", creative: "Creative help", other: "Something else / not sure" };
const TIMELINES = { "": "", asap: "As soon as possible", weeks: "Within a couple of weeks", flexible: "I'm flexible", exploring: "Just exploring" };
const PREFS = { "": "", email: "Email", text: "Text", call: "Phone call" };

const LIMITS = { details: 4000, budget: 120, location: 120, name: 100, contact: 200 };
const MIN_FILL_MS = 3000;      // faster than this is a bot
const MAX_PER_HOUR = 6;        // per IP

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function contactType(v) {
  const s = String(v || "").trim();
  if (EMAIL_RE.test(s)) return "email";
  const digits = s.replace(/\D/g, "");
  if (/^[\d\s().+\-]+$/.test(s) && digits.length >= 10 && digits.length <= 15) return "phone";
  return "";
}

function clean(v, max) {
  return String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

// Returns { value } or { errors: { field: message } }. Mirrors the checks in ask-dev/index.html.
export function validate(body) {
  const errors = {};
  const r = {
    category: clean(body.category, 20),
    details: clean(body.details, LIMITS.details + 1),
    timeline: clean(body.timeline, 20),
    budget: clean(body.budget, LIMITS.budget + 1),
    location: clean(body.location, LIMITS.location + 1),
    name: clean(body.name, LIMITS.name + 1),
    contact: clean(body.contact, LIMITS.contact + 1),
    contact_pref: clean(body.contact_pref, 20),
  };
  if (!(r.category in CATEGORIES)) errors.category = "Pick what you need help with.";
  if (r.details.length < 5) errors.details = "Tell me a little about what you're trying to do.";
  if (!(r.timeline in TIMELINES)) errors.timeline = "Pick one of the options.";
  if (!(r.contact_pref in PREFS)) errors.contact_pref = "Pick one of the options.";
  if (!r.name) errors.name = "Add your name.";
  for (const f of ["details", "budget", "location", "name", "contact"])
    if (r[f].length > LIMITS[f]) errors[f] = `Keep this under ${LIMITS[f]} characters.`;

  r.contact_type = contactType(r.contact);
  if (!r.contact) errors.contact = "Add an email or phone number.";
  else if (!r.contact_type) errors.contact = "That doesn't look like an email or phone number.";
  else if (r.contact_pref === "email" && r.contact_type !== "email") errors.contact = "You picked email — add an email address.";
  else if ((r.contact_pref === "text" || r.contact_pref === "call") && r.contact_type !== "phone") errors.contact = "You picked text/call — add a phone number.";

  return Object.keys(errors).length ? { errors } : { value: r };
}

function makeId(now) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const tail = [...bytes].map(b => alphabet[b % alphabet.length]).join("");
  return `AD-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${tail}`;
}

async function ipHash(ip, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ask-dev::${salt}::${ip}`));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function cors(req, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  return {
    ok: allowed.includes(origin),
    headers: {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "null",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" },
  });
}

// ---------- notifications (best effort; the request is already saved) ----------

function summary(r) {
  return [
    `Request ${r.id}${r.is_test ? "  [TEST]" : ""}`,
    `Received: ${r.created_at}`,
    "",
    `Needs: ${CATEGORIES[r.category]}`,
    `When: ${TIMELINES[r.timeline] || "—"}`,
    `Budget: ${r.budget || "—"}`,
    `Location: ${r.location || "—"}`,
    "",
    `Name: ${r.name}`,
    `Contact: ${r.contact}  (prefers: ${PREFS[r.contact_pref] || "no preference"})`,
    "",
    "What they're trying to do:",
    r.details,
  ].join("\n");
}

async function notify(env, r) {
  const results = [];
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.NOTIFY_FROM || "Ask Dev <onboarding@resend.dev>",
          to: [env.NOTIFY_EMAIL],
          ...(r.contact_type === "email" ? { reply_to: r.contact } : {}),
          subject: `${r.is_test ? "[TEST] " : ""}Ask Dev: ${CATEGORIES[r.category]} — ${r.name} (${r.id})`,
          text: summary(r),
        }),
      });
      results.push(res.ok ? "email:sent" : `email:failed:${res.status}`);
    } catch {
      results.push("email:failed:network");
    }
  }
  if (env.NTFY_TOPIC) {
    // Push to Dev's phone via ntfy. Keeps personal details out of the push itself.
    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
        method: "POST",
        headers: { Title: `${r.is_test ? "[TEST] " : ""}New Ask Dev request`, Tags: "inbox_tray" },
        body: `${CATEGORIES[r.category]} · ${TIMELINES[r.timeline] || "no timeline given"} · ${r.id}`,
      });
      results.push(res.ok ? "push:sent" : `push:failed:${res.status}`);
    } catch {
      results.push("push:failed:network");
    }
  }
  const status = results.length ? results.join(" ") : "not-configured";
  try {
    await env.DB.prepare("UPDATE requests SET notify_status=?1 WHERE id=?2").bind(status, r.id).run();
  } catch {}
  return status;
}

// ---------- handler ----------

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const c = cors(req, env);

    if (req.method === "OPTIONS") return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
    if (url.pathname !== "/request") return json({ ok: false, error: "Not found." }, 404, c.headers);
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, c.headers);
    if (!c.ok) return json({ ok: false, error: "Not allowed from this site." }, 403, c.headers);
    if (!(req.headers.get("content-type") || "").includes("application/json"))
      return json({ ok: false, error: "Bad request." }, 415, c.headers);

    const raw = await req.text();
    if (raw.length > 20000) return json({ ok: false, error: "That's too long to send." }, 413, c.headers);
    let body;
    try { body = JSON.parse(raw); } catch { body = null; }
    if (!body || typeof body !== "object") return json({ ok: false, error: "Bad request." }, 400, c.headers);

    // Spam: honeypot field + minimum time on the form.
    if (clean(body.website, 200) || !(Number(body.elapsed_ms) >= MIN_FILL_MS))
      return json({ ok: false, error: "Something looked automated about that. Please try again." }, 422, c.headers);

    const clientKey = clean(body.client_key, 64);
    if (!/^[A-Za-z0-9-]{16,64}$/.test(clientKey)) return json({ ok: false, error: "Bad request." }, 400, c.headers);

    const v = validate(body);
    if (v.errors) return json({ ok: false, error: "Please fix the highlighted fields.", fields: v.errors }, 422, c.headers);
    const r = v.value;

    try {
      // Same form sent twice (double tap, retry after a dropped connection) → same request.
      const existing = await env.DB.prepare("SELECT id FROM requests WHERE client_key=?1").bind(clientKey).first();
      if (existing) return json({ ok: true, id: existing.id, duplicate: true }, 200, c.headers);

      const iph = await ipHash(req.headers.get("cf-connecting-ip") || "0", env.IP_SALT || "ask-dev");
      const hour = Math.floor(Date.now() / 3600000);
      const rl = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM requests WHERE iph=?1 AND hour=?2").bind(iph, hour).first();
      if (rl.cnt >= MAX_PER_HOUR)
        return json({ ok: false, error: "Lots of requests from here in the last hour. Please try again later." }, 429, c.headers);

      const now = new Date();
      Object.assign(r, {
        id: makeId(now),
        created_at: now.toISOString(),
        is_test: /^\s*\[?test\]?\b/i.test(r.name) ? 1 : 0,
      });

      await env.DB.prepare(
        `INSERT INTO requests (id, created_at, category, details, timeline, budget, location, name, contact,
           contact_type, contact_pref, is_test, client_key, iph, hour)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
      ).bind(r.id, r.created_at, r.category, r.details, r.timeline, r.budget, r.location, r.name, r.contact,
             r.contact_type, r.contact_pref, r.is_test, clientKey, iph, hour).run();

      // Saved. Notifications run after the response and can't undo the save.
      ctx.waitUntil(notify(env, r));
      return json({ ok: true, id: r.id }, 201, c.headers);
    } catch (e) {
      if (String(e && e.message).includes("UNIQUE")) {
        const again = await env.DB.prepare("SELECT id FROM requests WHERE client_key=?1").bind(clientKey).first().catch(() => null);
        if (again) return json({ ok: true, id: again.id, duplicate: true }, 200, c.headers);
      }
      console.error("save failed", e && e.message);
      return json({ ok: false, error: "Couldn't save your request just now. Your answers are still here — please try again." }, 500, c.headers);
    }
  },
};
