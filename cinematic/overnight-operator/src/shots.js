import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, lerp, noise1, SETTINGS } from './util.js';

// Camera for OVERNIGHT OPERATOR.
// The camera is the operator: standing at the console, calm, obeying. Close
// shots read the card from where you'd stand; it never reaches for anything.

// Filled in once the world is built (director.js): where things are.
export const ANCH = {
  card: [0, 0.78, 1.04], title: [0, 0.78, 0.9], rule: [], write: [0, 0.78, 1.15],
  crt: [-0.74, 1.05, 0.62], mon3: [1.53, 0.975, 0.64], mon3N: [-0.37, 0, 0.93],
  phone: [-0.37, 0.85, 1.1], talk: [0.32, 0.84, 1.1], clock: [0, 2.53, 0.06],
};
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const mid = (a, b, k = 0.5) => a.map((v, i) => lerp(v, b[i], k));

// Reading the card: from the operator's side, looking down at it.
const over = (p, up = 0.2, back = 0.16, side = 0) => [p[0] + side, p[1] + up, p[2] + back];

// A breath of handheld: tiny, slow drift. Never shake.
function drift(t, amt) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  return [n(1, 0.3) * 0.004 * amt, n(2, 0.27) * 0.003 * amt, n(3, 0.31) * 0.004 * amt];
}

