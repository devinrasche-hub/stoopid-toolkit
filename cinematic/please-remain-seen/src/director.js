import * as THREE from 'three';
import { CUE } from './timeline.js';
import { cameraAt, trackCam, trackZ, ENTITY_HOME } from './shots.js';
import { crtText } from './crt.js';
import { makeHand } from './entity.js';
import { SPOT, FIXTURE } from './world.js';
import { clamp, lerp, smooth, pulse, fluorescent, easeInOut, easeOut, hash } from './util.js';

// The director turns timeline time into world state: lights, props, monitors,
// the entity, and which live feeds must be rendered for this frame.

const q20 = (x) => Math.round(clamp(x) * 20);
const TEAL = '#bfe9df';
const OFFWHITE = '#e6e3d2';

function timecode(t) {
  // Station clock: 03:13:00 at the top of the broadcast.
  const total = 13 * 60 + Math.floor(t);
  const p = (n) => String(n).padStart(2, '0');
  return `03:${p(Math.floor(total / 60))}:${p(total % 60)}:${p(Math.floor((t % 1) * 30))}`;
}

function bars(g, w, h, alpha = 1) {
  const cols = ['#bfbfbf', '#bfbf20', '#20bfbf', '#20bf2a', '#a020b0', '#bf2020', '#2020bf'];
  g.globalAlpha = alpha;
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.7); });
  const low = ['#2020bf', '#111', '#a020b0', '#111', '#20bfbf', '#111', '#bfbfbf'];
  low.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / 7, h * 0.7, w / 7 + 1, h * 0.08); });
  g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.78, w, h * 0.22);
  g.globalAlpha = 1;
}

function viewers(g, w, h, n, a = 1, size = 22) {
  crtText(g, `●`, 26, h - 30, { size: size * 0.8, color: '#ff4a2a', align: 'left', glow: 8, alpha: a });
  crtText(g, `VIEWERS: ${n}`, 50, h - 30, { size, color: OFFWHITE, align: 'left', alpha: a, spacing: 2 });
}

