import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, smooth, clamp, lerp, noise1, SETTINGS } from './util.js';

// Camera for SIGNAL RECEIVED.
// Their room is shot slowly and from behind: the watchers are always backlit,
// faces never seen. Moves are long, eased, and patient.

export const TV = [0, 1.35, 0];
// Filled in once the world is built (main.js): the watcher we see in profile,
// and the direction of Sol in their sky.
export const ANCH = { hero: [-0.55, 0, 2.65], heroYaw: 0, sol: [0.17, 0.94, -0.3], turner: [-1.05, 0, 3.55], turnerS: 1 };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// Handheld, deterministic: low-frequency drift plus a walking bob.
function body(t, amt, walk = 0) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  const bob = walk * Math.sin(t * 2 * Math.PI * 1.7);
  return { dx: n(1, 0.35) * 0.012 * amt + walk * 0.006 * Math.sin(t * Math.PI * 1.7), dy: n(2, 0.3) * 0.008 * amt + bob * 0.012, dz: n(3, 0.33) * 0.01 * amt,
    lx: n(4, 0.25) * 0.03 * amt, ly: n(5, 0.27) * 0.025 * amt, roll: 0.017 + n(6, 0.2) * 0.006 * amt };
}

function raw(t, shot) {
  const u = (t - shot.start) / (shot.end - shot.start);
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false };
  switch (shot.id) {
    case '1A': {
      // 03's last card, on a screen; pull back into a room that isn't a room on Earth
      const close = [0, 1.35, 0.86], far = [0.42, 1.52, 2.25];
      c.pos = keyed([[0, close], [CUE.pullStart, close], [CUE.audience, far]], t, easeInOut);
      c.look = keyed([[0, TV], [CUE.pullStart, TV], [CUE.audience, [0.05, 1.4, 0]]], t, easeInOut);
      c.fov = lerp(40, 44, easeInOut((t - CUE.pullStart) / 4));
      c.focus = TV; c.blur = 0.003;
      break;
    }
    case '2A':
      // behind the audience: rows of tall shapes, heads lost in the dark
      c.pos = keyed([[CUE.audience, [0.9, 2.25, 8.35]], [CUE.dolly, [-0.5, 2.3, 8.1]]], t, easeSine);
      c.look = [0, 1.7, 0];
      c.fov = 44; c.focusDist = 5.5; c.blur = 0.003;
      break;
    case '2B':
      // along the front rows, low; one head turns a little; then static
    {
      // over the shoulder of one of them, close; its head sits beside the set, not over it
      const w = ANCH.turner, r = Math.hypot(w[0], w[2]);
      const out = [w[0] / r, 0, w[2] / r], side = [out[2], 0, -out[0]];
      const p0 = add(add(w, out, 1.05), side, -0.42), p1 = add(add(w, out, 0.9), side, -0.38);
      c.pos = keyed([[CUE.dolly, [p0[0], 2.12, p0[2]]], [CUE.stoo, [p1[0], 2.1, p1[2]]]], t, easeSine);
      c.look = [0.12, 1.5, 0];
      c.fov = 36; c.focus = [w[0], 1.95, w[2]]; c.blur = 0.004;
    }
      break;
    case '3A':
      // the flip: heads against the screen — every one of them a bowl cut
      c.pos = keyed([[CUE.stoo, [0.22, 2.42, 8.2]], [CUE.crane, [0.2, 2.44, 8.05]]], t, easeSine);
      c.look = [0.0, 1.62, 0];
      c.fov = 17; c.focus = [0, 2.0, 2.7]; c.blur = 0.003;
      c.essential = true;
      break;
    case '3B':
      // crane up: the ring of screens switches to him, one after another
      c.pos = keyed([[CUE.crane, [0.2, 2.44, 8.05]], [CUE.region, [0.0, 6.6, 8.3]]], t, easeInOut);
      c.look = keyed([[CUE.crane, [0, 1.62, 0]], [CUE.region, [0, 2.4, -2.0]]], t, easeInOut);
      c.fov = keyed([[CUE.crane, 17], [CUE.region, 50]], t, easeInOut);
      c.focusDist = 8; c.blur = 0.002;
      break;
    case '4B':
      // every screen, the same message; nobody moves
      c.pos = keyed([[CUE.regionWide, [-5.4, 3.3, 6.1]], [CUE.origin, [-5.1, 3.25, 6.0]]], t, easeSine);
      c.look = [0.6, 2.3, -1.6];
      c.fov = 50; c.focusDist = 7; c.blur = 0.002;
      break;
    case '5A':
      // close on the set: where it came from, when it left, the last thing it sent
      c.pos = keyed([[CUE.origin, [0.06, 1.4, 1.75]], [CUE.lastFeed, [0.04, 1.38, 1.45]], [CUE.white, [0.0, 1.36, 1.02]], [CUE.sky, [0.0, 1.36, 0.98]]], t, easeInOut);
      c.look = TV; c.fov = 40; c.focus = TV; c.blur = 0.003;
      break;
    case '5B': {
      // look up through the roof: a yellow star, and a pale blue point beside it
      c.pos = [0.4, 1.7, 2.1];
      const sky = add(c.pos, ANCH.sol, 60);
      const up = easeInOut((t - CUE.sky) / 2.6);
      c.look = [lerp(0.2, sky[0], up), lerp(1.4, sky[1], up), lerp(0, sky[2], up)];
      c.fov = lerp(40, 13, easeInOut((t - CUE.sky - 2.2) / 2.4));
      c.focusDist = 60; c.blur = 0.0;
      c.essential = true;
      break;
    }
    case '6A':
      // the hand on the set; the rewind; the minute; Stoo
      c.pos = keyed([[CUE.grief, [0.52, 2.32, 1.18]], [CUE.profile, [0.44, 2.26, 1.06]]], t, easeSine);
      c.look = [-0.03, 1.56, -0.02];
      c.fov = 38; c.focus = TV; c.blur = 0.004;
      break;
    case '6B': {
      // profile of the nearest watcher, backlit; then wider, the drops of light
      const h = ANCH.hero, yaw = ANCH.heroYaw;
      const side = [Math.cos(yaw), 0, -Math.sin(yaw)];   // the watcher's left
      const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
      const head = [h[0], h[1] + 1.95, h[2]];
      const near = add(add(head, side, -2.3), fwd, 0.35);
      const wide = add(add(add(head, side, -3.9), fwd, -1.4), [0, 0.5, 0]);
      c.pos = keyed([[CUE.profile, near], [CUE.tears, near], [CUE.reply, wide]], t, easeInOut);
      c.look = keyed([[CUE.profile, add(head, fwd, 0.1)], [CUE.tears, add(head, fwd, 0.1)], [CUE.reply, [h[0] + 1.0, 1.9, h[2] - 0.6]]], t, easeInOut);
      c.fov = 34; c.focus = head; c.blur = 0.006;
      break;
    }
    case '7A': {
      // the reply on the set, then up with the beam toward the star
      c.pos = [0.22, 1.5, 2.15];
      const up = easeInOut((t - CUE.followBeam) / 3.2);
      const sky = add(c.pos, ANCH.sol, 60);
      c.look = [lerp(0.0, sky[0], up), lerp(1.42, sky[1], up), lerp(0, sky[2], up)];
      c.fov = lerp(40, 30, up);
      c.focus = up > 0.5 ? null : TV; c.focusDist = up > 0.5 ? 40 : 0; c.blur = 0.002;
      break;
    }
    default: break;
  }
  return c;
}

export function cameraAt(t) {
  const shot = shotAt(t);
  const c = raw(t, shot);
  c.shot = shot; c.scene = shot.scene; c.world = shot.world;
  if (SETTINGS.motion < 1 && !c.essential && shot.scene !== 'none') {
    const mid = raw((shot.start + shot.end) / 2, shot);
    const k = SETTINGS.motion;
    c.pos = c.pos.map((v, i) => lerp(mid.pos[i], v, k));
    c.look = c.look.map((v, i) => lerp(mid.look[i], v, k));
    c.roll *= k;
  }
  return c;
}
