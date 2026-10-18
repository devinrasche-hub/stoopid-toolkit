// PLANET CRASHER — wiring: scene, UI, the crash lifecycle and the HUD.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Sim, RHO } from './sim.js';
import { TARGETS, IMPACTORS, IMPACTOR_MATERIALS, buildBodies, approach, pack, planeToWorld } from './planets.js';
import { makeParticles, makeStars, makeSky, makeSun, makeAtmosphere, makeAimLine, kelvin } from './render.js';
import { analyse, classify } from './analysis.js';
import { Audio } from './audio.js';
import { VERDICTS } from './verdicts.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const G_SI = 6.674e-11;
const CHICXULUB_J = 4.2e23;
const SETTLE_UNITS = 32; // sim time after contact before the verdict

const SCENARIOS = {
  moon: { target: 'earth', impactor: 'theia', material: 'rock', speed: 1.1, angle: 45,
    note: 'The giant-impact theory: a Mars-sized planet called Theia grazes the young Earth. Watch for the ring of debris left in orbit.' },
  hitrun: { target: 'earth', impactor: 'theia', material: 'rock', speed: 1.7, angle: 55,
    note: 'Fast and glancing: the impactor tears through the edge and keeps going.' },
  dino: { target: 'earth', impactor: 'asteroid', material: 'rock', speed: 2.2, angle: 45,
    note: 'Not to scale: the smallest rock this simulation can see is about 1,000 km wide. The dinosaur one was 10.' },
  bully: { target: 'mars', impactor: 'bully', material: 'rock', speed: 1.3, angle: 30,
    note: 'Something three times heavier than Mars arrives. Mars is now the impactor, emotionally.' },
  oblit: { target: 'earth', impactor: 'twin', material: 'iron', speed: 6, angle: 0,
    note: 'Two Earth-mass planets, head-on, at six times escape speed. Most of both planets leaves for good.' },
  splash: { target: 'ocean', impactor: 'moon', material: 'ice', speed: 2.5, angle: 35,
    note: 'An icy moon into a water world. Water is the lightest layer, so it leaves first.' },
};

const isMobile = matchMedia('(pointer: coarse)').matches;
const state = {
  target: 'earth', impactor: 'theia', material: 'rock', speed: 1.1, angle: 45,
  quality: +(params.get('n') || (isMobile ? 2048 : 4096)),
  substeps: 8, cam: 'orbit',
  phase: 'aim', // aim | flight | done
  paused: false, simT: 0, contacted: false, verdictShown: false,
};

// ---------- renderer / scene ----------
const canvas = $('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext) || !gl.getExtension('EXT_color_buffer_float')) throw new Error('no float targets');
} catch (e) {
  $('nogl').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 3000);
camera.position.set(1.5, 3.2, 10.5);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 200;
controls.autoRotateSpeed = 0.35;

const sunDir = new THREE.Vector3(1, 0.32, 0.55).normalize();
scene.add(makeSky(), makeStars(), makeSun(sunDir));
const atmo = makeAtmosphere();
scene.add(atmo);
const aim = makeAimLine();
scene.add(aim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.55, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let sim = null, particles = null;
let bodies = null, ap = null, layout = null, real = null;
let lastA = null, analysing = false, frameNo = 0;
const audio = new Audio();

function texDims(n) {
  const W = n >= 8192 ? 128 : 64;
  return [W, Math.ceil(n / W)];
}

function ensureSim() {
  const [W, H] = texDims(state.quality);
  if (sim && sim.W === W && sim.H === H) return;
  if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); }
  sim = new Sim(renderer, W, H);
  particles = makeParticles(W, H);
  scene.add(particles);
}

// Real-world scale for the HUD, from the target planet.
function realUnits() {
  const T = TARGETS[state.target];
  const eUnit = (G_SI * T.mass) / T.radius; // J/kg per sim unit
  return {
    eUnit,
    vUnit: Math.sqrt(eUnit) / 1000, // km/s
    tUnit: Math.sqrt(T.radius ** 3 / (G_SI * T.mass)), // seconds
    EUnit: (G_SI * T.mass * T.mass) / T.radius, // joules
  };
}

// ---------- building and aiming ----------
function rebuild() {
  $('busy').hidden = false;
  // let the overlay paint before the (synchronous) build
  requestAnimationFrame(() => setTimeout(() => {
    ensureSim();
    bodies = buildBodies({ cap: sim.cap, target: state.target, impactor: state.impactor, material: state.material });
    real = realUnits();
    sim.setVaporization(1.6e7 / real.eUnit);
    particles.material.uniforms.uRad.value = bodies.diam * 0.56;
    particles.material.uniforms.uEUnit.value = real.eUnit;
    toAim(true);
    $('busy').hidden = true;
  }, 0));
}

