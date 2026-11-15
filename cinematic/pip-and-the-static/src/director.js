import * as THREE from 'three';
import { CUE, POSTS, FRIENDS, TOUCH, NARRATION } from './timeline.js';
import { cameraAt, ANCH, tapeCam } from './shots.js';
import { crtText } from './crt.js';
import { clamp, lerp, smooth, pulse, keyed, easeInOut, easeOut, fluorescent, mulberry32, hash } from './util.js';

// Timeline time → the archive (the thread, the deck, the label) and the tape
// (Pip, the board of friends). The tape runs in real time, except while it's
// paused (70–80), when it holds its frame.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const CHALK = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Segoe Print", sans-serif';
const between = (t, a, b) => t >= a && t < b;

// Tape time: what moment of the tape is on screen.
export const tapeTime = (t) => (between(t, CUE.paused, CUE.resume) ? CUE.paused : t);

function drawTestPattern(g, w, h) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  const bw = w / 7;
  bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw + 1, h * 0.67); });
  g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.67, w, h * 0.33);
  g.strokeStyle = 'rgba(240,240,240,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h * 0.4, h * 0.3, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#0b0b0b'; g.fillRect(w * 0.2, h * 0.32, w * 0.6, h * 0.17);
  g.font = `700 ${Math.round(h * 0.07)}px ${SANS}`; g.fillStyle = '#ececec'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('THE STOOPID SHOW', w / 2, h * 0.405);
  g.font = `600 ${Math.round(h * 0.05)}px ${SANS}`; g.fillStyle = '#d8d8d8'; g.fillText('BROADCAST DAY ENDED', w / 2, h * 0.83);
}

// ── The board of friends ──
// Each name in its own hand: its own size, slant and wobble. STOO is written
// last, in chalk, a letter at a time, at the bottom.
const NAME_POS = FRIENDS.map((n, i) => ({ u: i % 2 ? 0.66 : 0.3, v: 0.3 + Math.floor(i / 2) * 0.095 }));
const STOO = { u: 0.5, v: 0.88, text: 'STOO' };
export const namePoint = (i) => NAME_POS[i];
export const stooProgress = (t) => clamp((t - CUE.write) / (CUE.written - CUE.write)) * STOO.text.length;

function chalkText(g, s, x, y, size, seed, { alpha = 1, slant = 0, part = 99 } = {}) {
  const rnd = mulberry32(seed);
  g.save(); g.translate(x, y); g.transform(1, 0, slant, 1, 0, 0);
  g.font = `700 ${size}px ${CHALK}`; g.textBaseline = 'middle';
  const widths = [...s].map((c) => g.measureText(c).width * 0.95);
  let cx = -widths.reduce((a, b) => a + b, 0) / 2;
  [...s].forEach((c, i) => {
    if (i >= part) return;
    const k = clamp(part - i);
    g.save(); g.translate(cx, (rnd() - 0.5) * size * 0.14); g.rotate((rnd() - 0.5) * 0.14);
    g.beginPath(); g.rect(-2, -size, widths[i] * k + 4, size * 2); g.clip();
    g.globalAlpha = alpha * (0.82 + rnd() * 0.15);
    g.fillStyle = '#f1efe6'; g.fillText(c, 0, 0);
    g.restore();
    cx += widths[i] + size * 0.04;
  });
  g.restore();
}

function drawBoard(g, w, h, t) {
  const rnd = mulberry32(9);
  g.fillStyle = '#25392f'; g.fillRect(0, 0, w, h);
  // old erasures
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(220,230,220,${0.02 + rnd() * 0.04})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 60 + rnd() * 160, 16 + rnd() * 30, rnd() * 0.4, 0, Math.PI * 2); g.fill(); }
  chalkText(g, 'PIP’S FRIENDS', w / 2, h * 0.12, 70, 1);
  g.strokeStyle = 'rgba(240,240,230,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.24, h * 0.19); g.quadraticCurveTo(w * 0.5, h * 0.215, w * 0.76, h * 0.185); g.stroke();
  FRIENDS.forEach((n, i) => {
    const p = NAME_POS[i], r2 = mulberry32(100 + i);
    // the ones who stopped watching are fainter, rubbed out and written in again
    const faint = (i % 3 === 1) ? 0.55 : 1;
    chalkText(g, n, p.u * w, p.v * h, 40 + r2() * 18, 200 + i, { slant: (r2() - 0.5) * 0.5, alpha: faint });
  });
  const part = stooProgress(t);
  if (part > 0) chalkText(g, STOO.text, STOO.u * w, STOO.v * h, 96, 999, { part, slant: -0.08 });
}

