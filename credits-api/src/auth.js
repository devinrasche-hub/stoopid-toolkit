// Admin authentication. There was no auth system to reuse (stoopidtv.com is Wix; the toolkit is account-free),
// so the Credits Department uses one long random bearer token stored as a Worker secret (ADMIN_TOKEN).
// Every /admin/* request is checked here, server-side. Failed attempts are rate limited per IP.

import { fail, ipHash, rateLimit, sha256hex, cleanActor } from './lib.js';

function equalHex(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function requireAdmin(req, env) {
  const secret = env.ADMIN_TOKEN || '';
  if (secret.length < 32) fail(503, 'Admin is not configured: set the ADMIN_TOKEN secret (32+ random characters).');
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  const given = m ? m[1].trim() : '';
  const ok = given.length > 0 && equalHex(await sha256hex(given), await sha256hex(secret));
  if (!ok) {
    const iph = await ipHash(req, env);
    const allowed = await rateLimit(env, 'admin-fail', iph, 20);
    fail(allowed ? 401 : 429, allowed ? 'Not authorised.' : 'Too many failed sign-ins. Try again in an hour.');
  }
  return { actor: cleanActor(req.headers.get('x-admin-name')) };
}