// Pull the settled bodies back off the GPU and re-centre them on their own centres.
function harvest() {
  const { pos } = sim.readSync();
  const grab = (from, to, body) => {
    const pts = [];
    let m = 0; const c = [0, 0, 0];
    for (let i = from; i < to; i++) {
      const p = [pos[i * 4], pos[i * 4 + 1], pos[i * 4 + 2], Math.round(pos[i * 4 + 3])];
      const w = RHO[p[3]];
      m += w; c[0] += p[0] * w; c[1] += p[1] * w; c[2] += p[2] * w;
      pts.push(p);
    }
    for (const p of pts) { p[0] -= c[0] / m; p[1] -= c[1] / m; p[2] -= c[2] / m; }
    body.pts = pts;
  };
  grab(0, bodies.Nt, bodies.target);
  grab(bodies.Nt, bodies.Nt + bodies.Ni, bodies.impactor);
}

function place(fresh) {
  if (!fresh) harvest();
  ap = approach({ Mt: bodies.target.mass, Mi: bodies.impactor.mass, Rt: bodies.target.radius, Ri: bodies.impactor.radius, speed: state.speed, angle: state.angle });
  // step size: the fastest particle (about the impact speed) moves at most 15% of its width per step
  sim.configure({
    count: bodies.Nt + bodies.Ni, dt: (0.15 * bodies.diam) / Math.max(2.5, 1.15 * ap.vimp), diam: bodies.diam, m0: bodies.m0,
    ...(params.has('zn') && { zetaN: +params.get('zn') }), ...(params.has('zt') && { zetaT: +params.get('zt') }), ...(params.has('mu') && { mu: +params.get('mu') }),
  });
  layout = pack(sim.cap, bodies, ap);
  sim.upload(layout.pos, layout.vel);
  drawAim();
}

function toAim(fresh) {
  state.phase = 'aim'; state.simT = 0; state.contacted = false; state.verdictShown = false; state.paused = false;
  place(fresh);
  sim.setDrag(0.03); sim.setCooling(1e-9);
  lastA = null;
  atmo.visible = TARGETS[state.target].atmoStrength > 0;
  atmo.material.uniforms.uAlpha.value = TARGETS[state.target].atmoStrength;
  atmo.material.uniforms.uColor.value.setRGB(...TARGETS[state.target].atmo);
  atmo.scale.setScalar(bodies.target.radius * 1.045);
  atmo.position.fromArray(layout.targetPos);
  aim.visible = true;
  $('verdict').hidden = true;
  frameCamera();
  updateLabels();
  updateHud();
}

function frameCamera() {
  const sep = Math.hypot(ap.rel.x, ap.rel.y);
  const off = new THREE.Vector3(0.15, 0.32, 1).normalize();
  if (camera.aspect >= 1) {
    controls.target.set(0, 0, 0);
    camera.position.copy(off.multiplyScalar(Math.max(6, sep * 1.55 + bodies.impactor.radius * 2)));
  } else {
    // portrait: centre between the two bodies and fit them across the narrow width
    const mid = planeToWorld([ap.rel.x, ap.rel.y]).map((c) => c * (layout.fI + layout.fT) / 2);
    const E = sep / 2 + Math.max(bodies.target.radius, bodies.impactor.radius);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    controls.target.fromArray(mid);
    camera.position.copy(off.multiplyScalar(Math.max(5, (1.15 * E) / tanH))).add(controls.target);
  }
  controls.update();
}

function drawAim() {
  const { line, ring } = aim.userData;
  const arr = line.geometry.attributes.position.array;
  const n = Math.min(ap.path.length, 400);
  const fI = layout.fI, fT = layout.fT;
  for (let i = 0; i < n; i++) {
    const k = Math.floor((i / (n - 1)) * (ap.path.length - 1));
    const w = planeToWorld(ap.path[k]);
    arr[i * 3] = w[0] * fI; arr[i * 3 + 1] = w[1] * fI; arr[i * 3 + 2] = w[2] * fI;
  }
  line.geometry.setDrawRange(0, n);
  line.geometry.attributes.position.needsUpdate = true;
  line.computeLineDistances();
  // where the target will be when it is hit, and the spot on it
  const cd = planeToWorld(ap.contactDir);
  const tAt = planeToWorld([ap.rc * ap.contactDir[0], ap.rc * ap.contactDir[1]]).map((c) => c * fT);
  const R = bodies.target.radius;
  ring.position.set(tAt[0] + cd[0] * R * 1.01, tAt[1] + cd[1] * R * 1.01, tAt[2] + cd[2] * R * 1.01);
  ring.lookAt(ring.position.clone().add(new THREE.Vector3(...cd)));
  const s = Math.max(0.6, bodies.impactor.radius * 4);
  ring.scale.setScalar(s);
}

