import * as THREE from 'three';
import { hash, mulberry32, noise1, lerp, clamp } from './util.js';

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
  varying vec3 vWorld;
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
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */`
  uniform float uTime, uGlow, uTear, uRimAmt, uVis, uFadeR;
  uniform vec3 uRim, uFadeP;
  varying vec3 vWorld;
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
    // Dithered visibility: whole-body fade, and a local fade around uFadeP
    // (the arm thins out as the hand nears something it should not touch).
    float local = uFadeR > 0.0 ? smoothstep(0.0, uFadeR, distance(vWorld, uFadeP)) : 1.0;
    float vis = uVis * mix(0.12, 1.0, local);
    if (h(floor(gl_FragCoord.xy) + 0.5) > vis) discard;
    float tq = floor(uTime * 12.0) / 12.0;
    // Torn horizontal bands drop out for a few frames at a time.
    float band = floor(vY * 70.0);
    if (h(vec2(band, floor(tq * 5.0) + vSeed * 13.0)) < uTear) discard;

    vec2 p = vec2(atan(vLocal.z, vLocal.x) / 6.2831 + 0.5, vLocal.y + 0.5);

    float kind = floor(fract(vSeed) * 6.0);
    float shift = h(vec2(vSeed, floor(tq * 2.0))) * 0.4 + (uTime - vY * 0.35) * 0.03;
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
    [-0.255, 0.6, 1.86, 0.042, 0.075, 0.075], // left arm (too long)
    [0.26, 0.58, 1.86, 0.042, 0.075, 0.075],  // right arm
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
  constructor({ layer = 0, scale = 1, shadowOnly = false, strays = true } = {}) {
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
      uVis: { value: 1 },
      uFadeR: { value: 0 },
      uFadeP: { value: new THREE.Vector3() },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag });
    if (shadowOnly) { this.mat.colorWrite = false; this.mat.depthWrite = false; }
    if (!strays) this.slabs = this.slabs.filter((sl) => !sl.stray);
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
  //   reach / reachL: world points the right (+x) / left (−x) arm points toward
  //   reachAmt / reachAmtL: 0 hanging … 1 fully extended toward the point
  //   headYaw: radians, head turned relative to the body
  //   vis: dithered visibility 0…1; fadeAt + fadeR thin the body near a point
  update(t, { pos = [0, 0, 0], yaw = 0, rim = null, rimAmt = 0.25, glow = 1, tear = 0, visible = true, sway = 1,
              reach = null, reachAmt = 0, reachL = null, reachAmtL = 0, headYaw = 0, vis = 1, fadeAt = null, fadeR = 0 } = {}) {
    this.group.visible = visible && vis > 0.002;
    if (!this.group.visible) return;
    this.group.position.set(pos[0], pos[1], pos[2]);
    this.group.rotation.y = yaw;
    this.group.updateMatrixWorld(true);
    const u = this.uniforms;
    u.uTime.value = t;
    u.uGlow.value = glow;
    u.uTear.value = tear;
    u.uRimAmt.value = rimAmt;
    u.uVis.value = vis;
    u.uFadeR.value = fadeAt ? fadeR : 0;
    if (fadeAt) u.uFadeP.value.set(fadeAt[0], fadeAt[1], fadeAt[2]);
    if (rim) u.uRim.value.setRGB(rim[0], rim[1], rim[2]);

    // Arm rotations (shoulder pivots in local space). Rest direction is straight down.
    const armQ = {}, armK = { 1: 1, '-1': 1 };
    const down = new THREE.Vector3(0, -1, 0);
    [[1, reach, reachAmt], [-1, reachL, reachAmtL]].forEach(([side, target, amt]) => {
      const q = new THREE.Quaternion();
      if (target && amt > 0) {
        const piv = new THREE.Vector3(side * 0.26, 1.86, 0);
        const local = this.group.worldToLocal(new THREE.Vector3(target[0], target[1], target[2])).sub(piv);
        const dist = local.length();
        local.normalize();
        q.setFromUnitVectors(down, local);
        q.slerp(new THREE.Quaternion(), 1 - Math.min(1, amt));
        // the arm is 1.28 m long; when it reaches, it ends at the target instead of passing through it
        armK[side] = lerp(1, clamp(dist / 1.28, 0.45, 1), Math.min(1, amt));
      }
      armQ[side] = q;
    });
    const headQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headYaw);
    const tmp = new THREE.Vector3();

    this.slabs.forEach((s, i) => {
      // Each slab lives a few frames in the past, stepped at 12fps: the body is
      // a little out of sync with itself, but it never comes apart.
      const ts = Math.floor((t - s.delay) * 12) / 12;
      const breathe = Math.sin(ts * 0.9) * 0.006 * (s.y > 1.0 ? 1 : 0);
      const lean = (noise1(ts * 0.35, 3) - 0.5) * 0.04 * sway * (s.y / 2.3);
      let x = s.x + lean + (s.stray ? Math.sin(ts * 0.6 + s.seed * 10) * 0.03 : 0);
      let y = s.y + breathe;
      let z = s.z + (s.arm ? Math.sin(ts * 0.5 + s.arm) * 0.01 : 0);
      if (s.arm) x += s.arm * (1.86 - s.y) * 0.03;
      if (s.seed > 0.9) x += (s.seed - 0.95) * 0.08;       // a few pieces sit slightly wrong
      this.q.setFromEuler(this.e.set(0, (s.seed - 0.5) * 0.06, 0));
      if (s.arm) {
        const piv = tmp.set(s.arm * 0.26, 1.86, 0);
        this.v.set(x, y, z).sub(piv);
        this.v.y *= armK[s.arm];
        this.v.applyQuaternion(armQ[s.arm]).add(piv);
        this.q.premultiply(armQ[s.arm]);
      } else if (s.y > 1.95 && !s.stray) {
        this.v.set(x - 0.01, y, z).applyQuaternion(headQ);
        this.v.x += 0.01;
        this.q.premultiply(headQ);
      } else this.v.set(x, y, z);
      this.s.set(s.w, s.h, s.d);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ── The hand ───────────────────────────────────────────────────────────────
// A hand made of faint scanlines. The strip is bent in the vertex shader:
// flat on top of a surface up to uEdge, then curled over the edge.
//   uBend 0 = flat (resting on a switch), 1 = fingers hanging over a bezel
//   uGrip 0…1 = fingers tighten, tips pulling in under the edge
const handVert = /* glsl */`
  uniform float uLen, uEdge, uRad, uBend, uGrip;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    float s = uLen * 0.5 - position.y;
    vec3 p;
    float amax = uBend * 1.5708 + uGrip * 0.5;
    if (s <= uEdge || amax <= 0.0) p = vec3(position.x, 0.0, s);
    else {
      float a = min((s - uEdge) / uRad, amax);
      p = vec3(position.x, -uRad + uRad * cos(a), uEdge + uRad * sin(a));
      float rest = (s - uEdge) - a * uRad;
      if (rest > 0.0) p += rest * vec3(0.0, -sin(amax), cos(amax));
    }
    // knuckles lift slightly as it grips
    p.y += uGrip * 0.004 * smoothstep(uEdge - 0.06, uEdge, s);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
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
  const uniforms = {
    uMask: { value: maskTex }, uReveal: { value: 1 }, uTime: { value: 0 }, uIntensity: { value: 0.75 },
    uLen: { value: length }, uEdge: { value: sEdge }, uRad: { value: radius }, uBend: { value: 1 }, uGrip: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: handVert, fragmentShader: handFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.uniforms = uniforms;
  return mesh;
}
