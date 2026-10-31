import * as THREE from 'three';
import { CUE, THREAD, REPLY, LOG } from './timeline.js';
import { cameraAt, ANCH } from './shots.js';
import { drawCard, cardKey, LAYOUT, CARD_W } from './card.js';
import { drawLog, logKey, penAt } from './logbook.js';
import { clamp, lerp, smooth, pulse, keyed, easeInOut, easeOut, fluorescent, noise1 } from './util.js';

// Timeline time → the thread on the main CRT (a passage that narrows as it
// goes down), the trackball, the reply box, and the moderation log.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const between = (t, a, b) => t >= a && t < b;
const linear = (x) => x;

// ── The thread ──
// Each level is narrower, from both sides. The bottom reply opens out again.
const CW = 960, CH = 720, FONT = 30, LH = 38;
const margin = (d) => 26 + d * 31;
const OP = '@overnight_operator';

function wrap(g, s, width) {
  const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > width && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur);
  return lines;
}

// Lay out a list of replies once: y, height, lines.
function layout(list) {
  const g = document.createElement('canvas').getContext('2d');
  g.font = `400 ${FONT}px ${SANS}`;
  let y = 120;
  return list.map(([d, author, age, text], i) => {
    const m = margin(d), lines = wrap(g, text, CW - m * 2 - 20);
    const more = i < list.length - 1 && list[i + 1][0] > d;     // a deeper level follows
    const h = 34 + lines.length * LH + (more ? 44 : 14);
    const b = { d, author, age, text, lines, y, h, more, m };
    y += h;
    return b;
  });
}
const DOWN = layout(THREAD);
// After you reply: the top of the thread, with you as the newest reply.
const TOP = layout([THREAD[0], [1, OP, 'just now', REPLY], ...THREAD.slice(1, 6)]);

// Which reply sits mid-screen over time (fractional index), going down.
const IDX = [[0, 0], [CUE.loadMore + 0.6, 0], [CUE.loadMore + 2.6, 2.2], [CUE.deeper, 3], [CUE.log2, 6.2], [CUE.narrow, 7], [CUE.log3, 10.4], [CUE.popup, 11.2], [CUE.bottom, 11.2], [CUE.opens, 14], [CUE.opens + 1.4, 15], [CUE.posted, 15], [CUE.posted + 0.6, 15.6]];
function scrollDown(t) {
  const f = keyed(IDX, t, easeInOut), i = Math.floor(f), k = f - i;
  const a = DOWN[Math.min(i, DOWN.length - 1)], b = DOWN[Math.min(i + 1, DOWN.length - 1)];
  return lerp(a.y + a.h / 2, b.y + b.h / 2, k) - CH * 0.48;
}

