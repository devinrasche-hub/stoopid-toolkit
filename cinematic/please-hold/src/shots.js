import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, smooth, clamp, lerp, SETTINGS } from './util.js';

// Camera choreography for PLEASE HOLD. Pure functions of time.
// Each shot returns position, look target, lens (vertical fov), focus point or
// distance, and how much defocus the lens allows ("blur", fraction of frame height).

export const CRT_SCREEN = [-1.6, 1.0725, 0.74];
export const CRT_N = [Math.sin(0.16), 0, Math.cos(0.16)];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// The end composition of PLEASE REMAIN SEEN, so 02 begins exactly where 01 ended.
export const PREV_END_POS = add(add(CRT_SCREEN, CRT_N, 0.95), [-0.05, 0.34, 0]);
export const PREV_END_LOOK = add(CRT_SCREEN, [0.02, 0.09, 0]);

// Where the (invisible) viewer is along the chamber walkway; sections light ahead of it.
export function walkerZ(t) {
  if (t < CUE.chamberWide) return 1.0;
  if (t < CUE.walk) return lerp(1.0, 20.0, easeInOut((t - CUE.chamberWide) / (CUE.walk - CUE.chamberWide)));
  return lerp(20.0, 29.7, 1 - Math.pow(1 - clamp((t - CUE.walk) / (CUE.switchShot - CUE.walk)), 2));
}

// The phone, the switch: shared with the director.
export const PHONE = [0.88, 1.39, -4.2];
export const LEVER_TIP = [-0.08, 1.39, 31.57];

