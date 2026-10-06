import * as THREE from 'three';
import { DURATION, CUE, NARRATION, formatTime } from './timeline.js';
import { makeTextures } from './textures.js';
import { buildStation, buildCorridor } from './world.js';
import { makeDirector } from './director.js';
import { Post } from './post.js';
import { Cards } from './cards.js';
import { Soundtrack } from './audio.js';
import { clamp, smooth, hash, lerp } from './util.js';

// ── Quality presets ─────────────────────────────────────────────────────────
const QUALITY = {
  high:   { w: 1920, h: 1080, reflect: 640, shadow: 1024, feed: 384, samples: 4 },
  medium: { w: 1280, h: 720,  reflect: 448, shadow: 1024, feed: 320, samples: 2 },
  low:    { w: 960,  h: 540,  reflect: 288, shadow: 512,  feed: 256, samples: 0 },
};
const params = new URLSearchParams(location.search);
let qName = QUALITY[params.get('quality')] ? params.get('quality') : 'high';
const Q = () => ({ ...QUALITY[qName], dust: 700 });

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
const W = { station: buildStation(T, Q()), corridor: buildCorridor(T, Q()) };
const director = makeDirector(W, T);
const post = new Post(renderer, Q().w, Q().h, Q().samples);
const cards = new Cards();
const audio = new Soundtrack();
if (params.get('vo')) audio.loadVO(params.get('vo'));

const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.03, 80);
camera.layers.set(0);
camera.layers.enable(2);

function applyQuality(name) {
  qName = name;
  const q = Q();
  renderer.setSize(q.w, q.h, false);
  post.samples = q.samples;
  post.setSize(q.w, q.h);
  [W.station.glass, W.station.studioFloorRefl, W.corridor.floorRefl].forEach((r) => r.getRenderTarget().setSize(q.reflect, Math.round(q.reflect * 0.5625)));
  W.station.feedC1.setSize(q.feed, Math.round(q.feed * 0.75));
  W.station.feedC2.setSize(Math.round(q.feed * 0.8), Math.round(q.feed * 0.6));
  W.corridor.feed.setSize(q.feed, Math.round(q.feed * 0.75));
  const sp = W.station.spot;
  sp.shadow.mapSize.set(q.shadow, q.shadow);
  if (sp.shadow.map) { sp.shadow.map.dispose(); sp.shadow.map = null; }
  document.querySelectorAll('#quality, #introQuality').forEach((s) => (s.value = name));
  renderAt(state.t);
}

// ── Look: exposure and image treatment over time ────────────────────────────
function look(t, cam) {
  const L = { exposure: 1.0, bloom: 0.16, halation: 0.05, grain: 0.05, vignette: 0.5, instability: 0.12, ca: 0.0012, threshold: 0.9 };
  const id = cam.shot.id;
  if (t < CUE.glassWide) L.exposure = smooth(CUE.fadeUp, 3.4, t);
  if (cam.scene === 'corridor') { L.bloom = 0.2; L.threshold = 0.8; }
  if (id === '6A') L.instability = lerp(0.12, 0.32, smooth(CUE.disconnect, CUE.finalCrt, t));
  if (id === '6B') { L.instability = 0.36; L.exposure = 1 - 0.15 * smooth(CUE.soundFallaway, CUE.black, t); }
  if (id === '7A') { L.exposure = smooth(81.9, 82.5, t); L.instability = 0.06; L.grain = 0.04; }
  if (cam.scene === 'none' || cam.scene === 'card') { L.grain = 0.025; L.instability = 0; }
  return L;
}

// ── Captions ────────────────────────────────────────────────────────────────
const capEl = document.getElementById('captions');
const capLabel = capEl.querySelector('.label');
const capLine = capEl.querySelector('.line');
let capKey = '';
function updateCaptions(t) {
  let text = '', label = '', op = 0;
  for (const n of NARRATION) {
    if (t < n.start || t >= n.end) continue;
    const life = (t - n.start) / (n.end - n.start);
    op = smooth(n.start, n.start + 0.4, t) * (1 - smooth(n.end - 0.5, n.end, t));
    const chars = [...n.text];
    let keep = chars.length;
    if (n.truncate) keep = Math.ceil(chars.length * lerp(1, n.truncate, smooth(0.35, 0.85, life)));
    const loss = (n.decay || 0) * smooth(0.4, 1.0, life);
    text = chars.slice(0, keep).map((c, i) => (c !== ' ' && hash(i * 3.7 + n.start) < loss ? ' ' : c)).join('');
    label = n.label ? 'THE ALGORITHM' : '';
  }
  const key = text + '|' + label;
  if (key !== capKey) { capLine.textContent = text; capLabel.textContent = label; capKey = key; }
  capEl.style.opacity = op.toFixed(3);
}

