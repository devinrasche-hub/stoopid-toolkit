import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, lerp, noise1, SETTINGS } from './util.js';

// Camera for LOAD MORE REPLIES.
// Two places only: the main CRT, read close, and the log under the lamp.
// The deeper the thread goes, the closer the camera sits to the glass.

export const ANCH = { crt: [-0.74, 1.05, 0.62], crtN: [0.2, 0, 0.98], log: [-0.3, 0.8, 1.08], logL: [-0.38, 0.8, 1.08], logR: [-0.2, 0.8, 1.05], ball: [-0.7, 0.82, 1.1] };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const over = (p, up = 0.2, back = 0.16, side = 0) => [p[0] + side, p[1] + up, p[2] + back];

function drift(t, amt) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  return [n(1, 0.3) * 0.004 * amt, n(2, 0.27) * 0.003 * amt, n(3, 0.31) * 0.004 * amt];
}

function raw(t, shot) {
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false, drift: 1 };
  const crt = ANCH.crt, n = ANCH.crtN;
  const facing = (d, up, side = 0) => add(add(add(crt, n, d), [0, up, 0]), [side, 0, 0]);
  const atLog = (p, s0, s1) => { c.pos = keyed([[shot.start, over(p, 0.34, 0.27, 0.02)], [shot.end, over(p, 0.3, 0.24, 0.02)]], t, easeSine); c.look = p; c.fov = s0 || 34; c.focus = p; c.blur = 0.03; };
  switch (shot.id) {
    case '1A': atLog(ANCH.logL); break;
    case '3B': case '4B': atLog(ANCH.logL); break;
    case '6B': atLog(ANCH.logL); break;
    case '9A': atLog(ANCH.logR); c.essential = true; break;
    case '2A':
      c.pos = keyed([[CUE.comment, facing(1.0, 0.24, 0.04)], [CUE.deeper, facing(0.8, 0.18, 0.03)]], t, easeSine);
      c.look = crt; c.fov = 34; c.focus = crt; c.blur = 0.012;
      break;
    case '3A':
      c.pos = keyed([[CUE.deeper, facing(0.78, 0.16, 0.02)], [CUE.log2, facing(0.66, 0.12, 0.02)]], t, easeSine);
      c.look = crt; c.fov = 30; c.focus = crt; c.blur = 0.014;
      break;
    case '4A':
      c.pos = keyed([[CUE.narrow, facing(0.6, 0.1)], [CUE.log3, facing(0.5, 0.07)]], t, easeSine);
      c.look = crt; c.fov = 26; c.focus = crt; c.blur = 0.016;
      break;
    case '6A':
      // almost; there; it opens out, and the camera eases back with it
      c.pos = keyed([[CUE.bottom, facing(0.5, 0.07)], [CUE.opens - 1.2, facing(0.48, 0.06)], [CUE.opens + 1.6, facing(0.74, 0.12)], [CUE.log4, facing(0.76, 0.13)]], t, easeInOut);
      c.look = crt; c.fov = keyed([[CUE.bottom, 26], [CUE.opens - 1.2, 24], [CUE.opens + 1.6, 32]], t, easeInOut); c.focus = crt; c.blur = 0.014;
      break;
    case '7A': {
      // the reply box, and your hand, still, beside the ball
      const m = crt.map((x, i) => lerp(x, ANCH.ball[i], 0.55));
      c.pos = keyed([[CUE.box, [-0.5, 1.42, 1.72]], [CUE.posted, [-0.53, 1.38, 1.6]]], t, easeSine);
      c.look = m; c.fov = 40; c.focus = crt; c.blur = 0.008;
      c.essential = true;
      break;
    }
    case '8A':
      c.pos = keyed([[CUE.posted, facing(0.78, 0.16)], [CUE.last, facing(0.66, 0.12)]], t, easeSine);
      c.look = crt; c.fov = 30; c.focus = crt; c.blur = 0.012;
      c.essential = true;
      break;
    case '10A':
      c.pos = keyed([[CUE.room, [1.95, 1.72, 4.62]], [CUE.title, [1.86, 1.7, 4.46]]], t, easeSine);
      c.look = [-0.3, 1.0, 0.7]; c.fov = 46; c.focusDist = 3.8; c.blur = 0.002; c.drift = 0;
      break;
    default: break;
  }
  if (c.drift) c.pos = add(c.pos, drift(t, c.drift * SETTINGS.motion));
  return c;
}

export function cameraAt(t) {
  const shot = shotAt(t);
  const c = raw(t, shot);
  c.shot = shot; c.scene = shot.scene;
  if (SETTINGS.motion < 1 && !c.essential && shot.scene !== 'none') {
    const m = raw((shot.start + shot.end) / 2, shot);
    const k = SETTINGS.motion;
    c.pos = c.pos.map((v, i) => lerp(m.pos[i], v, k));
    c.look = c.look.map((v, i) => lerp(m.look[i], v, k));
  }
  return c;
}