// target centre during the approach, from the precomputed two-body path
function targetAt(t) {
  const back = ap.tContact - t;
  const P = ap.path;
  let k = 0;
  while (k < P.length - 1 && P[k + 1][2] > back) k++;
  const a = P[k], b = P[Math.min(k + 1, P.length - 1)];
  const u = a[2] === b[2] ? 0 : (a[2] - back) / (a[2] - b[2]);
  const w = planeToWorld([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  return w.map((c) => c * layout.fT);
}

function launch() {
  if (!bodies) return;
  audio.start();
  if (state.phase !== 'aim') { toAim(false); }
  place(false); // fresh velocities, heat zeroed
  sim.setDrag(0);
  sim.setCooling(30);
  state.phase = 'flight';
  state.simT = 0;
  aim.visible = false;
  audio.launch();
  updateLabels();
}

function togglePause() {
  if (state.phase === 'aim') return launch();
  state.paused = !state.paused;
  updateLabels();
}

// ---------- per-frame ----------
let shake = 0;
let lastNow = performance.now();
let fpsAcc = 0, fpsN = 0, fps = 0;

function frame() {
  const now = performance.now();
  const dtR = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  fpsAcc += dtR; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  frameNo++;

  if (sim && bodies) {
    if (state.phase === 'aim') {
      sim.step(2); // settle the planets in place
    } else if (!state.paused) {
      sim.step(state.substeps);
      state.simT += state.substeps * sim.dt;
    }
    tick();
    particles.material.uniforms.tPos.value = sim.posTex;
    particles.material.uniforms.tVel.value = sim.velTex;
  }

  // camera
  controls.autoRotate = state.cam === 'orbit';
  if (state.cam !== 'free' && lastA && state.phase !== 'aim') {
    const c = lastA.largest;
    const goal = new THREE.Vector3(c.x, c.y, c.z);
    const delta = goal.sub(controls.target).multiplyScalar(0.03);
    controls.target.add(delta); camera.position.add(delta);
  }
  controls.update();
  const shakeV = new THREE.Vector3();
  if (shake > 0.001) {
    shakeV.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.05 * camera.position.distanceTo(controls.target));
    camera.position.add(shakeV);
    shake *= Math.exp(-dtR * 2.2);
  }

  const u = particles && particles.material.uniforms;
  if (u) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    camera.updateMatrixWorld();
    u.uScale.value = size.y * camera.projectionMatrix.elements[5];
    u.uSun.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  }
  atmo.material.uniforms.uSun.value.copy(sunDir);
  composer.render();
  camera.position.sub(shakeV);

  if (snapPending) { snapPending = false; canvas.toBlob((b) => download(b, `planet-crasher-${Date.now()}.png`)); }
  requestAnimationFrame(frame);
}

function tick() {
  if (state.phase === 'aim') return;
  // atmosphere rides the target in, then is the first thing to go
  const since = state.simT - ap.tContact;
  if (since < 0) atmo.position.fromArray(targetAt(state.simT));
  atmo.material.uniforms.uAlpha.value = TARGETS[state.target].atmoStrength * Math.max(0, 1 - Math.max(0, since) / 1.5);
  atmo.visible = atmo.material.uniforms.uAlpha.value > 0;
  if (!state.contacted && since >= 0) {
    state.contacted = true;
    const strength = Math.min(1, Math.log10(1 + 0.5 * reducedMass() * ap.vimp ** 2 * 2000) / 3);
    audio.impact(strength);
    shake = 0.6 * strength + 0.15;
  }
  if (!state.paused && frameNo % 10 === 0 && !analysing) runAnalysis();
  if (state.contacted && !state.verdictShown && state.simT - ap.tContact > SETTLE_UNITS && lastA) showVerdict();
  updateHud();
}

function reducedMass() {
  const Mt = bodies.target.mass, Mi = bodies.impactor.mass;
  return (Mt * Mi) / (Mt + Mi);
}