function raw(t, shot) {
  const u = (t - shot.start) / (shot.end - shot.start);
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, essential: false };
  switch (shot.id) {
    case '1A': {
      const k = easeInOut((t - CUE.pullBack) / (CUE.exitWide - CUE.pullBack));
      c.pos = keyed([[0, PREV_END_POS], [CUE.pullBack, add(PREV_END_POS, CRT_N, 0.06)], [CUE.exitWide, [-0.95, 1.58, 3.5]]], t, easeInOut);
      c.look = keyed([[0, PREV_END_LOOK], [CUE.pullBack, PREV_END_LOOK], [CUE.exitWide, [-1.85, 1.12, 0.9]]], t, easeInOut);
      c.fov = lerp(40, 44, k);
      c.focus = CRT_SCREEN; c.blur = lerp(0.008, 0.004, k);
      break;
    }
    case '2A':
      c.pos = keyed([[12, [0.75, 1.48, 2.05]], [15.5, [0.62, 1.47, 2.1]]], t, easeSine);
      c.look = [-3.4, 1.22, 1.85];
      c.fov = 42; c.focus = [-2.6, 1.3, 1.0]; c.blur = 0.004;
      break;
    case '2B':
      c.pos = keyed([[15.5, [2.7, 1.5, 1.45]], [CUE.reflHoldA, [2.2, 1.5, 1.45]], [CUE.reflHoldB, [1.75, 1.5, 1.5]], [26.4, [-2.85, 1.55, 2.02]], [27, [-2.95, 1.55, 2.03]]], t, easeInOut);
      c.look = keyed([[15.5, [-3.95, 1.25, 0.9]], [CUE.reflHoldB, [-3.95, 1.25, 1.0]], [24.0, [-3.95, 1.85, 2.2]], [27, [-3.95, 1.75, 2.2]]], t, easeInOut);
      c.fov = 45; c.focus = keyed([[15.5, [-3.6, 1.2, 2.2]], [24, [-3.95, 2.3, 2.2]]], t); c.blur = 0.003;
      break;
    case '3A':
      c.pos = keyed([[27, [0, 1.55, 0.35]], [33.5, [0, 1.55, -5.3]]], t, easeSine);
      c.look = [0, 1.32, -12];
      c.fov = 32; c.focusDist = Math.abs(c.pos[2] + 12); c.blur = 0.003;
      break;
    case '3B':
      c.pos = [0, 1.55, -7.4];
      c.look = [0, 1.25, -12];
      c.fov = 34; c.focus = [0, 1.2, -12]; c.blur = 0.003;
      break;
    case '3C': {
      // turn back toward where we came from: the corridor is longer now
      const a = Math.PI * easeInOut((t - CUE.turnBack) / (CUE.turnEnd - CUE.turnBack));
      c.pos = [0, 1.55, -7.4];
      c.look = [Math.sin(a) * -0.6, 1.36, -7.4 - Math.cos(a) * 6];
      c.fov = 34; c.essential = true; c.blur = 0.009;
      c.focusDist = lerp(1.35, 18, easeInOut((t - CUE.rackFocus) / 1.5));
      break;
    }
    case '4A':
      c.pos = [0.36, 1.47, -3.97];
      c.look = [0.9, 1.42, -4.22];
      c.fov = 30; c.focus = PHONE; c.blur = 0.01;
      break;
    case '5A':
      c.pos = keyed([[54, [0, 1.55, -6.6]], [59, [0, 1.52, -11.45]]], t, easeInOut);
      c.look = keyed([[54, [0, 1.3, -12.5]], [59, [0.05, 1.3, -13.6]]], t, easeInOut);
      c.fov = 36; c.focus = [0.3, 1.3, -12.9]; c.blur = 0.004;
      break;
    case '5B': {
      const a = Math.PI * easeInOut((t - CUE.turnToGlass) / (CUE.glassReveal - CUE.turnToGlass));
      c.pos = [0.1, 1.5, lerp(-1.42, -0.7, easeInOut((t - CUE.turnToGlass) / 1.7))];
      c.look = [0.1 - Math.sin(a) * 0.15, lerp(1.75, 1.3, easeInOut((t - CUE.turnToGlass) / 1.7)), c.pos[2] + Math.cos(a) * 3];
      c.fov = 54; c.essential = true; c.blur = 0.004;
      c.focus = t < CUE.turnToGlass ? [0, 2.1, 0] : [0, 1.2, -2.0];
      break;
    }
    case '6A':
      c.pos = [0.05, 1.5, -0.95];
      c.look = [0, 1.25, 12];
      c.fov = 46; c.blur = 0.003; c.focusDist = t < CUE.stepAside + 1 ? 2.6 : 20;
      break;
    case '6B':
      c.pos = keyed([[77.5, [5.4, 3.4, -4.2]], [83, [4.9, 3.1, -2.6]]], t, easeSine);
      c.look = keyed([[77.5, [-0.6, 1.6, 30]], [83, [-0.6, 1.6, 31]]], t, easeSine);
      c.fov = 48; c.blur = 0.0;
      break;
    case '6C': {
      const z = walkerZ(t);
      c.pos = [0.02, 1.58, z];
      c.look = [0, 1.25 + (z - 20) * 0.006, 40];
      c.fov = 44; c.focusDist = Math.max(1.5, 31.6 - z); c.blur = 0.003;
      break;
    }
    case '7A':
      c.pos = [0.62, 1.32, 29.95];
      c.look = [-0.18, 1.2, 31.6];
      c.fov = 36; c.focus = [-0.05, 1.18, 31.62]; c.blur = 0.02;
      break;
    case '8A':
      c.pos = keyed([[107, [0.0, 1.6, 34.8]], [CUE.moveOut, [0.0, 1.6, 34.8]], [CUE.title, [0.0, 1.6, 37.6]]], t, easeInOut);
      c.look = [0, 1.25, 51.6];
      c.fov = 40; c.blur = 0.0;
      break;
    default:
      break;
  }
  return c;
}

export function cameraAt(t) {
  const shot = shotAt(t);
  const c = raw(t, shot);
  c.shot = shot;
  c.scene = shot.scene;
  // Reduced motion: shrink every move toward the shot's mid-point. Turns that
  // carry story information (the corridor turn, the elevator turn) are kept.
  if (SETTINGS.motion < 1 && !c.essential && shot.scene !== 'none') {
    const mid = raw((shot.start + shot.end) / 2, shot);
    const k = SETTINGS.motion;
    c.pos = c.pos.map((v, i) => lerp(mid.pos[i], v, k));
    c.look = c.look.map((v, i) => lerp(mid.look[i], v, k));
  }
  return c;
}