export function makeDirector(W, T) {
  const { station: S, corridor: C } = W;
  const v3 = new THREE.Vector3();

  // The hand rests on the main CRT; it is part of the monitor's group.
  const hand = makeHand(T.hand);
  hand.position.set(0.07, 0.345 / 2 + 0.045 + 0.003, 0.03 - 0.16);
  hand.rotation.y = -0.32;
  S.crt.group.add(hand);
  hand.visible = false;

  const P = {
    P0: [0, 0, -5.2],
    P1: [-0.55, 0, -0.95],
    P2: [0.75, 0, 1.75],
    P3: [-2.38, 0, 2.15],
    P4: [-2.0, 0, 1.18],
  };
  const chairAfter = { pos: [3.6, 0, -0.52], yaw: Math.atan2(0 - 3.6, -5.2 + 0.52) };
  const faceAway = (e, cam) => Math.atan2(e[0] - cam[0], e[2] - cam[2]);

  // Monitor power curves: 1 on, collapsing to 0 at `off` (0.35s), afterglow dot.
  const powerOff = (t, off) => ({
    power: 1 - smooth(off, off + 0.35, t),
    dot: t > off + 0.3 ? Math.max(0, 1 - (t - off - 0.3) / 0.7) * (t < off + 1.0 ? 1 : 0) : 0,
  });

  function stationState(t, cam) {
    const feeds = [];
    const shot = cam.shot.id;

    // ── Props
    const micYaw = 0.46 * easeInOut((t - CUE.micDrift) / 5.5) + 0.035 * Math.sin(t * 0.7) + (t > 47 ? 0.12 * Math.sin(t * 0.23) : 0);
    S.micPivot.rotation.y = micYaw;
    S.micPivot.rotation.z = 0.012 * Math.sin(t * 0.5);

    if (t < CUE.card) {
      S.chair.position.copy(S.chairHome);
      S.chair.rotation.y = lerp(2.55, 0, easeInOut((t - CUE.chairTurnStart) / (CUE.chairTurnEnd - CUE.chairTurnStart)));
    } else {
      S.chair.position.set(...chairAfter.pos);
      S.chair.rotation.y = chairAfter.yaw;
    }

    // The shadow crossing the back wall, seen reflected in the glass
    const sc = clamp((t - CUE.shadowCrossStart) / (CUE.shadowCrossEnd - CUE.shadowCrossStart));
    S.shadow.material.opacity = 0.95 * pulse(t, CUE.shadowCrossStart, CUE.shadowCrossEnd, 0.5, 0.5);
    S.shadow.position.x = lerp(2.4, -2.2, sc);
    S.shadow.visible = S.shadow.material.opacity > 0.001;

    // ── Lights
    const fl = fluorescent(t, 4, 0.25);
    const stripOn = t < CUE.m3Off ? 1 : 0;
    const occl = 1 - 0.6 * pulse(t, CUE.shadowCrossStart + 0.6, CUE.shadowCrossEnd - 0.3, 0.4, 0.4);
    S.stripLight.intensity = 6 * fl * stripOn * occl * (t > CUE.black ? 0 : 1);
    const lampOn = (t < CUE.m3Off ? 1 : 0) * (t > CUE.black ? 0 : 1);
    S.lamp.intensity = 4.2 * lampOn * occl * (0.96 + 0.04 * fluorescent(t, 21, 0.1));
    S.lampBulb.material.color.setRGB(3, 2.9, 2.4).multiplyScalar(lampOn + 0.003);
    S.strip.material.color.setRGB(2.2, 2.4, 2.1).multiplyScalar(fl * stripOn * (t > CUE.black ? 0 : 1) + 0.002);

    let spot = SPOT * (0.92 + 0.08 * fluorescent(t, 9, 0.2));
    if (t > CUE.m3Off) {
      const dip = 1 - 0.9 * pulse(t, CUE.m3Off + 0.05, CUE.m3Off + 0.95, 0.2, 0.35);
      spot *= dip * (t > CUE.m3Off + 0.9 ? 0.7 : 1);
    }
    spot *= 1 - smooth(CUE.m2Off + 0.05, CUE.m2Off + 0.45, t);
    S.spot.intensity = spot;
    S.spotCone.material.uniforms.uIntensity.value = 0.028 * spot / SPOT;

    const uvAmt = t < CUE.arc ? 2.5 : t < CUE.m2Off ? 3.5 : 0.8;
    S.uv.intensity = uvAmt * (t > CUE.black ? 0 : 1);
    S.uv2.intensity = (t < CUE.m2Off ? 5 : 0.8) * (t > CUE.black ? 0 : 1);
    S.cyc.intensity = 30 * (t < CUE.m2Off ? 1 : 0.15) * (t > CUE.black ? 0 : 1) * (1 - 0.8 * pulse(t, CUE.m3Off + 0.05, CUE.m3Off + 0.95, 0.2, 0.35));

    const tal = smooth(CUE.tallyOn, CUE.tallyOn + 0.12, t) * (t < CUE.black ? 1 : 0);
    S.tally.intensity = 4 * tal;
    S.tally2.intensity = 1.2 * tal;
    S.tallyLamp.material.color.setRGB(5 * tal, 0.4 * tal, 0.15 * tal);
    S.onAir.material.color.setRGB(3.2 * tal + 0.05, 0.25 * tal + 0.01, 0.1 * tal + 0.01);

    S.exitLight.intensity = t > CUE.black ? 0.45 : 0.9;
    S.ambient.intensity = t < CUE.disconnect ? 1.0 : t < CUE.m1Off ? 0.6 : t < CUE.black ? 0.3 : 0.12;
    S.rackLeds.forEach((l, i) => {
      const on = hash(i * 7 + Math.floor(t * 0.8 + i * 0.37)) > 0.55 && t < CUE.m2Off;
      l.material.color.setRGB(on ? 0.1 : 0.01, on ? 1.4 : 0.02, on ? 0.6 : 0.02);
    });

    // ── Main CRT program
    const crt = S.crt;
    if (t < CUE.glassWide) {
      const pw = smooth(CUE.crtOn, CUE.crtOn + 0.55, t);
      const warm = 1 - smooth(CUE.crtOn + 0.4, CUE.crtOn + 1.6, t);
      const aT = pulse(t, CUE.identTitle, CUE.identTextOut, 0.5, 0.6);
      const aS = pulse(t, CUE.identSub, CUE.identTextOut, 0.5, 0.6);
      const aV = pulse(t, CUE.viewers1In, CUE.viewers1Out, 0.15, 0.25);
      crt.draw(`id${q20(aT)}${q20(aS)}${q20(aV)}`, (g, w, h) => {
        if (aT > 0) {
          crtText(g, 'STOOPID', w / 2, h * 0.36, { size: 64, color: OFFWHITE, alpha: aT, spacing: 10, weight: '700' });
          crtText(g, 'AFTER HOURS', w / 2, h * 0.48, { size: 34, color: TEAL, alpha: aT, spacing: 14 });
        }
        if (aS > 0) crtText(g, 'HALLOWEEN SPECIAL', w / 2, h * 0.64, { size: 22, color: '#ff7a3a', alpha: aS, spacing: 8, glow: 14 });
        if (aV > 0) viewers(g, w, h, 1, aV, 26);
      });
      const fm = lerp(0.3, 0.95, smooth(CUE.identTextOut - 0.3, CUE.identTextOut + 0.5, t)) * pw;
      crt.set({ power: pw, feedMix: fm, noise: lerp(0.06, 0.6, warm) * pw, roll: warm * 0.25 * Math.sin((t - CUE.crtOn) * 2.2),
                time: t, feed: S.feedC1.texture, light: 0.6 + 0.4 * fm });
      if (shot === '1A' && fm > 0.01) feeds.push(S.feedC1);
    } else if (t < CUE.disconnect) {
      crt.draw('slate', (g, w, h) => {
        g.fillStyle = '#0b1514'; g.fillRect(0, 0, w, h);
        crtText(g, 'STOOPID AFTER HOURS', w / 2, h * 0.45, { size: 30, color: TEAL, spacing: 6 });
        crtText(g, '● LIVE', w / 2, h * 0.58, { size: 22, color: '#ff5533', spacing: 4 });
      });
      crt.set({ power: 1, feedMix: 0, noise: 0.05, time: t, light: 0.55 });
    } else if (t < CUE.black) {
      const n = t < CUE.viewersFinal ? 2 : 1;
      const aW = smooth(CUE.whoWatching, CUE.whoWatching + 0.6, t);
      const aV = 1 - 0.6 * aW;
      crt.draw(`fin${n}${q20(aW)}`, (g, w, h) => {
        g.fillStyle = '#050909'; g.fillRect(0, 0, w, h);
        crtText(g, '● LIVE', 30, 40, { size: 20, color: '#ff4a2a', align: 'left', spacing: 3 });
        crtText(g, `VIEWERS: ${n}`, w / 2, h * (0.5 - 0.1 * aW), { size: 44, color: OFFWHITE, spacing: 6, alpha: aV });
        if (aW > 0) crtText(g, 'WHO IS WATCHING WHOM?', w / 2, h * 0.6, { size: 28, color: TEAL, spacing: 4, alpha: aW });
      });
      const sag = t > CUE.viewersFinal - 0.25 && t < CUE.viewersFinal + 0.15 ? 0.25 : 0;
      crt.set({ power: 1, feedMix: 0, noise: 0.06 + sag, time: t, light: 0.85, roll: sag * 0.04 });
    } else {
      const a = smooth(CUE.stay, CUE.stay + 0.8, t);
      crt.draw(`stay${q20(a)}`, (g, w, h) => {
        if (a > 0) crtText(g, 'Stay?', w / 2, h / 2, { size: 15, color: OFFWHITE, alpha: a, weight: '400', spacing: 3, glow: 6,
          font: '"Helvetica Neue", Helvetica, Arial, sans-serif' });
      });
      crt.set({ power: t < CUE.titleCard ? 1 : 0, feedMix: 0, noise: 0.01, time: t, bright: 0.9, light: 0.25 + 0.15 * a, glass: 0.25 });
    }

    // ── Small monitors
    const [M1, M2, M3] = S.monitors;
    const m1 = powerOff(t, CUE.m1Off), m2 = powerOff(t, CUE.m2Off), m3 = powerOff(t, CUE.m3Off);
    const rec = tal > 0.5;
    M1.draw(`m1${rec}${Math.floor(t * 10)}`, (g, w, h) => {
      crtText(g, 'CAM 2', 34, 26, { size: 16, color: OFFWHITE, align: 'left', spacing: 2, glow: 4 });
      if (rec) crtText(g, '● ON AIR', w - 34, 26, { size: 16, color: '#ff4a2a', align: 'right', spacing: 2, glow: 6 });
      crtText(g, timecode(t), w / 2, h - 20, { size: 14, color: TEAL, spacing: 2, glow: 3 });
    });
    const m1Visible = ['5C', '6A'].includes(shot) && m1.power > 0;
    M1.set({ ...m1, feedMix: 0.95, noise: 0.06, time: t, feed: S.feedC2.texture });
    if (m1Visible) feeds.push(S.feedC2);
    M2.draw('m2', (g, w, h) => {
      bars(g, w, h, 0.85);
      crtText(g, 'STOOPID AFTER HOURS', w / 2, h * 0.88, { size: 15, color: OFFWHITE, spacing: 3, glow: 4 });
    });
    M2.set({ ...m2, noise: 0.05, time: t, bright: 0.7 });
    M3.draw('m3', (g, w, h) => { crtText(g, 'NO SIGNAL', w / 2, h / 2, { size: 18, color: TEAL, spacing: 4, glow: 6, alpha: 0.7 }); });
    M3.set({ ...m3, noise: 0.55, time: t, bright: 0.8 });

    // ── Entity (in the world)
    let ent = null;
    if (t >= CUE.arc && t < CUE.disconnect) {
      let camForYaw = cam.pos;
      if (shot === '5A') {
        const lagged = cameraAt(Math.max(CUE.arc, t - 0.45));
        camForYaw = lagged.pos;
      } else if (shot === '5C') {
        camForYaw = cameraAt(CUE.monitorInsert - 0.01).pos;
      }
      ent = { pos: P.P0, yaw: faceAway(P.P0, camForYaw), rim: [0.85, 0.88, 0.8], rimAmt: 0.5, glow: 1.0 };
    } else if (t >= CUE.disconnect && t < CUE.black) {
      // It moves only in the darkest moment after each picture dies.
      const steps = [
        [CUE.disconnect, P.P0], [CUE.m3Off + 0.5, P.P1], [CUE.m2Off + 0.35, P.P2], [CUE.m1Off + 0.3, P.P3], [CUE.finalCrt, P.P4],
      ];
      let idx = 0;
      steps.forEach((s, i) => { if (t >= s[0]) idx = i; });
      const pos = steps[idx][1];
      const yawCam = cameraAt(Math.max(steps[idx][0], CUE.disconnect) + 0.001).pos;
      const rimC = idx >= 3 ? [0.55, 0.85, 0.82] : [0.7, 0.75, 0.85];
      ent = { pos, yaw: faceAway(pos, yawCam), rim: rimC, rimAmt: idx >= 3 ? 0.4 : 0.3, glow: 1.2 };
    }
    S.entity.update(t, ent ? ent : { visible: false });
    if (!ent) S.entity.group.visible = false;

    // Ghost: the figure that is only in the CRT's picture during the ident
    if (t < CUE.glassWide) {
      const gp = [2.62, 0, 6.35];
      S.ghost.update(t, { pos: gp, yaw: Math.atan2(-1.5 - gp[0], 0.9 - gp[2]), rimAmt: 0.15, glow: 0.8 });
    } else S.ghost.update(t, { visible: false });

    // Rig: the cinematic camera, visible only to surveillance feeds
    if (t >= CUE.arc && t < CUE.disconnect) {
      const rc = shot === '5C' ? cameraAt(CUE.monitorInsert - 0.01) : cam;
      S.rig.visible = true;
      S.rig.position.set(...rc.pos);
      S.rig.lookAt(...rc.look);
    } else S.rig.visible = false;

    // ── Hand
    hand.visible = t > CUE.handIn - 0.1 && t < CUE.titleCard;
    hand.uniforms.uReveal.value = easeOut((t - CUE.handIn) / 1.3);
    hand.uniforms.uTime.value = t;

    // ── Reflections
    S.glass.material.uniforms.uStrength.value = shot === '2B' ? 0.48 : 0.28;
    S.glass.visible = true;

    // ── Dust
    S.dust.material.uniforms.uTime.value = t;
    S.dust.setLight(0, S.spot.position.toArray(), [-0.25, -4.5, -0.45], Math.cos(0.42), Math.cos(0.42 * 0.4), 6.5, 0.05 * spot / SPOT, 0xe7ecd8);
    S.dust.setLight(1, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    S.dust.setLight(2, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    S.dust.setLight(3, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    S.dustCR.material.uniforms.uTime.value = t;
    crt.screen.getWorldPosition(v3);
    const crtGlow = crt.light ? crt.light.intensity / crt.baseLight : 0;
    S.dustCR.setLight(0, v3.toArray(), [Math.sin(0.16), 0, Math.cos(0.16)], 0.55, 0.85, 2.4, 0.06 * crtGlow, 0x9bd6cf);
    S.dustCR.setLight(1, S.stripLight.position.toArray(), [0, -1, -0.2], 0.3, 0.7, 3.5, 0.003 * S.stripLight.intensity, 0xd6e3cf);
    S.dustCR.setLight(2, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    S.dustCR.setLight(3, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

    return feeds;
  }

  function corridorState(t, cam) {
    const feeds = [C.feed];
    const tc = trackCam(t);
    const camZ = tc[2];

    // Fixtures: full ahead, dimming as the camera passes beneath them.
    C.fixtures.forEach((fx) => {
      const d = fx.z - camZ; // >0 once passed
      let lvl = 1 - 0.86 * smooth(-0.4, 1.0, d);
      lvl *= fluorescent(t + fx.k * 3.1, fx.k + 1, 0.18);
      if (fx.damaged === 'dead') lvl = 0;
      if (fx.damaged === 'flicker') lvl *= fluorescent(t * 1.4, 77, 0.75);
      if (fx.damaged === 'hanging') lvl *= 0.75;
      // the far end of the hall is darker
      lvl *= 0.4 + 0.6 * smooth(-22, -6, fx.z);
      fx.light.intensity = FIXTURE * lvl;
      fx.panelMat.color.setRGB(2.2 * lvl, 2.4 * lvl, 2.15 * lvl);
      fx.cone.material.uniforms.uIntensity.value = 0.028 * lvl;
    });

    // Dust uses the four fixtures nearest ahead of the camera.
    C.dust.material.uniforms.uTime.value = t;
    const ahead = C.fixtures.filter((f) => f.z < camZ + 1.5).slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const fx = ahead[i];
      if (fx) C.dust.setLight(i, [0, 2.62, fx.z], [0, -1, 0], Math.cos(0.95), Math.cos(0.4), 3.2, 0.05 * fx.light.intensity / FIXTURE, 0xdbe6d2);
      else C.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    }

    // Rig at the dolly position; the entity stands directly behind it.
    C.rig.position.set(...tc);
    C.rig.lookAt(tc[0], 1.27, tc[2] - 10);
    C.entity.update(t, { pos: [0.16, 0, camZ + 1.05], yaw: Math.PI + 0.05, rimAmt: 0.45, rim: [0.8, 0.85, 0.78], glow: 1.3, tear: 0.05 });

    // Feed camera: a few feet behind us.
    C.feed.camera.position.set(-0.25, 1.95, camZ + 3.1);
    C.feed.camera.lookAt(0.0, 1.05, camZ - 6);

    const n = t < CUE.viewers2 ? 1 : 2;
    const tick = t > CUE.viewers2 - 0.1 && t < CUE.viewers2 + 0.25;
    C.crt.draw(`hall${n}${Math.floor(t * 10)}`, (g, w, h) => {
      crtText(g, '● LIVE', 22, 28, { size: 18, color: '#ff4a2a', align: 'left', spacing: 3, glow: 6 });
      crtText(g, 'HALL B · CAM 0', w - 22, 28, { size: 16, color: OFFWHITE, align: 'right', spacing: 2, glow: 4 });
      viewers(g, w, h, n, 1, 22);
      crtText(g, timecode(t), w - 22, h - 30, { size: 14, color: TEAL, align: 'right', spacing: 2, glow: 3 });
    });
    C.crt.set({ power: 1, feedMix: 0.95, noise: tick ? 0.25 : 0.07, time: t, feed: C.feed.texture, light: 0.9 });
    C.tally.intensity = 2 * (0.9 + 0.1 * Math.sin(t * 2.0));
    return feeds;
  }

  return {
    hand,
    update(t) {
      const cam = cameraAt(t);
      let feeds = [];
      if (cam.scene === 'station') feeds = stationState(t, cam);
      else if (cam.scene === 'corridor') feeds = corridorState(t, cam);
      return { cam, feeds };
    },
  };
}
