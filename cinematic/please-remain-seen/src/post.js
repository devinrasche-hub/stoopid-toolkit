import * as THREE from 'three';

// Image treatment. Kept deliberately small:
//   scene (HDR + depth) → half-res bokeh DOF → bloom chain → one final pass
//   (DOF composite, restrained bloom + red halation, tone map, grade,
//    vignette, grain, analog line instability, card layer with paper tear).

const quadVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DEPTH = /* glsl */`
  uniform float uNear, uFar;
  float linDepth(float d){
    float z = d * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  }
`;

const dofFrag = /* glsl */`
  uniform sampler2D tColor, tDepth;
  uniform vec2 uPx;          // 1 / half-res size
  uniform float uFocus, uBlur, uResY;
  varying vec2 vUv;
  ${DEPTH}
  float cocPx(float z){ return min(uBlur * abs(1.0 - uFocus / z), uBlur * 1.6) * uResY; }
  void main(){
    const float GA = 2.39996323;
    const float MAXR = 11.0;
    const float RS = 0.85;
    float cz = linDepth(texture2D(tDepth, vUv).r);
    float cs = cocPx(cz);
    vec3 col = texture2D(tColor, vUv).rgb;
    float tot = 1.0;
    float r = RS;
    for (float a = 0.0; a < 140.0; a += 1.0){
      if (r >= MAXR) break;
      float ang = a * GA;
      vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uPx * r;
      vec3 sc = texture2D(tColor, tc).rgb;
      float sz = linDepth(texture2D(tDepth, tc).r);
      float ss = cocPx(sz);
      if (sz > cz) ss = clamp(ss, 0.0, cs * 2.0);
      float m = smoothstep(r - 0.5, r + 0.5, ss);
      col += mix(col / tot, sc, m);
      tot += 1.0;
      r += RS / r;
    }
    gl_FragColor = vec4(col / tot, 1.0);
  }
`;

const brightFrag = /* glsl */`
  uniform sampler2D tColor;
  uniform float uThreshold;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tColor, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold * 2.5, l);
    gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0);
  }
`;