let lastHeat = 0, lastHeatT = 0;
async function runAnalysis() {
  analysing = true;
  const n = sim.count, d = bodies.diam, m0 = bodies.m0, t = state.simT;
  const { pos, vel } = await sim.read();
  lastA = analyse(pos, vel, n, d, m0);
  lastA.cls = classify(lastA, bodies.target.mass, bodies.impactor.mass);
  // rumble follows the heating rate
  const heat = lastA.meanT;
  if (t > lastHeatT) {
    const rate = (heat - lastHeat) / (t - lastHeatT);
    audio.rumble(state.contacted ? Math.min(1, Math.max(0, rate * 6)) : 0);
  }
  lastHeat = heat; lastHeatT = t;
  analysing = false;
}

// ---------- HUD ----------
const fmtPct = (x) => (x * 100 < 0.1 && x > 0 ? '<0.1' : (x * 100).toFixed(x < 0.1 ? 1 : 0)) + '%';
const WORDS = [[1e12, 'TRILLION'], [1e9, 'BILLION'], [1e6, 'MILLION'], [1e3, 'THOUSAND']];
function words(n) {
  for (const [v, w] of WORDS) if (n >= v) return `${(n / v).toFixed(n / v < 10 ? 1 : 0)} ${w}`;
  return n.toFixed(0);
}
function sci(x) {
  const e = Math.floor(Math.log10(x));
  return `${(x / 10 ** e).toFixed(1)}×10^${e}`;
}

function updateHud() {
  if (!bodies || !ap) return;
  const r = real;
  const secs = Math.max(0, state.simT - (state.phase === 'aim' ? 0 : ap.tContact)) * r.tUnit;
  const neg = state.phase !== 'aim' && state.simT < ap.tContact;
  const s = Math.abs((state.simT - ap.tContact) * r.tUnit);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0'), mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0'), ss = String(Math.floor(s % 60)).padStart(2, '0');
  $('hClock').textContent = state.phase === 'aim' ? '--:--:--' : `${neg ? '-' : ''}${hh}:${mm}:${ss}`;
  $('hClock').previousElementSibling.textContent = neg ? 'T−' : 'T+';
  void secs;
  $('hState').textContent = state.phase === 'aim' ? 'AIMING · PRESS LAUNCH'
    : state.paused ? 'PAUSED'
      : !state.contacted ? 'INBOUND' : state.verdictShown ? 'AFTERMATH' : 'IMPACT';
  const E = 0.5 * reducedMass() * ap.vimp ** 2 * r.EUnit;
  $('hSpeed').textContent = `${(ap.vimp * r.vUnit).toFixed(1)} KM/S`;
  $('hEnergy').textContent = `${sci(E)} J`;
  $('hEnergy').title = `≈ ${words(E / CHICXULUB_J)} CHICXULUBS`;
  if (lastA && state.phase !== 'aim') {
    const a = lastA;
    $('hLargest').textContent = `${fmtPct(a.largest.m / a.total)} OF MASS`;
    $('hDisk').textContent = fmtPct(a.bound / a.total);
    $('hEscape').textContent = fmtPct(a.escaping / a.total);
    const K = kelvin(a.peakT * r.eUnit);
    $('hTemp').textContent = `${Math.round(K).toLocaleString('en-US')} K`;
    $('hOutcome').textContent = state.contacted ? a.cls.kind + (a.cls.moonMaker && a.largest.m > 0.5 * a.total ? ' + DEBRIS DISK' : '') : 'PENDING';
  } else {
    for (const id of ['hLargest', 'hDisk', 'hEscape', 'hTemp']) $(id).textContent = '—';
    $('hOutcome').textContent = 'PENDING';
  }
  $('hPerf').textContent = `${sim ? sim.count.toLocaleString('en-US') : 0} PARTICLES · ${fps.toFixed(0)} FPS · ≈ ${words(E / CHICXULUB_J)} CHICXULUBS`;
}