function drawBlock(g, b, y, t, { highlight = false, op = false } = {}) {
  const m = b.m;
  // the walls of the passage: darker the deeper it goes
  g.fillStyle = `rgba(2,4,5,${Math.min(0.92, 0.25 + b.d * 0.06)})`;
  g.fillRect(0, y, m - 8, b.h); g.fillRect(CW - m + 8, y, m - 8, b.h);
  g.fillStyle = '#2a3a40'; g.fillRect(m - 8, y, 2, b.h); g.fillRect(CW - m + 6, y, 2, b.h);
  // author and age
  g.font = `600 19px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = op ? '#ff9a4a' : (b.author === '[deleted]' ? '#6a7678' : '#8fb2c8');
  const head = `${b.author}  ·  ${b.age}`;
  g.fillText(head.length * 10 > CW - m * 2 ? b.author.slice(0, 9) : head, m + 6, y + 18);
  // the text
  g.font = `400 ${FONT}px ${SANS}`; g.fillStyle = highlight ? '#ffffff' : '#dde6e8';
  b.lines.forEach((s, i) => g.fillText(s, m + 6, y + 34 + LH * 0.55 + i * LH));
  if (b.more) {
    g.font = `700 18px ${SANS}`; g.fillStyle = '#5ab0ff';
    g.fillText('▾ LOAD MORE REPLIES', m + 6, y + b.h - 22);
  }
}

function drawThread(g, w, h, t) {
  g.fillStyle = '#0d1214'; g.fillRect(0, 0, w, h);
  const upK = easeInOut((t - CUE.up) / (CUE.top - CUE.up));
  const atTop = t >= CUE.up;
  const list = t >= CUE.top ? TOP : DOWN;
  // going down, or rushing back up after you've posted
  let sy = atTop ? lerp(DOWN[DOWN.length - 1].y + 200, 0, upK) : scrollDown(t);
  if (t >= CUE.top) sy = 0;
  const posted = t >= CUE.posted;
  for (const b of list) {
    const y = b.y - sy;
    if (y > h || y + b.h < 0) continue;
    drawBlock(g, b, y, t, { op: b.author === OP });
  }
  // the header, fixed
  g.fillStyle = '#0a0e10'; g.fillRect(0, 0, w, 64);
  g.font = `700 22px ${SANS}`; g.fillStyle = '#c9d6da'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(t >= CUE.top ? '2,108 replies' : 'Comments', 26, 34);
  g.font = `400 18px ${MONO}`; g.fillStyle = '#5d7078'; g.textAlign = 'right';
  g.fillText('THE STOOPID SHOW · old episode', w - 26, 34);
  g.fillStyle = '#1e2a2e'; g.fillRect(0, 64, w, 2);
  // the first LOAD MORE lights up and loads
  if (between(t, CUE.loadMore - 0.4, CUE.loadMore + 0.5)) {
    const b = DOWN[0], y = b.y - sy + b.h - 22;
    g.fillStyle = 'rgba(90,176,255,0.25)'; g.fillRect(b.m, y - 16, 260, 32);
  }
  // the bottom: the reply box, typing by itself
  if (t >= CUE.box && !atTop) {
    const last = DOWN[DOWN.length - 1], y = last.y + last.h + 10 - sy;
    const typed = REPLY.slice(0, t < CUE.typing ? 0 : Math.min(REPLY.length, Math.floor(keyed([[CUE.typing, 0], [CUE.typing + 1.4, 4], [CUE.typing + 3.4, 4], [CUE.typing + 5.6, REPLY.length]], t, linear))));
    g.strokeStyle = posted ? '#3a4a50' : '#5ab0ff'; g.lineWidth = 2; g.strokeRect(26, y, w - 52, 120);
    g.font = `400 26px ${SANS}`; g.textAlign = 'left';
    if (!posted) {
      g.fillStyle = typed ? '#e8eef0' : '#5d7078';
      g.fillText(typed || `Reply as ${OP}…`, 44, y + 42);
      if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = '#e8eef0'; g.fillRect(44 + (typed ? g.measureText(typed).width + 2 : 0), y + 26, 2, 32); }
      g.fillStyle = typed.length === REPLY.length ? '#5ab0ff' : '#2a3a40'; g.fillRect(w - 180, y + 72, 140, 36);
      g.font = `700 20px ${SANS}`; g.fillStyle = '#0a0e10'; g.textAlign = 'center'; g.fillText('REPLY', w - 110, y + 91);
    } else {
      g.fillStyle = '#8fd8a8'; g.fillText('Reply posted.', 44, y + 42);
      g.font = `600 19px ${SANS}`; g.fillStyle = '#ff9a4a'; g.fillText(`${OP}  ·  just now`, 44, y + 74);
      g.font = `400 ${FONT}px ${SANS}`; g.fillStyle = '#dde6e8'; g.fillText(REPLY, 44, y + 104);
    }
  }
  // the room, later: LOAD MORE REPLIES lights by itself
  if (t >= CUE.room) {
    const b = TOP[1], y = b.y + b.h - 22;
    const on = smooth(CUE.room + 1, CUE.room + 2, t);
    g.fillStyle = `rgba(90,176,255,${0.3 * on})`; g.fillRect(b.m, y - 16, 260, 32);
  }
}

export function makeDirector(W) {
  const S = W.station;
  const v = new THREE.Vector3();
  S.crt.screen.getWorldPosition(v); ANCH.crt = v.toArray();
  ANCH.crtN = new THREE.Vector3(0, 0, 1).applyQuaternion(S.crt.group.quaternion).toArray();
  ANCH.log = S.logPoint(700, 420).toArray();
  ANCH.logL = S.logPoint(380, 420).toArray();
  ANCH.logR = S.logPoint(1050, 260).toArray();
  ANCH.ball = S.ball.getWorldPosition(v).toArray();

  const drawOn = (canvas, tex, key, fn) => {
    if (canvas._key === key) return;
    canvas._key = key;
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    fn(g, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  const camLabel = (s) => (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = `600 22px ${MONO}`; g.fillStyle = 'rgba(235,235,225,0.85)'; g.textBaseline = 'top'; g.fillText(s, 16, 14);
  };
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.35, -Math.PI / 2, 'YXZ'));
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, -0.62, 'YXZ'));

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene !== 'station') return { cam, feeds: [], portals: [], warm: 0 };
      const id = cam.shot.id;

      // ── light ──
      const fl = fluorescent(t, 7, 0.08);
      S.lamp.intensity = 0.55 * fl; S.lampBulb.material.color.setRGB(3.2, 2.9, 2.3).multiplyScalar(fl);
      S.lampCone.material.uniforms.uIntensity.value = 0.035;
      S.stripLight.intensity = 5 * fluorescent(t, 3, 0.3); S.strip.material.color.setRGB(2.0, 2.2, 1.9).multiplyScalar(S.stripLight.intensity / 5);
      // last nights' things, at rest
      S.studioChair.userData.top.rotation.y = S.facingYaw + Math.PI;
      S.opChair.userData.top.rotation.y = Math.PI + 0.25;
      S.talkLamp.material.color.setRGB(0.12, 0.02, 0.01); S.talkLight.intensity = 0;
      if (S.fourth) S.fourth.group.visible = false;
      if (S.newOp) S.newOp.visible = false;
      if (S.steam) S.steam.forEach((sp) => (sp.material.opacity = 0));
      drawOn(S.cardCanvas, S.cardTex, 'dry', (g, w, h) => drawCard(g, w, h, 1));
      drawOn(S.clockCanvas, S.clockTex, t < CUE.room ? (t < CUE.log4 ? '1:12' : '2:14') : '2:16', (g, w, h) => {
        g.fillStyle = '#060202'; g.fillRect(0, 0, w, h);
        g.font = `700 118px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#ff2a10'; g.shadowBlur = 18; g.fillStyle = '#ff3a1e';
        g.fillText(t < CUE.log4 ? (t < CUE.log2 ? '1:12' : t < CUE.log3 ? '1:31' : '1:48') : (t < CUE.last ? '2:14' : '2:16'), w / 2, h / 2 + 4);
      });

      // ── The main CRT: the thread ──
      S.crt.draw(`thread${Math.floor(t * 30)}`, (g, w, h) => drawThread(g, w, h, t));
      S.crt.set({ power: 1, noise: 0.025, time: t, bright: 1.1 });
      const [m1, m2, m3] = S.monitors;
      m1.draw('hall', camLabel('CAM 1  HALL')); m1.set({ power: 1, feedMix: 1, feed: S.hallFeed.texture, noise: 0.06, time: t, bright: 0.9 });
      m2.draw('m2', (g, w, h) => { g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, w, h); }); m2.set({ power: 1, noise: 0.3, time: t, bright: 0.4 });
      m3.draw('studio', camLabel('CAM 3  STUDIO')); m3.set({ power: 1, feedMix: 1, feed: S.studioFeed.texture, noise: 0.05, time: t, bright: 1.0 });

      // ── The log ──
      drawOn(S.logCanvas, S.logTex, logKey(t), (g, w, h) => drawLog(g, w, h, t));

      // ── Hands ──
      // writing: whenever an entry is being written (and through the last one, until it stops)
      const writing = LOG.find((e) => between(t, e.start - 0.8, e.end + 0.6));
      const last = LOG[LOG.length - 1];
      const gone = t >= last.end + 0.5;      // the hand isn't there any more
      S.pen.visible = true; S.handRig.visible = false;
      const p = penAt(t);
      const rest = S.logPoint(1280, 760, 0.0085);
      if (writing && !(writing === last && gone)) {
        const k = easeOut((t - (writing.start - 0.8)) / 0.8) * (writing === last ? 1 : 1 - easeInOut((t - (writing.end + 0.1)) / 0.5));
        const tip = S.logPoint(p.x, p.y, p.down ? 0.0012 : 0.01);
        const away = tip.clone().add(new THREE.Vector3(0.28, 0.22, 0.2));
        S.pen.position.lerpVectors(away, tip, k);
        S.pen.quaternion.copy(tilt);
        S.handRig.visible = true; S.handRig.position.copy(S.pen.position); S.handRig.quaternion.copy(tilt);
        // the last entry: the pen stops mid-word and stays there, upright for a moment
        if (writing === last && t > last.end) { S.pen.position.copy(S.logPoint(p.x, p.y, 0.0012)); }
      } else if (gone) {
        // dropped where it stopped: it tips over onto the page
        const fall = easeOut((t - (last.end + 0.5)) / 0.35);
        const at = S.logPoint(p.x + 40 * fall, p.y + 20 * fall, lerp(0.0012, 0.0085, fall));
        S.pen.position.copy(at); S.pen.quaternion.copy(tilt).slerp(flat, fall);
      } else {
        // between entries the pen lies on the log, out of the way
        S.pen.position.copy(rest); S.pen.quaternion.copy(flat);
      }
      // scrolling: the palm on the trackball, small pushes as the thread moves; still for the reply box
      const scrolling = (between(t, CUE.comment + 0.6, CUE.log2) || between(t, CUE.narrow, CUE.log3) || between(t, CUE.bottom, CUE.log4) || between(t, CUE.box, CUE.posted + 1)) && !writing;
      S.palmRig.visible = scrolling;
      if (scrolling) {
        const top = new THREE.Vector3(...ANCH.ball).add(new THREE.Vector3(0, 0.03, 0));
        const still = between(t, CUE.box, CUE.posted + 1);
        const push = still ? 0 : Math.sin(t * 3.1) * 0.004;
        // during the reply box the hand has come off the ball: it rests beside it, not moving
        const pos = still ? top.clone().add(new THREE.Vector3(0.11, -0.072, 0.02)) : top.clone().add(new THREE.Vector3(0, 0, push));
        S.palmRig.position.copy(pos); S.palmRig.rotation.set(0, 0.2, 0);
        if (!still) S.ball.rotation.x = -t * 2.2;
      }

      // dust in the lamp
      S.dust.material.uniforms.uTime.value = t;
      S.dust.setLight(0, S.lamp.position.toArray(), new THREE.Vector3().subVectors(S.card.position, S.lamp.position).toArray(), 0.72, 0.9, 1.1, 0.3, 0xffe6c0);
      for (let i = 1; i < 4; i++) S.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

      const feeds = [];
      if (id === '10A') { feeds.push({ feed: S.hallFeed, scene: S.scene }); feeds.push({ feed: S.studioFeed, scene: S.scene }); }
      return { cam, feeds, portals: [], warm: 0 };
    },
  };
}
