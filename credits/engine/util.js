// THE CREDITS DEPARTMENT — shared helpers. Pure functions; run in browsers, the Worker and Node.

const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Split into user-perceived characters, so emoji and accents count as one. */
export function graphemes(s) {
  s = String(s ?? '');
  return SEG ? Array.from(SEG.segment(s), (x) => x.segment) : Array.from(s);
}

/** Strip control characters, bidi overrides and invisible spacing; NFC; collapse whitespace. */
export function cleanText(s, max = 200) {
  let t = String(s ?? '').normalize('NFC');
  t = t.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  const g = graphemes(t);
  return g.length > max ? g.slice(0, max).join('') : t;
}

/** Keep a name readable on screen: cut at max graphemes with an ellipsis. Returns [text, wasCut]. */
export function fitName(s, max) {
  const g = graphemes(s);
  if (g.length <= max) return [g.join(''), false];
  return [g.slice(0, max - 1).join('').trimEnd() + '…', true];
}

/** "@Foo", "x.com/foo", "https://twitter.com/Foo/" → "foo". */
export function normalizeHandle(h) {
  let s = String(h ?? '').trim();
  s = s.replace(/^https?:\/\/(www\.)?(x|twitter|youtube)\.com\//i, '').replace(/^(www\.)?(x|twitter)\.com\//i, '');
  s = s.replace(/^@/, '').replace(/[/?#].*$/, '');
  return s.toLowerCase();
}

/** Only https URLs survive. Returns a normalised string or null. */
export function safeUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(String(u).trim());
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

export function slugify(s) {
  const base = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return base || 'contributor';
}

/** FNV-1a 32-bit. */
export function hash32(str) {
  let h = 0x811c9dc5;
  str = String(str);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) from any seed. */
export function rng(seed) {
  let a = hash32(seed) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates; returns a new array. */
export function shuffle(arr, seed) {
  const a = arr.slice(), r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pad = (n, w = 3) => String(n).padStart(w, '0');
