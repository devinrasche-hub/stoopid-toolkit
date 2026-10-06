import * as THREE from 'three';
import { DURATION, CUE, formatTime } from './timeline.js';
import { makeTextures } from './textures.js';
import { buildHome, buildChamber, buildReal } from './world.js';
import { makeDirector } from './director.js';
import { Post } from './post.js';
import { Cards } from './cards.js';
import { Soundtrack } from './audio.js';
import { clamp, smooth, lerp, SETTINGS } from './util.js';

// ── Quality presets ─────────────────────────────────────────────────────────
const QUALITY = {
  high:   { w: 1920, h: 1080, reflect: 640, shadow: 1024, feed: 384, samples: 4 },
  medium: { w: 1280, h: 720,  reflect: 448, shadow: 1024, feed: 320, samples: 2 },
  low:    { w: 960,  h: 540,  reflect: 288, shadow: 512,  feed: 256, samples: 0 },
};
const params = new URLSearchParams(location.search);
let qName = QUALITY[params.get('quality')] ? params.get('quality') : 'high';
const Q = () => ({ ...QUALITY[qName], dust: 700 });

// Viewer settings persist per browser (convenience only; the film works without).
const store = {
  get(k, d) { try { const v = localStorage.getItem('prh.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('prh.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
SETTINGS.motion = store.get('reducedMotion', prefersReduced) ? 0.45 : 1;
SETTINGS.flicker = store.get('reducedFlicker', false) ? 0 : 1;

// ── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('frames') });
renderer.setPixelRatio(1);
renderer.setSize(Q().w, Q().h, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const T = makeTextures();
const W = { home: buildHome(T, Q()), chamber: buildChamber(T, Q()), real: buildReal(T, Q()) };
const SCENES = { home: W.home.scene, real: W.real.scene };
const director = makeDirector(W);
const post = new Post(renderer, Q().w, Q().h, Q().samples);
const cards = new Cards();
const audio = new Soundtrack();
if (params.get('vo')) audio.loadVO(params.get('vo'));

const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.03, 140);
camera.layers.set(0);
camera.layers.enable(2);

function applyQuality(name) {
  qName = name;
  const q = Q();
  renderer.setSize(q.w, q.h, false);
  post.samples = q.samples;
  post.setSize(q.w, q.h);
  [W.home.toChamber, W.home.toReal].forEach((p) => p.setSize(q.w >> 1, q.h >> 1, q.w, q.h));
  [W.real.lamp].forEach((sp) => {
    sp.shadow.mapSize.set(q.shadow, q.shadow);
    if (sp.shadow.map) { sp.shadow.map.dispose(); sp.shadow.map = null; }
  });
  document.querySelectorAll('#quality, #introQuality').forEach((s) => (s.value = name));
  renderAt(state.t);
}

// ── Look: image treatment over time ─────────────────────────────────────────
function look(t, cam) {
  // FALSE HOME: commercial warmth with teal in the shadows, a faint broadcast instability.
  // REAL HOME: ordinary lamplight; no grade tricks, no instability, no aberration.
  const L = { exposure: 1.0, bloom: 0.15, halation: 0.04, grain: 0.045, vignette: 0.5, instability: 0.05, ca: 0.0012, threshold: 0.9, teal: 1, warm: 0.6 };
  if (cam.world === 'real') Object.assign(L, { bloom: 0.1, halation: 0.0, grain: 0.022, vignette: 0.26, instability: 0, ca: 0, threshold: 1.2, teal: 0, warm: 0.15 });
  if (cam.shot.id === '1A') L.exposure = 1;
  if (cam.scene === 'none') { L.grain = 0.018; L.instability = 0; L.ca = 0; }
  if (!SETTINGS.flicker) { L.instability = 0; L.grain *= 0.6; }
  return L;
}
// ── Frame render ────────────────────────────────────────────────────────────
const focusV = new THREE.Vector3();
let captionsOn = true;
function renderAt(t) {
  t = clamp(t, 0, DURATION);
  const { cam, feeds, portals } = director.update(t);
  const scene = SCENES[cam.scene] || null;
  if (scene) {
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.look);
    if (cam.roll) camera.rotateZ(cam.roll);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const f of feeds) f.feed.render(renderer, f.scene);
    for (const p of portals) p.portal.render(renderer, p.far, camera);
  }
  let focus = 4;
  if (cam.focusDist) focus = cam.focusDist;
  else if (cam.focus) focus = focusV.set(...cam.focus).distanceTo(camera.position);
  const c = cards.update(t, { captions: captionsOn });
  const L = look(t, cam);
  post.render(scene, camera, {
    ...L, focus, blur: cam.blur || 0, time: t, frame: Math.floor(t * 24),
    cardTexture: cards.texture, cardMix: c.mix, tear: 0, textTexture: cards.textTexture, textMix: c.textMix,
  });
  return portals.length;
}

// Compile every material and warm every shot before playback, so reveals don't stall.
const WARM = [0.5, 5, 12, 17, 22, 30, 35, 42, 50, 56, 61, 66, 70, 76, 81, 90, 98, 103, 108, 112, 117, 119.5];
async function prewarm() {
  Object.values(SCENES).forEach((s) => { try { renderer.compile(s, camera); } catch (e) { /* older three */ } });
  for (const t of WARM) {
    renderAt(t);
    await new Promise((r) => requestAnimationFrame(r));
  }
  renderAt(state.t);
}

// ── Playback state ──────────────────────────────────────────────────────────
const state = { t: clamp(parseFloat(params.get('t')) || 0, 0, DURATION), playing: false, perf0: 0, from: 0, started: false, scrubbing: false, ready: false };
const $ = (id) => document.getElementById(id);
const ui = { controls: $('controls'), play: $('bPlay'), time: $('time'), scrub: $('scrub'), cc: $('bCC'), mute: $('bMute'),
  rec: $('bRec'), intro: $('intro'), ended: $('ended'), toast: $('toast'), enter: $('enter') };

function clockTime() {
  const a = audio.running ? audio.time() : null;
  if (a !== null) return a;
  return state.from + (performance.now() - state.perf0) / 1000;
}
function play(from = state.t) {
  if (from >= DURATION - 0.01) from = 0;
  state.t = from; state.from = from; state.perf0 = performance.now();
  state.playing = true;
  audio.play(from);
  ui.ended.hidden = true;
  ui.play.textContent = '❚❚';
  document.body.classList.add('playing');
  pokeControls();
}
function pause() {
  if (state.playing) state.t = clamp(clockTime(), 0, DURATION);
  state.playing = false;
  audio.pause();
  ui.play.textContent = '▶';
  showControls();
}
function seek(t) {
  state.t = clamp(t, 0, DURATION);
  if (state.playing) play(state.t); else renderAt(state.t);
}
function toggle() { state.playing ? pause() : play(); }
function finish() {
  state.playing = false;
  audio.pause();
  state.t = DURATION;
  ui.play.textContent = '▶';
  document.body.classList.remove('playing');
  if (recorder) stopRecording();
  if (!document.body.classList.contains('capture')) ui.ended.hidden = false;
  showControls();
}
function loop() {
  requestAnimationFrame(loop);
  if (!state.ready) return;
  if (state.playing) {
    state.t = clockTime();
    if (state.t >= DURATION) { state.t = DURATION; renderAt(DURATION - 1e-3); finish(); }
  }
  if (!state.scrubbing) { renderAt(Math.min(state.t, DURATION - 1e-3)); ui.scrub.value = state.t; }
  ui.time.textContent = formatTime(state.t);
}

// ── Controls ────────────────────────────────────────────────────────────────
let hideTimer = 0;
function showControls() {
  if (!state.started || document.body.classList.contains('capture')) return;
  ui.controls.classList.remove('hidden');
  document.body.classList.remove('nocursor');
}
function pokeControls() {
  showControls();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (state.playing && !ui.controls.matches(':hover')) {
      ui.controls.classList.add('hidden');
      document.body.classList.add('nocursor');
    }
  }, 2200);
}
window.addEventListener('mousemove', pokeControls);
window.addEventListener('touchstart', pokeControls, { passive: true });

