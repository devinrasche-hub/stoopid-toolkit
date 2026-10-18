// Planet recipes and the scenario builder. A planet is the N lattice points
// nearest its centre (hexagonal close packing), layered by depth into core,
// mantle and surface materials.
import { RHO } from './sim.js';

const M = { IRON: 0, MANTLE: 1, LAND: 2, DESERT: 3, WATER: 4, ICE: 5, BASALT: 6, METAL: 7 };

// Real sizes let the HUD turn simulation units into km/s, kelvin and hours.
export const TARGETS = {
  earth: {
    label: 'EARTH', mass: 5.972e24, radius: 6.371e6, atmo: [0.35, 0.6, 1.0], atmoStrength: 1,
    layer(f, dir, n, shell) {
      if (f < 0.55) return M.IRON;
      if (!shell) return M.MANTLE;
      if (Math.abs(dir[1]) > 0.88) return M.ICE;
      return n > 0.18 ? M.LAND : M.WATER;
    },
  },
  mars: {
    label: 'MARS', mass: 6.417e23, radius: 3.39e6, atmo: [1.0, 0.55, 0.35], atmoStrength: 0.35,
    layer(f, dir, n, shell) {
      if (f < 0.5) return M.IRON;
      if (!shell) return M.MANTLE;
      if (Math.abs(dir[1]) > 0.93) return M.ICE;
      return n > 0.45 ? M.BASALT : M.DESERT;
    },
  },
  ocean: {
    label: 'OCEAN WORLD', mass: 1.19e25, radius: 7.9e6, atmo: [0.45, 0.75, 1.0], atmoStrength: 1.2,
    layer(f, dir, n, shell) {
      if (f < 0.3) return M.IRON;
      if (f < 0.6) return M.MANTLE;
      if (shell && (Math.abs(dir[1]) > 0.8 || n > 0.55)) return M.ICE;
      return M.WATER;
    },
  },
};

export const IMPACTOR_MATERIALS = {
  rock: {
    label: 'ROCK',
    layer(f, dir, n, shell) {
      if (f < 0.5) return M.IRON;
      if (shell && n > 0.35) return M.DESERT;
      return M.BASALT;
    },
  },
  iron: { label: 'IRON', layer: () => M.METAL },
  ice: {
    label: 'ICE',
    layer(f, dir, n) {
      if (f < 0.4) return M.BASALT;
      return n > 0.5 ? M.BASALT : M.ICE;
    },
  },
};

