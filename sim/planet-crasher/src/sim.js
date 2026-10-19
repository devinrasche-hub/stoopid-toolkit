// GPU particle physics. Every particle is a lump of planet: it feels the gravity
// of every other particle (direct N-body sum, no tree) and pushes back on the
// ones it touches with a damped spring. The damping is where impact energy turns
// into heat, so the glow you see is energy the collision actually lost.
//
// Units: G = 1, the target planet has mass 1 and radius 1 (see planets.js).
import * as THREE from 'three';

// id: name, density relative to rock, base colour (linear-ish RGB)
export const MATERIALS = [
  { name: 'IRON', rho: 2.4, color: [0.30, 0.22, 0.19] },
  { name: 'MANTLE', rho: 1.0, color: [0.42, 0.17, 0.09] },
  { name: 'LAND', rho: 0.9, color: [0.25, 0.40, 0.16] },
  { name: 'DESERT', rho: 0.9, color: [0.70, 0.30, 0.14] },
  { name: 'WATER', rho: 0.6, color: [0.06, 0.20, 0.55] },
  { name: 'ICE', rho: 0.55, color: [0.86, 0.91, 0.96] },
  { name: 'BASALT', rho: 1.0, color: [0.34, 0.32, 0.30] },
  { name: 'METAL', rho: 2.4, color: [0.52, 0.52, 0.56] },
];
export const RHO = MATERIALS.map((m) => m.rho);

const QUAD_VS = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const VEL_FS = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform int uW;
uniform int uH;
uniform int uCount;
uniform float dt, eps2, diam, omega2, zetaN, zetaT, friction, m0, drag, cool, eVap;
uniform float uRho[8];

float massOf(float w){ return m0 * uRho[int(w + 0.5)]; }

void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int id = ij.y * uW + ij.x;
  vec4 V = texelFetch(tVel, ij, 0);
  if (id >= uCount) { gl_FragColor = V; return; }
  vec4 P = texelFetch(tPos, ij, 0);
  float mi = massOf(P.w);
  float d2 = diam * diam;
  // vapour pressure: SPH form with an ideal gas (gamma 1.4) on the energy above
  // vaporization, at the packing density; kernel is the cubic spline, h = diam
  float rhoI = mi * 1.41421 / (d2 * diam);
  float Pi = 0.4 * max(0.0, V.w - eVap) / rhoI;
  float sig = 1.0 / (3.14159265 * d2 * diam * diam); // sigma / h
  vec3 acc = vec3(0.0);
  float heat = 0.0;
  int j = 0;
  for (int y = 0; y < uH; y++) {
    if (j >= uCount) break;
    for (int x = 0; x < uW; x++) {
      if (j >= uCount) break;
      ivec2 q = ivec2(x, y);
      vec4 Pj = texelFetch(tPos, q, 0);
      vec3 dx = Pj.xyz - P.xyz;
      float r2 = dot(dx, dx);
      float mj = massOf(Pj.w);
      float inv = inversesqrt(r2 + eps2);
      acc += (mj * inv * inv * inv) * dx;
      if (r2 < 4.0 * d2 && j != id) {
        float r = sqrt(r2) + 1e-7;
        vec3 n = dx / r;
        vec4 Vj = texelFetch(tVel, q, 0);
        float Pj_ = 0.4 * max(0.0, Vj.w - eVap) * d2 * diam / (mj * 1.41421);
        if (Pi + Pj_ > 0.0) {
          float qq = r / diam;
          float dW = sig * (qq < 1.0 ? (-3.0 * qq + 2.25 * qq * qq) : -0.75 * (2.0 - qq) * (2.0 - qq));
          float vn = dot(Vj.xyz - V.xyz, n);
          acc += mj * (Pi + Pj_) * dW * n;
          heat += mj * Pi * vn * dW; // expansion cools, compression heats
        }
      }
      if (r2 < d2 && j != id) {
        float r = sqrt(r2) + 1e-7;
        vec3 n = dx / r;
        float ov = diam - r;
        vec3 vr = texelFetch(tVel, q, 0).xyz - V.xyz;
        float vn = dot(vr, n);
        vec3 vt = vr - vn * n;
        float mu = mi * mj / (mi + mj);
        // repulsion only (no glue): spring that stiffens as it is crushed, plus damping
        float fs = omega2 * ov * (1.0 + 3.0 * ov / diam);
        float fn = max(0.0, fs - zetaN * vn);
        // sliding friction, capped Coulomb-style by the normal force
        vec3 ft = zetaT * vt;
        float ftl = length(ft);
        if (ftl > friction * fn) ft *= friction * fn / (ftl + 1e-12);
        acc += mu * (ft - fn * n) / mi;
        // energy the contact removed from the motion becomes heat, split between the pair
        heat += 0.5 * mu * ((fn - fs) * -vn + dot(ft, vt)) / mi;
      }
      j++;
    }
  }
  V.xyz = (V.xyz + acc * dt) * (1.0 - drag);
  V.w = V.w * cool + heat * dt;
  gl_FragColor = V;
}`;

const POS_FS = /* glsl */ `
precision highp float;
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform float dt;
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(tPos, ij, 0);
  P.xyz += texelFetch(tVel, ij, 0).xyz * dt;
  gl_FragColor = P;
}`;

const COPY_FS = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
void main(){ gl_FragColor = texelFetch(tSrc, ivec2(gl_FragCoord.xy), 0); }`;