function toast(msg, ms = 2400) {
  ui.toast.textContent = msg; ui.toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (ui.toast.hidden = true), ms);
}
function setMuted(m) {
  audio.setMuted(m);
  ui.mute.setAttribute('aria-pressed', String(!m));
  ui.mute.textContent = m ? 'MUTED' : 'SND';
  $('introSound').textContent = `Sound: ${m ? 'off' : 'on'}`;
  $('introSound').setAttribute('aria-pressed', String(!m));
}
function setCaptions(on) {
  captionsOn = on;
  ui.cc.setAttribute('aria-pressed', String(on));
  if (!state.playing && state.ready) renderAt(state.t);
}
function setMotion(reduced) {
  SETTINGS.motion = reduced ? 0.45 : 1; store.set('reducedMotion', reduced);
  document.querySelectorAll('[data-set=motion]').forEach((b) => { b.setAttribute('aria-pressed', String(reduced)); b.textContent = `Reduced motion: ${reduced ? 'on' : 'off'}`; });
  if (!state.playing && state.ready) renderAt(state.t);
}
function setFlicker(reduced) {
  SETTINGS.flicker = reduced ? 0 : 1; store.set('reducedFlicker', reduced);
  document.querySelectorAll('[data-set=flicker]').forEach((b) => { b.setAttribute('aria-pressed', String(reduced)); b.textContent = `Reduced flicker: ${reduced ? 'on' : 'off'}`; });
  if (!state.playing && state.ready) renderAt(state.t);
}
let captureWanted = params.has('capture');
function setCapture(on) {
  document.body.classList.toggle('capture', on);
  document.body.classList.toggle('nocursor', on);
  if (on) ui.controls.classList.add('hidden'); else showControls();
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

ui.enter.addEventListener('click', () => {
  if (!state.ready) return;
  audio.ensure();
  state.started = true;
  ui.intro.style.display = 'none';
  if (captureWanted) { setCapture(true); fullscreen(); }
  play(state.t);
});
$('introSound').addEventListener('click', () => setMuted(!audio.muted));
$('introCapture').addEventListener('click', () => {
  captureWanted = !captureWanted;
  $('introCapture').textContent = `Clean capture: ${captureWanted ? 'on' : 'off'}`;
  $('introCapture').setAttribute('aria-pressed', String(captureWanted));
});
document.querySelectorAll('[data-set=motion]').forEach((b) => b.addEventListener('click', () => setMotion(SETTINGS.motion === 1)));
document.querySelectorAll('[data-set=flicker]').forEach((b) => b.addEventListener('click', () => setFlicker(SETTINGS.flicker === 1)));
$('introQuality').addEventListener('change', (e) => applyQuality(e.target.value));
$('quality').addEventListener('change', (e) => applyQuality(e.target.value));
ui.play.addEventListener('click', toggle);
$('bRestart').addEventListener('click', () => play(0));
ui.cc.addEventListener('click', () => setCaptions(!captionsOn));
ui.mute.addEventListener('click', () => setMuted(!audio.muted));
$('bCapture').addEventListener('click', () => { setCapture(true); toast('Clean capture — press H or Esc to exit', 1800); });
$('bFull').addEventListener('click', fullscreen);
$('replay').addEventListener('click', () => play(0));
ui.scrub.addEventListener('input', () => {
  if (!state.scrubbing && state.playing) audio.pause();
  state.scrubbing = true;
  state.t = parseFloat(ui.scrub.value);
  renderAt(state.t);
  ui.time.textContent = formatTime(state.t);
});
ui.scrub.addEventListener('change', () => { state.scrubbing = false; seek(parseFloat(ui.scrub.value)); });

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (!state.started) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); toggle(); }
  else if (k === 'r') play(0);
  else if (k === 'm') setMuted(!audio.muted);
  else if (k === 'c') setCaptions(!captionsOn);
  else if (k === 'f') fullscreen();
  else if (k === 'h') setCapture(!document.body.classList.contains('capture'));
  else if (k === 'escape' && document.body.classList.contains('capture')) setCapture(false);
  else if (k === 'arrowright') seek(state.t + (e.shiftKey ? 1 : 5));
  else if (k === 'arrowleft') seek(state.t - (e.shiftKey ? 1 : 5));
  else if (k === '.' && !state.playing) seek(state.t + 1 / 30);
  else if (k === ',' && !state.playing) seek(state.t - 1 / 30);
  pokeControls();
});