function raw(t, shot) {
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false, drift: 1 };
  const R = ANCH.rule;
  switch (shot.id) {
    case '1A':
      // sign-off: the whole room, from the back corner, locked off
      c.pos = keyed([[0, [1.95, 1.72, 4.62]], [CUE.card, [1.86, 1.7, 4.46]]], t, easeSine);
      c.look = [-0.3, 1.0, 0.7]; c.fov = 46; c.focusDist = 3.8; c.blur = 0.002; c.drift = 0;
      break;
    case '2A':
      // down to the console; the lamp finds the card; read down to rule 1
      c.pos = keyed([[CUE.card, [0.35, 1.58, 2.3]], [CUE.lamp + 2.2, over(ANCH.title, 0.27, 0.22)], [CUE.readDown, over(ANCH.title, 0.25, 0.2)], [CUE.rule1 - 0.3, over(R[1], 0.21, 0.17)]], t, easeInOut);
      c.look = keyed([[CUE.card, ANCH.card], [CUE.lamp + 2.2, ANCH.title], [CUE.readDown, ANCH.title], [CUE.rule1 - 0.3, R[1]]], t, easeInOut);
      c.fov = keyed([[CUE.card, 40], [CUE.lamp + 2.2, 34], [CUE.rule1, 30]], t, easeInOut);
      c.focus = keyed([[CUE.card, ANCH.card], [CUE.readDown, ANCH.title], [CUE.rule1 - 0.3, R[1]]], t, easeInOut); c.blur = 0.03;
      break;
    case '3A':
      // the main CRT: the test pattern, then you, from behind
      c.pos = keyed([[CUE.rule1, [-0.22, 1.36, 1.82]], [CUE.rule2, [-0.38, 1.3, 1.5]]], t, easeSine);
      c.look = ANCH.crt; c.fov = keyed([[CUE.rule1, 34], [CUE.rule2, 29]], t, easeSine);
      c.focus = ANCH.crt; c.blur = 0.012;
      break;
    case '4A': case '4C': {
      // monitor 3: the studio chair
      const m = ANCH.mon3, n = ANCH.mon3N;
      const far = add(add(m, n, 1.05), [0.0, 0.3, 0]), near = add(add(m, n, 0.62), [0.0, 0.17, 0]);
      if (shot.id === '4A') { c.pos = keyed([[CUE.rule2, far], [CUE.faced, near]], t, easeInOut); c.fov = keyed([[CUE.rule2, 30], [CUE.faced, 25]], t, easeInOut); }
      else { c.pos = keyed([[CUE.awayAgain, add(near, n, 0.06)], [CUE.rule3, near]], t, easeSine); c.fov = 25; }
      c.look = m; c.focus = m; c.blur = 0.014;
      break;
    }
    case '4B':
      // look at the card until it isn't
      c.pos = keyed([[CUE.faced, over(R[2], 0.2, 0.15)], [CUE.awayAgain, over(R[2], 0.175, 0.13)]], t, easeSine);
      c.look = R[2]; c.fov = 30; c.focus = R[2]; c.blur = 0.035;
      break;
    case '5A': {
      // rule 3 and the talkback lamp, in one frame; do not answer
      const m2 = mid(R[3], ANCH.talk, 0.35);
      c.pos = keyed([[CUE.rule3, over(m2, 0.36, 0.3, -0.08)], [CUE.rule4, over(m2, 0.33, 0.27, -0.07)]], t, easeSine);
      c.look = m2; c.fov = 32; c.focus = R[3]; c.blur = 0.03;
      break;
    }
    case '6A':
      // rule 4, held too long
      c.pos = keyed([[CUE.rule4, over(R[4], 0.19, 0.15)], [CUE.rule6, over(R[4], 0.17, 0.135)]], t, easeSine);
      c.look = R[4]; c.fov = 30; c.focus = R[4]; c.blur = 0.035; c.drift = 0.5;
      break;
    case '7A': {
      // the request line rings; rule 6; the line light stays on
      const ph = ANCH.phone, wide = mid(ph, R[6], 0.45);
      c.pos = keyed([[CUE.rule6, over(wide, 0.46, 0.4, -0.02)], [CUE.ring2 + 0.8, over(wide, 0.42, 0.37, -0.02)], [CUE.pickedUp - 0.4, over(R[6], 0.2, 0.16)], [CUE.pickedUp + 1.4, over(ph, 0.36, 0.34, 0.06)], [CUE.clock, over(ph, 0.33, 0.31, 0.06)]], t, easeInOut);
      c.look = keyed([[CUE.rule6, wide], [CUE.ring2 + 0.8, wide], [CUE.pickedUp - 0.4, R[6]], [CUE.pickedUp + 1.4, ph], [CUE.clock, ph]], t, easeInOut);
      c.fov = keyed([[CUE.rule6, 36], [CUE.pickedUp - 0.4, 30], [CUE.pickedUp + 1.4, 30]], t, easeInOut);
      c.focus = keyed([[CUE.rule6, ph], [CUE.ring2 + 0.8, ph], [CUE.pickedUp - 0.4, R[6]], [CUE.pickedUp + 1.4, ph]], t, easeInOut); c.blur = 0.03;
      break;
    }
    case '8A':
      // the clock, over the glass: 4:58
      c.pos = [0.12, 1.32, 1.86];
      c.look = keyed([[CUE.clock, [0.05, 2.25, 0.2]], [CUE.rule7, ANCH.clock]], t, easeSine);
      c.fov = 30; c.focus = ANCH.clock; c.blur = 0.004;
      break;
    case '8B':
      // rule 7, scratched out; rule 8 below it. Lower, closer, raking.
      c.pos = keyed([[CUE.rule7, over(R[7], 0.13, 0.2)], [CUE.rule8, over(R[7], 0.12, 0.18)], [CUE.hand - 0.3, over(R[8], 0.14, 0.18)]], t, easeInOut);
      c.look = keyed([[CUE.rule7, R[7]], [CUE.rule8, R[7]], [CUE.hand - 0.3, R[8]]], t, easeInOut);
      c.fov = 30; c.focus = c.look; c.blur = 0.04;
      break;
    case '9A':
      // the hand writes the new rule 7
      c.pos = keyed([[CUE.hand, over(ANCH.write, 0.3, 0.24, -0.06)], [CUE.withdraw, over(ANCH.write, 0.27, 0.21, -0.05)], [CUE.wide, over(ANCH.write, 0.26, 0.2, -0.05)]], t, easeSine);
      c.look = add(ANCH.write, [0.03, 0, 0]); c.fov = 38; c.focus = ANCH.write; c.blur = 0.03;
      c.essential = true;
      break;
    case '10A':
      // shift change: the room again, from the back; the chair turns to you
      c.pos = keyed([[CUE.wide, [2.55, 1.62, 4.3]], [CUE.title, [2.4, 1.56, 4.05]]], t, easeSine);
      c.look = keyed([[CUE.wide, [-0.3, 1.0, 0.7]], [CUE.chair, [0.0, 0.9, 1.4]], [CUE.title, [0.25, 0.8, 2.0]]], t, easeInOut);
      c.fov = keyed([[CUE.wide, 46], [CUE.title, 40]], t, easeInOut); c.focusDist = 2.8; c.blur = 0.003; c.drift = 0;
      c.essential = true;
      break;
    default: break;
  }
  if (c.drift) {
    const d = drift(t, c.drift * SETTINGS.motion);
    c.pos = add(c.pos, d);
  }
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
