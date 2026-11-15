import * as THREE from 'three';
import { CUE, WRITE, LOAD } from './timeline.js';
import { cameraAt, ANCH } from './shots.js';
import { crtText } from './crt.js';
import { drawCard, cardKey, ruleCenter, penAt, LAYOUT, CARD_W } from './card.js';
import { drawLoaded } from './image.js';
import { clamp, lerp, smooth, pulse, keyed, easeInOut, easeOut, noise1, fluorescent } from './util.js';

// Timeline time → the next night at the station: the message, the image
// loading, the shares, the share sheet and its cursor, the trackball, rule 9.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const between = (t, a, b) => t >= a && t < b;
const linear = (x) => x;
export const loadAt = (t) => keyed(LOAD, t, linear);

// The sign-off test pattern (05's), still up when the night starts.
export function drawTestPattern(g, w, h, { sub = 'BROADCAST DAY ENDED', sub2 = 'RESUMES 5:00 AM' } = {}) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  const bw = w / 7;
  bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw + 1, h * 0.67); });
  const low = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
  low.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, h * 0.67, bw + 1, h * 0.08); });
  g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.75, w, h * 0.25);
  g.strokeStyle = 'rgba(240,240,240,0.8)'; g.lineWidth = 4;
  g.beginPath(); g.arc(w / 2, h * 0.4, h * 0.3, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#0b0b0b'; g.fillRect(w * 0.2, h * 0.32, w * 0.6, h * 0.17);
  g.font = `700 ${Math.round(h * 0.07)}px ${SANS}`; g.fillStyle = '#ececec'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '4px';
  g.fillText('THE STOOPID SHOW', w / 2, h * 0.405);
  g.font = `600 ${Math.round(h * 0.05)}px ${SANS}`; g.fillStyle = '#d8d8d8';
  g.fillText(sub, w / 2, h * 0.83);
  g.font = `400 ${Math.round(h * 0.04)}px ${SANS}`; g.fillStyle = '#9a9a9a';
  g.fillText(sub2, w / 2, h * 0.92);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

// ── The share sheet (main CRT, 640×480) ──
const ROWS = ['GROUP CHAT (14)', 'WORK', 'MOM', 'KIDDO'];
const ROW0 = 214, ROWH = 58, ROWX = 40, ROWW = 560;
const CANCEL = { x: 452, y: 34, w: 148, h: 50 };
const rowY = (i) => ROW0 + i * ROWH;

// Where the cursor is (canvas px). It drifts down by itself; then you take it back up.
export function cursorAt(t) {
  const n = (s, f) => (noise1(t * f, s) - 0.5) * 2;
  const kid = [500, rowY(3) + 20];
  let p = keyed([[CUE.sheet, [560, 150]], [CUE.drift, [560, 150]], [CUE.drift + 2.4, [380, rowY(1) + 24]], [CUE.drift + 4.6, [330, rowY(2) + 26]], [CUE.onKiddo, kid]], t, easeInOut);
  if (t >= CUE.onKiddo) p = kid;
  if (t >= CUE.fight) {
    // up against the pull: progress, slip back, progress, slip, then CANCEL
    const k = keyed([[CUE.fight, 0], [CUE.fight + 1.1, 0.32], [CUE.fight + 1.6, 0.22], [CUE.fight + 2.8, 0.6], [CUE.fight + 3.2, 0.5], [CUE.cancel - 0.35, 1]], t, easeInOut);
    const target = [CANCEL.x + CANCEL.w * 0.45, CANCEL.y + CANCEL.h * 0.55];
    p = [lerp(kid[0], target[0], k), lerp(kid[1], target[1], k)];
    const wob = (t < CUE.cancel - 0.3) ? 1 : 0;
    p = [p[0] + n(1, 7) * 9 * wob, p[1] + n(2, 6) * 7 * wob];
  }
  return p;
}
const rowUnder = ([x, y]) => { for (let i = 0; i < 4; i++) if (y >= rowY(i) && y < rowY(i) + ROWH - 6 && x > ROWX && x < ROWX + ROWW) return i; return -1; };
const overCancel = ([x, y]) => x > CANCEL.x && x < CANCEL.x + CANCEL.w && y > CANCEL.y && y < CANCEL.y + CANCEL.h;

function drawSheet(g, w, h, t) {
  g.fillStyle = '#0c1012'; g.fillRect(0, 0, w, h);
  // the image, small, still loading
  g.fillStyle = '#20272a'; g.fillRect(36, 26, 168, 130);
  drawLoaded(g, 40, 30, 160, 120, loadAt(t), t, { grain: 1 });
  g.font = `600 22px ${MONO}`; g.fillStyle = '#9fb8b2'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(`${Math.floor(loadAt(t) * 100)}%`, 220, 136);
  g.font = `700 30px ${SANS}`; g.fillStyle = '#e8ecea'; g.fillText('SEND TO:', 220, 60);
  const cur = cursorAt(t), under = rowUnder(cur);
  ROWS.forEach((name, i) => {
    const y = rowY(i), hi = under === i;
    g.fillStyle = hi ? '#2a4a52' : '#151c1f'; g.fillRect(ROWX, y, ROWW, ROWH - 6);
    g.fillStyle = hi ? '#9fd8cf' : '#47585a'; g.beginPath(); g.arc(ROWX + 30, y + 26, 16, 0, Math.PI * 2); g.fill();
    g.font = `600 26px ${SANS}`; g.fillStyle = hi ? '#ffffff' : '#c9d2cf'; g.fillText(name, ROWX + 62, y + (name === 'KIDDO' && t >= CUE.onKiddo ? 18 : 26));
    if (name === 'KIDDO' && t >= CUE.onKiddo) {
      g.font = `400 19px ${SANS}`; g.fillStyle = hi ? '#d6ece8' : '#8a9a98';
      g.fillText('night dad. one more minute?', ROWX + 62, y + 40);
    }
  });
  // CANCEL: pressed for a moment at the click
  const pressed = between(t, CUE.cancel, CUE.cancel + 0.35), hov = overCancel(cur);
  g.fillStyle = pressed ? '#cc5500' : (hov ? '#3a2a20' : '#151c1f'); g.fillRect(CANCEL.x, CANCEL.y, CANCEL.w, CANCEL.h);
  g.strokeStyle = '#cc5500'; g.lineWidth = 2; g.strokeRect(CANCEL.x + 1, CANCEL.y + 1, CANCEL.w - 2, CANCEL.h - 2);
  g.font = `700 24px ${SANS}`; g.fillStyle = pressed ? '#140804' : '#ff8a3a'; g.textAlign = 'center';
  g.fillText('CANCEL', CANCEL.x + CANCEL.w / 2, CANCEL.y + CANCEL.h / 2 + 1);
  // the cursor
  const [cx, cy] = cur;
  g.save(); g.translate(cx, cy); g.scale(1.6, 1.6);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 17); g.lineTo(4.5, 13); g.lineTo(7.5, 20); g.lineTo(10, 19); g.lineTo(7, 12); g.lineTo(12.5, 12); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke();
  g.restore();
}

