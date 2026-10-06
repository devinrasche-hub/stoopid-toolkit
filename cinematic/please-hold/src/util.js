// Viewer accessibility settings, read by the camera and light code.
//   motion  — 1 normal, 0.45 reduced: camera moves shrink toward each shot's anchor
//   flicker — 1 normal, 0 reduced: no fluorescent sags, no analog instability
export const SETTINGS = { motion: 1, flicker: 1 };

// Deterministic helpers. Everything visual derives from timeline time `t`,
// so these are pure functions of their inputs (no Math.random at runtime).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);

// Window: 0 outside [a,b], fades in/out at the edges.
export const pulse = (t, a, b, fin = 0.3, fout = 0.3) =>
  smooth(a, a + fin, t) * (1 - smooth(b - fout, b, t));

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(a, b) { return hash(a * 17.17 + b * 91.31); }

// Smooth value noise, 1D.
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.31), hash(i + 1 + seed * 57.31), u);
}
export function fbm1(x, seed = 0) {
  return noise1(x, seed) * 0.55 + noise1(x * 2.13, seed + 3) * 0.3 + noise1(x * 4.71, seed + 7) * 0.15;
}

// Seeded PRNG for build-time procedural layout (cables, panels, dust).
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Piecewise keyframe interpolation: keys = [[t, value], ...] (numbers or arrays).
export function keyed(keys, t, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const u = ease((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], u));
      return lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

// Gentle fluorescent instability: mostly 1, occasional soft sags. Never strobes:
// the fastest component is ~6Hz and its depth is small.
export function fluorescent(t, seed, sag = 0.35) {
  if (!SETTINGS.flicker) return 1;
  const slow = fbm1(t * 0.7, seed);
  const dip = smooth(0.72, 0.9, noise1(t * 1.9, seed + 11)) * sag;
  const buzz = (noise1(t * 6.0, seed + 23) - 0.5) * 0.05;
  return clamp(1 - dip - (slow - 0.5) * 0.12 + buzz, 0, 1.1);
}