// ── Capture ─────────────────────────────────────────────────────────────────
// REC records in real time: picture (captions and titles are part of it) plus
// the mixed soundtrack. If the GPU drops frames, the recording drops them too;
// for a guaranteed-smooth master use scripts/render-frames.mjs + the WAV.
let recorder = null, chunks = [];
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function startRecording() {
  if (!window.MediaRecorder || !canvas.captureStream) { toast('Recording is not supported in this browser'); return; }
  audio.ensure();
  const stream = canvas.captureStream(60);
  if (audio.recordDest) audio.recordDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc1,mp4a', 'video/webm'];
  const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 24_000_000 });
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => { download(new Blob(chunks, { type: mimeType || 'video/webm' }), `still-here.${ext}`); recorder = null; ui.rec.classList.remove('on'); };
  recorder.start(1000);
  ui.rec.classList.add('on');
  toast(`Recording ${ext.toUpperCase()} in real time (120 s)…`, 2500);
  setCapture(true);
  play(0);
}
function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
ui.rec.addEventListener('click', () => (recorder ? (stopRecording(), pause()) : startRecording()));
$('bWav').addEventListener('click', async () => {
  toast('Rendering soundtrack…', 8000);
  download(await audio.renderWav(), 'still-here-soundtrack.wav');
  toast('Soundtrack saved');
});

