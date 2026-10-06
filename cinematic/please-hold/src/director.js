import * as THREE from 'three';
import { CUE } from './timeline.js';
import { cameraAt, walkerZ, LEVER_TIP } from './shots.js';
import { crtText } from './crt.js';
import { SPOT, FIXTURE } from './world.js';
import { clamp, lerp, smooth, pulse, fluorescent, easeInOut, easeOut, hash, keyed } from './util.js';

// Timeline time → the state of every space. Each space is fully defined by t,
// so any timestamp can be rendered directly (seek, scrub, offline frames).

const OFFWHITE = '#e6e3d2';
const TEAL = '#bfe9df';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const q20 = (x) => Math.round(clamp(x) * 20);
// 12 fps stepping for the entity's own movements: it is a little out of sync.
const step12 = (x) => Math.floor(x * 12) / 12;
const between = (t, a, b) => t >= a && t < b;

function timecode(t) {
  const total = 14 * 60 + 2 + Math.floor(t);
  const p = (n) => String(n).padStart(2, '0');
  return `03:${p(Math.floor(total / 60))}:${p(total % 60)}:${p(Math.floor((t % 1) * 30))}`;
}

export function makeDirector(W) {
  const { station: S, corridor: C, lift: L } = W;
  const v3 = new THREE.Vector3();

  // Portal: the elevator doorway opens onto the control room, near the CRT.
  C.portal.toAnchor.position.set(-1.45, 0, 5.35);

  // The audience goes dark in groups, nearest the switch first.
  {
    const off = L.audience.geometry.attributes.aOff;
    for (let i = 0; i < L.audienceCount; i++) off.array[i] = CUE.groupsOff + Math.min(5, Math.floor(L.audienceDist[i] / 8)) * 0.52;
    off.needsUpdate = true;
  }
  // The scanline hand on the switch moves with the lever.
  L.lever.add(L.hand);
  L.hand.position.set(-0.03, 0.2, -0.05);
  L.hand.rotation.set(-Math.PI / 2, 0, 0.35);

  const E1 = [-2.6, 0, 1.0];                         // beside the CRT
  const handOnCrt = [-1.5, 1.27, 0.6];      // the wrist, at the back of the CRT's top
  const doorPt = [-3.92, 1.05, 2.2];

  // ── CONTROL ROOM ──────────────────────────────────────────────────────────
  function station(t, cam, viaPortal = false) {
    const shot = cam.shot.id;
    // Continuity with 01's ending: monitors dead, studio dark, only the CRT,
    // the exit lamp, and now the amber HOLD lamp over the service door.
    S.stripLight.intensity = 0; S.strip.material.color.setRGB(0.01, 0.01, 0.01);
    S.lamp.intensity = 0; S.lampBulb.material.color.setRGB(0.01, 0.01, 0.01);
    S.spot.intensity = 0; S.spotCone.material.uniforms.uIntensity.value = 0;
    S.uv.intensity = 1.2; S.uv2.intensity = 0.6; S.cyc.intensity = 5;
    S.tally.intensity = 0; S.tally2.intensity = 0;
    S.tallyLamp.material.color.setRGB(0.05, 0.01, 0.01); S.onAir.material.color.setRGB(0.05, 0.01, 0.01);
    S.exitLight.intensity = 0.6;
    S.ambient.intensity = viaPortal ? 0.9 : t < CUE.pullBack ? 0.25 : 0.4;
    S.rackLeds.forEach((l) => l.material.color.setRGB(0.01, 0.02, 0.02));
    S.monitors.forEach((m) => { m.draw('off', () => {}); m.set({ power: 0, time: t }); });
    S.shadow.visible = false;
    S.ghost.update(t, { visible: false });
    S.rig.visible = false;
    S.micPivot.rotation.y = 0.5 + 0.03 * Math.sin(t * 0.4);
    S.chair.position.set(3.6, 0, -0.52); S.chair.rotation.y = -2.47;

    // Equipment HOLD keys: ordinary, two of them lit.
    S.deskLamps.forEach((l, i) => l.set(i === 1 || i === 3 ? 0.55 : 0));
    const lamp = t >= CUE.doorLamp ? 1 : 0;
    S.doorLamp.set(lamp * (t < CUE.doorLamp + 0.08 ? 0.4 : 1));
    S.exitSign.draw(t < CUE.signFlip ? 'EXIT' : 'CONTINUE', between(t, CUE.signFlip - 0.06, CUE.signFlip + 0.1) ? 0.05 : 1.6);
    const ajar = t < CUE.doorAjar ? 0 : lerp(0.18, 1.15, easeInOut((t - 25.3) / 1.4)) * smooth(CUE.doorAjar, CUE.doorAjar + 0.5, t);
    S.serviceDoor.rotation.y = -ajar;
    S.passLight.intensity = t < CUE.doorAjar ? 0 : 1.6;
    S.glass.material.uniforms.uStrength.value = shot === '2B' ? 0.85 : 0.25;

    // CRT program
    const crt = S.crt;
    if (t < CUE.corridor) {
      const swap = t >= CUE.thankYou;
      const roll = pulse(t, CUE.thankYou - 0.15, CUE.thankYou + 0.35, 0.05, 0.2);
      crt.draw(swap ? 'thanks' : 'stay', (g, w, h) => {
        if (!swap) crtText(g, 'Stay?', w / 2, h / 2, { size: 15, color: OFFWHITE, weight: '400', spacing: 3, glow: 6, font: SANS });
        else crtText(g, 'THANK YOU FOR HOLDING.', w / 2, h / 2, { size: 17, color: OFFWHITE, weight: '400', spacing: 4, glow: 6, font: SANS });
      });
      crt.set({ power: 1, noise: 0.012 + roll * 0.3, roll: roll * 0.06, time: t, bright: 0.9, light: 0.45, glass: t < CUE.pullBack ? 0.3 : 0.7 });
    } else {
      crt.draw(`feed${Math.floor(t * 10)}`, (g, w, h) => {
        crtText(g, '● LIVE', 26, 32, { size: 18, color: '#ff4a2a', align: 'left', spacing: 3, glow: 6 });
        crtText(g, 'CONTINUITY · CAM 4', w - 26, 32, { size: 16, color: OFFWHITE, align: 'right', spacing: 2, glow: 4 });
        crtText(g, timecode(t), w - 26, h - 32, { size: 14, color: TEAL, align: 'right', spacing: 2, glow: 3 });
      });
      crt.set({ power: 1, feedMix: 0.95, noise: 0.05, time: t, feed: C.feed.texture, light: 0.8, glass: 1 });
    }

    // The scanline hand on the CRT: it grips, then lets go.
    const hand = S.hand;
    hand.visible = t < CUE.gesture + 0.6;
    hand.uniforms.uTime.value = t;
    hand.uniforms.uGrip.value = smooth(CUE.grip, CUE.grip + 0.9, t) * (1 - smooth(CUE.gesture - 0.3, CUE.gesture, t));
    hand.uniforms.uReveal.value = 1 - smooth(CUE.gesture, CUE.gesture + 0.5, t);
    hand.uniforms.uIntensity.value = 0.75 + 0.25 * smooth(CUE.grip, CUE.grip + 0.9, t);

    // The entity
    S.echoOn = shot === '2B' && t < 23.4;
    S.echo.update(t, { pos: E1, yaw: Math.PI / 2, reach: handOnCrt, reachAmt: 1, rim: [0.6, 0.95, 0.9], rimAmt: 1.6, glow: 2.0 });
    S.echo.group.visible = false;
    if (t < CUE.passGlass) {
      const head = -1.15 * easeInOut((step12(t) - CUE.notice) / 1.2);
      const toDoor = easeInOut((step12(t) - CUE.gesture) / 1.1);
      const reachPt = toDoor > 0 ? doorPt : handOnCrt;
      const amt = toDoor > 0 ? lerp(0.0, 0.45, toDoor) : 1;
      // while it holds the CRT, the arm thins into the scanline hand
      const holding = 1 - toDoor;
      S.entity.update(t, { pos: E1, yaw: Math.PI / 2, reach: reachPt, reachAmt: amt, headYaw: head,
        fadeAt: holding > 0.5 ? handOnCrt : null, fadeR: lerp(1.9, 0.95, smooth(CUE.pullBack, CUE.exitWide - 0.6, t)),
        rim: [0.55, 0.85, 0.82], rimAmt: 0.45 + 0.3 * lamp, glow: 1.1 });
    } else if (t < CUE.corridor) {
      const push = easeInOut((step12(t) - 25.2) / 1.0);
      S.entity.update(t, { pos: [-3.42, 0, 2.95], yaw: -2.5, reachL: [-3.9, 1.05, 2.5], reachAmtL: 0.62 * push,
        rim: [0.95, 0.65, 0.3], rimAmt: 0.5, glow: 1.0 });
    } else S.entity.update(t, { visible: false });

    // Dust in the CRT glow
    S.dust.material.uniforms.uTime.value = t;
    S.dustCR.material.uniforms.uTime.value = t;
    crt.screen.getWorldPosition(v3);
    S.dustCR.setLight(0, v3.toArray(), [Math.sin(0.16), 0, Math.cos(0.16)], 0.55, 0.85, 2.4, 0.05, 0x9bd6cf);
    for (let i = 1; i < 4; i++) S.dustCR.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    for (let i = 0; i < 4; i++) S.dust.setLight(i, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    return [];
  }

  // ── CONTINUITY ────────────────────────────────────────────────────────────
  function corridor(t, cam) {
    const feeds = [];
    const shot = cam.shot.id;
    C.fixtures.forEach((fx) => {
      let lvl = fluorescent(t + fx.k * 2.3, fx.k + 31, fx.k === 1 ? 0.45 : 0.12);
      fx.light.intensity = 7 * lvl;
      if (fx.panelMat) fx.panelMat.color.setRGB(2.0 * lvl, 2.2 * lvl, 1.95 * lvl);
      fx.cone.material.uniforms.uIntensity.value = 0.022 * lvl;
    });
    const swapped = t >= CUE.corridorSwap;
    C.short.visible = !swapped; C.long.visible = swapped;
    C.paintMat.map = swapped ? C.paintDark : C.paintLit;
    C.paintWindow.visible = !swapped;

    // Elevator
    const open = t < CUE.liftOpenStart ? 0 : easeInOut((t - CUE.liftOpenStart) / (CUE.liftOpenEnd - CUE.liftOpenStart));
    C.doorL.position.x = -0.275 - 0.54 * open;
    C.doorR.position.x = 0.275 + 0.54 * open;
    C.liftLamp.set(1); C.callLamp.set(1);
    C.portal.mesh.visible = t >= CUE.liftOpenStart && t < CUE.liftCar;
    C.car.visible = t >= CUE.liftCar;

    // The telephone
    const lift = smooth(CUE.lift, CUE.lift + 0.7, t) * (1 - smooth(CUE.settle, CUE.settle + 1.2, t));
    C.handset.position.y = -0.11 + 0.028 * lift;
    C.handset.rotation.z = 0.1 * lift;
    let disp = '';
    if (t >= CUE.waitText && t < CUE.dontHangUp) disp = 'ESTIMATED WAIT TIME:|THE REST OF THE EPISODE';
    else if (t >= CUE.dontHangUp && t < CUE.liftCar) disp = 'PLEASE DO NOT|HANG UP.';
    C.phoneDisplay.draw(disp, disp ? 1.6 : 0.3);
    const ringing = between(t, CUE.ring, CUE.ring + 1.6);
    C.phoneLamp.set(ringing ? (Math.floor((t - CUE.ring) * 6) % 2 ? 1 : 0.3) : 0.8);

    // The entity: it waits beside the elevator, then holds its door.
    if (t < CUE.liftCar) {
      C.entity.update(t, { pos: [-0.74, 0, -10.7], yaw: Math.PI, rim: [0.85, 0.85, 0.78], rimAmt: 0.4, glow: 1.0,
        headYaw: shot === '3B' ? 0.35 * easeInOut((step12(t) - 35.4) / 0.9) : 0 });
    } else {
      C.entity.update(t, { pos: [0.36, 0, -12.95], yaw: Math.PI / 2, reachL: [0.57, 1.32, -12.02], reachAmtL: 1,
        rim: [0.85, 0.88, 0.82], rimAmt: 0.45, glow: 1.0 });
    }
    // Rig (seen only by the corridor camera feed)
    C.rig.visible = true;
    C.rig.position.set(...cam.pos);
    C.rig.lookAt(...cam.look);

    C.dust.material.uniforms.uTime.value = t;
    C.fixtures.forEach((fx, i) => C.dust.setLight(i, [0, 2.45, fx.z], [0, -1, 0], Math.cos(0.9), Math.cos(0.35), 3, 0.04 * fx.light.intensity / 7, 0xdbe6d2));
    C.dust.setLight(3, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);

    const portals = [];
    if (C.portal.mesh.visible && t < CUE.turnEnd) {
      station(t, cam, true);
      feeds.push({ feed: C.feed, scene: C.scene });
      portals.push({ portal: C.portal, far: S.scene });
    }
    return { feeds, portals };
  }

  // ── LIFT + CHAMBER ────────────────────────────────────────────────────────
  function lift(t, cam) {
    const feeds = [];
    const shot = cam.shot.id;
    // car doors: close behind us, open onto the chamber
    let open;
    if (t < CUE.doorsClose) open = 1;
    else if (t < CUE.doorsOpen + 0.2) open = 1 - easeInOut((t - CUE.doorsClose) / 1.5);
    else open = easeInOut((t - CUE.doorsOpen - 0.2) / 1.4);
    L.doorL.position.x = -0.275 - 0.54 * open;
    L.doorR.position.x = 0.275 + 0.54 * open;
    let floor = '';
    if (t >= CUE.floorB1) floor = 'B1';
    if (t >= CUE.floorB2) floor = 'B2';
    if (t >= CUE.floorB3) floor = 'B3';
    if (t >= CUE.floorYou) floor = 'YOU';
    L.indicator.draw(floor || ' ', floor ? 1.8 : 0.2);
    L.panelLamp.set(1);

    // the rear wall turns from mirror to window
    const reveal = smooth(CUE.glassReveal, CUE.glassReveal + 2.0, t);
    const carLight = (1 - 0.45 * reveal) * (t < 104 ? 1 : 0.4);
    L.car.light.intensity = 2.8 * carLight;
    L.car.ceilPanelMat.color.setRGB(0.9, 0.95, 0.85).multiplyScalar(carLight);
    L.glass.material.uniforms.uStrength.value = lerp(0.85, 0.08, reveal);
    L.glassBack.material.opacity = 1 - smooth(CUE.glassReveal + 0.2, CUE.glassReveal + 1.8, t);
    L.gallery.material.uniforms.uOn.value = t - CUE.glassReveal - 0.3;
    L.gallery.material.uniforms.uTime.value = t;
    L.gallery.material.uniforms.uAtlas.value = L.atlas.texture;
    L.galleryLight.intensity = 1.6 * reveal;
    const lure = smooth(69.4, 70.4, t) * (t < CUE.doorsOpen ? 1 : 0);
    L.lure.material.uniforms.uAmt.value = lure;
    L.lure.material.uniforms.uTime.value = t;
    L.lureLight.intensity = 3 * lure;
    if (shot === '5B' && t > CUE.glassReveal - 0.4) {
      L.chair.position.set(cam.pos[0], 0, cam.pos[2]);
      L.chair.rotation.y = Math.atan2(cam.look[0] - cam.pos[0], cam.look[2] - cam.pos[2]);
      feeds.push({ feed: L.atlas, scene: L.scene });
    }

    // walkway: sections light just ahead of the viewer and stay lit
    const wz = walkerZ(t);
    const dark = smooth(CUE.groupsOff + 0.2, CUE.groupsOff + 2.4, t);
    let lit = [];
    L.sections.forEach((s) => {
      const on = t >= CUE.doorsOpen + 0.8 && s.z < wz + 2.6 && !s.platform ? smooth(0, 0.15, t - (CUE.doorsOpen + 0.8)) : 0;
      const groupDark = smooth(CUE.groupsOff + s.z * 0.06, CUE.groupsOff + s.z * 0.06 + 0.3, t);
      const base = t >= CUE.doorsOpen + 0.5 && !s.platform ? 0.12 : 0;
      const lvl = Math.max(on, base) * (1 - groupDark);
      s.stripMat.color.setRGB(1.5 * lvl, 1.6 * lvl, 1.4 * lvl);
      if (s.cone) s.cone.material.uniforms.uIntensity.value = 0.03 * lvl;
      if (lvl > 0.01) lit.push(s);
    });
    lit = lit.filter((s) => s.z > cam.pos[2] - 3).sort((a, b) => Math.abs(a.z - cam.pos[2] - 2) - Math.abs(b.z - cam.pos[2] - 2));
    L.walkLights.forEach((p, i) => {
      const s = lit[i];
      if (s) { p.position.set(0, 2.0, s.z); p.intensity = 3.2; } else p.intensity = 0;
    });

    // the audience
    const A = L.audience.material.uniforms;
    A.uTime.value = t; A.uIdle.value = t > CUE.doorsOpen ? 1 : 0;
    const waveOn = smooth(CUE.wave, CUE.wave + 5.5, t) * (1 - dark);
    L.audienceWashL.intensity = 5 * waveOn + 0.3; L.audienceWashR.intensity = 5 * waveOn + 0.3;
    L.glow.material.uniforms.uAmt.value = lerp(1, 0.18, dark);
    L.shafts.forEach((c, i) => (c.material.uniforms.uIntensity.value = 0.012 * (1 - dark) * (0.6 + 0.4 * Math.sin(t * 0.2 + i))));
    L.ambient.intensity = t < CUE.release ? 0.25 : 0.35;

    // the switch
    L.switchPlate.draw('end', 1.1);
    const keyOn = t >= CUE.doorsOpen + 0.5 && t < CUE.release ? 1 : 0;
    L.switchKey.intensity = 38 * keyOn * (1 - 0.5 * dark);
    L.switchCone.material.uniforms.uIntensity.value = 0.02 * keyOn * (1 - 0.5 * dark);
    const thrown = easeInOut((t - CUE.throwSwitch) / 0.55);
    L.lever.rotation.x = -Math.PI * 0.82 * thrown;
    L.switchLamp.set(t < CUE.throwSwitch + 0.25 ? 1 : 0);
    L.hand.visible = t > CUE.handOn - 0.1 && t < CUE.release;
    L.hand.uniforms.uReveal.value = easeOut((t - CUE.handOn) / 0.9) * (1 - smooth(CUE.groupsOff + 0.5, CUE.groupsOff + 2.6, t));
    L.hand.uniforms.uTime.value = t;
    L.hand.uniforms.uIntensity.value = 0.9;

    // the entity
    if (t < CUE.doorsOpen) {
      const blocked = easeInOut((step12(t) - CUE.block) / 0.35);
      const p = [lerp(-0.46, 0.05, blocked), 0, lerp(-0.28, -1.22, blocked)];
      L.entity.update(t, { pos: p, yaw: blocked > 0.5 ? Math.PI : 0, rim: [0.9, 0.75, 0.55], rimAmt: 0.35 + 0.4 * lure, glow: 1.0 });
    } else if (t < CUE.chamberWide) {
      const aside = easeInOut((step12(t) - CUE.stepAside) / 1.3);
      L.entity.update(t, { pos: [lerp(0, -0.8, aside), 0, lerp(1.7, 2.3, aside)], yaw: lerp(0, -0.5, aside), rim: [0.75, 0.7, 0.95], rimAmt: 0.45, glow: 1.0 });
    } else if (t < CUE.release) {
      const reach = shot === '7A' ? easeInOut((t - CUE.reach) / 2.6) * 0.86 + 0.14 * smooth(CUE.handOn - 0.6, CUE.handOn, t) : 0;
      const vis = 1 - smooth(CUE.groupsOff + 0.5, CUE.groupsOff + 2.8, t);
      L.leverTip.getWorldPosition(v3);
      const knob = v3.toArray();
      L.entity.update(t, { pos: [-0.62, 0, 31.3], yaw: Math.PI / 2, reachL: knob, reachAmtL: reach, vis,
        fadeAt: shot === '7A' ? knob : null, fadeR: 0.55, rim: [0.85, 0.8, 0.7], rimAmt: 0.45, glow: 1.0 });
    } else L.entity.update(t, { visible: false });
    // something no longer there still throws a shadow into the morning
    L.absent.update(t, { visible: t >= CUE.release, pos: [0.3, 0, 45.2], yaw: Math.PI });

    // release: a practical bulb, then the door and morning light
    const bulb = t >= CUE.release + 0.2 ? 1 : 0;
    L.bulb.material.color.setRGB(3 * bulb, 2.8 * bulb, 2.3 * bulb);
    L.bulbLight.intensity = 4.5 * bulb;
    const ex = easeInOut((t - CUE.exitOpen) / 1.8);
    L.exitDoor.rotation.y = 1.35 * ex;
    L.dawnMat.color.setRGB(2.4 * ex, 2.3 * ex, 2.15 * ex);
    L.dawn.intensity = 60 * ex;

    L.dust.material.uniforms.uTime.value = t;
    L.dust.setLight(0, L.switchKey.position.toArray(), [-0.15, -0.9, 0.35], Math.cos(0.42), Math.cos(0.2), 6, 0.05 * keyOn, 0xe7ecd8);
    L.dust.setLight(1, [0, 1.8, L.exitZ + 1.4], [0, -0.1, -1], Math.cos(0.5), Math.cos(0.25), 20, 0.04 * ex, 0xffe2bf);
    L.dust.setLight(2, L.bulb.position.toArray(), [0, -1, 0], 0.2, 0.6, 4, 0.03 * bulb, 0xf2e2c4);
    L.dust.setLight(3, [0, -10, 0], [0, -1, 0], 0.99, 1, 0.1, 0, 0xffffff);
    return { feeds, portals: [] };
  }

  return {
    update(t) {
      const cam = cameraAt(t);
      if (cam.scene === 'station') return { cam, feeds: station(t, cam).map((f) => f), portals: [] };
      if (cam.scene === 'corridor') return { cam, ...corridor(t, cam) };
      if (cam.scene === 'lift') return { cam, ...lift(t, cam) };
      return { cam, feeds: [], portals: [] };
    },
  };
}