// mass of the impactor as a fraction of the target's
export const IMPACTORS = {
  asteroid: { label: 'ASTEROID', q: 0.004 },
  moon: { label: 'THE MOON', q: 0.0123 },
  theia: { label: 'THEIA', q: 0.11 },
  twin: { label: 'TWIN', q: 1 },
  bully: { label: 'THE BULLY', q: 3 },
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth continents: a handful of random waves over the sphere, range ~[-1, 1]
function surfaceNoise(seed) {
  const r = rng(seed);
  const waves = [];
  for (let i = 0; i < 9; i++) {
    const v = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
    const l = Math.hypot(...v);
    waves.push({ v: v.map((c) => c / l), f: 1.5 + r() * 3.5, p: r() * 6.283, a: 1 / (1 + i * 0.35) });
  }
  const norm = waves.reduce((s, w) => s + w.a, 0) * 0.55;
  return (d) => waves.reduce((s, w) => s + w.a * Math.sin((d[0] * w.v[0] + d[1] * w.v[1] + d[2] * w.v[2]) * w.f + w.p), 0) / norm;
}

// The N hcp lattice points nearest the origin, spacing `diam`.
function lattice(N, diam, jitter, rand) {
  const s = diam / 2;
  const R = s * Math.cbrt(N / 0.7405) * 1.2 + 2 * diam;
  const nx = Math.ceil(R / diam) + 1;
  const pts = [];
  const dy = Math.sqrt(3) * s, dz = (2 * Math.sqrt(6) / 3) * s;
  for (let k = -Math.ceil(R / dz); k <= Math.ceil(R / dz); k++) {
    for (let j = -Math.ceil(R / dy); j <= Math.ceil(R / dy); j++) {
      for (let i = -nx; i <= nx; i++) {
        const x = (2 * i + (((j + k) % 2) + 2) % 2) * s;
        const y = (j + (((k % 2) + 2) % 2) / 3) * dy;
        const z = k * dz;
        const r2 = x * x + y * y + z * z;
        if (r2 <= R * R) pts.push([x, y, z, r2]);
      }
    }
  }
  pts.sort((a, b) => a[3] - b[3]);
  return pts.slice(0, N).map(([x, y, z]) => [
    x + (rand() - 0.5) * jitter, y + (rand() - 0.5) * jitter, z + (rand() - 0.5) * jitter,
  ]);
}

// Build one body: returns {pts:[[x,y,z,mat]], mass, radius} centred on its centre of mass.
function buildBody(N, diam, recipe, seed) {
  const rand = rng(seed);
  const noise = surfaceNoise(seed * 7 + 3);
  const raw = lattice(N, diam, diam * 0.04, rand);
  let Rb = 0;
  for (const p of raw) Rb = Math.max(Rb, Math.hypot(p[0], p[1], p[2]));
  const shellDepth = Math.min(0.35, (1.3 * diam) / Rb);
  const pts = raw.map((p) => {
    const r = Math.hypot(p[0], p[1], p[2]) || 1e-9;
    const dir = [p[0] / r, p[1] / r, p[2] / r];
    const f = r / Rb;
    return [p[0], p[1], p[2], recipe.layer(f, dir, noise(dir), f > 1 - shellDepth)];
  });
  let mass = 0; const c = [0, 0, 0];
  for (const p of pts) { const m = RHO[p[3]]; mass += m; c[0] += p[0] * m; c[1] += p[1] * m; c[2] += p[2] * m; }
  for (const p of pts) { p[0] -= c[0] / mass; p[1] -= c[1] / mass; p[2] -= c[2] / mass; }
  return { pts, mass, radius: Rb + diam / 2 };
}

// Lay out both bodies for a texture of `cap` texels.
// Units are fixed so the target has mass 1 and radius 1.
export function buildBodies({ cap, target, impactor, material }) {
  const T = TARGETS[target], I = IMPACTORS[impactor], IM = IMPACTOR_MATERIALS[material];
  // average densities from a trial build, so the particle budget splits by mass
  const avgRho = (recipe) => {
    const b = buildBody(800, 1, recipe, 11);
    return b.mass / 800;
  };
  const rhoT = avgRho(T), rhoI = avgRho(IM);
  let Nt = Math.floor(cap / (1 + (I.q * rhoT) / rhoI));
  let Ni = Math.max(12, Math.round((I.q * Nt * rhoT) / rhoI));
  if (Nt + Ni > cap) Nt = cap - Ni;
  // pick diam so the target radius comes out at 1
  const unit = buildBody(Nt, 1, T, 1);
  const diam = 1 / unit.radius;
  const tb = buildBody(Nt, diam, T, 1);
  const ib = buildBody(Ni, diam, IM, 5 + Ni);
  const m0 = 1 / tb.mass; // particle mass unit: target mass = 1
  return {
    diam, m0, Nt, Ni,
    target: { pts: tb.pts, mass: tb.mass * m0, radius: tb.radius },
    impactor: { pts: ib.pts, mass: ib.mass * m0, radius: ib.radius },
  };
}

// Back-integrate the two-body problem from the moment of contact to a start
// separation, so the impactor arrives at the chosen speed and angle.
// speed: multiples of mutual escape speed; angle: degrees from head-on.
export function approach({ Mt, Mi, Rt, Ri, speed, angle }) {
  const mu = Mt + Mi;
  const rc = Rt + Ri;
  const vesc = Math.sqrt((2 * mu) / rc);
  const vimp = speed * vesc;
  const th = (angle * Math.PI) / 180;
  // at contact: relative position along +x, velocity pointing in and sideways
  let x = rc, y = 0, vx = -vimp * Math.cos(th), vy = -vimp * Math.sin(th);
  const startR = Math.max(4.5 * rc, rc + 3);
  const path = [[x, y, 0]];
  const h = -0.002 * rc; // backwards in time
  let t = 0;
  const acc = (x, y) => { const r = Math.hypot(x, y); const a = -mu / (r * r * r); return [a * x, a * y]; };
  let [ax, ay] = acc(x, y);
  for (let i = 0; i < 200000; i++) {
    vx += 0.5 * h * ax; vy += 0.5 * h * ay;
    x += h * vx; y += h * vy;
    [ax, ay] = acc(x, y);
    vx += 0.5 * h * ax; vy += 0.5 * h * ay;
    t -= h;
    if (i % 20 === 0) path.push([x, y, t]);
    if (Math.hypot(x, y) >= startR) break;
    if (t > 60) break; // bound orbit that never gets far: start where we are
  }
  path.push([x, y, t]);
  path.reverse();
  // rotate the plane so the impactor starts off to the right of the target
  const phi = Math.atan2(y, x);
  const c = Math.cos(-phi), s = Math.sin(-phi);
  const rot = ([px, py, pt]) => [px * c - py * s, px * s + py * c, pt];
  const [rx, ry] = rot([x, y]);
  const [rvx, rvy] = rot([vx, vy]);
  return {
    tContact: t, vimp, vesc, rc,
    rel: { x: rx, y: ry, vx: rvx, vy: rvy },
    // [x, y, time-before-contact], start first
    path: path.map(rot),
    contactDir: rot([1, 0]),
  };
}

// Orbital plane (x,y) → world: tilt it so the camera sees it at an angle.
export function planeToWorld([x, y]) {
  return [x, y * 0.38, -y * 0.92];
}

// Pack positions and velocities into RGBA float arrays for the GPU.
export function pack(cap, bodies, ap) {
  const pos = new Float32Array(cap * 4), vel = new Float32Array(cap * 4);
  const { target, impactor } = bodies;
  const Mt = target.mass, Mi = impactor.mass, Mtot = Mt + Mi;
  const r = planeToWorld([ap.rel.x, ap.rel.y]);
  const v = planeToWorld([ap.rel.vx, ap.rel.vy]);
  const fT = -Mi / Mtot, fI = Mt / Mtot;
  let k = 0;
  const put = (pts, f) => {
    for (const p of pts) {
      pos[k * 4] = p[0] + r[0] * f; pos[k * 4 + 1] = p[1] + r[1] * f; pos[k * 4 + 2] = p[2] + r[2] * f; pos[k * 4 + 3] = p[3];
      vel[k * 4] = v[0] * f; vel[k * 4 + 1] = v[1] * f; vel[k * 4 + 2] = v[2] * f; vel[k * 4 + 3] = 0;
      k++;
    }
  };
  put(target.pts, fT);
  put(impactor.pts, fI);
  // unused texels: park far away, inert
  for (let i = k; i < cap; i++) { pos[i * 4] = 1e6; pos[i * 4 + 3] = 6; }
  return { pos, vel, count: k, targetPos: r.map((c) => c * fT), impactorPos: r.map((c) => c * fI), fT, fI };
}
