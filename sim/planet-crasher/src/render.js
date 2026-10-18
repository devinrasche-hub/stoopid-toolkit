// Drawing: every particle is a lit sphere impostor that writes true depth, so
// the planets read as solid rock. Heat from the simulation drives a blackbody
// glow bright enough to bloom.
import * as THREE from 'three';
import { MATERIALS } from './sim.js';

// Heat in J/kg -> kelvin for rock: warm up, melt, warm the melt, vaporize, then heat a vapour that is busy expanding and dissociating.
// Latent heats are why a giant impact tops out at thousands of kelvin, not millions.
export const KELVIN_GLSL = /* glsl */ `
float kelvin(float e){
  if (e < 1.51e6) return 290.0 + e / 1000.0;
  e -= 1.51e6;
  if (e < 4.0e5) return 1800.0;
  e -= 4.0e5;
  if (e < 2.04e6) return 1800.0 + e / 1200.0;
  e -= 2.04e6;
  if (e < 1.2e7) return 3500.0;
  e -= 1.2e7;
  return 3500.0 + e / 8000.0;
}`;
export function kelvin(e) {
  if (e < 1.51e6) return 290 + e / 1000;
  e -= 1.51e6;
  if (e < 4e5) return 1800;
  e -= 4e5;
  if (e < 2.04e6) return 1800 + e / 1200;
  e -= 2.04e6;
  if (e < 1.2e7) return 3500;
  return 3500 + (e - 1.2e7) / 8000;
}

const PARTICLE_VS = /* glsl */ `
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform float uRad;
uniform float uScale;
uniform vec3 uColors[8];
uniform float uEUnit;
attribute vec2 ref;
attribute float seed;
varying vec3 vColor;
varying vec3 vView;
varying float vK;
${KELVIN_GLSL}
void main(){
  vec4 P = texture2D(tPos, ref);
  vec4 V = texture2D(tVel, ref);
  int m = int(P.w + 0.5);
  vec3 c = uColors[m];
  vColor = c * (0.82 + 0.36 * seed);
  vK = kelvin(V.w * uEUnit);
  vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uRad * uScale / -mv.z);
  if (P.x > 1e5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const PARTICLE_FS = /* glsl */ `
uniform mat4 projectionMatrix;
uniform vec3 uSun;
uniform float uRad;
varying vec3 vColor;
varying vec3 vView;
varying float vK;

// Tanner Helland's blackbody fit, kelvin -> rgb
vec3 blackbody(float k){
  float t = k / 100.0;
  vec3 c;
  c.r = t <= 66.0 ? 1.0 : clamp(1.2929 * pow(t - 60.0, -0.1332), 0.0, 1.0);
  c.g = t <= 66.0 ? clamp(0.3901 * log(t) - 0.6318, 0.0, 1.0) : clamp(1.1298 * pow(t - 60.0, -0.0755), 0.0, 1.0);
  c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432 * log(t - 10.0) - 1.1962, 0.0, 1.0));
  return c * c;
}

void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  vec3 n = vec3(c, sqrt(1.0 - r2));
  vec3 p = vView + n * uRad;
  vec4 clip = projectionMatrix * vec4(p, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  float diff = max(dot(n, uSun), 0.0);
  float rim = pow(1.0 - n.z, 3.0) * 0.08;
  vec3 col = vColor * (0.035 + 1.0 * diff) + rim * vColor;
  // glow: dull red from ~900 K, white hot past ~4000 K
  // incandescence: dull red ~1000 K, orange melt, yellow at vaporization, white past ~6000 K
  float hot = smoothstep(800.0, 2000.0, vK);
  float glowI = 0.45 * hot + 0.55 * smoothstep(2000.0, 4000.0, vK) + 0.6 * smoothstep(5000.0, 20000.0, vK);
  vec3 glow = pow(blackbody(clamp(vK, 900.0, 9000.0)), vec3(2.0)) * glowI;
  col = col * (1.0 - 0.9 * hot) + glow * (0.6 + 0.4 * n.z);
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeParticles(W, H) {
  const cap = W * H;
  const geo = new THREE.BufferGeometry();
  const ref = new Float32Array(cap * 2), seed = new Float32Array(cap);
  for (let i = 0; i < cap; i++) {
    ref[i * 2] = ((i % W) + 0.5) / W;
    ref[i * 2 + 1] = (Math.floor(i / W) + 0.5) / H;
    seed[i] = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS,
    uniforms: {
      tPos: { value: null }, tVel: { value: null },
      uRad: { value: 0.05 }, uScale: { value: 500 }, uEUnit: { value: 6.26e7 },
      uSun: { value: new THREE.Vector3(1, 0, 0) },
      uColors: { value: MATERIALS.map((m) => new THREE.Color(...m.color)) },
    },
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export function makeStars() {
  const n = 5000;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(a) * 900, u * 900, s * Math.sin(a) * 900], i * 3);
    const b = Math.pow(Math.random(), 4) * 0.9 + 0.08;
    const tint = Math.random();
    col.set(tint < 0.15 ? [b * 0.8, b * 0.9, b * 1.2] : tint < 0.25 ? [b * 1.2, b * 0.95, b * 0.7] : [b, b, b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

// faint nebula on a big inverted sphere, in the show's teal/purple
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        float band = exp(-pow(dot(vD, normalize(vec3(0.3,1.0,-0.2))) * 2.6, 2.0));
        float f = fbm(vD * 3.0) * band;
        vec3 c = mix(vec3(0.20,0.05,0.35), vec3(0.0,0.45,0.40), fbm(vD*5.0+4.0));
        gl_FragColor = vec4(c * pow(f, 2.2) * 0.22, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), mat);
}

export function makeSun(dir) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,250,1)');
  gr.addColorStop(0.12, 'rgba(255,240,210,0.9)');
  gr.addColorStop(0.35, 'rgba(255,190,120,0.18)');
  gr.addColorStop(1, 'rgba(255,160,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.2, 2.0, 1.8) }));
  s.position.copy(dir).multiplyScalar(800);
  s.scale.setScalar(110);
  return s;
}

// Fresnel atmosphere shell around the intact target.
export function makeAtmosphere() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(0.35, 0.6, 1) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uAlpha: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz);
        vW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uSun; uniform float uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
        float lit = smoothstep(-0.35, 0.5, dot(vW, uSun));
        gl_FragColor = vec4(uColor * f * lit * 1.4 * uAlpha, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
}

export function makeAimLine() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 400), 3));
  const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xff7a2a, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.85 }));
  line.frustumCulled = false;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.085, 40), new THREE.MeshBasicMaterial({ color: 0xff2d2d, side: THREE.DoubleSide, transparent: true, depthTest: false }));
  const grp = new THREE.Group();
  grp.add(line, ring);
  grp.userData = { line, ring };
  return grp;
}
