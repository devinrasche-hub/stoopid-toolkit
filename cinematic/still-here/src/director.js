import * as THREE from 'three';
import { CUE } from './timeline.js';
import { cameraAt } from './shots.js';
import { crtText } from './crt.js';
import { clamp, lerp, smooth, pulse, easeInOut, easeOut } from './util.js';

// Timeline time → state of the false home, the chamber and the real room.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const between = (t, a, b) => t >= a && t < b;
const WARM = new THREE.Color(0xffc489), TEALC = new THREE.Color(0x5fa59a);

// The previous film's last card, laid out for a 4:3 screen that overflows the
// frame vertically: frame-relative y → canvas y, so the hand-off from the
// full-frame card to the CRT is invisible.
export function drawAutoplayCard(g, w, h, t, { fullFrame = false } = {}) {
  // frame px (1920×1080 reference) → canvas px
  const S = fullFrame ? 1 : h / (1080 * 1.336);
  const Y = (fy) => fullFrame ? fy * h : h / 2 + (fy - 0.5) * 1080 * 1.336 * S;
  const txt = (s, fy, size, color, spacing, weight = '400', alpha = 1) => {
    g.save(); g.globalAlpha = alpha; g.font = `${weight} ${size * S}px ${SANS}`; g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = `${spacing * S}px`;
    g.fillText(s, w / 2, Y(fy)); g.restore();
  };
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  txt('THE STOOPID SHOW', 0.405, 26, '#d9d6c6', 16);
  txt('PLEASE HOLD', 0.5, 70, '#d6e6e0', 26, '300');
  txt('END OF TRANSMISSION', 0.585, 20, '#8a9692', 12);
  const cx = w / 2, cy = Y(0.69);
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 34 * S); grd.addColorStop(0, 'rgba(255,170,70,0.55)'); grd.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = grd; g.fillRect(cx - 40 * S, cy - 40 * S, 80 * S, 80 * S);
  g.fillStyle = '#ffb347'; g.fillRect(cx - 9 * S, cy - 4 * S, 18 * S, 8 * S);
  txt('AUTOPLAY STARTING…', 0.735, 17, '#7d8682', 6);
  if (t >= CUE.upNext) txt('UP NEXT: STILL HERE', 0.79, 24, '#d6e6e0', 10, '400', smooth(CUE.upNext, CUE.upNext + 0.15, t));
  if (t >= CUE.selected) txt('SELECTED FOR YOU', 0.84, 15, '#ffb347', 8, '400', smooth(CUE.selected, CUE.selected + 0.15, t));
}