const blurFrag = /* glsl */`
  uniform sampler2D tColor;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tColor, vUv).rgb * 0.2270270;
    c += texture2D(tColor, vUv + uDir * 1.3846154).rgb * 0.3162162;
    c += texture2D(tColor, vUv - uDir * 1.3846154).rgb * 0.3162162;
    c += texture2D(tColor, vUv + uDir * 3.2307692).rgb * 0.0702703;
    c += texture2D(tColor, vUv - uDir * 3.2307692).rgb * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const finalFrag = /* glsl */`
  uniform sampler2D tColor, tDepth, tDof, tB1, tB2, tCard;
  uniform float uExposure, uBloom, uHal, uGrain, uVig, uInstab, uTime, uFrame, uCA;
  uniform float uFocus, uBlur, uCardMix, uTear, uCardGrain, uScene;
  uniform vec2 uRes;
  varying vec2 vUv;
  ${DEPTH}
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vn(float x){ float i = floor(x), f = fract(x); return mix(h(vec2(i, 1.7)), h(vec2(i + 1.0, 1.7)), f * f * (3.0 - 2.0 * f)); }

  vec3 aces(vec3 x){
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c){
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  // Jagged vertical tear line in card space.
  float tearX(float y){
    return 0.5 + 0.035 * sin(y * 9.0 + 1.3) + 0.018 * sin(y * 31.0) + 0.014 * (vn(y * 70.0) - 0.5) + 0.003 * (vn(y * 210.0) - 0.5);
  }
  vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

  // Returns rgba of the card (a = coverage) with the tear applied.
  vec4 card(vec2 uv){
    if (uCardMix <= 0.0) return vec4(0.0);
    float open = smoothstep(0.0, 0.36, uTear);      // the rip runs top → bottom
    float fly = smoothstep(0.36, 1.0, uTear);       // then the halves pull apart
    float aspect = uRes.x / uRes.y;
    vec4 outc = vec4(0.0);
    for (int side = 0; side < 2; side++){
      float s = side == 0 ? -1.0 : 1.0;
      vec2 off = vec2(s * fly * fly * 0.95, (side == 0 ? -0.07 : 0.11) * fly * fly);
      float ang = s * fly * 0.14;
      vec2 p = uv - 0.5;
      p.x *= aspect;
      p = rot(p - vec2(off.x * aspect, off.y), -ang);
      p.x /= aspect;
      p += 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) continue;
      float tx = tearX(p.y);
      float ripped = step(1.0 - open * 1.02, p.y);
      float gap = ripped * (0.0018 + 0.004 * open);
      bool inside = side == 0 ? (p.x < tx - gap) : (p.x > tx + gap);
      if (!inside) continue;
      vec3 c = pow(texture2D(tCard, p).rgb, vec3(2.2));
      float e = abs(p.x - tx) - gap;
      float fiber = ripped * (1.0 - smoothstep(0.0, 0.004 + 0.005 * vn(p.y * 300.0 + s * 7.0), e));
      c = mix(c, vec3(0.95, 0.95, 0.9), fiber * 0.9);
      c *= 1.0 - fly * 0.3 * (side == 0 ? (1.0 - p.x) : p.x);
      outc = vec4(c, 1.0);
    }
    return outc;
  }

  void main(){
    vec2 uv = vUv;
    // Analog instability: faint line jitter and a slow hold wobble.
    float line = floor(uv.y * 540.0);
    uv.x += (h(vec2(line, uFrame)) - 0.5) * 0.0011 * uInstab;
    uv.x += sin(uv.y * 6.0 + uTime * 1.1) * 0.0007 * uInstab;
    uv.y += sin(uTime * 0.7) * 0.0006 * uInstab;

    vec3 col = vec3(0.0);
    if (uScene > 0.5) {
      vec2 dc = uv - 0.5;
      col.r = texture2D(tColor, uv + dc * uCA).r;
      col.g = texture2D(tColor, uv).g;
      col.b = texture2D(tColor, uv - dc * uCA).b;
      float z = linDepth(texture2D(tDepth, uv).r);
      float px = min(uBlur * abs(1.0 - uFocus / z), uBlur * 1.6) * uRes.y;
      vec3 d = texture2D(tDof, uv).rgb;
      col = mix(col, d, smoothstep(0.8, 3.0, px));
      vec3 b1 = texture2D(tB1, uv).rgb;
      vec3 b2 = texture2D(tB2, uv).rgb;
      col += (b1 * 0.55 + b2 * 0.45) * uBloom;
      col += b2 * vec3(1.0, 0.3, 0.12) * uHal;
      col *= uExposure;
      col = aces(col);
      // Grade: cool the shadows toward dirty teal, keep highlights off-white.
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 0.86);
      float sh = 1.0 - smoothstep(0.0, 0.3, l);
      col *= mix(vec3(1.0), vec3(0.86, 1.04, 1.08), sh);
      col += vec3(0.0004, 0.0009, 0.001) * smoothstep(0.0, 0.004, l);
      col = max(col, 0.0);
      float vig = smoothstep(1.0, 0.2, length(dc * vec2(1.05, 1.0)) * 1.25);
      col *= mix(1.0, vig, uVig);
    }

    vec4 cd = card(vUv);
    col = mix(col, cd.rgb, cd.a * uCardMix);

    // Grain in display space: strongest in the midtones, almost none in black.
    vec3 disp = toSRGB(clamp(col, 0.0, 1.0));
    float g = h(vUv * uRes + vec2(uFrame * 13.17, uFrame * 7.31)) - 0.5;
    float l2 = dot(disp, vec3(0.333));
    float grain = mix(uGrain, uCardGrain, cd.a * uCardMix);
    disp += g * grain * smoothstep(0.015, 0.12, l2) * (1.0 - 0.6 * smoothstep(0.6, 1.0, l2));
    gl_FragColor = vec4(clamp(disp, 0.0, 1.0), 1.0);
  }
