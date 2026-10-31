import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, lerp, noise1, SETTINGS } from './util.js';

// Camera for PLEASE SHARE.
// The camera is the operator again: standing at the console. Tonight it
// watches screens, and once, it acts.

// Filled in once the world is built (director.js): where things are.
export const ANCH = {
  card: [0, 0.78, 1.04], rule: [], write: [0, 0.78, 1.2],
  crt: [-0.74, 1.05, 0.62], crtN: [0.2, 0, 0.98], crtAt: () => [-0.74, 1.05, 0.62],
  mons: [[0.82, 0.975, 0.58], [1.18, 0.975, 0.6], [1.53, 0.975, 0.64]], mon3: [1.53, 0.975, 0.64], mon3N: [-0.37, 0, 0.93],
  ball: [-0.7, 0.82, 1.1],
};
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const mid = (a, b, k = 0.5) => a.map((v, i) => lerp(v, b[i], k));
const over = (p, up = 0.2, back = 0.16, side = 0) => [p[0] + side, p[1] + up, p[2] + back];

function drift(t, amt) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  return [n(1, 0.3) * 0.004 * amt, n(2, 0.27) * 0.003 * amt, n(3, 0.31) * 0.004 * amt];
}

function raw(t, shot) {
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false, drift: 1 };
  const crt = ANCH.crt, n = ANCH.crtN;
  const facing = (p, d, up) => add(add(p, n, d), [0, up, 0]);   // in front of the main CRT
  switch (shot.id) {
    case '1A':
      // the next night: 05's wide, locked off
      c.pos = keyed([[0, [1.95, 1.72, 4.62]], [CUE.open, [1.86, 1.7, 4.46]]], t, easeSine);
      c.look = [-0.3, 1.0, 0.7]; c.fov = 46; c.focusDist = 3.8; c.blur = 0.002; c.drift = 0;
      break;
    case '2A':
      // the main CRT: it loads, and stops
      c.pos = keyed([[CUE.open, facing(crt, 1.05, 0.26)], [CUE.shares, facing(crt, 0.72, 0.18)]], t, easeSine);
      c.look = crt; c.fov = keyed([[CUE.open, 32], [CUE.shares, 28]], t, easeSine);
      c.focus = crt; c.blur = 0.012;
      break;
    case '3A': {
      // across to the monitors as each one is taken; then all of them
      const [m1, m2, m3] = ANCH.mons;
      c.pos = keyed([[CUE.shares, [0.05, 1.42, 1.95]], [CUE.share3 + 1.5, [0.25, 1.4, 1.9]], [CUE.mon3, [0.0, 1.46, 2.15]]], t, easeInOut);
      c.look = keyed([[CUE.shares, crt], [CUE.share1 - 0.4, m1], [CUE.share2 - 0.6, m1], [CUE.share2 - 0.1, m2], [CUE.share3 - 0.6, m2], [CUE.share3 - 0.1, m3], [CUE.share3 + 1.5, m3], [CUE.mon3, mid(crt, m3, 0.55)]], t, easeInOut);
      c.fov = keyed([[CUE.shares, 30], [CUE.share1 - 0.4, 24], [CUE.share3 + 1.5, 24], [CUE.mon3, 46]], t, easeInOut);
      c.focus = keyed([[CUE.shares, crt], [CUE.share1 - 0.4, m1], [CUE.share2 - 0.1, m2], [CUE.share3 - 0.1, m3]], t, easeInOut); c.blur = 0.01;
      break;
    }
    case '3B': {
      // monitor 3, close: two points of light
      const m = ANCH.mon3, mn = ANCH.mon3N;
      c.pos = keyed([[CUE.mon3, add(add(m, mn, 0.62), [0, 0.15, 0])], [CUE.joke, add(add(m, mn, 0.44), [0, 0.1, 0])]], t, easeSine);
      c.look = m; c.fov = 24; c.focus = m; c.blur = 0.014;
      break;
    }
    case '5A':
      // the share sheet
      c.pos = keyed([[CUE.sheet, facing(crt, 0.9, 0.22)], [CUE.anchor, facing(crt, 0.74, 0.18)]], t, easeSine);
      c.look = crt; c.fov = 30; c.focus = crt; c.blur = 0.012;
      break;
    case '5B': {
      // the KIDDO row, close
      const row = ANCH.crtAt(300, 404);
      c.pos = keyed([[CUE.anchor, facing(row, 0.62, 0.14)], [CUE.choice, facing(row, 0.52, 0.12)]], t, easeSine);
      c.look = row; c.fov = 24; c.focus = row; c.blur = 0.014;
      break;
    }
    case '6A': {
      // your hand on the trackball, and the screen it's fighting
      const m2 = mid(crt, ANCH.ball, 0.6);
      c.pos = keyed([[CUE.choice, [-0.5, 1.5, 1.82]], [CUE.stays, [-0.53, 1.48, 1.72]]], t, easeSine);
      c.look = m2; c.fov = 42; c.focus = crt; c.blur = 0.008;
      c.essential = true;
      break;
    }
    case '7A':
      // it stays: pull back until every screen is in frame
      c.pos = keyed([[CUE.stays, [-0.2, 1.36, 1.8]], [CUE.stays + 1.2, [-0.2, 1.36, 1.8]], [CUE.rule9, [1.55, 1.64, 4.15]]], t, easeInOut);
      c.look = keyed([[CUE.stays, crt], [CUE.stays + 1.2, crt], [CUE.rule9, [0.2, 0.98, 0.7]]], t, easeInOut);
      c.fov = keyed([[CUE.stays, 34], [CUE.rule9, 46]], t, easeInOut); c.focusDist = 2.6; c.blur = 0.003; c.drift = 0;
      c.essential = true;
      break;
    case '8A':
      // rule 9, in your hand
      c.pos = keyed([[CUE.rule9, over(ANCH.write, 0.32, 0.26, -0.07)], [CUE.title, over(ANCH.write, 0.28, 0.22, -0.06)]], t, easeSine);
      c.look = add(ANCH.write, [0.03, 0, -0.03]); c.fov = 38; c.focus = ANCH.write; c.blur = 0.03;
      c.essential = true;
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
    c.roll *= k;
  }
  return c;
}
