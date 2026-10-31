import * as THREE from 'three';
import { CUE, WRITE } from './timeline.js';
import { cameraAt, ANCH } from './shots.js';
import { crtText } from './crt.js';
import { drawCard, cardKey, ruleCenter, penAt, LAYOUT, CARD_W } from './card.js';
import { clamp, lerp, smooth, pulse, keyed, easeInOut, easeOut, easeSine, fluorescent } from './util.js';

// Timeline time → the station after midnight: the card, the lamp, the sets,
// the studio chair, the talkback, the phone, the clock, the hand.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const between = (t, a, b) => t >= a && t < b;

// The sign-off test pattern on the main CRT.
export function drawTestPattern(g, w, h, { sub = 'BROADCAST DAY ENDED', sub2 = 'RESUMES 5:00 AM' } = {}) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  const bw = w / 7;
  bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw + 1, h * 0.67); });
  const low = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
  low.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, h * 0.67, bw + 1, h * 0.08); });
  g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.75, w, h * 0.25);
  // the circle and the station's box
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

// The LED clock: minutes after midnight.
const clockMinutes = (t) => Math.floor(keyed([[0, 0], [CUE.card, 0], [CUE.rule1, 41], [CUE.rule4, 189], [CUE.clock, 298], [CUE.hand, 299], [CUE.five - 0.001, 299], [CUE.five, 300]], t, (x) => x));
const clockText = (m) => `${Math.floor(m / 60) === 0 ? 12 : Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export function makeDirector(W) {
  const S = W.station;
  const vec = (v) => v.toArray();

  // ── Anchors for the camera ──
  const rc = (n) => ruleCenter(n);
  ANCH.card = vec(S.cardPoint(CARD_W / 2, 760));
  ANCH.title = vec(S.cardPoint(CARD_W / 2, 150));
  for (let n = 1; n <= 8; n++) ANCH.rule[n] = vec(S.cardPoint(...rc(n)));
  const hw = LAYOUT.hand;
  ANCH.write = vec(S.cardPoint(CARD_W / 2 - 20, (hw[0].y + hw[1].y) / 2 - 20));
  const cw = new THREE.Vector3();
  S.crt.screen.getWorldPosition(cw); ANCH.crt = vec(cw);
  const m3 = S.monitors[2];
  m3.screen.getWorldPosition(cw); ANCH.mon3 = vec(cw);
  ANCH.mon3N = vec(new THREE.Vector3(0, 0, 1).applyQuaternion(m3.group.quaternion));
  ANCH.phone = vec(S.lineLed.getWorldPosition(cw).add(new THREE.Vector3(-0.06, 0.02, -0.02)));
  ANCH.talk = vec(S.talkLamp.getWorldPosition(cw));
  ANCH.clock = vec(S.clock.getWorldPosition(cw));

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
    g.font = `600 22px "DejaVu Sans Mono", "Courier New", monospace`; g.fillStyle = 'rgba(235,235,225,0.85)';
    g.textBaseline = 'top'; g.fillText(s, 16, 14);
  };

  function program(t, cam) {
    const tv = S.crt;
    // ── Main CRT: warms up on the test pattern ──
    let warm = 0;
    if (t < CUE.crtOn) { tv.draw('off', (g) => g.clearRect(0, 0, 1, 1)); tv.set({ power: 0, time: t, glass: 1 }); }
    else if (t < CUE.feedIn || (t >= CUE.feedOut + 0.4 && t < CUE.morning)) {
      tv.draw('bars', (g, w, h) => drawTestPattern(g, w, h));
      const p = smooth(CUE.crtOn, CUE.crtOn + 1.1, t);
      tv.set({ power: p, noise: 0.03 + 0.2 * (1 - p), time: t, bright: 0.95, roll: t < CUE.crtOn + 1.6 ? (1 - smooth(CUE.crtOn, CUE.crtOn + 1.6, t)) * 0.4 : 0 });
    } else if (t < CUE.feedOut + 0.4) {
      // Rule 1: the picture changes. It is the room, from behind you. You are not in it.
      const k = smooth(CUE.feedIn, CUE.feedIn + 0.5, t), back = smooth(CUE.feedOut, CUE.feedOut + 0.4, t);
      if (back > 0) tv.draw('bars', (g, w, h) => drawTestPattern(g, w, h));
      else tv.draw('feedLabel', camLabel('CAM 4  CONTROL'));
      tv.set({ power: 1, feedMix: back > 0 ? 0 : 1, feed: S.backFeed.texture, noise: 0.04 + 0.5 * (pulse(t, CUE.feedIn - 0.05, CUE.feedIn + 0.5, 0.05, 0.4) + pulse(t, CUE.feedOut - 0.05, CUE.feedOut + 0.4, 0.05, 0.3)), roll: (1 - k) * 0.15 + back * 0.1, time: t, bright: 1.5 });
    } else {
      // 5:00. Good morning.
      const k = smooth(CUE.morning, CUE.morning + 0.4, t);
      tv.draw('morning', (g, w, h) => {
        g.fillStyle = '#050403'; g.fillRect(0, 0, w, h);
        crtText(g, 'GOOD MORNING,', w / 2, h * 0.42, { size: 52, color: '#ff8a3a', spacing: 4, glow: 14, weight: '700' });
        crtText(g, 'OPERATOR.', w / 2, h * 0.56, { size: 52, color: '#ff8a3a', spacing: 4, glow: 14, weight: '700' });
        crtText(g, 'BROADCAST DAY BEGINS', w / 2, h * 0.78, { size: 22, color: '#9ff2e2', spacing: 6, glow: 6 });
      });
      tv.set({ power: 1, noise: 0.03 + 0.4 * (1 - k), time: t, bright: 1.05 });
      warm = 1;
    }

    // ── Monitors ──
    const [m1, m2, m3] = S.monitors;
    m1.draw('hall', camLabel('CAM 1  HALL'));
    m1.set({ power: 1, feedMix: 1, feed: S.hallFeed.texture, noise: 0.06, time: t, bright: 0.9 });
    m2.draw('m2', (g, w, h) => { drawTestPattern(g, w, h, { sub: 'CAM 2', sub2: 'NO SOURCE' }); });
    m2.set({ power: 1, noise: 0.05, time: t, bright: 0.55 });
    m3.draw('studio', camLabel('CAM 3  STUDIO'));
    m3.set({ power: 1, feedMix: 1, feed: S.studioFeed.texture, noise: 0.05 + 0.25 * pulse(t, CUE.faced - 0.15, CUE.faced + 0.1, 0.1, 0.1), time: t, bright: 1.0 });
    return { warm };
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene !== 'station') return { cam, feeds: [], portals: [], warm: 0 };
      const id = cam.shot.id;
      const pg = program(t, cam);

      // ── The card ──
      drawOn(S.cardCanvas, S.cardTex, cardKey(t), (g, w, h) => drawCard(g, w, h, t));

      // ── The desk lamp: clicks on at 9, then a tired, steady light ──
      const lampOn = t >= CUE.lamp ? 1 : 0;
      const fl = fluorescent(t, 7, 0.08);
      S.lamp.intensity = 0.55 * lampOn * fl;
      S.lampBulb.material.color.setRGB(3.2, 2.9, 2.3).multiplyScalar(lampOn * fl);
      S.lampCone.material.uniforms.uIntensity.value = 0.035 * lampOn;
      // the room itself: one strip, sagging now and then
      S.stripLight.intensity = 5 * fluorescent(t, 3, 0.3);
      S.strip.material.color.setRGB(2.0, 2.2, 1.9).multiplyScalar(S.stripLight.intensity / 5);

      // ── The LED clock ──
      const mins = clockMinutes(t);
      drawOn(S.clockCanvas, S.clockTex, clockText(mins), (g, w, h) => {
        g.fillStyle = '#060202'; g.fillRect(0, 0, w, h);
        g.font = `700 118px "DejaVu Sans Mono", "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#ff2a10'; g.shadowBlur = 18; g.fillStyle = '#ff3a1e';
        g.fillText(clockText(mins), w / 2, h / 2 + 4);
      });

      // ── Rule 2: the studio chair turns to face you; then it doesn't ──
      const turn = keyed([[CUE.turnStart, 0], [CUE.turnStart + 0.9, 0.12], [CUE.turnStart + 1.6, 0.12], [CUE.turnStart + 2.6, 0.45], [CUE.turnStart + 3.0, 0.45], [CUE.faced - 0.2, 1], [CUE.awayAgain - 0.01, 1], [CUE.awayAgain, 0]], t, easeInOut);
      S.studioChair.userData.top.rotation.y = S.facingYaw + Math.PI * (1 - turn);

      // ── Rule 3: the talkback lamp ──
      const talk = t >= CUE.talkOn && t < CUE.talkOff ? 1 : 0;
      S.talkLamp.material.color.setRGB(0.12 + 3.2 * talk, 0.02 + 0.35 * talk, 0.01 + 0.15 * talk);
      S.talkLight.intensity = 0.18 * talk;

      // ── Rule 6: the request line. While it rings, the line light blinks with it; after, steady ──
      const ringing = (between(t, CUE.ring1, CUE.ring1 + 1.4) || between(t, CUE.ring2, CUE.ring2 + 1.4)) ? 1 : 0;
      const held = t >= CUE.pickedUp && t < CUE.five ? 1 : 0;
      const led = Math.max(ringing, held);
      S.lineLed.material.color.setRGB(0.05 + 2.2 * led, 0.03 + 1.1 * led, 0.01 + 0.2 * led);
      S.lineLight.intensity = 0.03 * led;

      // ── Rule 4's answer: a light down the hall, in the break room ──
      const brk = pulse(t, CUE.beeps - 0.2, CUE.beeps + 6, 0.05, 1.5);
      S.breakLight.intensity = 3 * brk;
      S.breakGlow.material.color.setRGB(1.6, 1.25, 0.8).multiplyScalar(brk);

      // ── The flip: the last operator's hand writes the new rule 7 ──
      const showPen = t >= CUE.hand - 0.05;
      S.pen.visible = showPen;
      S.handRig.visible = showPen && t < CUE.wide - 0.5;
      if (showPen) {
        const p = penAt(t);
        const tip = S.cardPoint(p.x, p.y, p.down ? 0.0012 : 0.01);
        // in from the right, held, written, then laid down beside the card
        const inK = easeOut((t - CUE.hand) / 1.8);
        const start = S.cardPoint(CARD_W + 380, LAYOUT.hand[0].y - 120, 0.22);
        const restPos = S.cardPoint(CARD_W + 90, LAYOUT.hand[1].y + 30, 0.0085);
        const lay = easeInOut((t - (CUE.capOn - 0.3)) / 0.9);
        const pos = new THREE.Vector3().lerpVectors(start, tip, inK);
        if (lay > 0) pos.lerp(restPos, lay);
        S.pen.position.copy(pos);
        // writing: barrel tilted back toward the writer, beside you on the right
        const tilt = new THREE.Euler(0.42, 0, -0.62, 'YXZ');
        const flat = new THREE.Euler(0, 0.35, -Math.PI / 2, 'YXZ');
        const qa = new THREE.Quaternion().setFromEuler(tilt), qb = new THREE.Quaternion().setFromEuler(flat);
        S.pen.quaternion.copy(qa).slerp(qb, lay);
        // the hand holds the pen until it lets go, then goes back the way it came
        const off = easeInOut((t - CUE.withdraw) / 1.6);
        S.handRig.position.copy(S.pen.position).add(new THREE.Vector3(0.35, 0.28, 0.08).multiplyScalar(off));
        S.handRig.quaternion.copy(S.pen.quaternion);
        if (t >= CUE.withdraw) S.handRig.quaternion.copy(qb).slerp(qa, 0.5);
      }

      // ── Shift change: the operator's chair turns to face you ──
      const ck = easeInOut((t - CUE.chair) / 4.2);
      S.opChair.userData.top.rotation.y = lerp(Math.PI + 0.55, Math.PI * 2 + 0.52, ck);

      // ── Dust only where the lamp falls ──
      S.dust.material.uniforms.uTime.value = t;
      S.dust.setLight(0, S.lamp.position.toArray(), new THREE.Vector3().subVectors(S.card.position, S.lamp.position).toArray(), 0.72, 0.9, 1.1, 0.3 * lampOn, 0xffe6c0);
      for (let i = 1; i < 4; i++) S.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

      // ── Which feeds this frame needs ──
      const feeds = [];
      const wide = id === '1A' || id === '10A';
      // (3A's feed of the room shows the monitors, so theirs render first)
      if (wide || id === '3A') feeds.push({ feed: S.hallFeed, scene: S.scene });
      if (id === '4A' || id === '4C' || id === '3A' || wide) feeds.push({ feed: S.studioFeed, scene: S.scene });
      if (id === '3A') feeds.push({ feed: S.backFeed, scene: S.scene });

      // warm grade: the morning card, and the fresh ink
      const ink = id === '9A' ? 1 - smooth(WRITE[1].end, WRITE[1].end + 2.2, t) : 0;
      return { cam, feeds, portals: [], warm: Math.max(pg.warm, ink * 0.6) };
    },
  };
}
