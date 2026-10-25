import * as THREE from 'three';
import { CUE } from './timeline.js';
import { cameraAt, ANCH } from './shots.js';
import { crtText } from './crt.js';
import { stooFrame } from './world.js';
import { Feed } from './fx.js';
import { clamp, lerp, smooth, pulse, easeInOut, easeOut, hash } from './util.js';

// Timeline time → state of the watchers' room, its screens, its sky, and the
// last transmission from Earth (03's bedside room, rendered live into the set).

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const between = (t, a, b) => t >= a && t < b;
const ORANGE = new THREE.Color(1.0, 0.52, 0.2), TEAL = new THREE.Color(0.45, 0.85, 0.8), WHITE = new THREE.Color(0.9, 0.95, 1.0), WARM = new THREE.Color(1.0, 0.78, 0.55);

// 03's last card. Full frame on the card layer, and on the set's 4:3 screen
// (laid out so the hand-off from one to the other is invisible).
export function drawEndCard(g, w, h, { fullFrame = false, a3 = 1 } = {}) {
  const S = fullFrame ? 1 : h / (1080 * 1.336);
  const Y = (fy) => fullFrame ? fy * h : h / 2 + (fy - 0.5) * 1080 * 1.336 * S;
  const txt = (s, fy, size, color, spacing, weight = '400', alpha = 1) => {
    g.save(); g.globalAlpha = alpha; g.font = `${weight} ${size * S}px ${SANS}`; g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = `${spacing * S}px`;
    g.fillText(s, w / 2, Y(fy)); g.restore();
  };
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  txt('THE STOOPID SHOW', 0.43, 26, '#d9d6c6', 16);
  txt('STILL HERE', 0.525, 72, '#efe9dc', 26, '300');
  txt('END.', 0.63, 20, '#9a958a', 12, '400', a3);
}

export function drawRegionCard(g, w, h, { S = 1 } = {}) {
  g.fillStyle = '#e6e9e4'; g.fillRect(0, 0, w, h);
  const txt = (s, y, size, color, weight = '500', spacing = 1) => {
    g.save(); g.font = `${weight} ${size * S}px ${SANS}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${spacing * S}px`; g.fillText(s, w / 2, y); g.restore();
  };
  // a small planet, struck through
  const cx = w / 2, cy = h * 0.3, r = 34 * S;
  g.strokeStyle = '#4c5658'; g.lineWidth = 4 * S;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, r * 1.7, r * 0.42, -0.25, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#b8473a'; g.beginPath(); g.moveTo(cx - r * 1.5, cy + r * 1.2); g.lineTo(cx + r * 1.5, cy - r * 1.2); g.stroke();
  txt('THIS PLANET IS NO LONGER', h * 0.47, 58, '#1d2324', '600', 3);
  txt('AVAILABLE IN YOUR REGION.', h * 0.555, 58, '#1d2324', '600', 3);
  txt('We apologize for any inconvenience.', h * 0.65, 26, '#5d6668', '400', 0.5);
}

