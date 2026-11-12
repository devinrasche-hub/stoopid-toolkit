// POST /api/billboard — saves a request to rent one of the arcade billboards.
// Write-only, like /api/signup: nothing reads rows back out. Dev follows up by email.
// If the NTFY_TOPIC secret is set, Dev also gets a phone push (slot + request number only,
// no names or emails, since anyone who guesses an ntfy.sh topic can read it).

const SLOTS = new Set(["any", "L1", "L2", "L3", "R1", "R2", "R3"]);
const SLOT_NAMES = { any: "any open slot", L1: "left, top", L2: "left, middle", L3: "left, bottom",
                     R1: "right, top", R2: "right, middle", R3: "right, bottom" };

async function push(env, slot, id) {
  if (!env.NTFY_TOPIC) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
      method: "POST",
      headers: { Title: "New billboard request", Tags: "moneybag" },
      body: `Arcade billboard: ${SLOT_NAMES[slot]} · request #${id}`,
    });
  } catch {} // A failed push never loses the request; it's already saved.
}
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function onRequestPost({ request, env, waitUntil }) {
  // Only this site's own pages may submit.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: "Not allowed from this site." }, 403);

  const raw = await request.text();
  if (raw.length > 4000) return json({ ok: false, error: "Too much text." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Bad request." }, 400);

  const slot = clean(body.slot, 8) || "any";
  const name = clean(body.first_name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const promote = clean(body.promote, 500);
  let link = clean(body.link, 300);

  if (!SLOTS.has(slot)) return json({ ok: false, error: "Pick a billboard from the list." }, 422);
  if (!name) return json({ ok: false, error: "Add your name." }, 422);
  if (!EMAIL.test(email)) return json({ ok: false, error: "That email doesn't look right." }, 422);
  if (!promote) return json({ ok: false, error: "Tell us what you want to promote." }, 422);
  if (link) {
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    try { new URL(link); } catch { return json({ ok: false, error: "That link doesn't look right." }, 422); }
  }

  // Bots fill the hidden field or submit instantly. Tell them it worked and save nothing.
  if (clean(body.website, 200) || !(Number(body.elapsed_ms) >= 2000)) return json({ ok: true }, 200);

  const saved = await env.DB.prepare(
    "INSERT INTO billboard_requests (created_at, slot, name, email, promote, link) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(new Date().toISOString(), slot, name, email, promote, link).run();

  // Send the push after replying, so the visitor never waits on ntfy.
  waitUntil(push(env, slot, saved.meta.last_row_id));
  return json({ ok: true }, 200);
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
