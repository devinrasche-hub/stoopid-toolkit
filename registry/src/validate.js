// Pure validation/normalization logic for the STOOPID SIGNAL REGISTRY.
// No I/O, no crypto, no env — safe to unit test with node:test.

// Arcade-style name: uppercase, alphanumeric only, max 3 chars.
export function normalizeName(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

// Validates a parsed /submit body. Returns either
//   { ok: true, name, score, wave }
// or
//   { ok: false, error, status }
// mirroring the worker's exact historical responses.
export function validateSubmission(body) {
  if (!body) return { ok: false, error: "bad json", status: 400 };

  let { name, score, wave } = body;
  name = normalizeName(name);
  score = Math.floor(Number(score));
  wave = Math.floor(Number(wave));

  if (name.length < 1 || !Number.isFinite(score) || !Number.isFinite(wave))
    return { ok: false, error: "bad fields", status: 400 };
  // plausibility gate — the registry is trusting, not gullible
  if (score < 0 || wave < 1 || wave > 99 || score > 250000 || score > wave * 3000 + 5000)
    return { ok: false, error: "the registry doubts you", status: 422 };

  return { ok: true, name, score, wave };
}
