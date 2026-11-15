import { CUE, shotAt } from './timeline.js';
import { keyed, easeSine, easeInOut, lerp, noise1, SETTINGS } from './util.js';

// Camera for PIP AND THE STATIC.
// In the archive: the operator, close to the set, then the room, then the tape.
// On the tape: the studio camera that taped it, on a pedestal, with the slow
// zooms of an old kids' show; later, the zooms go where they shouldn't.

export const ANCH = { crt: [0, 1.0, 1.55], tape: [-0.06, 0.69, 1.78], play: [0.12, 0.66, 1.73], pipHead: [-0.35, 1.37, 0.05], board: [0.9, 1.55, -0.35] };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const mid = (a, b, k = 0.5) => a.map((v, i) => lerp(v, b[i], k));

// The tape's own camera at tape time tt (the feed uses it too).
export function tapeCam(tt) {
  const wide = { pos: [0.15, 1.45, 3.3], look: [0.15, 1.4, 0], fov: 34 };
  const head = [ANCH.pipHead[0], ANCH.pipHead[1], ANCH.pipHead[2]];
  const pipBoard = [0.55, 1.45, -0.1];
  const pos = keyed([[0, wide.pos], [CUE.board, wide.pos], [CUE.board + 1.5, [0.4, 1.5, 3.1]], [CUE.grape, [0.4, 1.5, 3.1]], [CUE.forgot, [0.3, 1.45, 3.2]], [CUE.paused, [0.25, 1.5, 3.0]], [CUE.resume, [0.4, 1.5, 3.1]], [CUE.stare, [0.4, 1.5, 3.1]], [CUE.theme, [0.3, 1.45, 2.9]]], tt, easeInOut);
  const look = keyed([[0, wide.look], [CUE.board, wide.look], [CUE.board + 1.5, pipBoard], [CUE.grape, pipBoard], [CUE.forgot, [0.25, 1.4, -0.1]], [CUE.paused - 4, [0.2, 1.4, 0.05]], [CUE.paused, [0.18, 1.4, 0.05]], [CUE.resume, pipBoard], [CUE.stare, pipBoard], [CUE.stare + 1.6, [0.14, 1.36, 0.05]], [CUE.theme, [0.12, 1.38, 0.05]]], tt, easeInOut);
  const fov = keyed([[0, 34], [CUE.board, 34], [CUE.board + 1.5, 32], [CUE.grape, 32], [CUE.forgot, 36], [CUE.paused, 14], [CUE.resume, 30], [CUE.stare, 30], [CUE.stare + 2.5, 15], [CUE.theme, 12]], tt, easeInOut);
  return { pos, look, fov };
}

function raw(t, shot) {
  const c = { pos: [0, 1.5, 0], look: [0, 1.5, -1], fov: 40, focus: null, blur: 0.004, roll: 0, essential: false };
  const crt = ANCH.crt;
  const front = (d, up = 0.05, side = 0) => [crt[0] + side, crt[1] + up, crt[2] + d];
  switch (shot.id) {
    case '1A':
      c.pos = keyed([[0, front(0.62, 0.04)], [CUE.archive, front(0.52, 0.03)]], t, easeSine);
      c.look = crt; c.fov = 34; c.focus = crt; c.blur = 0.012;
      break;
    case '2A':
      // pull back into the room; then down to the deck, the label, PLAY
      c.pos = keyed([[CUE.archive, front(0.52, 0.03)], [CUE.archive + 3.6, [1.1, 1.62, 3.6]], [CUE.archive + 4.6, [1.0, 1.6, 3.5]], [CUE.press - 1.6, [0.18, 1.05, 2.25]], [CUE.tracking, [0.15, 1.02, 2.18]]], t, easeInOut);
      c.look = keyed([[CUE.archive, crt], [CUE.archive + 3.6, [-0.2, 1.1, 0.6]], [CUE.archive + 4.6, [-0.2, 1.1, 0.6]], [CUE.press - 1.6, mid(ANCH.tape, ANCH.play)], [CUE.tracking, mid(ANCH.tape, ANCH.play)]], t, easeInOut);
      c.fov = keyed([[CUE.archive, 34], [CUE.archive + 3.6, 48], [CUE.archive + 4.6, 48], [CUE.press - 1.6, 34]], t, easeInOut);
      c.focus = c.look; c.blur = 0.01;
      break;
    case '2B': case '6A':
      c.pos = keyed([[shot.start, front(0.75, 0.06, 0.06)], [shot.end, front(0.62, 0.05, 0.05)]], t, easeSine);
      c.look = crt; c.fov = 32; c.focus = crt; c.blur = 0.012;
      break;
    case '8A':
      c.pos = keyed([[shot.start, front(0.9, 0.08)], [shot.end, front(1.2, 0.12)]], t, easeSine);
      c.look = crt; c.fov = 34; c.focus = crt; c.blur = 0.01;
      break;
    case '8B':
      // the label, close
      c.pos = keyed([[CUE.label, add(ANCH.tape, [0.05, 0.24, 0.2])], [CUE.title, add(ANCH.tape, [0.04, 0.2, 0.17])]], t, easeSine);
      c.look = add(ANCH.tape, [0.0, 0.01, 0.01]); c.fov = 30; c.focus = ANCH.tape; c.blur = 0.03;
      c.essential = true;
      break;
    default: {
      // on the tape: the studio camera
      const tc = tapeCam(t);
      Object.assign(c, tc); c.focusDist = 3; c.blur = 0.0015;
      c.essential = true;   // the zooms are the tape's, not ours
      break;
    }
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
  }
  return c;
}