export function makeDirector(W) {
  const { home: H, chamber: C, real: R } = W;
  H.toChamber.toAnchor.position.copy(C.anchor.position); H.toChamber.toAnchor.rotation.copy(C.anchor.rotation);
  H.toReal.toAnchor.position.copy(R.anchor.position); H.toReal.toAnchor.rotation.copy(R.anchor.rotation);
  const col = new THREE.Color();

  // ── THE FALSE HOME ───────────────────────────────────────────────────────
  function home(t, cam) {
    const shot = cam.shot.id;
    const feeds = [], portals = [];
    // Light: warm, until it stops pretending
    const tealK = smooth(CUE.teal, CUE.teal + 0.25, t);
    H.warm.forEach((w) => {
      col.copy(WARM).lerp(TEALC, tealK);
      w.light.color.copy(col);
      w.light.intensity = w.base * lerp(1, 0.8, tealK);
      if (w.shade) w.shade.emissive.setRGB(0.9, 0.62, 0.32).lerp(new THREE.Color(0.25, 0.6, 0.55), tealK);
      if (w.mat) w.mat.color.setRGB(2.4, 1.6, 0.8).lerp(new THREE.Color(0.6, 1.6, 1.4), tealK);
    });
    H.ambient.intensity = lerp(0.55, 0.9, tealK);

    // The television
    const tv = H.tv;
    if (t < 9.5) {
      tv.draw(`card${t >= CUE.upNext}${t >= CUE.selected}`, (g, w, h) => drawAutoplayCard(g, w, h, t));
      tv.set({ power: 1, noise: 0.01, time: t, bright: 1.0, light: 0.5, glass: 0.5 });
    } else {
      const knew = t >= CUE.knewYou;
      tv.draw(`home${knew}`, (g, w, h) => {
        g.fillStyle = '#0a0806'; g.fillRect(0, 0, w, h);
        if (!knew) { crtText(g, 'SELECTED FOR YOU', w / 2, h / 2, { size: 40, color: '#ffb347', spacing: 10, glow: 10, alpha: 0.85 }); return; }
        crtText(g, 'WE KNEW', w / 2, h * 0.4, { size: 110, color: '#f2e6cf', weight: '700', spacing: 10, glow: 14, font: SANS });
        crtText(g, 'YOU’D LIKE THIS.', w / 2, h * 0.6, { size: 92, color: '#f2e6cf', weight: '700', spacing: 6, glow: 14, font: SANS });
      });
      tv.set({ power: 1, noise: 0.03, time: t, bright: knew ? 1.1 : 0.8, light: 0.8 });
    }

    // Pictures in the hallway: the same empty couch, rendered live from three angles
    if (shot === '2A' || shot === '1A' && t > 19.5) H.photoFeeds.forEach((p) => feeds.push({ feed: p.feed, scene: H.scene }));

    // The recording light
    const rec = t >= CUE.recOn ? 1 : 0;
    H.recMat.color.setRGB(4 * rec + 0.05, 0.25 * rec + 0.01, 0.12 * rec + 0.01);
    H.recLight.intensity = 0.18 * rec;

    // The bedside tally: instructions
    let bd = 'TAKE 01';
    if (t >= CUE.bePresent) bd = 'BE PRESENT.';
    if (t >= CUE.lookNatural) bd = 'LOOK NATURAL.';
    if (t >= CUE.again) bd = 'AGAIN.';
    H.bedDisplay.draw(bd, t >= CUE.bePresent ? 1.8 : 0.4);
    // The camera's own tally
    let cd = ' ';
    if (t >= CUE.endSession) cd = 'LEAVING WILL END|YOUR SESSION.';
    if (t >= CUE.audience) cd = 'YOUR AUDIENCE|IS STILL HERE.';
    H.camDisplay.draw(cd, t >= CUE.endSession ? 1.8 : 0.3);

    // Beyond the wall: a strip of real light under it, then the seams of a door
    const strip = smooth(CUE.tiltDown + 0.2, CUE.tiltDown + 1.6, t) * (t < CUE.doorOpen ? 1 : 0);
    const seams = smooth(CUE.doorForms, CUE.doorForms + 3.0, t) * (t < CUE.doorOpen ? 1 : 0);
    const lit = (k) => new THREE.Color(1.6, 1.25, 0.85).multiplyScalar(k);
    H.stripMat.color.copy(lit(strip));
    H.seamL.color.copy(lit(seams * 0.42)); H.seamR.color.copy(lit(seams * 0.42));
    H.seamT.color.copy(lit(smooth(CUE.doorForms + 1.2, CUE.doorForms + 3.4, t) * 0.36 * (t < CUE.doorOpen ? 1 : 0)));
    H.beyondLight.intensity = 0.06 * strip + 0.04 * seams;
    // the panel becomes a door: a little darker, a few millimetres proud, a handle
    const form = easeInOut((t - CUE.doorForms) / 3.4);
    // same paint as the wall until it isn't: a shade darker, a door's worth of difference
    H.doorMat.color.set(0xd2d8c8).multiplyScalar(lerp(1, 0.9, form));
    H.door.position.z = lerp(0.02, -0.004, form);
    H.handle.scale.set(1, 1, Math.max(0.001, form));
    H.handle.visible = form > 0.01;
    // the handle turns, the door opens away from us
    H.lever.rotation.z = -0.75 * easeInOut((t - CUE.handleTurn) / 1.2) * (1 - 0.3 * smooth(CUE.doorOpen + 0.5, CUE.doorOpen + 1.2, t));
    H.doorPivot.rotation.y = -1.3 * easeInOut((t - CUE.doorOpen) / 2.6);

    // Portals: the doorway behind us → the chamber; the new door → the real room
    H.toChamber.mesh.visible = between(t, CUE.turnBack, CUE.handle);
    H.toReal.mesh.visible = t >= CUE.doorOpen;
    if (H.toChamber.mesh.visible) { chamber(t); portals.push({ portal: H.toChamber, far: C.scene }); }
    if (H.toReal.mesh.visible) { real(t, null); portals.push({ portal: H.toReal, far: R.scene }); }

    H.dust.material.uniforms.uTime.value = t;
    H.dust.setLight(0, H.nightLight.position.toArray(), [-1, 0.2, -0.3], 0.2, 0.6, 3.5, 0.03, 0xffb070);
    for (let i = 1; i < 4; i++) H.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    return { feeds, portals };
  }

  // ── THE CHAMBER (only ever seen through the doorway) ─────────────────────
  function chamber(t) {
    C.audience.material.uniforms.uTime.value = t;
  }

  // ── THE REAL ROOM ────────────────────────────────────────────────────────
  function real(t, cam) {
    R.blanketShape(t);
    // his hand, resting on the sheet beside the pillow once he sits
    const seated = smooth(CUE.sit + 0.7, CUE.sit + 1.6, t);
    R.dadArm.visible = seated > 0.01;
    R.dadArm.position.set(2.575, 0.468 + (1 - seated) * 0.12, 2.64);
    R.dadArm.rotation.set(0, 0.62, 0.04);
    // the child's hand comes out from under the top of the quilt and rests near his
    const out = easeInOut((t - CUE.handOut) / 1.8);
    R.childHand.position.set(lerp(2.66, 2.635, out), lerp(0.47, 0.476, out), lerp(2.44, 2.575, out));
    R.childHand.rotation.set(0, -0.35, 0.05);
    R.childHand.visible = t > CUE.handOut - 0.1;
    R.lamp.intensity = 3.6; R.lampFill.intensity = 0.55;
    return { feeds: [], portals: [] };
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene === 'home') return { cam, ...home(t, cam) };
      if (cam.scene === 'real') return { cam, ...real(t, cam) };
      return { cam, feeds: [], portals: [] };
    },
  };
}
