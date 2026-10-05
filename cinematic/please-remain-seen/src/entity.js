import * as THREE from 'three';
import { hash, mulberry32, noise1 } from './util.js';

// The entity: a tall, almost-human silhouette assembled from horizontal slabs,
// each carrying a fragment of broadcast imagery. Every slab samples the pose at
// a slightly different, quantized moment, so the body lags behind the room by
// a few frames and never quite lines up with itself.

const vert = /* glsl */`
  attribute float aSeed;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  varying float vY;
  void main(){
    vec4 lp = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      lp = instanceMatrix * lp;
      n = transpose(inverse(mat3(instanceMatrix))) * n;
    #endif
    vec4 wp = modelMatrix * lp;
    vLocal = position;
    vN = normalize(mat3(modelMatrix) * n);
    vV = normalize(cameraPosition - wp.xyz);
    vSeed = aSeed;
    vY = lp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */`
  uniform float uTime, uGlow, uTear, uRimAmt;
  uniform vec3 uRim;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  varying float vY;

  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 bars(float x){
    float i = floor(fract(x) * 7.0);
    if (i < 1.0) return vec3(0.75);
    if (i < 2.0) return vec3(0.75, 0.75, 0.1);
    if (i < 3.0) return vec3(0.1, 0.72, 0.72);
    if (i < 4.0) return vec3(0.1, 0.7, 0.15);
    if (i < 5.0) return vec3(0.62, 0.12, 0.7);
    if (i < 6.0) return vec3(0.72, 0.1, 0.1);
    return vec3(0.1, 0.12, 0.72);
  }

  void main(){
    float tq = floor(uTime * 12.0) / 12.0;
    // Torn horizontal bands drop out for a few frames at a time.
    float band = floor(vY * 70.0);
    if (h(vec2(band, floor(tq * 5.0) + vSeed * 13.0)) < uTear) discard;

    vec2 p = vec2(atan(vLocal.z, vLocal.x) / 6.2831 + 0.5, vLocal.y + 0.5);

    float kind = floor(fract(vSeed) * 6.0);
    float shift = h(vec2(vSeed, floor(tq * 2.0))) * 0.4;
    vec3 img = vec3(0.0);
    if (kind < 1.0) img = bars(p.x * 0.9 + shift);
    else if (kind < 2.0) img = vec3(h(vec2(floor(p.y * 30.0), floor(tq * 12.0) + vSeed)) * 0.8);
    else if (kind < 3.0) img = vec3(0.55, 0.85, 0.8) * smoothstep(0.4, 0.5, fract(p.y * 3.0 + tq * 0.6));
    else if (kind < 4.0) img = vec3(0.7, 0.6, 0.9) * h(floor(p * vec2(12.0, 9.0)) + floor(tq * 8.0));
    else img = vec3(0.0);

    // Scanlines through every fragment.
    img *= 0.55 + 0.45 * sin(vY * 900.0);

    vec3 n = normalize(vN);
    float side = 1.0 - abs(n.y);
    float fres = pow(1.0 - abs(dot(n, normalize(vV))), 7.0) * side;
    float stray = step(1.0, vSeed);
    float seed = fract(vSeed);
    float shows = max(step(0.74, fract(seed * 7.31)), stray);   // only some pieces carry a picture
    vec3 col = vec3(0.0018, 0.002, 0.0024)
             + img * 0.045 * uGlow * shows
             + uRim * fres * uRimAmt * (1.0 - stray);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildParts() {
  // [centerX, y0, y1, width0, width1, depth]
  const parts = [
    [0.02, 2.03, 2.27, 0.15, 0.165, 0.19],    // head, bowed slightly
    [0.01, 1.93, 2.03, 0.09, 0.1, 0.11],      // neck
    [0.0, 1.66, 1.93, 0.38, 0.44, 0.22],      // shoulders
    [0.0, 1.32, 1.66, 0.3, 0.37, 0.2],        // chest
    [0.0, 1.06, 1.32, 0.27, 0.29, 0.17],      // waist
    [0.0, 0.92, 1.06, 0.31, 0.29, 0.19],      // hips
    [-0.085, 0.0, 0.92, 0.075, 0.125, 0.12],  // left leg
    [0.085, 0.0, 0.92, 0.075, 0.125, 0.12],   // right leg
    [-0.255, 0.6, 1.86, 0.05, 0.095, 0.09],   // left arm (too long)
    [0.26, 0.58, 1.86, 0.05, 0.095, 0.09],    // right arm
  ];
  const slabs = [];
  const rnd = mulberry32(777);
  parts.forEach(([cx, y0, y1, w0, w1, d], pi) => {
    const n = Math.max(2, Math.round((y1 - y0) / 0.11));
    for (let i = 0; i < n; i++) {
      const a = y0 + (y1 - y0) * (i / n);
      const b = y0 + (y1 - y0) * ((i + 1) / n);
      const u = (i + 0.5) / n;
      let w = w0 + (w1 - w0) * u;
      if (pi === 0) w *= Math.sin(Math.PI * (0.25 + 0.75 * u)) * 1.1; // rounded head
      slabs.push({
        x: cx + (rnd() - 0.5) * 0.022,
        y: (a + b) / 2,
        h: (b - a) * (rnd() < 0.08 ? 0.72 : 1.08),
        w: w * (0.92 + rnd() * 0.16),
        d: d * (0.85 + rnd() * 0.3),
        z: (rnd() - 0.5) * 0.02,
        seed: rnd(),
        delay: rnd() * 0.12 + (2.3 - (a + b) / 2) * 0.03,
        arm: pi >= 7 ? (pi === 7 ? -1 : 1) : 0,
      });
    }
  });
  // A few stray fragments that belong to the image, not the body.
  for (let i = 0; i < 4; i++) {
    slabs.push({
      x: (rnd() - 0.5) * 0.6, y: 0.7 + rnd() * 1.4, h: 0.015 + rnd() * 0.03,
      w: 0.08 + rnd() * 0.16, d: 0.03, z: -0.06 - rnd() * 0.1, seed: 1 + rnd(),
      delay: 0.2 + rnd() * 0.2, arm: 0, stray: true,
    });
  }
  return slabs;
}

export class Entity {
  constructor({ layer = 0, scale = 1 } = {}) {
    this.slabs = buildParts();
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1);
    const seeds = new Float32Array(this.slabs.length);
    this.slabs.forEach((s, i) => (seeds[i] = s.seed));
    this.slabs.forEach((s) => (s.seed = s.seed % 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uGlow: { value: 1 },
      uTear: { value: 0.03 },
      uRim: { value: new THREE.Color(0.55, 0.5, 0.9) },
      uRimAmt: { value: 0.25 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.slabs.length);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.scale.setScalar(scale);
    this.setLayer(layer);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
  }

  setLayer(layer) {
    this.group.traverse((o) => o.layers.set(layer));
  }

  // pos: [x,y,z], yaw: radians (0 = facing +z). The body faces its local +z.
  update(t, { pos = [0, 0, 0], yaw = 0, rim = null, rimAmt = 0.25, glow = 1, tear = 0.03, visible = true, sway = 1 } = {}) {
    this.group.visible = visible;
    if (!visible) return;
    this.group.position.set(pos[0], pos[1], pos[2]);
    this.group.rotation.y = yaw;
    const u = this.uniforms;
    u.uTime.value = t;
    u.uGlow.value = glow;
    u.uTear.value = tear;
    u.uRimAmt.value = rimAmt;
    if (rim) u.uRim.value.setRGB(rim[0], rim[1], rim[2]);

    // Glitch windows: deterministic per ~1.3s slot, short, not strobing.
    const slot = Math.floor(t / 1.3);
    const gOn = hash(slot * 3.1 + 5) > 0.72;
    const gPhase = (t / 1.3) - slot;
    const gActive = gOn && gPhase > 0.35 && gPhase < 0.35 + 0.12 + hash(slot) * 0.15;
    const gY = 0.6 + hash(slot * 7.7) * 1.6;
    const gAmp = (hash(slot * 1.9) - 0.5) * 0.12;

    this.slabs.forEach((s, i) => {
      // Each slab lives a few frames in the past, stepped at 12fps.
      const ts = Math.floor((t - s.delay) * 12) / 12;
      const breathe = Math.sin(ts * 0.9) * 0.006 * (s.y > 1.0 ? 1 : 0);
      const lean = (noise1(ts * 0.35, 3) - 0.5) * 0.05 * sway * (s.y / 2.3);
      let x = s.x + lean + (s.stray ? Math.sin(ts * 0.6 + s.seed * 10) * 0.03 : 0);
      let y = s.y + breathe;
      const z = s.z + (s.arm ? Math.sin(ts * 0.5 + s.arm) * 0.015 : 0);
      if (s.arm) x += s.arm * (1.86 - s.y) * 0.035;      // arms drift outward toward the hands
      if (gActive && Math.abs(s.y - gY) < 0.22) x += gAmp * (0.6 + s.seed);
      // Permanent misregistration: a few slabs simply sit wrong.
      if (s.seed > 0.86) x += (s.seed - 0.93) * 0.18;
      this.v.set(x, y, z);
      this.e.set(0, (s.seed - 0.5) * 0.08, 0);
      this.q.setFromEuler(this.e);
      this.s.set(s.w, s.h, s.d);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ── The hand ───────────────────────────────────────────────────────────────
// A hand made of faint scanlines, resting on top of a CRT with its fingers
// curling over the front edge. Built as a strip bent around the bezel edge.
const handVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const handFrag = /* glsl */`
  uniform sampler2D uMask;
  uniform float uReveal, uTime, uIntensity;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float lines = 210.0;
    float li = floor((1.0 - vUv.y) * lines);
    float jitter = (h(vec2(li, floor(uTime * 12.0))) - 0.5) * 0.012;
    float m = texture2D(uMask, vec2(vUv.x + jitter, vUv.y)).r;
    float f = fract((1.0 - vUv.y) * lines);
    float line = smoothstep(0.0, 0.2, f) * smoothstep(0.55, 0.3, f);
    float on = step(h(vec2(li, 3.7)) * 0.85 + 0.1, uReveal);
    float breath = 0.75 + 0.25 * sin(uTime * 1.3 + li * 0.21);
    vec3 col = vec3(0.62, 0.92, 0.88) * m * line * on * breath * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeHand(maskTex, { width = 0.12, length = 0.31, sEdge = 0.17, radius = 0.014 } = {}) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const s = (length / 2 - p.getY(i)); // 0 at wrist (top of canvas)
    let y, z;
    if (s <= sEdge) { y = 0; z = s; }
    else {
      const a = Math.min((s - sEdge) / radius, Math.PI / 2);
      const arc = a * radius;
      y = -(radius - Math.cos(a) * radius);
      z = sEdge + Math.sin(a) * radius;
      const rest = (s - sEdge) - arc;
      if (rest > 0) y -= rest;
    }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const uniforms = { uMask: { value: maskTex }, uReveal: { value: 0 }, uTime: { value: 0 }, uIntensity: { value: 0.75 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: handVert, fragmentShader: handFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  mesh.uniforms = uniforms;
  return mesh;
}