export class Sim {
  constructor(renderer, W, H) {
    this.renderer = renderer;
    this.W = W; this.H = H; this.cap = W * H;
    this.count = 0;
    const mk = () => new THREE.WebGLRenderTarget(W, H, {
      type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    this.pos = [mk(), mk()];
    this.vel = [mk(), mk()];
    this.i = 0;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const shared = {
      tPos: { value: null }, tVel: { value: null }, dt: { value: 0.002 },
    };
    this.velMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: VEL_FS,
      uniforms: {
        ...shared,
        uW: { value: W }, uH: { value: H }, uCount: { value: 0 },
        eps2: { value: 0 }, diam: { value: 0.1 }, omega2: { value: 1 }, zetaN: { value: 0 }, zetaT: { value: 0 },
        m0: { value: 1 }, friction: { value: 0.6 }, drag: { value: 0 }, eVap: { value: 1e9 }, cool: { value: 1 }, uRho: { value: RHO },
      },
    });
    this.posMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: POS_FS, uniforms: { tPos: { value: null }, tVel: { value: null }, dt: { value: 0.002 } } });
    this.copyMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: COPY_FS, uniforms: { tSrc: { value: null } } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.velMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  get posTex() { return this.pos[this.i].texture; }
  get velTex() { return this.vel[this.i].texture; }

  // contact constants derive from dt, diam and the damping ratios
  // Low damping and little friction: at these energies rock behaves like a fluid,
  // and stickier settings swallow the debris that should end up in orbit.
  configure({ count, dt, diam, m0, zetaN = 0.1, zetaT = 0.02, mu = 0.1 }) {
    this.count = count;
    const u = this.velMat.uniforms;
    const omega = (2 * Math.PI) / (24 * dt); // contact lasts ~24 steps
    u.uCount.value = count;
    u.dt.value = dt; this.posMat.uniforms.dt.value = dt;
    u.diam.value = diam;
    u.eps2.value = (0.5 * diam) ** 2;
    u.omega2.value = omega * omega;
    u.zetaN.value = 2 * zetaN * omega;
    u.zetaT.value = 2 * zetaT * omega;
    u.friction.value = mu;
    u.m0.value = m0;
    this.dt = dt;
  }

  // specific energy (sim units) at which rock is fully vaporized and starts to push
  setVaporization(e) { this.velMat.uniforms.eVap.value = e; }

  setDrag(drag) { this.velMat.uniforms.drag.value = drag; }
  setCooling(tau) { this.velMat.uniforms.cool.value = tau > 0 ? Math.exp(-this.dt / tau) : 1; }

  _pass(mat, target) {
    this.quad.material = mat;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(target);
    r.render(this.scene, this.cam);
    r.setRenderTarget(prev);
  }

  upload(posArr, velArr) {
    const tex = (a) => {
      const t = new THREE.DataTexture(a, this.W, this.H, THREE.RGBAFormat, THREE.FloatType);
      t.needsUpdate = true;
      return t;
    };
    for (const [arr, rts] of [[posArr, this.pos], [velArr, this.vel]]) {
      const t = tex(arr);
      this.copyMat.uniforms.tSrc.value = t;
      this._pass(this.copyMat, rts[this.i]);
      t.dispose();
    }
  }

  step(n = 1) {
    for (let s = 0; s < n; s++) {
      const a = this.i, b = 1 - a;
      const vu = this.velMat.uniforms;
      vu.tPos.value = this.pos[a].texture; vu.tVel.value = this.vel[a].texture;
      this._pass(this.velMat, this.vel[b]);
      const pu = this.posMat.uniforms;
      pu.tPos.value = this.pos[a].texture; pu.tVel.value = this.vel[b].texture;
      this._pass(this.posMat, this.pos[b]);
      this.i = b;
    }
  }

  readSync() {
    const pos = new Float32Array(this.cap * 4), vel = new Float32Array(this.cap * 4);
    this.renderer.readRenderTargetPixels(this.pos[this.i], 0, 0, this.W, this.H, pos);
    this.renderer.readRenderTargetPixels(this.vel[this.i], 0, 0, this.W, this.H, vel);
    return { pos, vel };
  }

  async read() {
    if (!this.renderer.readRenderTargetPixelsAsync) return this.readSync();
    const pos = new Float32Array(this.cap * 4), vel = new Float32Array(this.cap * 4);
    const i = this.i;
    try {
      await Promise.all([
        this.renderer.readRenderTargetPixelsAsync(this.pos[i], 0, 0, this.W, this.H, pos),
        this.renderer.readRenderTargetPixelsAsync(this.vel[i], 0, 0, this.W, this.H, vel),
      ]);
      return { pos, vel };
    } catch {
      return this.readSync();
    }
  }
}
