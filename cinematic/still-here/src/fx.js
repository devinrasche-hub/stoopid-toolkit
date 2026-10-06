import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mulberry32 } from './util.js';

// ── Reflections ────────────────────────────────────────────────────────────
// Additive planar reflections: the surface underneath stays a normal lit
// material and the reflection is layered on top, broken up by a damp/puddle
// mask (floors) or smudges (glass). One shared guard stops reflectors from
// rendering inside each other's passes.

export const reflectGuard = { busy: false, disabled: false };

const reflVert = /* glsl */`
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  void main(){
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vView = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const reflFrag = /* glsl */`
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform float uStrength, uBlur, uPuddle, uAxis, uFresnel;
  varying vec4 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p){ return vn(p) * 0.5 + vn(p * 2.1) * 0.3 + vn(p * 4.3) * 0.2; }
  void main(){
    vec2 q = uAxis < 0.5 ? vWorld.xz : vWorld.xy;
    float n = fbm(q * 1.1);
    float wet = mix(1.0, smoothstep(0.42, 0.62, n), uPuddle);
    vec2 uv = vUv.xy / vUv.w;
    vec2 d = (vec2(fbm(q * 9.0), fbm(q * 9.0 + 5.2)) - 0.5) * 0.012 * (1.0 - wet * 0.8);
    uv += d;
    float r = uBlur * (1.0 - wet * 0.75);
    vec3 c = texture2D(tDiffuse, uv).rgb * 0.36;
    c += texture2D(tDiffuse, uv + vec2(r, 0.0)).rgb * 0.16;
    c += texture2D(tDiffuse, uv - vec2(r, 0.0)).rgb * 0.16;
    c += texture2D(tDiffuse, uv + vec2(0.0, r * 1.8)).rgb * 0.16;
    c += texture2D(tDiffuse, uv - vec2(0.0, r * 1.8)).rgb * 0.16;
    vec3 N = uAxis < 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    float f = mix(1.0, pow(1.0 - abs(dot(normalize(vView), N)), 2.0) * 0.85 + 0.15, uFresnel);
    float smudge = uAxis > 0.5 ? (0.7 + 0.6 * fbm(q * 3.0)) : 1.0;
    gl_FragColor = vec4(c * color * uStrength * mix(0.18, 1.0, wet) * f * smudge, 1.0);
  }
`;

export function makeReflector(w, h, { strength = 0.5, blur = 0.004, puddle = 0, axis = 0, fresnel = 1, res = 512, tint = 0xffffff } = {}) {
  const shader = {
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uStrength: { value: strength }, uBlur: { value: blur }, uPuddle: { value: puddle },
      uAxis: { value: axis }, uFresnel: { value: fresnel },
    },
    vertexShader: reflVert, fragmentShader: reflFrag,
  };
  const r = new Reflector(new THREE.PlaneGeometry(w, h), {
    shader, textureWidth: res, textureHeight: Math.round(res * 0.5625), multisample: 0, color: tint, clipBias: 0.003,
  });
  r.material.transparent = true;
  r.material.blending = THREE.AdditiveBlending;
  r.material.depthWrite = false;
  const orig = r.onBeforeRender;
  r.onBeforeRender = function (renderer, scene, camera) {
    if (reflectGuard.busy || reflectGuard.disabled) return;
    reflectGuard.busy = true;
    // Optional hooks let a reflection show a different state of the room
    // than the room itself (the mirror "remembers" an earlier layout).
    if (r.userData.pre) r.userData.pre();
    orig.call(this, renderer, scene, camera);
    if (r.userData.post) r.userData.post();
    reflectGuard.busy = false;
  };
  r.renderOrder = 2;
  return r;
}

// ── Light shafts ───────────────────────────────────────────────────────────
const coneVert = /* glsl */`
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vV;
  void main(){
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const coneFrag = /* glsl */`
  uniform vec3 uColor;
  uniform float uIntensity, uLength;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vV;
  void main(){
    float d = clamp(-vPos.y / uLength, 0.0, 1.0);
    float fall = pow(1.0 - d, 1.6) * smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.82, 1.0, d));
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
    gl_FragColor = vec4(uColor * uIntensity * fall * edge, 1.0);
  }
`;

// A soft additive shaft hanging down from `apex` along -Y of its group.
export function makeCone(radius, length, color, intensity = 0.05) {
  const geo = new THREE.ConeGeometry(radius, length, 40, 1, true);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uLength: { value: length } },
    vertexShader: coneVert, fragmentShader: coneFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}

