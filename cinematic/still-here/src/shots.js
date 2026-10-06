import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, smooth, clamp, lerp, noise1, SETTINGS } from './util.js';

// Camera for STILL HERE.
// The false home is shot like a commercial: level, centred, eased moves that
// start and stop exactly. The real room is shot by a person: a slight roll,
// a walking bob, a sit that settles, breathing.

export const TV = [0, 0.876, 0.47];
export const HANDLE = [12.55, 1.0, 4.995];
export const DOORWAY_W = [9.97, 1.1, 3.0];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const aim = (p, yaw, pitchY, dist = 3) => [p[0] + Math.sin(yaw) * dist, p[1] + pitchY, p[2] + Math.cos(yaw) * dist];

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
      const close = add(TV, [0, 0, 0.58]);
      const far = [0.5, 1.5, 4.3];
      c.pos = keyed([[0, close], [CUE.pullStart, close], [CUE.pullStop, far]], t, easeInOut);
      if (t < CUE.turnStart) c.look = keyed([[0, TV], [CUE.pullStart, TV], [CUE.pullStop, [0.5, 0.65, 1.3]]], t, easeInOut);
      else {
        // turn, pause with the television readable at the left edge, then on to the hallway
        const a = keyed([[CUE.turnStart, 0], [15.6, 0.4], [17.6, 0.46], [CUE.turnEnd, 1.09]], t, easeInOut);
        c.look = aim(c.pos, Math.PI - a, lerp(-0.85, -0.3, easeInOut((t - CUE.turnStart) / 7)), 3);
        c.essential = true;
      }
      c.fov = t < CUE.pullStart ? 40 : lerp(40, 44, easeInOut((t - CUE.pullStart) / 7));
      c.focus = TV; c.blur = 0.004;
      break;
    }
    case '2A':
      c.pos = keyed([[20, [2.3, 1.6, 3.0]], [28, [9.25, 1.6, 3.0]]], t, (x) => easeInOut(x) * 0.15 + x * 0.85);
      c.look = [14, 1.38, 3.0];
      c.fov = 40; c.focusDist = 4; c.blur = 0.003;
      break;
    case '2B':
      c.pos = keyed([[28, [9.3, 1.6, 3.0]], [33, [9.78, 1.6, 3.0]]], t, easeInOut);
      c.look = keyed([[28, [14, 1.15, 3.0]], [30.6, [14, 1.15, 3.0]], [32.8, [14, 1.98, 3.0]]], t, easeInOut);
      c.fov = 42; c.focus = [13.9, 1.6, 3.0]; c.blur = 0.004;
      break;
    case '3A': {
      const book = [12.92, 0.49, 3.0], disp = [13.62, 0.66, 1.85];
      c.pos = keyed([[33, [12.45, 0.93, 3.0]], [CUE.slide, [12.45, 0.93, 3.0]], [36.8, [12.68, 0.9, 2.35]], [46.2, [12.68, 0.9, 2.35]], [47.9, [12.6, 1.5, 2.6]]], t, easeInOut);
      c.look = keyed([[33, book], [CUE.slide, book], [36.8, disp], [46.2, disp], [47.9, [12.2, 1.12, 5.0]], [CUE.tiltDown, [12.2, 1.12, 5.0]], [56.6, [12.2, 0.12, 5.0]]], t, easeInOut);
      c.fov = t < CUE.slide ? 34 : 38;
      c.focus = t < CUE.slide ? book : t < 46.5 ? disp : [12.2, 0.5, 5.0]; c.blur = 0.008;
      c.essential = t > 46 && t < 48;
      break;
    }
    case '4A':
      c.pos = keyed([[58, [12.6, 1.5, 2.6]], [64, [12.25, 1.45, 3.7]]], t, easeInOut);
      c.look = keyed([[58, [12.2, 0.12, 5.0]], [64, [12.2, 0.42, 5.0]]], t, easeInOut);
      c.fov = 38; c.focusDist = 2.0; c.blur = 0.004;
      break;
    case '4B':
      // the chair (dust on the seat), the book with no other pages, then up the cord to the camera
      c.pos = keyed([[64, [12.78, 1.3, 1.45]], [68, [12.82, 1.34, 1.55]]], t, easeInOut);
      c.look = keyed([[64, [12.0, 0.4, 2.2]], [65.4, [12.05, 0.42, 2.25]], [66.3, [12.9, 0.45, 3.0]], [67.9, [13.75, 1.75, 3.4]]], t, easeInOut);
      c.fov = 46; c.focus = keyed([[64, [12.05, 0.47, 2.15]], [65.6, [12.05, 0.47, 2.15]], [66.4, [12.9, 0.5, 3.0]], [67.6, [13.8, 1.9, 3.1]]], t, easeInOut); c.blur = 0.006;
      break;
    case '4C':
      c.pos = keyed([[68, [12.25, 1.45, 3.7]], [72, [12.25, 1.5, 3.85]], [74.6, [12.22, 1.55, 4.15]]], t, easeInOut);
      c.look = keyed([[68, [12.2, 0.42, 5.0]], [69.4, [12.2, 0.42, 5.0]], [72, [12.2, 1.05, 5.0]]], t, easeInOut);
      c.fov = 40; c.focus = [12.2, 1.0, 5.0]; c.blur = 0.004;
      break;
    case '5A':
      c.pos = [13.02, 1.78, 3.0];
      c.look = [13.9, 1.84, 3.0];
      c.fov = 34; c.focus = [13.9, 1.85, 3.0]; c.blur = 0.006;
      break;
    case '5B': {
      const p = [12.25, 1.55, 4.15];
      const back = Math.atan2(DOORWAY_W[0] - p[0], DOORWAY_W[2] - p[2]);   // toward the doorway we came through
      let yaw;
      if (t < CUE.turnToDoor) yaw = lerp(0, back, easeInOut((t - CUE.turnBack) / 1.0));
      else yaw = lerp(back, 0, easeInOut((t - CUE.turnToDoor) / 2.0));
      c.pos = t < CUE.turnToDoor ? p : keyed([[CUE.turnToDoor, p], [87, [12.3, 1.5, 4.35]]], t, easeInOut);
      c.look = aim(c.pos, yaw, -0.25, 3);
      c.fov = lerp(40, 34, smooth(CUE.turnBack, 81, t) * (1 - smooth(CUE.turnToDoor, 86, t)));
      c.essential = true;
      c.focusDist = t > 80.4 && t < CUE.turnToDoor + 0.5 ? 6 : 1.5; c.blur = 0.004;
      break;
    }
    case '6A':
      c.pos = keyed([[87, [12.4, 1.2, 4.55]], [96, [12.42, 1.18, 4.6]]], t, easeInOut);
      c.look = HANDLE;
      c.fov = 36; c.focus = HANDLE; c.blur = 0.012;
      break;
    case '6B':
      c.pos = keyed([[96, [12.42, 1.18, 4.6]], [97.4, [12.36, 1.4, 4.45]], [101, [12.22, 1.56, 4.82]]], t, easeInOut);
      c.look = keyed([[96, HANDLE], [97.4, [12.25, 1.15, 6.5]], [101, [12.2, 1.2, 7.5]]], t, easeInOut);
      c.fov = 40; c.focusDist = 2.5; c.blur = 0.004;
      break;
    case '7A': {
      // a person: doorway, a few steps, sitting down beside the bed
      const walking = clamp((t - CUE.walk) / (CUE.sit - CUE.walk)) > 0 && t < CUE.sit ? 1 : 0;
      const b = body(t, 1, walking);
      const sit = clamp((t - CUE.sit) / 1.5);
      const sitY = lerp(1.55, 1.1, easeInOut(sit)) - 0.05 * Math.sin(Math.PI * clamp(sit * 1.15)) * (1 - sit);
      let p;
      if (t < CUE.walk) p = [1.4, 1.58, 0.42];
      else if (t < CUE.sit) p = keyed([[CUE.walk, [1.4, 1.58, 0.42]], [104.6, [1.72, 1.57, 1.45]], [CUE.sit, [1.86, 1.55, 1.78]]], t, (x) => x);
      else p = [lerp(1.86, 2.06, easeInOut(sit)), sitY, lerp(1.78, 1.9, easeInOut(sit))];
      const still = t > CUE.sit + 1.6 ? 0.35 : 1;
      c.pos = [p[0] + b.dx * still, p[1] + b.dy * still, p[2] + b.dz * still];
      const lookStand = [3.0, 0.6, 2.45];
      const lookSit = [3.0, 0.56, 2.44];
      const lk = t < CUE.sit ? lookStand : keyed([[CUE.sit, lookStand], [CUE.sit + 1.6, lookSit]], t, easeInOut);
      c.look = [lk[0] + b.lx * still, lk[1] + b.ly * still, lk[2]];
      c.roll = b.roll;
      c.essential = t < CUE.sit + 1.6;   // walking in and sitting down is the story
      c.fov = t < CUE.sit ? 44 : 44 + 4 * easeInOut(sit); c.focusDist = t < CUE.sit ? 2.0 : 1.2; c.blur = 0.006;
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
