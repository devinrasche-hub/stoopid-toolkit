import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, lerp, noise1, SETTINGS } from './util.js';

// Camera for COUNT AGAIN.
// The operator walks this time: out the back door, down the hall, and in
// through the back door again. Walking has a small, steady bob; standing
// still has almost none.

export const ANCH = {
  card: [0, 0.78, 1.04], rule: [], rule9: [0, 0.78, 1.2],
  crt: [-0.74, 1.05, 0.62], mons: [[0.82, 0.975, 0.58], [1.18, 0.975, 0.6], [1.53, 0.975, 0.64], [1.87, 0.975, 0.74]],
  fourthN: [-0.48, 0, 0.88], mug: [0.62, 0.875, 1.12], clock: [0, 2.53, 0.06], micro: [0.1, 1.1, 9.95],
};
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const over = (p, up = 0.2, back = 0.16, side = 0) => [p[0] + side, p[1] + up, p[2] + back];

const DX = 2.3, BZ = 5.2;
// Coming in through the back door: from just outside it, into the room.
const ENTER = [[0, [DX, 1.62, BZ + 0.9]], [2.6, [1.85, 1.6, 3.9]]];

function sway(t, walk) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  const bob = Math.sin(t * Math.PI * 2 * 1.8);
  return [n(1, 0.3) * 0.004 + walk * 0.008 * Math.sin(t * Math.PI * 1.8), n(2, 0.27) * 0.003 + walk * 0.012 * Math.abs(bob), n(3, 0.31) * 0.004];
}