const clockMinutes = (t) => Math.floor(keyed([[0, 0], [CUE.open, 0], [120, 58]], t, linear));
const clockText = (m) => `${Math.floor(m / 60) === 0 ? 12 : Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const SHARE_T = [CUE.share1, CUE.share2, CUE.share3];

export function makeDirector(W) {
  const S = W.station;
  const vec = (v) => v.toArray();

  // ── Anchors for the camera ──
  ANCH.card = vec(S.cardPoint(CARD_W / 2, 800));
  for (let n = 1; n <= 8; n++) ANCH.rule[n] = vec(S.cardPoint(...ruleCenter(n)));
  const r9 = LAYOUT.hand.filter((h) => h.rule === 9);
  ANCH.write = vec(S.cardPoint(CARD_W / 2 - 40, (r9[0].y + r9[1].y) / 2 - 10));
  const cw = new THREE.Vector3();
  S.crt.screen.getWorldPosition(cw); ANCH.crt = vec(cw);
  ANCH.crtN = vec(new THREE.Vector3(0, 0, 1).applyQuaternion(S.crt.group.quaternion));
  ANCH.mons = S.monitors.map((m) => vec(m.screen.getWorldPosition(new THREE.Vector3())));
  ANCH.mon3 = ANCH.mons[2];
  ANCH.mon3N = vec(new THREE.Vector3(0, 0, 1).applyQuaternion(S.monitors[2].group.quaternion));
  ANCH.ball = vec(S.ball.getWorldPosition(cw));
  // a point on the main CRT, from its canvas px
  ANCH.crtAt = (px, py) => {
    const v = new THREE.Vector3((px / 640 - 0.5) * S.crt.width, (0.5 - py / 480) * S.crt.height, 0);
    return vec(S.crt.screen.localToWorld(v));
  };

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
    g.font = `600 22px ${MONO}`; g.fillStyle = 'rgba(235,235,225,0.85)';
    g.textBaseline = 'top'; g.fillText(s, 16, 14);
  };
  const gk = (t) => Math.floor(t * 12);   // grain moves 12 times a second

  function program(t) {
    const tv = S.crt;
    let warm = 0;
    const load = loadAt(t);
    // ── Main CRT ──
    if (t < CUE.message) {
      tv.draw('bars', (g, w, h) => drawTestPattern(g, w, h));
      tv.set({ power: 1, noise: 0.03, time: t, bright: 0.95 });
    } else if (t < CUE.open) {
      tv.draw('message', (g, w, h) => {
        g.fillStyle = '#0a0f10'; g.fillRect(0, 0, w, h);
        crtText(g, '1 NEW MESSAGE', w / 2, h * 0.3, { size: 46, color: '#e8f3ec', spacing: 4, glow: 12, weight: '700' });
        crtText(g, 'FROM: (unknown)', w / 2, h * 0.52, { size: 30, color: '#9ff2e2', spacing: 2, glow: 8 });
        crtText(g, 'SUBJECT: please share', w / 2, h * 0.64, { size: 30, color: '#9ff2e2', spacing: 2, glow: 8 });
      });
      tv.set({ power: 1, noise: 0.03 + 0.4 * pulse(t, CUE.message - 0.05, CUE.message + 0.3, 0.05, 0.25), time: t, bright: 1.05 });
    } else if (t < CUE.sheet || (t >= CUE.cancel + 0.4)) {
      // the viewer: the image, and how much of it there is
      const full = t >= CUE.stays;
      const pct = Math.floor(load * 100);
      const shareMsg = SHARE_T.findIndex((s) => between(t, s, s + 2.2));
      const must = t >= CUE.mustShare && !full;
      tv.draw(`view${pct}.${gk(t)}.${shareMsg}.${must}.${full}`, (g, w, h) => {
        g.fillStyle = '#080b0c'; g.fillRect(0, 0, w, h);
        if (full) { drawLoaded(g, 0, 0, w, h, 1, t); return; }
        drawLoaded(g, 80, 18, 480, 360, load, t);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `600 24px ${MONO}`; g.fillStyle = '#9fb8b2';
        g.fillText(`LOADING… ${pct}%`, w / 2, 404);
        g.fillStyle = '#26302f'; g.fillRect(140, 424, 360, 8); g.fillStyle = '#9fd8cf'; g.fillRect(140, 424, 360 * load, 8);
        if (shareMsg >= 0) { g.font = `700 22px ${SANS}`; g.fillStyle = '#e8ecea'; g.fillText(`SHARED TO: MONITOR ${shareMsg + 1}`, w / 2, 458); }
        else if (must) { g.font = `400 21px ${SANS}`; g.fillStyle = '#c9d2cf'; g.fillText('This image must be shared to finish loading.', w / 2, 458); }
      });
      tv.set({ power: 1, noise: 0.03, time: t, bright: full ? 1.15 : 1.05 });
    } else {
      // the share sheet
      const c = cursorAt(t);
      tv.draw(`sheet${Math.round(c[0])}.${Math.round(c[1])}.${gk(t)}.${t >= CUE.onKiddo}.${between(t, CUE.cancel, CUE.cancel + 0.35)}`, (g, w, h) => drawSheet(g, w, h, t));
      tv.set({ power: 1, noise: 0.025, time: t, bright: 1.1 });
      if (t >= CUE.cancel) warm = 0.6;
    }

    // ── Monitors: their own pictures, until the image is shared to them ──
    S.monitors.forEach((m, i) => {
      const got = t >= SHARE_T[i] + 0.25;
      const burst = pulse(t, SHARE_T[i] - 0.05, SHARE_T[i] + 0.5, 0.05, 0.4);
      if (got) {
        const full = t >= CUE.stays;
        m.draw(`img${Math.floor(load * 100)}.${gk(t)}.${full}`, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); drawLoaded(g, 0, 0, w, h, full ? 1 : load, t); });
        m.set({ power: 1, noise: 0.04 + 0.5 * burst, time: t, bright: 1.05 });
      } else if (i === 0) {
        m.draw('hall', camLabel('CAM 1  HALL'));
        m.set({ power: 1, feedMix: 1, feed: S.hallFeed.texture, noise: 0.06 + 0.5 * burst, time: t, bright: 0.9 });
      } else if (i === 1) {
        m.draw('m2', (g, w, h) => drawTestPattern(g, w, h, { sub: 'CAM 2', sub2: 'NO SOURCE' }));
        m.set({ power: 1, noise: 0.05 + 0.5 * burst, time: t, bright: 0.55 });
      } else {
        m.draw('studio', camLabel('CAM 3  STUDIO'));
        m.set({ power: 1, feedMix: 1, feed: S.studioFeed.texture, noise: 0.05 + 0.5 * burst, time: t, bright: 1.0 });
      }
    });
    return { warm };
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene !== 'station') return { cam, feeds: [], portals: [], warm: 0 };
      const id = cam.shot.id;
      const pg = program(t);

      // ── The card ──
      drawOn(S.cardCanvas, S.cardTex, cardKey(t), (g, w, h) => drawCard(g, w, h, t));

      // ── Light: the lamp is on all night now ──
      const fl = fluorescent(t, 7, 0.08);
      S.lamp.intensity = 0.55 * fl;
      S.lampBulb.material.color.setRGB(3.2, 2.9, 2.3).multiplyScalar(fl);
      S.lampCone.material.uniforms.uIntensity.value = 0.035;
      S.stripLight.intensity = 5 * fluorescent(t, 3, 0.3);
      S.strip.material.color.setRGB(2.0, 2.2, 1.9).multiplyScalar(S.stripLight.intensity / 5);
      // the screens light the room more as the image takes them over
      const full = smooth(CUE.stays, CUE.stays + 0.8, t);
      S.crt.light.intensity = S.crt.baseLight * (1 + 0.8 * full);

      // ── The LED clock ──
      const mins = clockMinutes(t);
      drawOn(S.clockCanvas, S.clockTex, clockText(mins), (g, w, h) => {
        g.fillStyle = '#060202'; g.fillRect(0, 0, w, h);
        g.font = `700 118px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#ff2a10'; g.shadowBlur = 18; g.fillStyle = '#ff3a1e';
        g.fillText(clockText(mins), w / 2, h / 2 + 4);
      });

      // last night's things, at rest
      S.studioChair.userData.top.rotation.y = S.facingYaw + Math.PI;
      S.talkLamp.material.color.setRGB(0.12, 0.02, 0.01); S.talkLight.intensity = 0;
      S.lineLed.material.color.setRGB(0.05, 0.03, 0.01); S.lineLight.intensity = 0;
      S.breakLight.intensity = 0; S.breakGlow.material.color.setRGB(0, 0, 0);
      S.opChair.userData.top.rotation.y = Math.PI + 0.25;

      // ── The marker: where the last operator left it, until you pick it up ──
      const restPos = S.cardPoint(CARD_W + 90, LAYOUT.hand[1].y + 30, 0.0085);
      const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.35, -Math.PI / 2, 'YXZ'));
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, -0.62, 'YXZ'));
      S.pen.visible = true;
      S.pen.position.copy(restPos); S.pen.quaternion.copy(flat);
      S.handRig.visible = false;

      // ── The choice: your hand on the trackball ──
      S.palmRig.visible = between(t, CUE.choice + 0.4, CUE.stays + 1.2);
      if (S.palmRig.visible) {
        const top = new THREE.Vector3(...ANCH.ball).add(new THREE.Vector3(0, 0.03, 0));
        const inK = easeOut((t - (CUE.choice + 0.4)) / 0.9), outK = easeInOut((t - (CUE.cancel + 0.8)) / 1.4);
        const c = cursorAt(t);
        // the hand works the ball: small pushes that follow the cursor
        const nudge = t >= CUE.fight ? new THREE.Vector3((c[0] - 500) * 0.00002, 0, (c[1] - 270) * 0.00004) : new THREE.Vector3();
        const away = top.clone().add(new THREE.Vector3(0.05, 0.12, 0.42));
        S.palmRig.position.lerpVectors(away, top.clone().add(nudge), inK * (1 - outK));
        S.palmRig.rotation.set(0, 0.2, 0);
        // the click: the hand presses down
        S.palmRig.position.y -= 0.005 * pulse(t, CUE.cancel - 0.06, CUE.cancel + 0.2, 0.05, 0.12);
      }
      S.ball.rotation.x = between(t, CUE.fight, CUE.cancel) ? -(cursorAt(t)[1] - 400) * 0.02 : S.ball.rotation.x;

      // ── Rule 9: you pick up the marker and write ──
      const w9 = LAYOUT.hand.filter((h) => h.rule === 9);
      if (t >= CUE.rule9) {
        S.handRig.visible = true;
        const grab = easeInOut((t - CUE.rule9) / 0.5);           // the hand reaches the marker
        const lift = easeInOut((t - (CUE.rule9 + 0.5)) / 0.7);   // and brings it to the card
        const p = penAt(t);
        const tip = S.cardPoint(p.x, p.y, p.down ? 0.0012 : 0.01);
        const pos = restPos.clone().lerp(tip, lift);
        S.pen.position.copy(pos);
        S.pen.quaternion.copy(flat).slerp(tilt, lift);
        const from = restPos.clone().add(new THREE.Vector3(0.35, 0.3, 0.2));
        S.handRig.position.lerpVectors(from, S.pen.position, grab);
        S.handRig.quaternion.copy(S.pen.quaternion);
        // done: hand and marker lift away, so the rule can be read before the title
        const away = easeInOut((t - w9[1].end - 0.25) / 0.8);
        if (away > 0) { S.pen.position.add(new THREE.Vector3(0.22, 0.2, 0.12).multiplyScalar(away)); S.handRig.position.copy(S.pen.position); }
      }

      // ── Dust only where the lamp falls ──
      S.dust.material.uniforms.uTime.value = t;
      S.dust.setLight(0, S.lamp.position.toArray(), new THREE.Vector3().subVectors(S.card.position, S.lamp.position).toArray(), 0.72, 0.9, 1.1, 0.3, 0xffe6c0);
      for (let i = 1; i < 4; i++) S.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

      // ── Feeds: only while a monitor still shows its own camera, in shots that see it ──
      const feeds = [];
      const seesMonitors = id === '1A' || id === '3A';
      if (seesMonitors && t < CUE.share1 + 0.25) feeds.push({ feed: S.hallFeed, scene: S.scene });
      if (seesMonitors && t < CUE.share3 + 0.25) feeds.push({ feed: S.studioFeed, scene: S.scene });

      const ink = id === '8A' ? 1 - smooth(WRITE[WRITE.length - 1].end, WRITE[WRITE.length - 1].end + 2.2, t) : 0;
      return { cam, feeds, portals: [], warm: Math.max(pg.warm, ink * 0.6) };
    },
  };
}