function drawThread(g, w, h, t, { from = 0, upto = 99, panel = false } = {}) {
  const posts = POSTS.filter(([t0], i) => i >= from && i < upto && t >= t0);
  if (!panel) {
    g.fillStyle = '#0b1120'; g.fillRect(0, 0, w, h);
    g.font = `600 18px ${MONO}`; g.fillStyle = '#6f8fb8'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('FORUM › TV › LOST SHOWS', 28, 30);
    g.fillStyle = '#26324a'; g.fillRect(28, 46, w - 56, 2);
  } else {
    g.fillStyle = 'rgba(8,12,22,0.86)'; g.fillRect(0, h * 0.56, w, h * 0.44);
  }
  const y0 = panel ? h * 0.56 + 30 : 82;
  posts.forEach(([t0, s], i) => {
    const y = y0 + i * (panel ? 46 : 70);
    const typed = s.slice(0, Math.max(0, Math.floor((t - t0) * 40)));
    g.fillStyle = '#3a4a68'; g.beginPath(); g.arc(46, y, 12, 0, Math.PI * 2); g.fill();
    g.font = `400 13px ${MONO}`; g.fillStyle = '#5d7090'; g.textAlign = 'left';
    if (!panel) g.fillText(`guest_${(4021 + i * 773) % 9000}  ·  ${3 + i * 2} yrs ago`, 70, y - 16);
    g.font = `500 ${panel ? 22 : 24}px ${SANS}`; g.fillStyle = '#dfe6f2';
    g.fillText(typed, 70, y + (panel ? 0 : 8));
  });
}