function updateLabels() {
  const r = real || realUnits();
  for (const seg of document.querySelectorAll('.seg[data-key]')) {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', String(state[seg.dataset.key]) === b.dataset.v);
  }
  if (ap) {
    $('speedOut').textContent = `${state.speed.toFixed(2)}× ESCAPE · ${(ap.vimp * r.vUnit).toFixed(1)} KM/S`;
  }
  const ang = state.angle;
  $('angleOut').textContent = `${ang}° · ${ang < 15 ? 'HEAD-ON' : ang < 40 ? 'OBLIQUE' : ang < 60 ? 'GLANCING' : 'GRAZING'}`;
  $('subOut').textContent = `${state.substeps} STEPS/FRAME`;
  const q = IMPACTORS[state.impactor].q;
  $('qOut').textContent = q < 0.1 ? `${(q * 100).toFixed(q < 0.01 ? 1 : 0)}% OF TARGET` : q < 1 ? `${Math.round(q * 100)}% OF TARGET` : q === 1 ? 'SAME MASS' : `${q}× TARGET`;
  for (const L of [$('launch'), $('launchM')]) {
    L.textContent = state.phase === 'aim' ? 'LAUNCH' : state.paused ? 'RESUME' : 'PAUSE';
    L.classList.toggle('running', state.phase !== 'aim' && !state.paused);
  }
}

// ---------- verdict ----------
function showVerdict() {
  state.verdictShown = true;
  const a = lastA, c = a.cls;
  const key = c.moonMaker && (c.kind === 'PERFECT MERGER' || c.kind === 'PARTIAL ACCRETION') ? 'MOON' : c.kind;
  const v = VERDICTS[key] || VERDICTS['PERFECT MERGER'];
  $('vKind').textContent = c.kind + (key === 'MOON' ? ' + A MOON-MAKING DISK' : c.moonMaker && a.largest.m > 0.5 * a.total ? ' + DEBRIS DISK' : '');
  const st = $('vStamp');
  st.textContent = v.stamp;
  st.classList.toggle('stupid', v.stamp === 'STUPID');
  $('vLine').textContent = v.lines[Math.floor(Math.random() * v.lines.length)];
  const E = 0.5 * reducedMass() * ap.vimp ** 2 * real.EUnit;
  $('vStats').innerHTML = [
    `${IMPACTORS[state.impactor].label} (${IMPACTOR_MATERIALS[state.material].label}) → ${TARGETS[state.target].label} · ${(ap.vimp * real.vUnit).toFixed(1)} KM/S · ${state.angle}°`,
    `ENERGY ${sci(E)} J ≈ ${words(E / CHICXULUB_J)} CHICXULUBS`,
    `LARGEST REMNANT ${fmtPct(a.largest.m / a.total)} · IN ORBIT ${fmtPct(a.bound / a.total)} · GONE FOREVER ${fmtPct(a.escaping / a.total)}`,
    `PEAK ${Math.round(kelvin(a.peakT * real.eUnit)).toLocaleString('en-US')} K`,
  ].join('<br>');
  $('verdict').hidden = false;
  audio.verdict();
}

// ---------- UI wiring ----------
function setState(patch, needsRebuild) {
  Object.assign(state, patch);
  if (needsRebuild) rebuild();
  else if (bodies) { toAim(false); }
  updateLabels();
}

for (const seg of document.querySelectorAll('.seg[data-key]')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = seg.dataset.key;
    if (k === 'cam') { state.cam = b.dataset.v; updateLabels(); return; }
    const v = k === 'quality' ? +b.dataset.v : b.dataset.v;
    if (state[k] === v) return;
    setState({ [k]: v }, true);
  });
}
for (const b of document.querySelectorAll('#scenarios button')) {
  b.addEventListener('click', () => {
    const s = SCENARIOS[b.dataset.scn];
    $('speed').value = s.speed; $('angle').value = s.angle;
    $('note').textContent = s.note;
    const { note, ...cfg } = s; void note;
    const same = cfg.target === state.target && cfg.impactor === state.impactor && cfg.material === state.material;
    Object.assign(state, cfg);
    if (same) toAim(false); else rebuild();
    updateLabels();
  });
}
$('speed').addEventListener('input', (e) => { state.speed = +e.target.value; if (state.phase === 'aim' && bodies) { place(false); updateLabels(); updateHud(); } });
$('angle').addEventListener('input', (e) => { state.angle = +e.target.value; if (state.phase === 'aim' && bodies) { place(false); updateLabels(); } });
$('speed').addEventListener('change', () => { if (state.phase !== 'aim') toAim(false); });
$('angle').addEventListener('change', () => { if (state.phase !== 'aim') toAim(false); });
$('substeps').addEventListener('input', (e) => { state.substeps = +e.target.value; updateLabels(); });
$('launch').addEventListener('click', togglePause);
$('launchM').addEventListener('click', togglePause);
$('reset').addEventListener('click', () => rebuild());
$('vAgain').addEventListener('click', () => { $('verdict').hidden = true; toAim(false); });
$('vWatch').addEventListener('click', () => { $('verdict').hidden = true; });
$('panelToggle').addEventListener('click', () => {
  const p = $('panel');
  p.classList.toggle('collapsed');
  $('panelToggle').setAttribute('aria-expanded', String(!p.classList.contains('collapsed')));
});
controls.addEventListener('start', () => { if (state.cam === 'orbit') { state.cam = 'follow'; updateLabels(); } });

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 'r' || e.key === 'R') rebuild();
  else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean');
});