// Deterministic entry points for offline export (scripts/render-frames.mjs).
if (params.has('frames')) window.__W = W;
window.PRS = {
  duration: DURATION,
  // Frame-exact: re-renders until every monitor feed (and the portal, whose CRT
  // shows a feed that contains the portal) holds this exact moment.
  renderAt: (t) => { state.t = t; const portal = renderAt(t); renderAt(t); if (portal) renderAt(t); },
  seek, play, pause,
  get time() { return state.t; },
  async audioLevels() {
    const buf = await audio.renderBuffer(24000);
    const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = [];
    for (let s = 0; s < DURATION; s++) {
      let pk = 0, sum = 0;
      for (let i = s * sr; i < (s + 1) * sr; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); pk = Math.max(pk, v); sum += L[i] * L[i] + R[i] * R[i]; }
      const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120).toFixed(1);
      out.push([s, db(pk), db(Math.sqrt(sum / (2 * sr)))]);
    }
    return out;
  },
};

setCaptions(params.get('cc') !== '0');
setMuted(params.get('mute') === '1');
setMotion(SETTINGS.motion < 1);
setFlicker(SETTINGS.flicker === 0);
applyQuality(qName);
if (params.has('frames')) { state.started = true; ui.intro.style.display = 'none'; setCapture(true); state.ready = true; }
else {
  ui.enter.textContent = 'Preparing…';
  prewarm().then(() => { state.ready = true; ui.enter.textContent = 'Start'; ui.enter.disabled = false; });
}
requestAnimationFrame(loop);
