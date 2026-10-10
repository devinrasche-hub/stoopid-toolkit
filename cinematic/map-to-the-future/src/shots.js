import { CUE, shotAt } from './timeline.js';
import { keyed, easeInOut, easeIn, smooth, lerp, noise1, SETTINGS } from './util.js';
import { CORE_Z, bPos, PHONE } from './world.js';

// Cameras for A MAP TO THE FUTURE.
// Calm, motivated moves: one push into the phone, one orbit that reveals the
// coil, one dive, one dolly through the gate, one pull back from the brain.
// Reduced motion keeps every move (they carry the explanation) but removes the
// drift and shortens the dive.

const drift = (t, amt, seed = 0) => {
  const k = amt * SETTINGS.motion;
  return [(noise1(t * 0.23, seed + 1) - 0.5) * k, (noise1(t * 0.19, seed + 2) - 0.5) * k * 0.7, (noise1(t * 0.21, seed + 3) - 0.5) * k];
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sph = (target, yaw, pitch, d) => [target[0] + d * Math.sin(yaw) * Math.cos(pitch), target[1] + d * Math.sin(pitch), target[2] + d * Math.cos(yaw) * Math.cos(pitch)];

export const PHONE_POS = [0, 0.62, 0.06];
const BED_EYE = [0, 0.29, 0.25];
// Distance from the screen at which the phone's ring matches the loop head-on.
const RING_PX = 150, PUSH_END = 0.075;
export const LOOP_MATCH = 1.6 / ((RING_PX / PHONE.cw) * PHONE.sw / PUSH_END);

function raw(t, shot) {
  const c = { pos: [0, 0, 5], look: [0, 0, 0], fov: 40, blur: 0, focusDist: 4 };
  switch (shot.id) {
    case '1A': {
      const dir = [BED_EYE[0] - PHONE_POS[0], BED_EYE[1] - PHONE_POS[1], BED_EYE[2] - PHONE_POS[2]];
      const len = Math.hypot(...dir);
      const d = keyed([[0, len], [CUE.push, len * 0.92], [CUE.loop - 0.1, PUSH_END]], t, easeInOut);
      const p = PHONE_POS.map((v, i) => v + (dir[i] / len) * d);
      const hand = drift(t, 0.012 * (1 - smooth(CUE.push, CUE.ring, t)), 4);
      c.pos = add(p, hand);
      c.look = PHONE_POS;
      c.fov = 40; c.focusDist = d; c.blur = 0.006; c.up = [0, 0, -1];
      break;
    }
    case '1B': {
      // yaw, pitch, distance, target z
      const k = keyed([
        [CUE.loop, [0, 0, LOOP_MATCH, 0]], [CUE.loop + 0.6, [0, 0, LOOP_MATCH, 0]],
        [20.5, [0.2, 0.08, 6.6, 0]], [CUE.memorize, [0.45, 0.2, 6.6, 0]],
        [CUE.sameFuture + 0.6, [1.32, 0.24, 10.5, -1.6]], [39.3, [1.32, 0.24, 10.5, -1.6]],
        [CUE.dive, [0, 0, 5.2, -1]],
      ], t, easeInOut);
      const target = [0, 0, k[3]];
      c.pos = add(sph(target, k[0], k[1], k[2]), drift(t, 0.25, 9));
      c.look = target;
      if (t > CUE.dive) {
        const z = keyed([[CUE.dive, 4.2], [CUE.split, SETTINGS.motion < 1 ? -3 : -17]], t, easeIn);
        c.pos = [0, 0, z];
        c.look = [0, 0, z - 4];
      }
      c.fov = 40;
      break;
    }
    case '2A': {
      const m = smooth(CUE.merge, CUE.merge + 2.4, t);
      const leftW = lerp(0.5, 0, m);
      const base = [0, 0, 7.5];
      const L = { pos: add(base, drift(t, 0.08, 1)), look: [0, -0.05, 0], fov: 42, vp: [0, 0, leftW, 1] };
      const rz = keyed([[CUE.gateOpen + 0.8, 7.5], [CUE.lidsClose, -1.6]], t, easeInOut);
      const R = { pos: add([0, lerp(0, -0.3, smooth(CUE.gateOpen, CUE.lidsClose, t)), rz], drift(t, 0.08, 2)),
        look: [0, lerp(-0.05, -0.3, smooth(CUE.gateOpen, CUE.merge, t)), lerp(0, CORE_Z, smooth(CUE.gateOpen, CUE.merge, t))], fov: 42, vp: [leftW, 0, 1 - leftW, 1] };
      c.views = leftW > 0.001 ? [L, R] : [R];
      c.pos = R.pos; c.look = R.look; c.fov = 42;
      c.split = leftW;
      break;
    }
    case '3A': {
      c.pos = keyed([
        [CUE.brain, [0.28, 0.12, 0.62]], [CUE.rehearse[0], [0.22, 0.16, 0.42]],
        [CUE.rehearse[2], [0.95, 0.38, 1.45]], [CUE.shift, [1.85, 0.55, 2.05]],
        [CUE.pullOut, [2.75, 0.45, 0.75]], [CUE.board, [6.4, 1.1, 2.6]],
      ], t, easeInOut);
      c.pos = add(c.pos, drift(t, 0.05, 5));
      c.look = keyed([
        [CUE.brain, [-0.1, 0.0, -0.7]], [CUE.rehearse[0], [-0.1, 0.0, -0.6]],
        [CUE.rehearse[2], [0, 0, -0.1]], [CUE.shift, [0, 0, 0]], [CUE.board, [0, -0.05, 0]],
      ], t, easeInOut);
      c.fov = keyed([[CUE.brain, 62], [CUE.rehearse[2], 50], [CUE.shift, 42], [CUE.board, 36]], t, easeInOut);
      break;
    }
    case '4A': {
      const bp = bPos(t);
      c.pos = keyed([
        [CUE.board, [2.6, 2.4, 3.7]], [CUE.quantum, [2.0, 2.0, 3.2]],
        [CUE.intention, [0.05, 1.45, 2.75]], [CUE.coherence, [0.5, 1.25, 2.45]],
        [CUE.creator + 2.5, [0.3, 1.55, 2.6]], [CUE.coda, [0.0, 4.2, 4.2]],
      ], t, easeInOut);
      c.pos = add(c.pos, drift(t, 0.12, 7));
      const lk = keyed([
        [CUE.board, [0.3, 0, 0.4]], [CUE.quantum, [0.2, 0, 0.5]],
        [CUE.intention, [0, 0.75, -1.6]], [CUE.coherence, [0, 0.7, -1.4]],
        [CUE.creator + 2.5, [0, 0.75, -4]], [CUE.coda, [0, 0, -5]],
      ], t, easeInOut);
      c.look = t > CUE.rise2 && t < CUE.coherence ? lk.map((v, i) => lerp(v, bp[i], 0.25)) : lk;
      c.fov = 40;
      break;
    }
    case '5A':
      c.pos = add(keyed([[CUE.coda, [0.26, 0.34, 0.42]], [CUE.title, [0.2, 0.26, 0.33]]], t, easeInOut), drift(t, 0.006, 3));
      c.look = [0.0, 0.0, 0.0];
      c.fov = 38; c.focusDist = 0.5; c.blur = 0.01;
      break;
    default: break;
  }
  return c;
}

export function cameraAt(t) {
  const shot = shotAt(t);
  const c = raw(t, shot);
  c.shot = shot; c.scene = shot.scene;
  return c;
}
