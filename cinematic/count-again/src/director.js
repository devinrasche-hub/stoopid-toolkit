import * as THREE from 'three';
import { CUE, WRITE, roomAt } from './timeline.js';
import { cameraAt, ANCH } from './shots.js';
import { drawCard, cardKey, ruleCenter, LAYOUT, CARD_W } from './card.js';
import { clamp, lerp, smooth, pulse, easeInOut, fluorescent, hash } from './util.js';

// Timeline time → which room you're in and what's wrong with it. Every copy is
// the same set with one more thing changed; the real room is the one where the
// coffee is still warm. Copy 3 has a fourth monitor, which is a window: it
// renders the same set in its real state, with someone new at the console.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const between = (t, a, b) => t >= a && t < b;

export function drawTestPattern(g, w, h, { sub = 'BROADCAST DAY ENDED', sub2 = 'RESUMES 5:00 AM', reverse = false } = {}) {
  let bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  if (reverse) bars = bars.slice().reverse();
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
  g.fillText(reverse ? 'WOHS DIPOOTS EHT' : 'THE STOOPID SHOW', w / 2, h * 0.405);
  g.font = `600 ${Math.round(h * 0.05)}px ${SANS}`; g.fillStyle = '#d8d8d8';
  g.fillText(sub, w / 2, h * 0.83);
  g.font = `400 ${Math.round(h * 0.04)}px ${SANS}`; g.fillStyle = '#9a9a9a';
  g.fillText(sub2, w / 2, h * 0.92);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

// The card as last night left it (dry), or with rule 9's ink wet again.
const DRY_T = 1, WET_T = WRITE[WRITE.length - 1].end + 0.2;

export function makeDirector(W) {
  const S = W.station;
  const vec = (v) => v.toArray();

  // ── Anchors for the camera ──
  ANCH.card = vec(S.cardPoint(CARD_W / 2, 800));
  for (let n = 1; n <= 9; n++) if (n <= 8) ANCH.rule[n] = vec(S.cardPoint(...ruleCenter(n)));
  const r9 = LAYOUT.hand.filter((h) => h.rule === 9);
  ANCH.rule9 = vec(S.cardPoint(CARD_W / 2 - 40, (r9[0].y + r9[1].y) / 2));
  const v = new THREE.Vector3();
  S.crt.screen.getWorldPosition(v); ANCH.crt = vec(v);
  ANCH.mons = [...S.monitors, S.fourth].map((m) => vec(m.screen.getWorldPosition(new THREE.Vector3())));
  ANCH.fourthN = vec(new THREE.Vector3(0, 0, 1).applyQuaternion(S.fourth.group.quaternion));
  ANCH.mug = vec(S.mugTop);
  ANCH.clock = vec(S.clock.getWorldPosition(v));
  ANCH.micro = vec(S.micro.getWorldPosition(v).add(new THREE.Vector3(0, 0.15, 0)));

  // The fourth monitor's window: from where a fourth monitor stands in the real
  // room, looking at whoever stands at the console.
  const windowFeed = new (S.backFeed.constructor)(S.backFeed.a.width, S.backFeed.a.height, 50);
  windowFeed.camera.position.copy(S.fourth.group.position).add(new THREE.Vector3(-0.06, 0.03, 0.12));
  windowFeed.camera.lookAt(0.0, 1.0, 1.25);
  windowFeed.camera.updateMatrixWorld();

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
  const card = (t0) => drawOn(S.cardCanvas, S.cardTex, `card${cardKey(t0)}`, (g, w, h) => drawCard(g, w, h, t0));
  const clock = (s) => drawOn(S.clockCanvas, S.clockTex, s, (g, w, h) => {
    g.fillStyle = '#060202'; g.fillRect(0, 0, w, h);
    g.font = `700 118px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff2a10'; g.shadowBlur = 18; g.fillStyle = '#ff3a1e';
    g.fillText(s, w / 2, h / 2 + 4);
  });

  // ── The state of the room ──
  // k: 0 real, 1–3 copies, 4 ours at 4:59
  function setRoom(k, t) {
    const copy = k >= 1 && k <= 3;
    // what's wrong: the chair faces the door; the light sags lower each time; the bars run backwards; the ink is wet
    S.opChair.position.set(k >= 2 && k <= 3 ? 0.9 : 0.42, 0, k >= 2 && k <= 3 ? 3.0 : 2.3);
    S.opChair.userData.top.rotation.y = copy ? Math.atan2(2.3 - S.opChair.position.x, 5.2 - S.opChair.position.z) : Math.PI + 0.25;
    const dim = [1, 0.85, 0.6, 0.5, 1][k];
    S.stripLight.intensity = 5 * dim * fluorescent(t, 3 + k, 0.3);
    S.strip.material.color.setRGB(2.0, 2.2, 1.9).multiplyScalar(S.stripLight.intensity / 5);
    S.wash.intensity = 2.5 * dim;
    const rev = k === 2 || k === 3;
    S.crt.draw(`bars${rev}`, (g, w, h) => drawTestPattern(g, w, h, { reverse: rev }));
    S.crt.set({ power: 1, noise: 0.03, time: t, bright: 0.95 });
    card(k === 2 || k === 3 ? WET_T : DRY_T);
    clock(k === 4 && t >= CUE.tick ? '4:59' : '4:58');
    // the coffee: warm, or with a skin on it
    S.coffee.material.color.set(copy ? 0x3a2a1c : 0x1a0f08); S.coffee.material.roughness = copy ? 0.85 : 0.15;
    S.fourth.group.visible = k === 3;
    S.newOp.visible = false;   // only the window ever sees them
    S.newOpKey.intensity = 0;
    const steam = k === 0 ? 1 : (k === 4 ? smooth(CUE.tick + 0.3, CUE.tick + 1.6, t) * 0.7 : 0);
    S.steam.forEach((sp, i) => {
      const ph = (t * 0.32 + i / S.steam.length) % 1;
      const sw = Math.sin(t * 1.1 + i * 1.7) * 0.014 * ph + Math.sin(t * 0.5 + i) * 0.006 * ph;
      sp.position.set(S.mugTop.x + sw, S.mugTop.y + ph * 0.2, S.mugTop.z + Math.cos(t * 0.9 + i * 2.3) * 0.01 * ph);
      sp.scale.setScalar(0.025 + 0.07 * ph);
      sp.material.opacity = steam * Math.sin(Math.PI * ph) * 0.32;
      sp.material.rotation = i + t * 0.2;
    });
  }

  // The new operator, in the real room: hands on the card; one slides to rule 5;
  // the hood turns to the fourth monitor (to us), holds, and turns away.
  function newOperator(t) {
    const [L, Rr] = S.newOpHands;
    const r5 = ruleCenter(5);
    const left = S.cardPoint(260, 560, 0.012);
    const rStart = S.cardPoint(760, 420, 0.012), rEnd = S.cardPoint(r5[0] + 160, r5[1], 0.012);
    const sl = easeInOut((t - CUE.slide) / 2.2);
    L.position.copy(S.newOp.worldToLocal(left.clone()));
    Rr.position.copy(S.newOp.worldToLocal(rStart.clone().lerp(rEnd, sl)));
    L.rotation.y = 0.3; Rr.rotation.y = -0.3;
    // the head: down at the card, then to the window, then away
    const head = new THREE.Vector3(); S.newOpHead.getWorldPosition(head);
    const cam = windowFeed.camera.position;
    const yawTo = Math.atan2(-(cam.x - head.x), -(cam.z - head.z));
    const pitchTo = Math.atan2(cam.y - head.y, Math.hypot(cam.x - head.x, cam.z - head.z));
    const look = easeInOut((t - CUE.looks) / 1.8) * (1 - easeInOut((t - CUE.turns) / 1.6));
    const away = easeInOut((t - CUE.turns) / 1.6);
    S.newOpHead.rotation.set(lerp(-0.75, pitchTo, look), lerp(0, yawTo, look) - 0.5 * away, 0, 'YXZ');
    // leans in a little toward the window while it looks
    S.newOp.position.set(0.0 + 0.06 * look, 0, 1.62 - 0.04 * look);
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene !== 'station') return { cam, feeds: [], portals: [], warm: 0 };
      const id = cam.shot.id;
      const k = roomAt(t);

      // light that doesn't change between rooms
      const fl = fluorescent(t, 7, 0.08);
      S.lamp.intensity = 0.55 * fl;
      S.lampBulb.material.color.setRGB(3.2, 2.9, 2.3).multiplyScalar(fl);
      S.lampCone.material.uniforms.uIntensity.value = 0.035;
      S.studioChair.userData.top.rotation.y = S.facingYaw + Math.PI;
      S.talkLamp.material.color.setRGB(0.12, 0.02, 0.01); S.talkLight.intensity = 0;
      S.lineLed.material.color.setRGB(0.05, 0.03, 0.01); S.lineLight.intensity = 0;
      S.pen.visible = true; S.handRig.visible = false; S.palmRig.visible = false;
      S.pen.position.copy(S.cardPoint(CARD_W + 90, LAYOUT.hand[1].y + 30, 0.0085));
      S.pen.quaternion.setFromEuler(new THREE.Euler(0, 0.35, -Math.PI / 2, 'YXZ'));

      // the microwave: FISH, always
      drawOn(S.microCanvas, S.microTex, `fish${between(t, CUE.beeps, CUE.beeps + 1.9) ? Math.floor((t - CUE.beeps) / 0.31) % 2 : 1}`, (g, w, h) => {
        g.fillStyle = '#020604'; g.fillRect(0, 0, w, h);
        const on = !between(t, CUE.beeps, CUE.beeps + 1.9) || Math.floor((t - CUE.beeps) / 0.31) % 2 === 0;
        if (on) { g.font = `700 34px ${MONO}`; g.fillStyle = '#5dffa8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FISH', w / 2, h / 2 + 2); }
      });
      S.microWin.material.color.setRGB(0.6, 0.45, 0.2);

      // monitors: their own pictures
      const [m1, m2, m3] = S.monitors;
      m1.draw('hall', camLabel('CAM 1  HALL'));
      m1.set({ power: 1, feedMix: 1, feed: S.hallFeed.texture, noise: 0.06, time: t, bright: 0.9 });
      m2.draw('m2', (g, w, h) => drawTestPattern(g, w, h, { sub: 'CAM 2', sub2: 'NO SOURCE' }));
      m2.set({ power: 1, noise: 0.05, time: t, bright: 0.55 });
      m3.draw('studio', camLabel('CAM 3  STUDIO'));
      m3.set({ power: 1, feedMix: 1, feed: S.studioFeed.texture, noise: 0.05, time: t, bright: 1.0 });
      // the fourth: a window onto the real room; then snow; then nothing
      const snow = smooth(CUE.snow, CUE.snow + 0.3, t), gone = smooth(CUE.black, CUE.black + 0.25, t);
      S.fourth.draw('none', (g) => g.clearRect(0, 0, 1, 1));
      S.fourth.set({ power: 1 - gone, feedMix: 1, feed: windowFeed.texture, noise: 0.03 + snow, time: t, bright: 1.1 });

      setRoom(k, t);

      // dust in the lamp light
      S.dust.material.uniforms.uTime.value = t;
      S.dust.setLight(0, S.lamp.position.toArray(), new THREE.Vector3().subVectors(S.card.position, S.lamp.position).toArray(), 0.72, 0.9, 1.1, 0.3, 0xffe6c0);
      for (let i = 1; i < 4; i++) S.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

      // ── Feeds ──
      const feeds = [];
      const room = ['1A', '3A', '4B', '6A', '6C', '8A'].includes(id);
      if (room || id === '2A' || id === '5A') feeds.push({ feed: S.hallFeed, scene: S.scene });
      if (room) feeds.push({ feed: S.studioFeed, scene: S.scene });
      if (k === 3 && (id === '6A' || id === '6C' || id === '7A')) {
        // the window shows the real room: set it real, render, set it back
        feeds.push({ feed: windowFeed, scene: S.scene, pre: () => { setRoom(0, t); S.newOp.visible = true; S.newOpKey.intensity = 3.0; newOperator(t); }, post: () => setRoom(k, t) });
      }
      return { cam, feeds, portals: [], warm: 0 };
    },
  };
}
