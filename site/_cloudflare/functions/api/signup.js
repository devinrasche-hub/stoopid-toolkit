// POST /api/signup — saves a newsletter or Earn sign-up. Write-only: nothing reads rows back out.

const LISTS = new Set(["newsletter", "earn"]);
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  // Only this site's own pages may submit.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: "Not allowed from this site." }, 403);

  const raw = await request.text();
  if (raw.length > 4000) return json({ ok: false, error: "Too much text." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Bad request." }, 400);

  const list = clean(body.list, 20);
  const email = clean(body.email, 254).toLowerCase();
  const firstName = clean(body.first_name, 80);
  const hangout = clean(body.hangout, 200);

  if (!LISTS.has(list)) return json({ ok: false, error: "Unknown form." }, 422);
  if (!EMAIL.test(email)) return json({ ok: false, error: "That email doesn't look right." }, 422);
  if (list === "earn" && !firstName) return json({ ok: false, error: "Add your first name." }, 422);

  // Bots fill the hidden field or submit instantly. Tell them it worked and save nothing.
  if (clean(body.website, 200) || !(Number(body.elapsed_ms) >= 2000)) return json({ ok: true }, 200);

  await env.DB.prepare(
    "INSERT OR IGNORE INTO signups (created_at, list, email, first_name, hangout) VALUES (?, ?, ?, ?, ?)"
  ).bind(new Date().toISOString(), list, email, firstName, hangout).run();

  return json({ ok: true }, 200);
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