// ── Frame render ────────────────────────────────────────────────────────────
const focusV = new THREE.Vector3();
function renderAt(t) {
  t = clamp(t, 0, DURATION);
  const { cam, feeds } = director.update(t);
  const scene = cam.scene === 'station' ? W.station.scene : cam.scene === 'corridor' ? W.corridor.scene : null;

  if (scene) {
    for (const f of feeds) f.render(renderer, scene);
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.look);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
  }
  let focus = 4;
  if (cam.focusDist) focus = cam.focusDist;
  else if (cam.focus) focus = focusV.set(...cam.focus).distanceTo(camera.position);

  const c = cards.update(t);
  const L = look(t, cam);
  const after = t >= CUE.relayEnd;
  post.render(after ? null : scene, camera, {
    ...L, focus, blur: cam.blur || 0, time: t, frame: Math.floor(t * 24),
    cardTexture: cards.texture, cardMix: after ? 0 : c.mix, tear: c.tear,
  });
  updateCaptions(t);
}

// ── Playback state ──────────────────────────────────────────────────────────
const state = { t: clamp(parseFloat(params.get('t')) || 0, 0, DURATION), playing: false, perf0: 0, from: 0, started: false, scrubbing: false };
const $ = (id) => document.getElementById(id);
const ui = { controls: $('controls'), play: $('bPlay'), time: $('time'), scrub: $('scrub'), cc: $('bCC'), mute: $('bMute'),
  rec: $('bRec'), intro: $('intro'), ended: $('ended'), toast: $('toast') };

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
  if (state.playing) {
    state.t = clockTime();
    if (state.t >= DURATION) { renderAt(DURATION); finish(); }
  }
  if (!state.scrubbing) renderAt(state.t);
  if (!state.scrubbing) ui.scrub.value = state.t;
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

function toast(msg, ms = 2200) {
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
  document.body.classList.toggle('nocc', !on);
  ui.cc.setAttribute('aria-pressed', String(on));
}
let captureWanted = params.has('capture');
function setCapture(on) {
  document.body.classList.toggle('capture', on);
  document.body.classList.toggle('nocursor', on);
  if (on) ui.controls.classList.add('hidden'); else showControls();
  $('introCapture').textContent = `Clean capture: ${on || captureWanted ? 'on' : 'off'}`;
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

$('enter').addEventListener('click', () => {
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
$('introQuality').addEventListener('change', (e) => applyQuality(e.target.value));
$('quality').addEventListener('change', (e) => applyQuality(e.target.value));
ui.play.addEventListener('click', toggle);
$('bRestart').addEventListener('click', () => play(0));
ui.cc.addEventListener('click', () => setCaptions(document.body.classList.contains('nocc')));
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
ui.scrub.addEventListener('change', () => {
  state.scrubbing = false;
  seek(parseFloat(ui.scrub.value));
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (!state.started) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); toggle(); }
  else if (k === 'r') play(0);
  else if (k === 'm') setMuted(!audio.muted);
  else if (k === 'c') setCaptions(document.body.classList.contains('nocc'));
  else if (k === 'f') fullscreen();
  else if (k === 'h') setCapture(!document.body.classList.contains('capture'));
  else if (k === 'escape' && document.body.classList.contains('capture')) setCapture(false);
  else if (k === 'arrowright') seek(state.t + (e.shiftKey ? 1 : 5));
  else if (k === 'arrowleft') seek(state.t - (e.shiftKey ? 1 : 5));
  else if (k === '.' && !state.playing) seek(state.t + 1 / 30);
  else if (k === ',' && !state.playing) seek(state.t - 1 / 30);
  pokeControls();
});

// ── Capture: real-time WebM recording and offline soundtrack export ──────────
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
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 24_000_000 });
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => { download(new Blob(chunks, { type: 'video/webm' }), 'please-remain-seen.webm'); recorder = null; ui.rec.classList.remove('on'); };
  recorder.start(1000);
  ui.rec.classList.add('on');
  setCapture(true);
  play(0);
}
function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
ui.rec.addEventListener('click', () => (recorder ? (stopRecording(), pause()) : startRecording()));
$('bWav').addEventListener('click', async () => {
  toast('Rendering soundtrack…', 6000);
  const blob = await audio.renderWav();
  download(blob, 'please-remain-seen-soundtrack.wav');
  toast('Soundtrack saved');
});

// Scriptable hooks for frame-accurate capture (see scripts/render-frames.mjs).
if (params.has("frames")) window.__W = W;
window.PRS = {
  duration: DURATION,
  renderAt: (t) => { state.t = t; renderAt(t); },
  seek, play, pause,
  get time() { return state.t; },
  // Per-second peak / RMS (dBFS) of the offline soundtrack, for checking levels.
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
applyQuality(qName);
if (params.has('frames')) { state.started = true; ui.intro.style.display = 'none'; setCapture(true); }
requestAnimationFrame(loop);
