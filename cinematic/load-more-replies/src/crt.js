import * as THREE from 'three';

const BLACK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLACK.needsUpdate = true;

const screenVert = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const screenFrag = /* glsl */`
  uniform sampler2D uOverlay;
  uniform sampler2D uFeed;
  uniform float uFeedMix, uPower, uTime, uNoise, uBright, uLines, uDot, uRoll, uSeed, uGlass;
  uniform vec3 uTint;
  varying vec2 vUv;

  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
  vec2 curve(vec2 uv){
    uv = uv * 2.0 - 1.0;
    vec2 o = abs(uv.yx) / vec2(5.0, 4.2);
    uv = uv + uv * o * o;
    return uv * 0.5 + 0.5;
  }
  vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }

  void main(){
    vec2 uv = curve(vUv);
    float tube = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

    // Power: the raster grows from a dot to a line to a full field (and back).
    float sx = smoothstep(0.0, 0.22, uPower);
    float sy = mix(0.005, 1.0, smoothstep(0.22, 1.0, uPower));
    vec2 c = uv - 0.5;
    vec2 suv = vec2(c.x / max(sx, 1e-3), c.y / sy) + 0.5;
    float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);

    // Vertical roll while warming / losing sync.
    suv.y = fract(suv.y + uRoll);

    float frame = floor(uTime * 30.0);
    float line = floor(suv.y * uLines);
    suv.x += (h(vec2(line, frame)) - 0.5) * 0.006 * uNoise;

    vec3 feed = texture2D(uFeed, suv).rgb;
    vec4 ov = texture2D(uOverlay, suv);
    vec3 col = feed * uFeedMix;
    col = mix(col, toLinear(ov.rgb), ov.a);

    float st = h(floor(suv * vec2(320.0, 240.0)) + frame * vec2(0.37, 0.71));
    col = mix(col, vec3(st * st) * 0.6, uNoise);

    // Scanlines + slot mask, kept soft.
    float sl = 0.62 + 0.38 * pow(abs(sin(suv.y * uLines * 3.14159)), 0.8);
    float mx = mod(floor(suv.x * uLines * 1.6), 3.0);
    vec3 mask = mx < 1.0 ? vec3(1.0, 0.82, 0.82) : (mx < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0));
    col *= sl * mask;

    float boost = 1.0 + (1.0 - sy) * 4.0;
    col *= inside * boost * uBright;

    vec2 vv = uv * (1.0 - uv.yx);
    col *= pow(clamp(vv.x * vv.y * 18.0, 0.0, 1.0), 0.3);
    col *= tube;

    // Afterglow dot when the set switches off.
    float d = length((vUv - 0.5) * vec2(1.33, 1.0));
    col += uDot * exp(-d * d * 1400.0) * vec3(0.75, 0.95, 1.0) * 4.0;

    // Dead glass: a faint grey-green base and a soft reflection streak.
    vec3 glass = vec3(0.006, 0.008, 0.008);
    float streak = smoothstep(0.32, 0.0, abs(vUv.x * 0.7 + vUv.y * 0.5 - 0.95)) * 0.012;
    col += (glass + streak) * uGlass;

    gl_FragColor = vec4(col * uTint, 1.0);
  }
`;