// ── Dust ───────────────────────────────────────────────────────────────────
// Motes only show where a light volume catches them.
const MAXL = 4;
const dustVert = /* glsl */`
  attribute float aSeed;
  uniform float uTime, uSize;
  uniform vec3 uLA[${MAXL}];
  uniform vec3 uLD[${MAXL}];
  uniform vec4 uLP[${MAXL}]; // cosOuter, cosInner, range, intensity
  uniform vec3 uLC[${MAXL}];
  varying vec3 vCol;
  void main(){
    vec3 p = position;
    float s = aSeed * 6.2831;
    p += vec3(sin(uTime * 0.11 + s) * 0.18, sin(uTime * 0.07 + s * 1.7) * 0.12 - mod(uTime * 0.012 + aSeed, 1.0) * 0.25, cos(uTime * 0.09 + s * 1.3) * 0.18);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vec3 col = vec3(0.0);
    for (int i = 0; i < ${MAXL}; i++){
      vec3 L = wp.xyz - uLA[i];
      float dist = length(L);
      float c = dot(L / max(dist, 1e-4), uLD[i]);
      float cone = smoothstep(uLP[i].x, uLP[i].y, c);
      float fall = 1.0 - smoothstep(0.0, uLP[i].z, dist);
      col += uLC[i] * cone * fall * uLP[i].w;
    }
    vCol = col * (0.5 + 0.5 * sin(uTime * 0.8 + s * 3.0));
    vec4 mv = viewMatrix * wp;
    gl_PointSize = uSize * (0.6 + aSeed) / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;
const dustFrag = /* glsl */`
  varying vec3 vCol;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    gl_FragColor = vec4(vCol * a, 1.0);
  }
