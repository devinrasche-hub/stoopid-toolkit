// Reads the particle state back from the GPU and works out what is left:
// clumps (friends-of-friends), what is bound to the biggest clump, what is
// leaving forever, and how hot everything is.
import { RHO } from './sim.js';

export function analyse(pos, vel, count, diam, m0) {
  const link = diam * 1.3;
  const inv = 1 / link;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a < b ? b : a] = a < b ? a : b; };

  // spatial hash
  const grid = new Map();
  const key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
  const cell = new Int32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(pos[i * 4] * inv), y = Math.floor(pos[i * 4 + 1] * inv), z = Math.floor(pos[i * 4 + 2] * inv);
    cell[i * 3] = x; cell[i * 3 + 1] = y; cell[i * 3 + 2] = z;
    const k = key(x, y, z);
    let b = grid.get(k);
    if (!b) grid.set(k, (b = []));
    b.push(i);
  }
  const l2 = link * link;
  for (let i = 0; i < count; i++) {
    const cx = cell[i * 3], cy = cell[i * 3 + 1], cz = cell[i * 3 + 2];
    const px = pos[i * 4], py = pos[i * 4 + 1], pz = pos[i * 4 + 2];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const b = grid.get(key(cx + dx, cy + dy, cz + dz));
      if (!b) continue;
      for (const j of b) {
        if (j <= i) continue;
        const ex = pos[j * 4] - px, ey = pos[j * 4 + 1] - py, ez = pos[j * 4 + 2] - pz;
        if (ex * ex + ey * ey + ez * ez < l2) union(i, j);
      }
    }
  }

  // clump masses and centres
  const clumps = new Map();
  let total = 0, peakT = 0, heatSum = 0;
  for (let i = 0; i < count; i++) {
    const m = m0 * RHO[Math.round(pos[i * 4 + 3])];
    total += m;
    heatSum += vel[i * 4 + 3] * m;
    if (vel[i * 4 + 3] > peakT) peakT = vel[i * 4 + 3];
    const r = find(i);
    let c = clumps.get(r);
    if (!c) clumps.set(r, (c = { m: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, n: 0, root: r }));
    c.m += m; c.n++;
    c.x += pos[i * 4] * m; c.y += pos[i * 4 + 1] * m; c.z += pos[i * 4 + 2] * m;
    c.vx += vel[i * 4] * m; c.vy += vel[i * 4 + 1] * m; c.vz += vel[i * 4 + 2] * m;
  }
  // "peak" is the 99th percentile, so one unlucky particle can't speak for the planet
  const temps = new Float32Array(count);
  for (let i = 0; i < count; i++) temps[i] = vel[i * 4 + 3];
  temps.sort();
  peakT = temps[Math.floor(count * 0.99)];
  const list = [...clumps.values()].sort((a, b) => b.m - a.m);
  for (const c of list) { c.x /= c.m; c.y /= c.m; c.z /= c.m; c.vx /= c.m; c.vy /= c.m; c.vz /= c.m; }
  const lr = list[0];

  // radius of the largest remnant
  let rr = 0;
  for (let i = 0; i < count; i++) {
    if (find(i) !== lr.root) continue;
    const ex = pos[i * 4] - lr.x, ey = pos[i * 4 + 1] - lr.y, ez = pos[i * 4 + 2] - lr.z;
    rr += ex * ex + ey * ey + ez * ez;
  }
  lr.radius = Math.sqrt((rr / lr.n) * (5 / 3)) + diam / 2;

  // everything not in the largest remnant: orbiting it, or leaving?
  let bound = 0, escaping = 0;
  for (let i = 0; i < count; i++) {
    if (find(i) === lr.root) continue;
    const m = m0 * RHO[Math.round(pos[i * 4 + 3])];
    const ex = pos[i * 4] - lr.x, ey = pos[i * 4 + 1] - lr.y, ez = pos[i * 4 + 2] - lr.z;
    const ux = vel[i * 4] - lr.vx, uy = vel[i * 4 + 1] - lr.vy, uz = vel[i * 4 + 2] - lr.vz;
    const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const E = 0.5 * (ux * ux + uy * uy + uz * uz) - lr.m / Math.max(r, lr.radius);
    if (E < 0) bound += m; else escaping += m;
  }

  // second clump and whether it is leaving
  const second = list[1] && list[1].n >= 6 ? list[1] : null;
  if (second) {
    const ex = second.x - lr.x, ey = second.y - lr.y, ez = second.z - lr.z;
    const ux = second.vx - lr.vx, uy = second.vy - lr.vy, uz = second.vz - lr.vz;
    const r = Math.hypot(ex, ey, ez);
    second.escaping = 0.5 * (ux * ux + uy * uy + uz * uz) - (lr.m + second.m) / r > 0;
    second.dist = r;
  }

  return {
    total, largest: lr, second, bound, escaping,
    peakT, meanT: heatSum / total, clumps: list.length,
  };
}

// Leinhardt & Stewart style outcome regimes, plus whether a moon-making disk formed.
export function classify(a, Mt, Mi) {
  const M = a.total, L = a.largest.m;
  let kind;
  if (a.second && a.second.escaping && a.second.m > 0.35 * Mi && Mi > 0.02 * Mt && a.second.dist > 1.2 * (a.largest.radius)) kind = 'HIT-AND-RUN';
  else if (L >= 0.97 * M) kind = 'PERFECT MERGER';
  else if (L >= Mt) kind = 'PARTIAL ACCRETION';
  else if (L >= 0.1 * M) kind = 'EROSION';
  else kind = 'SUPER-CATASTROPHIC DISRUPTION';
  const disk = a.bound / M;
  return { kind, disk, moonMaker: disk > 0.004 };
}