// snap / rec / sound
let snapPending = false;
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('snap').addEventListener('click', () => { snapPending = true; });
let rec = null;
$('rec').addEventListener('click', () => {
  if (rec) { rec.stop(); return; }
  audio.start();
  const stream = canvas.captureStream(60);
  if (audio.dest) for (const t of audio.dest.stream.getAudioTracks()) stream.addTrack(t);
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const chunks = [];
  rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { download(new Blob(chunks, { type: 'video/webm' }), `planet-crasher-${Date.now()}.webm`); rec = null; $('rec').classList.remove('on'); $('rec').innerHTML = '&#9679; REC'; };
  rec.start(500);
  $('rec').classList.add('on'); $('rec').textContent = '■ STOP';
});
$('sound').addEventListener('click', () => {
  audio.start();
  audio.setMuted(!audio.muted);
  $('sound').textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
});
if (params.has('mute')) { audio.muted = true; $('sound').textContent = 'SOUND OFF'; }

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// test hooks for scripts/snapshot.mjs
window.PC = {
  state, ready: () => !!bodies && $('busy').hidden,
  scenario: (k) => document.querySelector(`[data-scn="${k}"]`).click(),
  launch, frame: () => composer.render(),
  // energy audit: kinetic, potential (softened, as the GPU sees it), heat
  energy() {
    const { pos, vel } = sim.readSync();
    const n = sim.count, m0 = bodies.m0, e2 = (0.5 * bodies.diam) ** 2;
    let K = 0, U = 0, Q = 0;
    const m = new Float64Array(n);
    for (let i = 0; i < n; i++) m[i] = m0 * RHO[Math.round(pos[i * 4 + 3])];
    for (let i = 0; i < n; i++) {
      K += 0.5 * m[i] * (vel[i * 4] ** 2 + vel[i * 4 + 1] ** 2 + vel[i * 4 + 2] ** 2);
      Q += m[i] * vel[i * 4 + 3];
      for (let j = i + 1; j < n; j++) {
        const r2 = (pos[i * 4] - pos[j * 4]) ** 2 + (pos[i * 4 + 1] - pos[j * 4 + 1]) ** 2 + (pos[i * 4 + 2] - pos[j * 4 + 2]) ** 2;
        U -= (m[i] * m[j]) / Math.sqrt(r2 + e2);
      }
    }
    return { K, U, Q, total: K + U + Q };
  },
  // advance simulation time synchronously, in sim units
  advance(units) {
    const steps = Math.ceil(units / sim.dt);
    for (let i = 0; i < steps; i += 32) {
      const n = Math.min(32, steps - i);
      sim.step(n); state.simT += n * sim.dt;
    }
    const { pos, vel } = sim.readSync();
    lastA = analyse(pos, vel, sim.count, bodies.diam, bodies.m0);
    lastA.cls = classify(lastA, bodies.target.mass, bodies.impactor.mass);
    return { simT: state.simT, tContact: ap.tContact, largest: lastA.largest.m / lastA.total, disk: lastA.bound / lastA.total, esc: lastA.escaping / lastA.total, peakK: kelvin(lastA.peakT * real.eUnit), meanK: kelvin(lastA.meanT * real.eUnit), kind: lastA.cls.kind, moon: lastA.cls.moonMaker };
  },
};

if (innerWidth < 760) { $('panel').classList.add('collapsed'); $('panelToggle').setAttribute('aria-expanded', 'false'); }

const first = params.get('scn');
if (first && SCENARIOS[first]) {
  Object.assign(state, (({ note, ...c }) => c)(SCENARIOS[first]));
  $('speed').value = state.speed; $('angle').value = state.angle;
  $('note').textContent = SCENARIOS[first].note;
} else {
  $('note').textContent = SCENARIOS.moon.note;
}
state.substeps = state.quality >= 16384 ? 3 : state.quality >= 8192 ? 5 : 8;
$('substeps').value = state.substeps;
updateLabels();
rebuild();
requestAnimationFrame(frame);