`;

export function makeDust(count, min, max, seed = 5) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = min[0] + rnd() * (max[0] - min[0]);
    pos[i * 3 + 1] = min[1] + rnd() * (max[1] - min[1]);
    pos[i * 3 + 2] = min[2] + rnd() * (max[2] - min[2]);
    seeds[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = {
    uTime: { value: 0 }, uSize: { value: 6 },
    uLA: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) },
    uLD: { value: Array.from({ length: MAXL }, () => new THREE.Vector3(0, -1, 0)) },
    uLP: { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0.8, 0.9, 5, 0)) },
    uLC: { value: Array.from({ length: MAXL }, () => new THREE.Color(1, 1, 1)) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: dustVert, fragmentShader: dustFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  pts.setLight = (i, apex, dir, cosOuter, cosInner, range, intensity, color) => {
    uniforms.uLA.value[i].set(...apex);
    uniforms.uLD.value[i].set(...dir).normalize();
    uniforms.uLP.value[i].set(cosOuter, cosInner, range, intensity);
    if (color) uniforms.uLC.value[i].set(color);
  };
  return pts;
}

// ── Live video feeds ───────────────────────────────────────────────────────
// Double-buffered so a monitor can appear inside its own feed without
// reading and writing the same texture.
export class Feed {
  constructor(w, h, fov = 50) {
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.a = new THREE.WebGLRenderTarget(w, h, opts);
    this.b = new THREE.WebGLRenderTarget(w, h, opts);
    this.camera = new THREE.PerspectiveCamera(fov, w / h, 0.05, 80);
    this.camera.layers.enable(1);
  }
  get texture() { return this.a.texture; }
  render(renderer, scene) {
    reflectGuard.disabled = true;
    renderer.setRenderTarget(this.b);
    renderer.clear();
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(null);
    reflectGuard.disabled = false;
    const t = this.a; this.a = this.b; this.b = t;
  }
  setSize(w, h) { this.a.setSize(w, h); this.b.setSize(w, h); }
}

// ── Portal ─────────────────────────────────────────────────────────────────
// A doorway in one scene that shows another scene at the correct scale and
// perspective. The other scene is rendered from a camera carrying the same
// pose relative to `toAnchor` as the viewer has relative to `fromAnchor`;
// the doorway samples that image in screen space. A clip plane removes
// anything in the far scene that would sit between that camera and the
// virtual doorway. The portal mesh is never part of the scene it shows, so
// there is no recursion.
const portalVert = /* glsl */`
  void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const portalFrag = /* glsl */`
  uniform sampler2D tView;
  uniform vec2 uRes;
  uniform float uMix;
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    gl_FragColor = vec4(texture2D(tView, uv).rgb * uMix, 1.0);
  }
`;
export class Portal {
  constructor(w, h, width, height) {
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 80);
    this.uniforms = { tView: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(w * 2, h * 2) }, uMix: { value: 1 } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: portalVert, fragmentShader: portalFrag }));
    this.fromAnchor = new THREE.Object3D();   // pose of the doorway in the near scene
    this.toAnchor = new THREE.Object3D();     // matching pose in the far scene
    this.clip = new THREE.Plane();
    this._m = new THREE.Matrix4();
  }
  // rt: render-target size; vw, vh: size of the frame the doorway is drawn into
  setSize(w, h, vw = w * 2, vh = h * 2) { this.rt.setSize(w, h); this.uniforms.uRes.value.set(vw, vh); }
  render(renderer, farScene, viewer) {
    this.fromAnchor.updateMatrixWorld(); this.toAnchor.updateMatrixWorld();
    // far = to * inverse(from) * viewer
    this._m.copy(this.fromAnchor.matrixWorld).invert().premultiply(this.toAnchor.matrixWorld).multiply(viewer.matrixWorld);
    this.camera.matrixAutoUpdate = false;
    this.camera.matrix.copy(this._m);           // render() copies matrix → matrixWorld
    this.camera.matrixWorld.copy(this._m);
    this.camera.matrixWorldInverse.copy(this._m).invert();
    this.camera.projectionMatrix.copy(viewer.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(viewer.projectionMatrixInverse);
    // keep only what lies beyond the doorway (anchor −z is "into" the far room)
    const n = new THREE.Vector3(0, 0, -1).transformDirection(this.toAnchor.matrixWorld);
    this.clip.setFromNormalAndCoplanarPoint(n, new THREE.Vector3().setFromMatrixPosition(this.toAnchor.matrixWorld));
    const prevClip = renderer.clippingPlanes;
    renderer.clippingPlanes = [this.clip];
    // Reflections inside the far scene render from this camera too, so the
    // view through the doorway never shows a reflection left over from earlier.
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(farScene, this.camera);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = prevClip;
  }
}

// ── Feed atlas ──────────────────────────────────────────────────────────────
// Several small camera views packed into one double-buffered texture, so a
// wall of monitors can show different angles with a single sampler.
export class FeedAtlas {
  constructor(cols, rows, tileW, tileH) {
    this.cols = cols; this.rows = rows; this.tw = tileW; this.th = tileH;
    const o = { type: THREE.HalfFloatType };
    this.a = new THREE.WebGLRenderTarget(cols * tileW, rows * tileH, o);
    this.b = new THREE.WebGLRenderTarget(cols * tileW, rows * tileH, o);
    this.cameras = [];
    for (let i = 0; i < cols * rows; i++) {
      const c = new THREE.PerspectiveCamera(60, tileW / tileH, 0.03, 40);
      c.layers.enable(1);
      this.cameras.push(c);
    }
  }
  get texture() { return this.a.texture; }
  render(renderer, scene) {
    reflectGuard.disabled = true;
    renderer.setRenderTarget(this.b);
    renderer.setScissorTest(true);
    this.cameras.forEach((c, i) => {
      const x = (i % this.cols) * this.tw, y = Math.floor(i / this.cols) * this.th;
      this.b.viewport.set(x, y, this.tw, this.th);
      this.b.scissor.set(x, y, this.tw, this.th);
      renderer.setRenderTarget(this.b);
      renderer.clear();
      renderer.render(scene, c);
    });
    this.b.viewport.set(0, 0, this.cols * this.tw, this.rows * this.th);
    this.b.scissor.set(0, 0, this.cols * this.tw, this.rows * this.th);
    renderer.setScissorTest(false);
    renderer.setRenderTarget(null);
    reflectGuard.disabled = false;
    const t = this.a; this.a = this.b; this.b = t;
  }
}
