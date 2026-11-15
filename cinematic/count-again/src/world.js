import * as THREE from 'three';
import { CRT } from './crt.js';
import { makeReflector, makeCone, makeDust, Feed } from './fx.js';
import { mulberry32 } from './util.js';
import { CARD_W, CARD_H } from './card.js';

// ─────────────────────────────────────────────────────────────────────────────
// The station after midnight: the control room (z 0..5), the studio through the
// glass (z < 0) and the hall behind you (through the back door, z > 5).
// The console's front edge is at z 1.3; the operator stands at about z 1.75.
// ─────────────────────────────────────────────────────────────────────────────

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function plane(w, h, mat, parent = null) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const repeat = (tex, x, y) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(x, y); return t; };

// A small printed or taped label as a texture.
function label(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
function tape(text, w = 256, h = 64, size = 30) {
  return label(w, h, (g) => {
    g.fillStyle = '#d9d3bb'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % w, 0, 1, h);
    g.font = `700 ${size}px ${SANS}`; g.fillStyle = '#1b1b18'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

// Swivel chair (01's). Local +z is the direction a sitter would face.
export function makeChair(vinyl, metal) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leg = box(0.32, 0.025, 0.04, metal, 0, 0.06, 0, g);
    leg.geometry.translate(0.16, 0, 0);
    leg.rotation.y = (i / 5) * Math.PI * 2;
    const wheel = cyl(0.025, 0.025, 0.03, metal);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(Math.cos(-leg.rotation.y) * 0.3, 0.025, Math.sin(-leg.rotation.y) * 0.3);
    g.add(wheel);
  }
  const col = cyl(0.025, 0.03, 0.36, metal); col.position.y = 0.25; g.add(col);
  const top = new THREE.Group(); g.add(top);   // the part that swivels
  box(0.5, 0.08, 0.48, vinyl, 0, 0.47, 0, top);
  const back = box(0.46, 0.56, 0.07, vinyl, 0, 0.82, -0.25, top);
  back.rotation.x = -0.12;
  box(0.05, 0.04, 0.32, vinyl, -0.26, 0.66, -0.02, top);
  box(0.05, 0.04, 0.32, vinyl, 0.26, 0.66, -0.02, top);
  box(0.03, 0.17, 0.03, metal, -0.26, 0.56, -0.08, top);
  box(0.03, 0.17, 0.03, metal, 0.26, 0.56, -0.08, top);
  g.userData.top = top;
  return g;
}

export function buildStation(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x0a1010, 0.035);
  const S = { scene };

  const vinyl = std(0x1a1c1d, 0.5);
  const metal = std(0x3a3d3d, 0.4, { metalness: 0.3 });
  const wallMat = std(0x8a918d, 0.9, { map: repeat(T.concrete, 2, 1) });
  const floorCR = std(0x8a908b, 0.55, { map: repeat(T.tile, 4, 3) });
  const ceilMat = std(0x9a9c94, 0.95, { map: repeat(T.ceiling, 6, 4) });
  const black = std(0x050606, 0.9);
  const frameMat = std(0x1a1e1e, 0.6);

  // ── Control room shell ──
  const f = plane(8, 5.2, floorCR, scene); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 2.6);
  const c = plane(8, 5.2, ceilMat, scene); c.rotation.x = Math.PI / 2; c.position.set(0, 2.7, 2.6);
  const lw = plane(5.2, 2.7, wallMat, scene); lw.rotation.y = Math.PI / 2; lw.position.set(-4, 1.35, 2.6);
  const rw = plane(5.2, 2.7, wallMat, scene); rw.rotation.y = -Math.PI / 2; rw.position.set(4, 1.35, 2.6);
  // back wall, with the door to the hall at x = 2.3
  const DX = 2.3, BZ = 5.2;
  const bwL = plane(DX - 0.5 + 4, 2.7, wallMat, scene); bwL.rotation.y = Math.PI; bwL.position.set((-4 + DX - 0.5) / 2, 1.35, BZ);
  const bwR = plane(4 - DX - 0.5, 2.7, wallMat, scene); bwR.rotation.y = Math.PI; bwR.position.set((DX + 0.5 + 4) / 2, 1.35, BZ);
  const bwT = plane(1.0, 0.6, wallMat, scene); bwT.rotation.y = Math.PI; bwT.position.set(DX, 2.4, BZ);
  box(0.06, 2.12, 0.12, frameMat, DX - 0.5, 1.06, BZ, scene);
  box(0.06, 2.12, 0.12, frameMat, DX + 0.5, 1.06, BZ, scene);
  box(1.06, 0.06, 0.12, frameMat, DX, 2.12, BZ, scene);
  S.exit = box(0.26, 0.11, 0.05, glow(3.0, 0.7, 0.15), DX, 2.33, BZ - 0.04, scene);
  { const l = new THREE.PointLight(0xff6a20, 0.8, 3, 2); l.position.set(DX, 2.2, BZ - 0.3); scene.add(l); }

  // ── The hall (only ever on monitor 1, and as a dark doorway) ──
  {
    const hm = std(0x7f8783, 0.9, { map: repeat(T.block, 4, 1) });
    const hf = plane(1.4, 7, std(0x6c726d, 0.6, { map: repeat(T.tile, 1, 5) }), scene); hf.rotation.x = -Math.PI / 2; hf.position.set(DX, 0.001, BZ + 3.5);
    const hc = plane(1.4, 7, ceilMat, scene); hc.rotation.x = Math.PI / 2; hc.position.set(DX, 2.4, BZ + 3.5);
    // the left wall has the break-room doorway in it (z BZ+4.3 … BZ+5.2)
    const h1a = plane(4.3, 2.4, hm, scene); h1a.rotation.y = Math.PI / 2; h1a.position.set(DX - 0.7, 1.2, BZ + 2.15);
    const h1b = plane(1.8, 2.4, hm, scene); h1b.rotation.y = Math.PI / 2; h1b.position.set(DX - 0.7, 1.2, BZ + 6.1);
    const h1c = plane(0.9, 0.35, hm, scene); h1c.rotation.y = Math.PI / 2; h1c.position.set(DX - 0.7, 2.225, BZ + 4.75);
    box(0.08, 2.06, 0.05, frameMat, DX - 0.7, 1.03, BZ + 4.3, scene); box(0.08, 2.06, 0.05, frameMat, DX - 0.7, 1.03, BZ + 5.2, scene);
    const h2 = plane(7, 2.4, hm, scene); h2.rotation.y = -Math.PI / 2; h2.position.set(DX + 0.7, 1.2, BZ + 3.5);
    const end = plane(1.4, 2.4, hm, scene); end.rotation.y = Math.PI; end.position.set(DX, 1.2, BZ + 7);
    // the break-room door, hinged at the far jamb, swung in: ajar
    S.breakDoor = new THREE.Group(); S.breakDoor.position.set(DX - 0.72, 0, BZ + 5.18); scene.add(S.breakDoor);
    box(0.045, 2.02, 0.86, std(0x3b4240, 0.7), -0.02, 1.01, -0.43, S.breakDoor);
    S.breakDoor.rotation.y = 1.2;
    S.breakGlow = plane(0.01, 0.01, glow(0, 0, 0), scene); S.breakGlow.visible = false;
    // the break room: small, a counter, a microwave facing the door
    const RX0 = DX - 0.7 - 2.3, RX1 = DX - 0.7, RZ0 = BZ + 3.7, RZ1 = BZ + 6.0, rm = std(0x9a9a88, 0.9, { map: repeat(T.block, 2, 1) });
    const bf = plane(RX1 - RX0, RZ1 - RZ0, std(0x7a7466, 0.6, { map: repeat(T.tile, 2, 2) }), scene); bf.rotation.x = -Math.PI / 2; bf.position.set((RX0 + RX1) / 2, 0.001, (RZ0 + RZ1) / 2);
    const bc = plane(RX1 - RX0, RZ1 - RZ0, ceilMat, scene); bc.rotation.x = Math.PI / 2; bc.position.set((RX0 + RX1) / 2, 2.4, (RZ0 + RZ1) / 2);
    const bw1 = plane(RZ1 - RZ0, 2.4, rm, scene); bw1.rotation.y = Math.PI / 2; bw1.position.set(RX0, 1.2, (RZ0 + RZ1) / 2);
    const bw2 = plane(RX1 - RX0, 2.4, rm, scene); bw2.position.set((RX0 + RX1) / 2, 1.2, RZ0);
    const bw3 = plane(RX1 - RX0, 2.4, rm, scene); bw3.rotation.y = Math.PI; bw3.position.set((RX0 + RX1) / 2, 1.2, RZ1);
    box(0.6, 0.9, 1.9, std(0x6e6a5c, 0.6), RX0 + 0.3, 0.45, BZ + 4.85, scene);
    box(0.62, 0.04, 1.92, std(0xb8b4a2, 0.5), RX0 + 0.31, 0.92, BZ + 4.85, scene);
    S.micro = new THREE.Group(); S.micro.position.set(RX0 + 0.32, 0.94, BZ + 4.75); S.micro.rotation.y = Math.PI / 2; scene.add(S.micro);
    box(0.5, 0.29, 0.36, std(0xd8d6cc, 0.5), 0, 0.145, 0, S.micro);
    S.microWin = plane(0.3, 0.19, glow(0.6, 0.45, 0.2), S.micro); S.microWin.position.set(-0.06, 0.15, 0.181);
    S.microCanvas = document.createElement('canvas'); S.microCanvas.width = 128; S.microCanvas.height = 48;
    S.microTex = new THREE.CanvasTexture(S.microCanvas); S.microTex.colorSpace = THREE.SRGBColorSpace;
    S.microDisp = plane(0.1, 0.036, new THREE.MeshBasicMaterial({ map: S.microTex, color: new THREE.Color(2, 2, 2), fog: false }), S.micro); S.microDisp.position.set(0.17, 0.22, 0.181);
    S.microLight = new THREE.PointLight(0xffc070, 1.2, 1.6, 2); S.microLight.position.set(RX0 + 0.75, 1.15, BZ + 4.75); scene.add(S.microLight);
    S.breakLight = new THREE.PointLight(0xe8e0c0, 2.2, 4, 2); S.breakLight.position.set((RX0 + RX1) / 2, 2.2, BZ + 4.85); scene.add(S.breakLight);
    const fix = box(0.2, 0.03, 1.0, glow(1.6, 1.8, 1.6), DX, 2.385, BZ + 3.2, scene); fix.castShadow = false;
    S.hallLight = new THREE.PointLight(0xcfe0d0, 4, 5, 2); S.hallLight.position.set(DX, 2.2, BZ + 3.2); scene.add(S.hallLight);
  }

  // ── Partition: sill, header, glass, and the clock over it ──
  box(8, 0.95, 0.16, wallMat, 0, 0.475, -0.08, scene);
  box(8, 0.35, 0.16, wallMat, 0, 2.525, -0.08, scene);
  box(7.2, 0.05, 0.12, frameMat, 0, 0.95, 0.0, scene);
  box(7.2, 0.05, 0.12, frameMat, 0, 2.35, 0.0, scene);
  S.glass = makeReflector(7.2, 1.4, { strength: 0.22, blur: 0.0015, axis: 1, fresnel: 0.6, res: q.reflect });
  S.glass.position.set(0, 1.65, 0.01);
  scene.add(S.glass);
  { const dirt = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.4), new THREE.MeshBasicMaterial({ color: 0x9fb8b2, transparent: true, opacity: 0.02, depthWrite: false }));
    dirt.position.set(0, 1.65, 0.005); scene.add(dirt); }
  {
    box(0.6, 0.2, 0.06, std(0x0c0d0d, 0.5), 0, 2.53, 0.03, scene);
    S.clockCanvas = document.createElement('canvas'); S.clockCanvas.width = 512; S.clockCanvas.height = 160;
    S.clockTex = new THREE.CanvasTexture(S.clockCanvas); S.clockTex.colorSpace = THREE.SRGBColorSpace;
    S.clockMat = new THREE.MeshBasicMaterial({ map: S.clockTex, color: new THREE.Color(2.2, 2.2, 2.2), fog: false });
    S.clock = plane(0.54, 0.17, S.clockMat, scene); S.clock.position.set(0, 2.53, 0.062);
    S.clockLight = new THREE.PointLight(0xff3020, 0.5, 1.4, 2); S.clockLight.position.set(0, 2.45, 0.35); scene.add(S.clockLight);
  }

  // ── Console desk ──
  const deskMat = std(0x262a2a, 0.6, { map: T.metal });
  box(5.2, 0.06, 1.0, deskMat, 0, 0.75, 0.8, scene);
  box(5.2, 0.72, 0.05, black, 0, 0.36, 1.28, scene);
  const slope = box(1.5, 0.05, 0.5, deskMat, -1.65, 0.86, 0.55, scene);
  slope.rotation.x = 0.32;
  {
    // faders and knobs on the slope, off to the left
    const n = 15 * 3;
    const fader = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.022, 0.035), std(0x0d0f0f, 0.4), n);
    const knob = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.01, 0.02, 10), std(0x0b0c0c, 0.35), n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0));
    const rnd = mulberry32(3);
    let k = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 15; i++) {
      const x = -2.3 + i * 0.093;
      const zz = 0.4 + row * 0.15 + (row === 2 ? rnd() * 0.04 : 0);
      const y = 0.88 + (0.55 - zz) * Math.tan(0.32) + 0.015;
      m4.compose(new THREE.Vector3(x, y, zz), qq, new THREE.Vector3(1, 1, 1)); fader.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x, y + 0.005, zz - 0.06), qq, new THREE.Vector3(1, 1, 1)); knob.setMatrixAt(k, m4);
      k++;
    }
    scene.add(fader, knob);
    const ledGeo = new THREE.BoxGeometry(0.008, 0.004, 0.008);
    for (let i = 0; i < 14; i++) {
      const lit = rnd() < 0.35;
      const col = lit ? (rnd() < 0.8 ? new THREE.Color(0.05, 0.9, 0.5) : new THREE.Color(2.0, 0.5, 0.05)) : new THREE.Color(0.02, 0.03, 0.03);
      const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: col }));
      led.position.set(-2.3 + i * 0.1, 0.99, 0.31);
      scene.add(led);
    }
  }
  // clutter: a logbook, a mug, loose paper
  {
    const paper = std(0xb8b8a8, 0.9);
    [[-1.3, 1.08, 0.25], [1.6, 1.1, -0.35]].forEach(([x, z, r]) => {
      const p = plane(0.21, 0.297, paper, scene); p.rotation.set(-Math.PI / 2, 0, r); p.position.set(x, 0.782, z);
    });
    const log = box(0.24, 0.025, 0.32, std(0x2a3a52, 0.7), -1.32, 0.792, 1.0, scene); log.rotation.y = -0.2;
    const mug = cyl(0.042, 0.038, 0.1, std(0x5f5c54, 0.6), 18); mug.position.set(0.62, 0.83, 1.12); scene.add(mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), std(0x5f5c54, 0.6)); handle.rotation.z = -Math.PI / 2; handle.position.set(0.665, 0.835, 1.12); scene.add(handle);
    S.coffee = new THREE.Mesh(new THREE.CircleGeometry(0.036, 18), std(0x1a0f08, 0.15)); S.coffee.rotation.x = -Math.PI / 2; S.coffee.position.set(0.62, 0.872, 1.12); scene.add(S.coffee);
    S.mugTop = new THREE.Vector3(0.62, 0.875, 1.12);
    // steam: a few soft sprites that rise, curl and fade (the director moves them)
    {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      S.steam = [];
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xfff2dc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.scale.setScalar(0.04); scene.add(sp); S.steam.push(sp);
      }
    }
  }

  // ── The card ──
  {
    const cw = 0.24, ch = cw * CARD_H / CARD_W;
    S.cardCanvas = document.createElement('canvas'); S.cardCanvas.width = CARD_W; S.cardCanvas.height = CARD_H;
    S.cardTex = new THREE.CanvasTexture(S.cardCanvas); S.cardTex.colorSpace = THREE.SRGBColorSpace; S.cardTex.anisotropy = 8;
    S.card = new THREE.Group();
    S.card.position.set(0.0, 0.7815, 1.04);
    S.card.rotation.y = 0.05;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshPhysicalMaterial({
      map: S.cardTex, roughness: 0.62, clearcoat: 0.3, clearcoatRoughness: 0.45,
    }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
    S.card.add(m);
    scene.add(S.card);
    S.cardSize = [cw, ch];
    S.cardMesh = m;
  }
  // canvas px on the card → world position
  S.cardPoint = (px, py, lift = 0.002) => {
    S.card.updateMatrixWorld();
    const [cw, ch] = S.cardSize;
    return new THREE.Vector3((px / CARD_W - 0.5) * cw, lift, (py / CARD_H - 0.5) * ch).applyMatrix4(S.card.matrixWorld);
  };

  // ── Desk lamp: a gooseneck over the card ──
  {
    const lm = std(0x1d2422, 0.5);
    const base = cyl(0.07, 0.08, 0.025, lm, 20); base.position.set(0.3, 0.792, 0.7); scene.add(base);
    const pts = [new THREE.Vector3(0.3, 0.8, 0.7), new THREE.Vector3(0.3, 1.02, 0.7), new THREE.Vector3(0.24, 1.17, 0.78), new THREE.Vector3(0.12, 1.2, 0.88)];
    const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.008, 8), lm); neck.castShadow = true; scene.add(neck);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.075, 0.1, 20, 1, true), std(0x23302c, 0.5, { side: THREE.DoubleSide }));
    shade.position.set(0.1, 1.17, 0.9); shade.rotation.set(0.25, 0, -0.35); scene.add(shade);
    S.lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), glow(0, 0, 0));
    S.lampBulb.position.set(0.085, 1.14, 0.91); scene.add(S.lampBulb);
    S.lamp = new THREE.SpotLight(0xffe6c0, 0, 2.2, 0.75, 0.55, 2);
    S.lamp.position.set(0.085, 1.14, 0.91);
    S.lamp.target.position.copy(S.card.position);
    S.lamp.castShadow = true; S.lamp.shadow.mapSize.set(q.shadow, q.shadow); S.lamp.shadow.bias = -0.0004; S.lamp.shadow.camera.near = 0.05;
    scene.add(S.lamp, S.lamp.target);
    S.lampCone = makeCone(0.24, 0.42, 0xffe2b8, 0.0);
    S.lampCone.position.copy(S.lamp.position);
    S.lampCone.lookAt(S.card.position); S.lampCone.rotateX(-Math.PI / 2);
    S.lampCone.layers.set(2);
    scene.add(S.lampCone);
  }

  // ── Talkback panel, right of the card ──
  {
    const pm = std(0x2c3130, 0.55);
    const panel = box(0.15, 0.05, 0.11, pm, 0.36, 0.805, 0.9, scene); panel.rotation.y = -0.12;
    const plate = plane(0.1, 0.025, new THREE.MeshStandardMaterial({ map: tape('TALKBACK', 256, 64, 34), roughness: 0.7 }), scene);
    plate.rotation.set(-Math.PI / 2, 0, -0.12); plate.position.set(0.365, 0.8312, 0.935);
    const bezel = cyl(0.016, 0.018, 0.012, std(0x101111, 0.4), 18); bezel.position.set(0.35, 0.836, 0.875); scene.add(bezel);
    S.talkLamp = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow(0.12, 0.02, 0.01));
    S.talkLamp.position.set(0.35, 0.842, 0.875); scene.add(S.talkLamp);
    S.talkLight = new THREE.PointLight(0xff2a14, 0, 0.9, 2); S.talkLight.position.set(0.35, 0.9, 0.9); scene.add(S.talkLight);
    // its microphone on a short gooseneck
    const mpts = [new THREE.Vector3(0.41, 0.83, 0.86), new THREE.Vector3(0.42, 0.95, 0.84), new THREE.Vector3(0.39, 1.03, 0.89)];
    const mic = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpts), 20, 0.005, 6), std(0x0c0d0d, 0.4)); scene.add(mic);
    const head = cyl(0.012, 0.01, 0.05, std(0x0c0d0d, 0.4)); head.position.set(0.382, 1.045, 0.9); head.rotation.set(0.6, 0, 0.3); scene.add(head);
  }

  // ── The request-line phone, left of the card ──
  {
    const beige = std(0x8a826c, 0.6);
    S.phone = new THREE.Group(); S.phone.position.set(-0.37, 0.78, 1.1); S.phone.rotation.y = 0.22; scene.add(S.phone);
    const body = box(0.2, 0.06, 0.17, beige, 0, 0.03, 0, S.phone); body.rotation.x = 0.08;
    const cradle = box(0.2, 0.025, 0.05, beige, 0, 0.07, -0.05, S.phone);
    const handset = box(0.22, 0.035, 0.05, beige, 0, 0.095, -0.05, S.phone);
    [-0.1, 0.1].forEach((x) => box(0.05, 0.03, 0.06, beige, x, 0.085, -0.05, S.phone));
    // buttons and the one line light
    for (let i = 0; i < 9; i++) box(0.022, 0.008, 0.018, std(0xd8d2c0, 0.5), -0.05 + (i % 3) * 0.032, 0.062, 0.02 + Math.floor(i / 3) * 0.026, S.phone).rotation.x = 0.08;
    S.lineLed = box(0.016, 0.008, 0.012, glow(0.05, 0.03, 0.01), 0.072, 0.064, 0.03, S.phone);
    S.lineLight = new THREE.PointLight(0xffb040, 0, 0.5, 2); S.lineLight.position.set(0.07, 0.1, 0.04); S.phone.add(S.lineLight);
    const lab = plane(0.12, 0.024, new THREE.MeshStandardMaterial({ map: tape('REQUEST LINE', 384, 72, 38), roughness: 0.7 }), S.phone);
    lab.rotation.set(-0.35, 0, 0.0); lab.position.set(0.0, 0.03, 0.0865);
    S.handset = handset; S.cradle = cradle;
  }

  // ── The trackball, in front of the main CRT ──
  {
    S.trackball = new THREE.Group(); S.trackball.position.set(-0.7, 0.78, 1.12); S.trackball.rotation.y = 0.2; scene.add(S.trackball);
    box(0.13, 0.034, 0.15, std(0x2a2d2c, 0.5), 0, 0.017, 0, S.trackball);
    box(0.13, 0.012, 0.035, std(0x1b1d1c, 0.5), 0, 0.03, 0.065, S.trackball);
    S.ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), std(0x6a2a18, 0.25));
    S.ball.position.set(0, 0.04, -0.012); S.ball.castShadow = true; S.trackball.add(S.ball);
  }

  // ── Main CRT: the test pattern ──
  S.crt = new CRT({ width: 0.46, height: 0.345, depth: 0.44, canvasW: 640, canvasH: 480, lines: 262, lightIntensity: 2.4, seed: 1, lightOffset: 0.8 });
  S.crt.group.position.set(-0.74, 0.78 + 0.345 / 2 + 0.095, 0.62);
  S.crt.group.rotation.y = 0.2;
  scene.add(S.crt.group);

  // ── Three monitors, right ──
  S.monitors = [];
  [[0.82, 0.58, -0.18], [1.18, 0.6, -0.28], [1.53, 0.64, -0.38]].forEach(([x, z, ry], i) => {
    const m = new CRT({ width: 0.27, height: 0.2, depth: 0.28, canvasW: 400, canvasH: 300, lines: 200, lightIntensity: 1.2, seed: 2 + i, lightColor: 0x8fd0c8, lightOffset: 0.9, bezel: 0x141616 });
    m.group.position.set(x, 0.78 + 0.2 / 2 + 0.095, z);
    m.group.rotation.y = ry;
    scene.add(m.group);
    const t = plane(0.034, 0.022, new THREE.MeshStandardMaterial({ map: tape(String(i + 1), 64, 42, 30), roughness: 0.7 }), m.group);
    t.position.set(0, -0.1 - 0.024, 0.031);
    S.monitors.push(m);
  });

  // ── The fourth monitor (copy 3 only): a window, not a set ──
  {
    const m = new CRT({ width: 0.27, height: 0.2, depth: 0.28, canvasW: 400, canvasH: 300, lines: 200, lightIntensity: 1.2, seed: 9, lightColor: 0x8fd0c8, lightOffset: 0.9, bezel: 0x141616 });
    m.group.position.set(1.87, 0.78 + 0.2 / 2 + 0.095, 0.74);
    m.group.rotation.y = -0.5;
    m.group.visible = false;
    scene.add(m.group);
    S.fourth = m;
  }

  // ── The new operator (only ever seen through the fourth monitor) ──
  {
    const hood = std(0xa8521e, 0.95, { map: T.fabric });
    S.newOp = new THREE.Group(); S.newOp.position.set(0.0, 0, 1.62); scene.add(S.newOp);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 8, 16), hood); torso.scale.set(1, 1, 0.62); torso.position.set(0, 1.15, 0.04); S.newOp.add(torso);
    S.newOpHead = new THREE.Group(); S.newOpHead.position.set(0, 1.62, 0.0); S.newOp.add(S.newOpHead);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), hood); hd.scale.set(1, 1.12, 1.05); S.newOpHead.add(hd);
    // where a face would be: only the dark inside of the hood
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), new THREE.MeshBasicMaterial({ color: 0x000000 })); hole.scale.set(1, 1.2, 1); hole.position.set(0, -0.01, -0.138); hole.rotation.y = Math.PI; S.newOpHead.add(hole);
    // arms down to the card, hands flat on it
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x7e5a46, roughness: 0.7, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.95, 0.6, 0.5) });
    S.newOpHands = [];
    [-1, 1].forEach((sd) => {
      const arm = cyl(0.045, 0.05, 0.62, hood, 12); arm.position.set(sd * 0.16, 1.05, -0.16); arm.rotation.x = -0.85; S.newOp.add(arm);
      const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), skin); hnd.scale.set(0.9, 0.38, 1.3); S.newOp.add(hnd);
      S.newOpHands.push(hnd);
    });
    S.newOp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.newOp.visible = false;
    // the lamp's spill on the hood, from the desk side (on only for the window)
    S.newOpKey = new THREE.PointLight(0xffc89a, 0, 2.0, 2); S.newOpKey.position.set(0.5, 1.5, 0.95); scene.add(S.newOpKey);
  }

  // ── The operator's chair: pushed back and askew (01's) ──
  S.opChair = makeChair(vinyl, metal);
  S.opChair.position.set(0.42, 0, 2.3);
  S.opChair.userData.top.rotation.y = Math.PI + 0.55;
  scene.add(S.opChair);

  // a rack, a filing cabinet, cables
  {
    const rack = new THREE.Group(); rack.position.set(-3.6, 0, 3.0); scene.add(rack);
    box(0.6, 1.9, 0.62, std(0x101212, 0.5), 0, 0.95, 0, rack);
    for (let i = 0; i < 9; i++) box(0.02, 0.12, 0.52, std(0x1c1f1f, 0.5), 0.31, 0.3 + i * 0.17, 0, rack);
    for (let i = 0; i < 6; i++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), glow(i % 3 ? 0.05 : 1.6, i % 3 ? 0.6 : 0.3, 0.1));
      led.position.set(0.33, 0.36 + i * 0.27, -0.2 + (i % 2) * 0.1); rack.add(led);
    }
    const cab = box(0.5, 1.0, 0.45, std(0x4a504d, 0.6, { metalness: 0.2 }), -0.6, 0.5, 4.9, scene); cab.castShadow = false;
    const rnd = mulberry32(19);
    const cmat = std(0x070808, 0.35);
    for (let i = 0; i < 7; i++) {
      const x0 = -2.2 + rnd() * 4.4;
      const pts = [new THREE.Vector3(x0, 0.75, 1.2), new THREE.Vector3(x0 + (rnd() - 0.5) * 0.3, 0.3, 1.35)];
      let x = x0, z = 1.5;
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 1.3; z += 0.25 + rnd() * 0.6; pts.push(new THREE.Vector3(x, 0.012, z)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.006 + rnd() * 0.006, 6), cmat);
      tube.receiveShadow = true; scene.add(tube);
    }
  }

  // ── Room light: one tired strip over the back wall, a dim fill ──
  S.strip = box(0.9, 0.04, 0.06, glow(2.0, 2.2, 1.9), 0.4, 2.62, 4.9, scene);
  S.stripLight = new THREE.PointLight(0xd6e3cf, 5, 6, 2); S.stripLight.position.set(0.4, 2.45, 4.7); scene.add(S.stripLight);
  S.ambient = new THREE.HemisphereLight(0x1d2a2b, 0x050505, 0.8); scene.add(S.ambient);
  S.wash = new THREE.PointLight(0x5f8f8a, 2.5, 5, 2); S.wash.position.set(-2.2, 2.2, 2.8); scene.add(S.wash);

  // ── Studio, through the glass ──
  {
    const sfMat = std(0x8d918d, 0.45, { map: repeat(T.concrete, 5, 5) });
    const sf = plane(9, 8, sfMat, scene); sf.rotation.x = -Math.PI / 2; sf.position.set(0, 0, -4);
    const sw = std(0x3a3f40, 0.95, { map: T.fabric });
    const back = plane(9, 4, sw, scene); back.position.set(0, 2, -8);
    const l = plane(8, 4, sw, scene); l.rotation.y = Math.PI / 2; l.position.set(-4.5, 2, -4);
    const r = plane(8, 4, sw, scene); r.rotation.y = -Math.PI / 2; r.position.set(4.5, 2, -4);
    const cc = plane(9, 8, black, scene); cc.rotation.x = Math.PI / 2; cc.position.set(0, 4, -4);
    S.studioFloorRefl = makeReflector(9, 8, { strength: 0.25, blur: 0.006, puddle: 0.35, res: q.reflect >> 1 });
    S.studioFloorRefl.rotation.x = -Math.PI / 2; S.studioFloorRefl.position.set(0, 0.003, -4);
    scene.add(S.studioFloorRefl);
    // the chair on its mark, and the tape X under it
    S.studioChair = makeChair(vinyl, metal);
    S.studioChair.position.set(0.55, 0, -3.4);
    scene.add(S.studioChair);
    const xm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.48, 0.4) });
    [0.7, -0.7].forEach((r2) => { const s2 = plane(0.5, 0.04, xm, scene); s2.rotation.set(-Math.PI / 2, 0, r2); s2.position.set(0.55, 0.004, -3.4); });
    // one light on it
    S.studioSpot = new THREE.SpotLight(0xdfe6dc, 60, 7, 0.36, 0.5, 2);
    S.studioSpot.position.set(0.55, 3.8, -2.6); S.studioSpot.target.position.set(0.55, 0.4, -3.4);
    S.studioSpot.castShadow = true; S.studioSpot.shadow.mapSize.set(q.shadow, q.shadow); S.studioSpot.shadow.bias = -0.0005;
    scene.add(S.studioSpot, S.studioSpot.target);
    const shaft = makeCone(0.95, 3.6, 0xc6d8d2, 0.035); shaft.position.copy(S.studioSpot.position);
    shaft.lookAt(S.studioSpot.target.position); shaft.rotateX(-Math.PI / 2); scene.add(shaft);
    const can = cyl(0.1, 0.14, 0.24, std(0x0c0d0d, 0.5)); can.position.copy(S.studioSpot.position); can.position.y += 0.05; scene.add(can);
    // two dead cameras on pedestals in the dark
    [[-2.0, -1.8, 0.5], [2.6, -2.2, -0.6]].forEach(([x, z, r2]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r2; scene.add(g);
      box(0.22, 0.24, 0.5, std(0x151717, 0.5), 0, 1.45, 0, g);
      const ped = cyl(0.06, 0.25, 1.3, std(0x151717, 0.5)); ped.position.y = 0.65; g.add(ped);
    });
  }

  // ── Feeds ──
  // Rule 1: the room from behind you. The chair in it is empty.
  S.backFeed = new Feed(q.feed, Math.round(q.feed * 0.75), 52);
  S.backFeed.camera.position.set(0.7, 2.05, 3.55);
  S.backFeed.camera.lookAt(-0.25, 0.95, 0.85);
  // Monitor 3: the studio
  S.studioFeed = new Feed(q.feed, Math.round(q.feed * 0.75), 40);
  S.studioFeed.camera.position.set(-1.7, 2.0, -1.3);
  S.studioFeed.camera.lookAt(0.55, 0.65, -3.4);
  // Monitor 1: the hall
  S.hallFeed = new Feed(q.feed >> 1, Math.round(q.feed * 0.375), 60);
  S.hallFeed.camera.position.set(DX + 0.5, 2.25, BZ + 0.4);
  S.hallFeed.camera.lookAt(DX - 0.2, 0.9, BZ + 6.6);
  [S.backFeed, S.studioFeed, S.hallFeed].forEach((fd) => fd.camera.updateMatrixWorld());
  // the chair faces the studio camera at this yaw
  S.facingYaw = Math.atan2(S.studioFeed.camera.position.x - 0.55, S.studioFeed.camera.position.z + 3.4);

  // ── The last operator's hand and the marker ──
  {
    S.pen = new THREE.Group();
    const body = cyl(0.0085, 0.0085, 0.125, std(0x0e0e0e, 0.35), 16); body.position.y = 0.0625 + 0.012; S.pen.add(body);
    const tip = cyl(0.0085, 0.003, 0.014, std(0x0a0a0a, 0.6), 12); tip.position.y = 0.007; S.pen.add(tip);
    const band = cyl(0.0088, 0.0088, 0.012, std(0x8c3a12, 0.5), 16); band.position.y = 0.11; S.pen.add(band);
    // the hand curls over the pen, a little above the tip; the sleeve goes off to the right.
    // Built in the pen's frame; the director moves it with the pen, then away without it.
    S.handRig = new THREE.Group();
    // a loose fist around the barrel: palm, a row of knuckles, the thumb on the near side
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x7e5a46, roughness: 0.7, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.95, 0.6, 0.5) });
    const blob = (r, sx, sy, sz, x, y, z, rz = 0) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), skin);
      m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.z = rz; S.handRig.add(m); return m;
    };
    S.hand = blob(0.03, 1.15, 1.5, 1.0, 0.026, 0.085, 0.004, 0.25);           // palm and back of the hand
    for (let k = 0; k < 4; k++) blob(0.0115, 1.2, 1.0, 1.0, 0.012 - k * 0.002, 0.052 + k * 0.019, 0.022, 0.3); // curled fingers, in front of the barrel
    blob(0.011, 1.0, 2.2, 1.0, -0.004, 0.066, -0.016, -0.5);                // thumb, behind the barrel
    blob(0.021, 1.0, 1.4, 1.0, 0.046, 0.128, 0.0, 0.6);                     // wrist
    const sleeve = cyl(0.04, 0.046, 0.5, std(0x15181b, 0.9, { map: T.fabric }), 14);
    sleeve.geometry.translate(0, 0.25, 0);
    sleeve.position.set(0.05, 0.135, 0.0); sleeve.rotation.set(0, 0, -1.0);
    S.handRig.add(sleeve);
    S.handRig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.handRig.visible = false;
    scene.add(S.handRig);
    S.pen.visible = false;
    scene.add(S.pen);
    // the same hand, flat on a trackball: palm over the ball, fingers toward the set,
    // sleeve coming back toward you. Origin = the top of the ball.
    S.palmRig = new THREE.Group();
    const pb = (r, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), skin); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; S.palmRig.add(m); return m; };
    pb(0.045, 1.0, 0.42, 1.2, 0, 0.012, 0.01);
    for (let k = 0; k < 4; k++) pb(0.016, 0.55, 0.5, 1.15, -0.027 + k * 0.018, 0.004 - Math.abs(k - 1.5) * 0.002, -0.05 - (k === 1 || k === 2 ? 0.006 : 0));
    pb(0.015, 0.6, 0.5, 1.3, -0.05, 0.0, 0.0).rotation.y = 0.5;
    const cuff = cyl(0.038, 0.044, 0.5, std(0x15181b, 0.9, { map: T.fabric }), 14);
    cuff.geometry.translate(0, 0.25, 0);
    cuff.position.set(0.004, 0.018, 0.06); cuff.rotation.set(1.35, 0, 0);
    cuff.castShadow = true; S.palmRig.add(cuff);
    S.palmRig.visible = false;
    scene.add(S.palmRig);
  }

  // Dust in the lamp's light
  S.dust = makeDust(q.dust, [-0.6, 0.78, 0.5], [0.8, 1.4, 1.7], 23);
  S.dust.material.uniforms.uSize.value = 3.2;
  S.dust.layers.set(2);
  scene.add(S.dust);

  scene.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return S;
}
