import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, smooth, clamp, lerp } from './util.js';

// Camera choreography. Each shot returns a camera description derived purely
// from time: position, look target, lens (vertical fov), focus point and how
// much defocus the lens allows ("blur", in fractions of frame height).

// Corridor dolly: speed profile integrated once into a lookup table so the
// track accelerates and settles smoothly and seeks are exact.
const TRACK = (() => {
  const dt = 0.005, t0 = CUE.hallway, t1 = CUE.card;
  const speed = (t) => 0.9 * smooth(t0, t0 + 2.6, t) * (1 - smooth(CUE.hallHold - 0.5, CUE.hallStop, t));
  const table = [0];
  let d = 0;
  for (let t = t0; t < t1; t += dt) { d += speed(t + dt / 2) * dt; table.push(d); }
  return { t0, dt, table };
})();
export function trackZ(t) {
  const i = clamp((t - TRACK.t0) / TRACK.dt, 0, TRACK.table.length - 1);
  const a = Math.floor(i), b = Math.min(a + 1, TRACK.table.length - 1);
  return 3.6 - lerp(TRACK.table[a], TRACK.table[b], i - a);
}
export function trackCam(t) {
  const z = trackZ(t);
  return [Math.sin(t * 0.21) * 0.035, 1.52 + Math.sin(t * 0.33) * 0.008, z];
}

export const CRT_MAIN_SCREEN = [-1.6, 1.0725, 0.74];
export const CRT_MAIN_NORMAL = [Math.sin(0.16), 0, Math.cos(0.16)];
const M1 = [1.85, 1.005, 0.68];
const M1N = [Math.sin(-0.22), 0, Math.cos(-0.22)];
export const ENTITY_HOME = [0, 0, -5.2];

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

export function cameraAt(t) {
  const shot = shotAt(t);
  const u = (shot.end - shot.start) > 0 ? (t - shot.start) / (shot.end - shot.start) : 0;
  const c = { shot, scene: shot.scene, pos: [0, 1.5, 3], look: [0, 1, 0], fov: 40, focus: null, blur: 0.004, roll: 0 };

  switch (shot.id) {
    case '1A':
      c.pos = keyed([[0, [-0.48, 1.135, 1.8]], [7.2, [-1.17, 1.1, 1.6]]], t, easeSine);
      c.look = keyed([[0, [-1.48, 1.06, 0.78]], [7.2, [-1.62, 1.07, 0.76]]], t, easeSine);
      c.fov = lerp(37, 33, easeSine(u));
      c.focus = CRT_MAIN_SCREEN; c.blur = 0.009;
      break;
    case '1B':
      c.pos = keyed([[7.2, [-1.55, 1.3, 1.5]], [10, [-1.48, 1.29, 1.78]]], t, easeSine);
      c.look = [2.3, 1.02, 6];
      c.fov = 50; c.focus = [2.6, 1.0, 6]; c.blur = 0.002;
      break;
    case '2A':
      c.pos = keyed([[10, [0.95, 1.33, 1.95]], [17, [0.72, 1.3, 1.5]]], t, easeSine);
      c.look = keyed([[10, [0.08, 1.02, -5.2]], [17, [0.0, 0.98, -5.2]]], t, easeSine);
      c.fov = 34; c.focus = [0, 0.8, -5.2]; c.blur = 0.008;
      break;
    case '2B':
      c.pos = keyed([[17, [0.3, 1.27, 0.8]], [24, [0.2, 1.26, 0.5]]], t, easeSine);
      c.look = [0, 0.8, -5.2];
      c.fov = lerp(22, 19.5, easeSine(u)); c.focus = [0, 0.8, -5.2]; c.blur = 0.006;
      break;
    case '3A':
    case '3C': {
      c.pos = trackCam(t);
      const yaw = shot.id === '3C' ? 0.07 * smooth(38.4, 39.9, t) : 0;   // starts to turn… and doesn't
      c.look = [c.pos[0] + Math.sin(yaw) * 10 - 0.02, 1.27, c.pos[2] - Math.cos(yaw) * 10];
      c.fov = 30;
      const far = Math.abs(c.pos[2] - (-19.55));
      c.focusDist = shot.id === '3C' ? lerp(far, 2.4, easeInOut((t - 37.7) / 1.1)) : far;
      c.blur = 0.006;
      break;
    }
    case '3B':
      c.pos = keyed([[31.5, [0.33, 1.2, -17.95]], [35.5, [0.27, 1.18, -18.2]]], t, easeSine);
      c.look = [0.0, 1.1, -19.55];
      c.fov = 30; c.focus = [0, 1.1, -19.55]; c.blur = 0.008;
      break;
    case '4A':
      c.scene = 'card';
      break;
    case '5A': {
      const th = lerp(0.62, -0.4, easeSine((t - CUE.arc) / (CUE.tallyAngle - CUE.arc)));
      const r = lerp(3.7, 3.35, easeSine(u));
      c.pos = [ENTITY_HOME[0] + Math.sin(th) * r, 1.32, ENTITY_HOME[2] + Math.cos(th) * r];
      c.look = [ENTITY_HOME[0] + Math.sin(th) * 0.2, 1.28, ENTITY_HOME[2]];
      c.fov = 35; c.focus = [0, 1.3, -5.2]; c.blur = 0.007;
      c.theta = th;
      break;
    }
    case '5B':
      c.pos = keyed([[58, [3.32, 1.18, -0.78]], [63.5, [3.2, 1.16, -0.95]]], t, easeSine);
      c.look = [0.05, 1.18, -5.2];
      c.fov = 31; c.focus = [0, 1.3, -5.2]; c.blur = 0.008;
      break;
    case '5C': {
      const d = lerp(0.95, 0.78, easeSine(u));
      c.pos = add(add(M1, M1N, d), [0.04, 0.05, 0]);
      c.look = M1;
      c.fov = 30; c.focus = M1; c.blur = 0.012;
      break;
    }
    case '6A':
      c.pos = keyed([[67, [-3.15, 1.5, 4.95]], [76, [-2.72, 1.45, 4.38]]], t, easeSine);
      c.look = keyed([[67, [0.3, 1.05, -0.6]], [76, [0.05, 1.05, -0.6]]], t, easeSine);
      c.fov = 40; c.blur = 0.004;
      break;
    case '6B':
      c.pos = keyed([[76, [-1.28, 1.12, 1.92]], [81, [-1.37, 1.11, 1.76]]], t, easeSine);
      c.look = CRT_MAIN_SCREEN;
      c.fov = 30; c.focus = CRT_MAIN_SCREEN; c.blur = 0.045;
      break;
    case '7A': {
      const k = easeInOut((t - CUE.pullBack) / (CUE.titleCard - CUE.pullBack));
      const d = lerp(0.3, 0.95, k);
      c.pos = add(add(CRT_MAIN_SCREEN, CRT_MAIN_NORMAL, d), [lerp(0, -0.05, k), lerp(0, 0.34, k), 0]);
      c.look = add(CRT_MAIN_SCREEN, [0.02, lerp(0, 0.09, k), 0]);
      c.fov = 40; c.focus = CRT_MAIN_SCREEN; c.blur = 0.008;
      break;
    }
    default:
      c.scene = 'none';
  }
  return c;
}