export function makeDirector(W) {
  const A = W.archive, P = W.pip;
  const v = new THREE.Vector3();
  A.crt.screen.getWorldPosition(v); ANCH.crt = v.toArray();
  A.tape.getWorldPosition(v); ANCH.tape = v.toArray();
  A.playBtn.getWorldPosition(v); ANCH.play = v.toArray();
  P.board.updateMatrixWorld();
  P.head.getWorldPosition(v); ANCH.pipHead = v.toArray();
  ANCH.board = P.boardPoint(0.5, 0.5).toArray();

  const drawOn = (tex, key, fn) => {
    const c = tex.canvas;
    if (c._key === key) return;
    c._key = key;
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    fn(g, c.width, c.height);
    tex.needsUpdate = true;
  };

  // ── Pip at tape time tt ──
  const shoulder = new THREE.Vector3(), target = new THREE.Vector3();
  function aimArm(arm, wp) {
    arm.getWorldPosition(shoulder);
    const d = target.copy(wp).sub(shoulder);
    arm.rotation.set(Math.atan2(-d.z, -d.y) * 0.4, 0, Math.atan2(d.x, -d.y));
  }
  function setPip(tt) {
    const speaking = NARRATION.some((n) => tt >= n.start && tt < n.end - 0.3);
    const up = tt < CUE.popUp ? 0 : easeOut((tt - CUE.popUp) / 0.45) * (1 + 0.12 * Math.sin(Math.min(1, (tt - CUE.popUp) / 0.8) * Math.PI) * (1 - smooth(CUE.popUp + 0.4, CUE.popUp + 1.0, tt)));
    // where Pip stands: centre stage, then over by the board
    const x = keyed([[0, -0.35], [CUE.board, -0.35], [CUE.board + 1.4, 0.18], [CUE.forgot, 0.18], [CUE.resume, 0.18], [CUE.write - 0.6, 0.3], [CUE.stare, 0.3], [CUE.stare + 1.2, 0.12]], tt, easeInOut);
    const bob = Math.sin(tt * 2.6) * 0.012;
    P.pip.position.set(x, lerp(0.25, 0.95, up) + bob, 0.05);
    P.pip.rotation.z = Math.sin(tt * 1.3) * 0.04;
    // the head: to camera, to the board, down, back to camera
    const toBoard = keyed([[0, 0], [CUE.board, 0], [CUE.board + 1, 1], [CUE.grape, 1], [CUE.forgot, 0.6], [CUE.forgot + 6, 0.8], [CUE.paused, 0.3], [CUE.resume, 0.3], [CUE.oneMore + 1.6, 1], [CUE.written + 0.6, 1], [CUE.stare, 0]], tt, easeInOut);
    const down = keyed([[0, 0], [CUE.forgot, 0], [CUE.forgot + 2, 0.25], [CUE.paused - 3, 0.1], [CUE.paused, 0]], tt, easeInOut);
    P.head.rotation.set(down - toBoard * 0.05, toBoard * 0.75, Math.sin(tt * 0.9) * 0.05 + (tt > CUE.stare ? 0.12 * smooth(CUE.stare, CUE.stare + 1.5, tt) : 0));
    // the mouth moves while Pip talks; during the theme it hums, a little open
    const hum = between(tt, CUE.theme, CUE.blue) ? 0.35 : 0;
    const open = speaking ? 0.25 + 0.75 * Math.abs(Math.sin(tt * 13)) : 0.12 + hum;
    P.mouth.scale.set(1, open, 1);
    // arms: the left one hangs; the right waves, touches the names, writes
    const [L, R] = P.arms;
    L.rotation.set(0, 0, -0.25 + Math.sin(tt * 1.7) * 0.05);
    P.chalk.visible = false;
    P.pip.updateMatrixWorld(true); P.board.updateMatrixWorld();
    if (between(tt, CUE.popUp + 0.5, CUE.hi + 2.6)) {
      R.rotation.set(0, 0, 2.5 + Math.sin(tt * 10) * 0.35);
    } else if (between(tt, TOUCH.start - 0.6, TOUCH.start + TOUCH.each * 7)) {
      const i = Math.min(FRIENDS.length - 1, Math.max(0, Math.floor((tt - TOUCH.start) / TOUCH.each)));
      const n = namePoint(i);
      aimArm(R, P.boardPoint(n.u - 0.12, n.v));
    } else if (between(tt, CUE.forgot + 4, CUE.paused)) {
      const s = (tt - CUE.forgot - 4) * 0.5;
      aimArm(R, P.boardPoint(0.35 + 0.25 * Math.sin(s), 0.55 + 0.08 * Math.cos(s * 1.3)));
    } else if (between(tt, CUE.write - 0.8, CUE.written + 0.4)) {
      const k = stooProgress(tt) / 4;
      const wob = Math.sin(tt * 18) * 0.012;
      const p = P.boardPoint(0.34 + 0.32 * k, 0.88 + wob);
      aimArm(R, p);
      R.userData.hand.getWorldPosition(v);
      P.chalk.visible = true; P.chalk.position.copy(v).add(new THREE.Vector3(-0.02, 0, 0.03)); P.chalk.rotation.set(0.4, 0, 0.8);
    } else {
      R.rotation.set(0, 0, 0.25 + Math.sin(tt * 1.5 + 1) * 0.05);
    }
    // the light: bright, then lower as friends are forgotten; lowest for the stare
    const dark = keyed([[0, 0], [CUE.forgot - 0.1, 0], [CUE.forgot + 1, 0.45], [CUE.resume, 0.45], [CUE.resume + 0.5, 0.35], [CUE.stare, 0.55], [CUE.blue, 0.6]], tt, easeInOut);
    P.key.intensity = 40 * (1 - dark) * (0.96 + 0.04 * Math.sin(tt * 17));
    P.fill.intensity = 0.9 * (1 - dark * 0.8);
    drawOn(P.boardTex, `b${Math.round(stooProgress(tt) * 8)}`, (g, w, h) => drawBoard(g, w, h, tt));
    return dark;
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      const tt = tapeTime(t);
      const dark = setPip(tt);
      // keep the tape camera where the tape had it (it pushes in, as the tape did)
      const tc = tapeCam(tt);
      P.feed.camera.position.set(...tc.pos); P.feed.camera.lookAt(...tc.look);
      P.feed.camera.fov = tc.fov; P.feed.camera.updateProjectionMatrix(); P.feed.camera.updateMatrixWorld();
      if (cam.scene === 'pip') return { cam, feeds: [], portals: [], warm: dark };
      if (cam.scene !== 'archive') return { cam, feeds: [], portals: [], warm: 0 };

      // ── The archive ──
      const fl = fluorescent(t, 5, 0.25);
      A.bulbLight.intensity = 3.2 * fl; A.bulb.material.color.setRGB(3, 2.7, 2.0).multiplyScalar(fl);
      const crt = A.crt;
      let feed = false;
      if (t < CUE.tracking) {
        crt.draw(`thread${Math.floor(t * 40)}`, (g, w, h) => drawThread(g, w, h, t, { upto: 5 }));
        crt.set({ power: 1, noise: 0.03, time: t, bright: 1.0 });
      } else if (t < CUE.tape) {
        crt.draw('none', (g) => g.clearRect(0, 0, 1, 1));
        crt.set({ power: 1, feedMix: smooth(CUE.tracking + 0.8, CUE.tape, t), feed: P.feed.texture, noise: 0.85 - 0.6 * smooth(CUE.tracking + 0.8, CUE.tape, t), roll: (t - CUE.tracking) * -0.6, time: t, bright: 1.1 });
        feed = true;
      } else if (t < CUE.blue) {
        const paused = between(t, CUE.paused, CUE.resume);
        crt.draw(`tape${paused}${Math.floor(t * 40)}`, (g, w, h) => {
          g.clearRect(0, 0, w, h);
          if (paused) {
            crtText(g, '❚❚ PAUSE', 34, 34, { size: 26, align: 'left', color: '#f2f2f2', glow: 6 });
            drawThread(g, w, h, t, { from: 5, panel: true });
          }
        });
        crt.set({ power: 1, feedMix: 1, feed: P.feed.texture, noise: paused ? 0.05 : 0.08, time: paused ? CUE.paused + (t * 7 % 0.5) : t, bright: 1.1 });
        feed = true;
      } else if (t < CUE.bars) {
        crt.draw('blue', (g, w, h) => { g.fillStyle = '#1430b8'; g.fillRect(0, 0, w, h); crtText(g, '■ STOP', 34, 34, { size: 26, align: 'left', color: '#f2f2f2', glow: 6 }); });
        crt.set({ power: 1, noise: 0.03, time: t, bright: 1.0 });
      } else {
        crt.draw('bars', (g, w, h) => drawTestPattern(g, w, h));
        crt.set({ power: 1, noise: 0.03 + 0.4 * pulse(t, CUE.bars - 0.05, CUE.bars + 0.4, 0.05, 0.3), time: t, bright: 0.95 });
      }
      // the deck's display
      const state = t < CUE.press ? 'STOP' : (between(t, CUE.paused, CUE.resume) ? 'PAUSE' : (t < CUE.blue ? 'PLAY' : 'STOP'));
      const secs = Math.max(0, Math.floor(tt - CUE.press));
      drawOn(A.deckDispTex, `${state}${secs}`, (g, w, h) => {
        g.fillStyle = '#030805'; g.fillRect(0, 0, w, h);
        g.font = `700 30px ${MONO}`; g.fillStyle = '#62ffb0'; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillText(`${state === 'PLAY' ? '▶' : state === 'PAUSE' ? '❚❚' : '■'} 0:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, 12, h / 2 + 2);
      });
      // the label: and later, in the same marker, a newer line
      const airs = clamp((t - CUE.airs) / 1.2);
      drawOn(A.tapeLabelTex, `label${Math.round(airs * 20)}`, (g, w, h) => {
        g.fillStyle = '#e6e0c8'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#b84a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 30); g.lineTo(w, 30); g.stroke();
        g.font = `700 44px "Marker Felt", "Comic Sans MS", ${SANS}`; g.fillStyle = '#16140f'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('PIP — EP. 7', 22, 62);
        g.fillText('DO NOT AIR', 22, 108);
        if (airs > 0) {
          g.save(); g.beginPath(); g.rect(20, 136, 480 * airs, 60); g.clip();
          g.font = `700 38px "Marker Felt", "Comic Sans MS", ${SANS}`; g.fillText('(AIRS NIGHTLY)', 22, 162); g.restore();
        }
      });
      // your hand presses PLAY
      A.palm.visible = between(t, CUE.press - 1.2, CUE.press + 0.9);
      if (A.palm.visible) {
        const btn = new THREE.Vector3(...ANCH.play);
        const k = easeOut((t - (CUE.press - 1.2)) / 1.0) * (1 - easeInOut((t - (CUE.press + 0.2)) / 0.7));
        A.palm.position.copy(btn).add(new THREE.Vector3(0.04, 0.12, 0.35).multiplyScalar(1 - k)).add(new THREE.Vector3(0, 0.004 - 0.004 * pulse(t, CUE.press - 0.05, CUE.press + 0.15, 0.05, 0.1), 0.0));
        A.palm.rotation.set(0.15, 0.1, 0);
      }
      A.dust.material.uniforms.uTime.value = t;
      A.dust.setLight(0, A.bulb.position.toArray(), [0, -1, 0], 0.2, 0.6, 3, 0.04 * fl, 0xffd9a0);
      for (let i = 1; i < 4; i++) A.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
      return { cam, feeds: feed ? [{ feed: P.feed, scene: P.scene }] : [], portals: [], warm: 0 };
    },
  };
}