export function makeDirector(W, stooImg) {
  const { alien: A, real: R } = W;
  const tv = A.tv;
  // the last transmission: 03's bedside, from where he sat
  const lastFeed = new Feed(512, 384, 50);
  lastFeed.camera.position.set(2.06, 1.1, 1.9);
  lastFeed.camera.lookAt(2.98, 0.56, 2.44);
  lastFeed.camera.updateMatrixWorld();
  A.lastFeed = lastFeed;
  // anchors the camera needs
  const hw = A.watchers[A.hero];
  ANCH.hero = [hw.x, 0, hw.z]; ANCH.heroYaw = Math.atan2(-hw.x, -hw.z);
  ANCH.sol = A.solDir.toArray();
  // the cascade times are fixed: write them once
  const aOn = A.screens.geometry.attributes.aOn;
  for (let i = 0; i < aOn.count; i++) aOn.array[i] = CUE.cascade + A.cascadeRel[i];
  aOn.needsUpdate = true;
  // the screens' other two pictures
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = 256; c.height = 192; draw(c.getContext('2d'), 256, 192); const t = new THREE.CanvasTexture(c); return t; };
  const texRegion = mk((g, w, h) => drawRegionCard(g, w, h, { S: 256 / 1920 * 1.6 }));
  // the watcher whose head turns, near the low camera in 2B
  let turner = 0, td = 1e9;
  A.watchers.forEach((w, i) => { const d = Math.hypot(w.x + 1.05, w.z - 3.55); if (w.row === 1 && d < td) { td = d; turner = i; } });
  const tw = A.watchers[turner];
  ANCH.turner = [tw.x, 0, tw.z]; ANCH.turnerS = tw.s;
  // the drops of light: which watchers, when
  const front = A.watchers.map((w, i) => i).filter((i) => A.watchers[i].row <= 3);

  function realRoom(t) {
    // 03's minute, still going: the quilt breathes, his hand by hers
    R.blanketShape(t);
    R.dadArm.visible = true;
    R.dadArm.position.set(2.575, 0.468, 2.64); R.dadArm.rotation.set(0, 0.62, 0.04);
    R.childHand.visible = true;
    R.childHand.position.set(2.635, 0.476, 2.575); R.childHand.rotation.set(0, -0.35, 0.05);
    R.lamp.intensity = 3.6; R.lampFill.intensity = 0.55;
  }

  function program(t) {
    // What the set shows, and what light it throws.
    let light = 0, lc = TEAL;
    const S = 1024 / 1920;
    const subtitle = (g, w, h, s, a = 1) => {
      g.save(); g.globalAlpha = a; g.font = `400 ${42}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 8; g.fillStyle = '#f3eee2'; g.fillText(s, w / 2, h * 0.86); g.restore();
    };
    if (t < CUE.staticOn) {
      const ghost = smooth(CUE.pullStart + 0.4, CUE.pullStart + 2.2, t) * (1 - smooth(9.5, 11.5, t));
      tv.draw(`end${Math.round(ghost * 20)}`, (g, w, h) => {
        drawEndCard(g, w, h);
        if (ghost > 0) {
          // in the glass: something tall standing where you'd stand. Not a person.
          g.save(); g.globalAlpha = 0.085 * ghost; g.fillStyle = '#a9cfc8';
          const x = w * 0.66, y = h * 0.34;
          g.beginPath(); g.ellipse(x, y, 52, 62, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(x - 13, y + 50, 26, 120);
          g.beginPath(); g.ellipse(x, y + 205, 130, 52, 0, Math.PI, 0); g.fill();
          g.fillRect(x - 120, y + 205, 240, 300);
          g.restore();
        }
      });
      tv.set({ power: 1, noise: 0.02, time: t, bright: 1, glass: 1 });
      light = 1.6; lc = TEAL;
    } else if (t < CUE.stoo) {
      tv.draw('static', (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });
      tv.set({ power: 1, noise: 1, time: t, bright: 1.1 });
      light = 3.5; lc = WHITE;
    } else if (t < CUE.region) {
      tv.draw('stoo', (g, w, h) => stooFrame(g, w, h, stooImg));
      tv.set({ power: 1, noise: 0.02 * (1 - smooth(CUE.stoo, CUE.stoo + 0.3, t)) + 0.01, time: t, bright: 1.15 });
      light = 26; lc = ORANGE;
    } else if (t < CUE.origin) {
      tv.draw('region', (g, w, h) => drawRegionCard(g, w, h, { S: S * 1.25 }));
      tv.set({ power: 1, noise: 0.01, time: t, bright: 0.85 });
      light = 7; lc = WHITE;
    } else if (t < CUE.lastFeed) {
      const k = t >= CUE.transmitted ? 2 : 1;
      tv.draw(`origin${k}`, (g, w, h) => {
        g.fillStyle = '#031010'; g.fillRect(0, 0, w, h);
        crtText(g, 'SIGNAL ORIGIN: SOL III', w / 2, h * 0.42, { size: 54, color: '#9ff2e2', spacing: 4, glow: 14 });
        if (k > 1) crtText(g, 'TRANSMITTED: 40 YEARS AGO', w / 2, h * 0.58, { size: 54, color: '#9ff2e2', spacing: 4, glow: 14 });
      });
      tv.set({ power: 1, noise: 0.02, time: t, bright: 1 });
      light = 3; lc = TEAL;
    } else if (t < CUE.white) {
      tv.draw('feed', (g) => g.clearRect(0, 0, 1, 1));
      tv.set({ power: 1, feedMix: 1, feed: lastFeed.texture, noise: 0.03, time: t, bright: 1.25 });
      light = 4; lc = WARM;
    } else if (t < CUE.noSignal) {
      // the picture goes white — softly, not a flash
      const k = smooth(CUE.white, CUE.white + 0.7, t);
      tv.draw(`white${Math.round(k * 20)}`, (g, w, h) => { g.fillStyle = `rgba(240,244,246,${k})`; g.fillRect(0, 0, w, h); });
      tv.set({ power: 1, feedMix: 1, feed: lastFeed.texture, noise: 0.02, time: t, bright: lerp(1.25, 1.6, k) });
      light = lerp(4, 12, k); lc = WHITE;
    } else if (t < CUE.rewind) {
      tv.draw('nosignal', (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        crtText(g, 'NO SIGNAL', w / 2, h / 2, { size: 76, color: '#cfe8e2', spacing: 12, glow: 12 });
      });
      tv.set({ power: 1, noise: 0.12, time: t, bright: 0.9 });
      light = 1.2; lc = TEAL;
    } else if (t < CUE.replay) {
      tv.draw('rewind', (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        crtText(g, '◀◀', w * 0.14, h * 0.13, { size: 64, color: '#f2f2f2', glow: 6 });
      });
      tv.set({ power: 1, feedMix: 0.6, feed: lastFeed.texture, noise: 0.55, roll: (t - CUE.rewind) * -1.7, time: t, bright: 1.1 });
      light = 3; lc = WHITE;
    } else if (t < CUE.freeze) {
      const sub = t >= CUE.imHere && t < CUE.freeze - 0.5 ? 1 : 0;
      tv.draw(`replay${sub}`, (g, w, h) => { g.clearRect(0, 0, w, h); if (sub) subtitle(g, w, h, 'I’m here.'); });
      tv.set({ power: 1, feedMix: 1, feed: lastFeed.texture, noise: 0.03, time: t, bright: 1.25 });
      light = 4; lc = WARM;
    } else if (t < CUE.reply) {
      tv.draw('stooFreeze', (g, w, h) => stooFrame(g, w, h, stooImg));
      tv.set({ power: 1, noise: 0.015, time: t, bright: 1.1 });
      light = 20; lc = ORANGE;
    } else {
      const k = t >= CUE.arrival ? 3 : t >= CUE.received ? 2 : t >= CUE.replyTo ? 1 : 0;
      // typed, a character at a time
      const typed = (s, t0) => s.slice(0, Math.max(0, Math.floor((t - t0) * 24)));
      const a = typed('REPLY TO: SOL III', CUE.replyTo), b = typed('SIGNAL RECEIVED.', CUE.received), c = typed('ESTIMATED ARRIVAL: 40 YEARS', CUE.arrival);
      tv.draw(`reply${a.length}.${b.length}.${c.length}`, (g, w, h) => {
        g.fillStyle = '#060504'; g.fillRect(0, 0, w, h);
        if (k >= 1) crtText(g, a, w / 2, h * 0.3, { size: 46, color: '#9ff2e2', spacing: 4, glow: 10 });
        if (k >= 2) crtText(g, b, w / 2, h * 0.5, { size: 78, color: '#ffb36b', spacing: 6, glow: 18, weight: '700' });
        if (k >= 3) crtText(g, c, w / 2, h * 0.7, { size: 38, color: '#9ff2e2', spacing: 3, glow: 8 });
      });
      tv.set({ power: 1, noise: 0.015, time: t, bright: 1.1 });
      light = k >= 2 ? 6 : 3; lc = k >= 2 ? ORANGE : TEAL;
    }
    A.tvLight.color.copy(lc); A.tvLight.intensity = light;
    A.tvSpill.color.copy(lc); A.tvSpill.intensity = light * 1.6;
    return { orange: lc === ORANGE ? light : 0 };
  }

  function alien(t, cam) {
    const feeds = [];
    const shot = cam.shot.id;
    const pg = program(t);
    const usingFeed = between(t, CUE.lastFeed, CUE.noSignal) || between(t, CUE.rewind, CUE.freeze);
    if (usingFeed) { realRoom(t); feeds.push({ feed: lastFeed, scene: R.scene }); }

    // The ring of screens: Stoo, one after another; then the region notice; then dark;
    // then Stoo again, frozen, for the rest of it.
    const u = A.screens.material.uniforms;
    u.uTime.value = t;
    let ringCol = ORANGE, ringK = 0;
    if (t < CUE.cascade) { u.uBright.value = 0; u.uIdle.value = 0.1; }
    else if (t < CUE.regionWide) { u.uText.value = A.screenTex.stoo; u.uBright.value = 1; u.uIdle.value = 0.22; ringK = smooth(CUE.cascade, CUE.cascade + 3.6, t) * (t < CUE.region ? 1 : 0); }
    else if (t < CUE.origin) { u.uText.value = texRegion; u.uBright.value = 0.75; ringCol = WHITE; ringK = 0.6; }
    else if (t < CUE.freeze) { u.uBright.value = 0; u.uIdle.value = between(t, CUE.white, CUE.rewind) ? 0 : 0.12; }
    else { u.uText.value = A.screenTex.stoo; u.uBright.value = smooth(CUE.freeze, CUE.freeze + 1.2, t) * 0.85; ringK = u.uBright.value * 0.8; }
    A.ringLights.forEach(({ light }) => { light.color.copy(ringCol); light.intensity = 9 * ringK; });

    // The room's own light: dim teal, sinking away when the signal is lost
    const lost = smooth(CUE.white, CUE.noSignal + 1.0, t) * (1 - smooth(CUE.freeze, CUE.freeze + 2, t));
    A.backWash.intensity = lerp(16, 5, lost);
    A.hemi.intensity = lerp(0.35, 0.18, lost);
    A.floorGlow.intensity = lerp(26, 8, lost) * (1 - 0.7 * smooth(CUE.stoo, CUE.stoo + 1, t) * (1 - smooth(CUE.region, CUE.region + 0.1, t)));
    A.handKey.target.position.copy(A.tvTop);
    A.handKey.intensity = between(t, CUE.grief, CUE.profile) ? 7 : 0;

    // One head turns, a little, toward something behind it
    const turn = pulse(t, CUE.headTurn, CUE.headTurn + 3.6, 1.2, 1.4) * 0.55;
    A.setWatcher(turner, turn);
    A.bodies.instanceMatrix.needsUpdate = true; A.hair.instanceMatrix.needsUpdate = true;

    // The hand settles on top of the set
    const hk = easeOut((t - CUE.hand) / 1.6);
    A.hand.visible = t > CUE.hand - 0.05 && t < CUE.profile + 11;
    if (A.hand.visible) {
      // it comes over the back of the set and lets its fingers rest over the front edge
      const top = A.tvTop.clone().add(new THREE.Vector3(-0.05, 0.02, -0.07));
      const start = top.clone().add(new THREE.Vector3(-0.1, 0.3, -0.35));
      A.hand.position.lerpVectors(start, top, hk);
      A.hand.rotation.set(-0.12 * (1 - hk), 0.32, 0, 'YXZ');
    }

    // Drops of light, falling where faces would be
    const tk = smooth(CUE.profile + 0.4, CUE.profile + 1.0, t) * (1 - smooth(CUE.reply + 1.5, CUE.reply + 4, t));
    A.tears.material.opacity = tk;
    const P = A.tearPos;
    for (let k = 0; k < A.tearN; k++) {
      // the first few belong to the one we see in profile
      const wi = k < 6 ? A.hero : front[Math.floor(hash(k * 3.1) * front.length)];
      const w = A.watchers[wi];
      const period = 2.6 + hash(k * 1.7) * 1.8;
      const t0 = (k < 6 ? CUE.profile + 0.6 + k * 1.5 : CUE.tears + hash(k * 7.3) * 4) ;
      const age = t - t0;
      if (age < 0 || tk <= 0) { P[k * 3 + 1] = -50; continue; }
      const ph = (age % period) / period;
      const yaw = Math.atan2(-w.x, -w.z) + (wi === A.hero ? 0 : 0);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const off = (hash(k * 5.9) < 0.5 ? -1 : 1) * (0.1 + hash(k * 2.3) * 0.03);
      P[k * 3] = w.x + fx * 0.07 * w.s + Math.cos(yaw) * off * w.s;
      P[k * 3 + 1] = (1.93 - 0.12 * Math.pow(ph * 3.2, 2)) * w.s;
      P[k * 3 + 2] = w.z + fz * 0.07 * w.s - Math.sin(yaw) * off * w.s;
      if (ph * 3.2 > 4.0) P[k * 3 + 1] = -50;
    }
    A.tears.geometry.attributes.position.needsUpdate = true;

    // The sky: the label, then the pale blue point goes out
    A.labelMat.opacity = smooth(CUE.sky + 2.4, CUE.sky + 3.4, t) * (1 - smooth(CUE.title - 0.3, CUE.title, t));
    const gone = smooth(CUE.fade, CUE.fade + 2.4, t);
    A.earth.material.color.setRGB(1.2, 1.5, 2.2).multiplyScalar(1 - gone);
    A.earth.scale.setScalar(0.9 * (1 - 0.6 * gone));

    // The reply
    const bk = easeInOut((t - CUE.reply - 0.4) / 6.5);
    A.beamMat.opacity = t > CUE.reply ? smooth(CUE.reply, CUE.reply + 0.8, t) * (1 - smooth(CUE.title - 0.3, CUE.title, t)) : 0;
    if (A.beamMat.opacity > 0) {
      const len = Math.max(0.01, A.beamLen * bk);
      A.beam.position.copy(A.mastTop).addScaledVector(A.beamDir, len / 2);
      A.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.beamDir);
      A.beam.scale.set(1, len, 1);
    }

    // Dust, only where the set's light falls
    A.dust.material.uniforms.uTime.value = t;
    A.dust.setLight(0, [0, 1.45, 0.4], [0, 0.05, 1], 0.55, 0.8, 9, 0.05 * Math.min(1, A.tvLight.intensity / 8), A.tvLight.color.getHex());
    for (let i = 1; i < 4; i++) A.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

    A.ringMat.color.setRGB(0.05, 0.32, 0.3).multiplyScalar(lerp(1, 0.35, lost));
    return { feeds, warm: pg.orange > 0 || ringK > 0.3 ? 1 : 0 };
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene === 'alien') return { cam, portals: [], ...alien(t, cam) };
      return { cam, feeds: [], portals: [], warm: 0 };
    },
  };
}