export class CRT {
  constructor({ width = 0.44, height = 0.33, depth = 0.42, canvasW = 512, canvasH = 384, lines = 240,
                bezel = 0x1a1c1b, lightColor = 0x9bd6cf, lightIntensity = 1.6, seed = 1, light = true, lightOffset = 0.55 } = {}) {
    this.group = new THREE.Group();
    this.width = width; this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = canvasW; this.canvas.height = canvasH;
    this.g = this.canvas.getContext('2d');
    this.overlay = new THREE.CanvasTexture(this.canvas);
    this.overlay.colorSpace = THREE.NoColorSpace; // linearized in the shader
    this.lastKey = null;

    this.uniforms = {
      uOverlay: { value: this.overlay },
      uFeed: { value: BLACK },
      uFeedMix: { value: 0 },
      uPower: { value: 1 },
      uTime: { value: 0 },
      uNoise: { value: 0 },
      uBright: { value: 1 },
      uLines: { value: lines },
      uDot: { value: 0 },
      uRoll: { value: 0 },
      uSeed: { value: seed * 1.37 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uGlass: { value: 1 },
    };

    const bez = 0.045;
    const W = width + bez * 2, H = height + bez * 2 + 0.05;
    const plastic = new THREE.MeshStandardMaterial({ color: bezel, roughness: 0.85, metalness: 0.0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x050606, roughness: 0.4 });

    // Bezel frame
    const fd = 0.06;
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, bez, fd), plastic);
    top.position.set(0, height / 2 + bez / 2, 0);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(W, bez + 0.05, fd), plastic);
    bot.position.set(0, -height / 2 - (bez + 0.05) / 2, 0);
    const left = new THREE.Mesh(new THREE.BoxGeometry(bez, height, fd), plastic);
    left.position.set(-width / 2 - bez / 2, 0, 0);
    const right = left.clone();
    right.position.x *= -1;
    this.group.add(top, bot, left, right);

    // Rear housing: a square frustum
    const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.68, 1, 4, 1), plastic);
    rear.rotation.x = Math.PI / 2;
    rear.rotation.y = Math.PI / 4;
    rear.scale.set(W * 0.98, depth, H * 0.98);
    rear.position.set(0, -0.012, -fd / 2 - depth / 2);
    this.group.add(rear);
    this.rear = rear;

    // Screen recess (dark) and curved glass
    const recess = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.02), dark);
    recess.position.z = -0.02;
    this.group.add(recess);

    const sg = new THREE.PlaneGeometry(width, height, 24, 18);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (width / 2), y = p.getY(i) / (height / 2);
      p.setZ(i, 0.014 * (1 - (x * x + y * y) * 0.5));
    }
    sg.computeVertexNormals();
    this.screenMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: screenVert, fragmentShader: screenFrag,
    });
    this.screen = new THREE.Mesh(sg, this.screenMat);
    this.screen.position.z = -0.012;
    this.group.add(this.screen);

    // Knobs + LED on the chin
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12), knobMat);
      k.rotation.x = Math.PI / 2;
      k.position.set(width / 2 - 0.02 - i * 0.032, -height / 2 - 0.045, fd / 2 + 0.004);
      this.group.add(k);
    }
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 0.08) }));
    this.led.position.set(-width / 2 + 0.02, -height / 2 - 0.045, fd / 2 + 0.002);
    this.group.add(this.led);

    this.baseLight = lightIntensity;
    if (light) {
      this.light = new THREE.PointLight(lightColor, lightIntensity, 4.5, 2);
      this.light.position.set(0, 0, lightOffset);
      this.group.add(this.light);
    }

    this.group.traverse((o) => { if (o.isMesh && o !== this.screen) { o.castShadow = false; o.receiveShadow = true; } });
  }

  // Redraws the overlay canvas only when the content key changes.
  draw(key, fn) {
    if (key === this.lastKey) return;
    this.lastKey = key;
    const g = this.g, w = this.canvas.width, h = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    fn(g, w, h);
    this.overlay.needsUpdate = true;
  }

  set({ power = 1, feedMix = 0, noise = 0, bright = 1, time = 0, dot = 0, roll = 0, feed = null, light = 1, glass = 1 }) {
    const u = this.uniforms;
    u.uPower.value = power;
    u.uFeedMix.value = feedMix;
    u.uNoise.value = noise;
    u.uBright.value = bright;
    u.uTime.value = time;
    u.uDot.value = dot;
    u.uRoll.value = roll;
    u.uGlass.value = glass;
    u.uFeed.value = feed || BLACK;
    const on = Math.min(1, power * 1.2);
    if (this.light) this.light.intensity = this.baseLight * on * light;
    this.led.material.color.setRGB(2.2 * (0.15 + 0.85 * on), 0.35 * on, 0.08 * on);
  }
}

// Text with phosphor bloom. Coordinates in canvas pixels.
export function crtText(g, text, x, y, { size = 32, color = '#e8f3ec', align = 'center', weight = '600',
  font = '"DejaVu Sans Mono", "Courier New", monospace', spacing = 0, glow = 10, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.shadowColor = color;
  g.shadowBlur = glow;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
  g.fillText(text, x, y);
  g.restore();
}