`;

export class Post {
  constructor(renderer, w, h, samples = 0) {
    this.renderer = renderer;
    this.samples = samples;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);

    const common = { uNear: { value: 0.05 }, uFar: { value: 80 } };
    this.dofMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: dofFrag,
      uniforms: { tColor: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2() }, uFocus: { value: 3 }, uBlur: { value: 0 }, uResY: { value: 540 }, ...common } });
    this.brightMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: brightFrag,
      uniforms: { tColor: { value: null }, uThreshold: { value: 0.9 } } });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: blurFrag,
      uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } } });
    this.finalMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: finalFrag,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tDof: { value: null }, tB1: { value: null }, tB2: { value: null }, tCard: { value: null },
        uExposure: { value: 1 }, uBloom: { value: 0.2 }, uHal: { value: 0.06 }, uGrain: { value: 0.05 }, uVig: { value: 0.4 },
        uInstab: { value: 0.2 }, uTime: { value: 0 }, uFrame: { value: 0 }, uCA: { value: 0.0015 },
        uFocus: { value: 3 }, uBlur: { value: 0 }, uCardMix: { value: 0 }, uTear: { value: 0 }, uCardGrain: { value: 0.022 },
        uScene: { value: 1 }, uRes: { value: new THREE.Vector2(w, h) }, ...common,
      } });
    this.setSize(w, h);
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    this.dispose();
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture, samples: this.samples });
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.rtDof = new THREE.WebGLRenderTarget(hw, hh, hf);
    this.rtBright = new THREE.WebGLRenderTarget(hw, hh, hf);
    this.rtQ = [new THREE.WebGLRenderTarget(w >> 2, h >> 2, hf), new THREE.WebGLRenderTarget(w >> 2, h >> 2, hf)];
    this.rtE = [new THREE.WebGLRenderTarget(w >> 3, h >> 3, hf), new THREE.WebGLRenderTarget(w >> 3, h >> 3, hf)];
    this.finalMat.uniforms.uRes.value.set(w, h);
    this.dofMat.uniforms.uPx.value.set(1 / hw, 1 / hh);
    this.dofMat.uniforms.uResY.value = hh;
  }

  dispose() {
    [this.rtScene, this.rtDof, this.rtBright, ...(this.rtQ || []), ...(this.rtE || [])].forEach((r) => r && r.dispose());
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qscene, this.cam);
  }

  blur(src, pair, w, h) {
    const m = this.blurMat;
    m.uniforms.tColor.value = src.texture; m.uniforms.uDir.value.set(1 / w, 0); this.pass(m, pair[0]);
    m.uniforms.tColor.value = pair[0].texture; m.uniforms.uDir.value.set(0, 1 / h); this.pass(m, pair[1]);
    m.uniforms.tColor.value = pair[1].texture; m.uniforms.uDir.value.set(2 / w, 0); this.pass(m, pair[0]);
    m.uniforms.tColor.value = pair[0].texture; m.uniforms.uDir.value.set(0, 2 / h); this.pass(m, pair[1]);
  }

  render(scene, camera, p) {
    const r = this.renderer;
    const F = this.finalMat.uniforms;
    const hasScene = !!scene;
    if (hasScene) {
      r.setRenderTarget(this.rtScene);
      r.clear();
      r.render(scene, camera);
      const near = camera.near, far = camera.far;
      [this.dofMat.uniforms, F].forEach((u) => { u.uNear.value = near; u.uFar.value = far; });

      const D = this.dofMat.uniforms;
      D.tColor.value = this.rtScene.texture; D.tDepth.value = this.rtScene.depthTexture;
      D.uFocus.value = p.focus; D.uBlur.value = p.blur;
      if (p.blur > 0) this.pass(this.dofMat, this.rtDof);

      this.brightMat.uniforms.tColor.value = this.rtScene.texture;
      this.brightMat.uniforms.uThreshold.value = p.threshold ?? 0.85;
      this.pass(this.brightMat, this.rtBright);
      this.blur(this.rtBright, this.rtQ, this.w >> 2, this.h >> 2);
      this.blur(this.rtQ[1], this.rtE, this.w >> 3, this.h >> 3);
    }

    F.tColor.value = this.rtScene.texture; F.tDepth.value = this.rtScene.depthTexture;
    F.tDof.value = this.rtDof.texture; F.tB1.value = this.rtQ[1].texture; F.tB2.value = this.rtE[1].texture;
    F.tCard.value = p.cardTexture || null;
    F.uScene.value = hasScene ? 1 : 0;
    F.uExposure.value = p.exposure; F.uBloom.value = p.bloom; F.uHal.value = p.halation;
    F.uGrain.value = p.grain; F.uVig.value = p.vignette; F.uInstab.value = p.instability;
    F.uTime.value = p.time; F.uFrame.value = p.frame; F.uCA.value = p.ca;
    F.uFocus.value = p.focus; F.uBlur.value = p.blur;
    F.uCardMix.value = p.cardMix; F.uTear.value = p.tear;
    this.pass(this.finalMat, null);
  }
}