function raw(t, shot) {
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false, walk: 0 };
  const M = ANCH.mons;
  const enter = (t0) => keyed(ENTER.map(([dt, p]) => [t0 + dt, p]), t, easeInOut);
  switch (shot.id) {
    case '1A':
      c.pos = keyed([[0, [1.95, 1.72, 4.62]], [CUE.warmClose, [1.86, 1.7, 4.46]]], t, easeSine);
      c.look = [-0.2, 1.0, 0.8]; c.fov = 46; c.focusDist = 3.8; c.blur = 0.002;
      break;
    case '1B':
      // the card and the warm mug
      c.pos = keyed([[CUE.warmClose, over(ANCH.mug, 0.42, 0.46, -0.36)], [CUE.hall, over(ANCH.mug, 0.38, 0.42, -0.34)]], t, easeSine);
      c.look = add(ANCH.mug, [-0.3, -0.03, -0.08]); c.fov = 36; c.focus = ANCH.mug; c.blur = 0.03;
      break;
    case '2A':
      // out the back door, down the hall, to the door on the left
      c.pos = keyed([[CUE.hall, [1.2, 1.6, 3.2]], [CUE.hall + 2.6, [DX, 1.62, BZ - 0.3]], [CUE.hall + 5.2, [DX + 0.1, 1.62, BZ + 2.6]], [CUE.door1, [DX + 0.15, 1.6, BZ + 3.9]]], t, easeInOut);
      c.look = keyed([[CUE.hall, [DX, 1.5, BZ]], [CUE.hall + 2.6, [DX, 1.45, BZ + 4]], [CUE.hall + 5.2, [DX - 0.2, 1.3, BZ + 5]], [CUE.door1, [DX - 1.4, 1.2, BZ + 4.75]]], t, easeInOut);
      c.fov = 50; c.focusDist = 3; c.blur = 0.002; c.walk = 1;
      break;
    case '3A':
      // in through the back door: the control room again
      c.pos = enter(CUE.copy1); c.look = [-0.1, 1.0, 0.9]; c.fov = 48; c.focusDist = 3; c.blur = 0.002; c.walk = t < CUE.copy1 + 2.6 ? 1 : 0;
      break;
    case '3B':
      // the mug: cold
      c.pos = keyed([[CUE.cold, [1.55, 1.55, 3.2]], [CUE.cold + 2.5, over(ANCH.mug, 0.3, 0.32, 0.05)], [CUE.out2, over(ANCH.mug, 0.24, 0.24, 0.04)]], t, easeInOut);
      c.look = keyed([[CUE.cold, ANCH.mug], [CUE.out2, ANCH.mug]], t, easeInOut);
      c.fov = keyed([[CUE.cold, 44], [CUE.cold + 2.5, 32]], t, easeInOut); c.focus = ANCH.mug; c.blur = 0.025;
      c.walk = t < CUE.cold + 2.5 ? 0.6 : 0;
      break;
    case '4A':
      // back out
      c.pos = keyed([[CUE.out2, over(ANCH.mug, 0.6, 0.9, 0.3)], [CUE.door2, [DX, 1.62, BZ + 0.6]]], t, easeInOut);
      c.look = keyed([[CUE.out2, [DX, 1.3, BZ]], [CUE.door2, [DX - 0.6, 1.3, BZ + 4.75]]], t, easeInOut);
      c.fov = 48; c.focusDist = 3; c.blur = 0.002; c.walk = 1;
      break;
    case '4B': {
      // copy 2: in, the bars backwards, the wet ink
      const t0 = CUE.copy2;
      if (t < t0 + 3.2) { c.pos = enter(t0); c.look = keyed([[t0, [-0.1, 1.0, 0.9]], [t0 + 3.2, ANCH.crt]], t, easeInOut); c.fov = keyed([[t0, 48], [t0 + 3.2, 30]], t, easeInOut); c.walk = t < t0 + 2.6 ? 1 : 0; c.focusDist = 3; }
      else if (t < t0 + 5.4) { c.pos = keyed([[t0 + 3.2, [1.85, 1.6, 3.9]], [t0 + 5.4, [-0.1, 1.42, 1.9]]], t, easeInOut); c.look = keyed([[t0 + 3.2, ANCH.crt], [t0 + 5.4, ANCH.rule9]], t, easeInOut); c.fov = keyed([[t0 + 3.2, 30], [t0 + 5.4, 34]], t, easeInOut); c.walk = 0.7; c.focusDist = 2; }
      else { c.pos = keyed([[t0 + 5.4, [-0.1, 1.42, 1.9]], [t0 + 6.6, over(ANCH.rule9, 0.3, 0.24, -0.05)], [CUE.out3, over(ANCH.rule9, 0.27, 0.21, -0.05)]], t, easeInOut); c.look = ANCH.rule9; c.fov = 36; c.focus = ANCH.rule9; c.blur = 0.03; }
      c.blur = c.blur || 0.003;
      break;
    }
    case '5A':
      // the hall again: the break-room door, ajar
      c.pos = keyed([[CUE.out3, [DX + 0.15, 1.6, BZ + 2.4]], [CUE.fish, [DX + 0.3, 1.5, BZ + 4.55]]], t, easeInOut);
      c.look = keyed([[CUE.out3, [DX - 0.4, 1.3, BZ + 4.75]], [CUE.fish, ANCH.micro]], t, easeInOut);
      c.fov = 46; c.focusDist = 2.5; c.blur = 0.002; c.walk = 1;
      break;
    case '5B':
      // FISH. Through the gap, held.
      c.pos = keyed([[CUE.fish, [DX + 0.3, 1.5, BZ + 4.55]], [CUE.copy3, [DX - 0.1, 1.42, BZ + 4.65]]], t, easeSine);
      c.look = ANCH.micro; c.fov = keyed([[CUE.fish, 36], [CUE.copy3, 28]], t, easeSine); c.focus = ANCH.micro; c.blur = 0.006;
      break;
    case '6A': {
      // copy 3: in; the monitors; there are four
      const t0 = CUE.copy3;
      c.pos = keyed([[t0, ENTER[0][1]], [t0 + 2.6, ENTER[1][1]], [CUE.four, [1.0, 1.5, 2.6]], [CUE.rule5, [0.8, 1.48, 2.3]]], t, easeInOut);
      c.look = keyed([[t0, [-0.1, 1.0, 0.9]], [t0 + 2.6, [-0.1, 1.0, 0.9]], [CUE.four, [1.35, 1.0, 0.66]]], t, easeInOut);
      c.fov = keyed([[t0, 48], [CUE.four, 36]], t, easeInOut); c.walk = t < CUE.four ? 1 : 0; c.focusDist = 2; c.blur = 0.003;
      break;
    }
    case '6B':
      // rule 5
      c.pos = keyed([[CUE.rule5, over(ANCH.rule[5], 0.22, 0.18)], [CUE.count, over(ANCH.rule[5], 0.2, 0.16)]], t, easeSine);
      c.look = ANCH.rule[5]; c.fov = 30; c.focus = ANCH.rule[5]; c.blur = 0.035;
      break;
    case '6C': {
      // count: 1, 2, 3, 4. Count again: 1, 2, 3 … 4.
      const P = [0.95, 1.42, 1.95];
      const c0 = CUE.count, a = CUE.again;
      c.pos = P;
      c.look = keyed([[c0, M[0]], [c0 + 1.3, M[0]], [c0 + 1.8, M[1]], [c0 + 3.1, M[1]], [c0 + 3.6, M[2]], [c0 + 4.9, M[2]], [c0 + 5.6, M[3]], [a, M[3]],
        [a + 0.6, M[0]], [a + 1.6, M[0]], [a + 2.0, M[1]], [a + 3.0, M[1]], [a + 3.4, M[2]], [a + 4.4, M[2]], [a + 5.4, M[3]]], t, easeInOut);
      c.fov = 26; c.focus = c.look; c.blur = 0.01;
      c.essential = true;
      break;
    }
    case '7A': {
      // the fourth monitor: push in until it is the frame
      const m = M[3], n = ANCH.fourthN;
      c.pos = keyed([[CUE.window, [0.95, 1.42, 1.95]], [CUE.hood, add(add(m, n, 0.36), [0, 0.06, 0])], [CUE.ours, add(add(m, n, 0.32), [0, 0.05, 0])]], t, easeInOut);
      c.look = keyed([[CUE.window, m], [CUE.hood, m]], t, easeInOut);
      c.fov = keyed([[CUE.window, 26], [CUE.hood, 34]], t, easeInOut); c.focus = m; c.blur = 0.01;
      c.essential = true;
      break;
    }
    case '8A':
      // 4:59; then the mug, and a thread of steam
      c.pos = keyed([[CUE.ours, [0.35, 1.38, 1.95]], [CUE.tick + 0.9, [0.35, 1.38, 1.95]], [CUE.title, over(ANCH.mug, 0.3, 0.32, -0.08)]], t, easeInOut);
      c.look = keyed([[CUE.ours, ANCH.clock], [CUE.tick + 0.9, ANCH.clock], [CUE.title - 0.6, add(ANCH.mug, [0, 0.06, 0])]], t, easeInOut);
      c.fov = keyed([[CUE.ours, 30], [CUE.title - 0.6, 34]], t, easeInOut); c.focus = c.look; c.blur = 0.01;
      c.essential = true;
      break;
    default: break;
  }
  c.pos = add(c.pos, sway(t, c.walk * SETTINGS.motion));
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
