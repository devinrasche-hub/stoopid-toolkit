// CREDIT AUDIO — the soundtrack is synthesized from the same timeline the pictures use, with
// OfflineAudioContext, so the preview plays the exact buffer the exporter muxes. Seeded; no samples.

import { timeline } from './sequence.js';
import { rng } from './util.js';

export const SAMPLE_RATE = 48000;

export async function renderAudio(seq, sampleRate = SAMPLE_RATE) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext is not available in this browser.');
  const len = Math.ceil(seq.duration * sampleRate);
  const ac = new OAC(2, len, sampleRate);
  const master = ac.createGain(); master.gain.value = 0.8;
  const comp = ac.createDynamicsCompressor();
  master.connect(comp); comp.connect(ac.destination);
  const noise = noiseBuffer(ac, seq.seed);
  const tl = timeline(seq);
  const v = { ac, out: master, noise, seq };

  roomTone(v, 0, seq.duration, seq.theme === 'midnight' ? 0.012 : 0.02);
  for (const e of tl) {
    const kind = e.seg.kind;
    if (kind === 'ident' && e.pi === 0) staticBurst(v, e.start, 1.1);
    if (kind === 'final') finalCue(v, e);
    if (seq.theme === 'terminal') terminalCues(v, e);
    else if (seq.theme === 'midnight') midnightCues(v, e);
    else beansCues(v, e);
  }
  return ac.startRendering();
}

function noiseBuffer(ac, seed) {
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0), r = rng(seed + ':audio');
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(v, t, freq, dur, peak = 0.08, type = 'sine', attack = 0.005) {
  const o = v.ac.createOscillator(), g = v.ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  env(g, t, attack, peak, dur); o.connect(g); g.connect(v.out);
  o.start(t); o.stop(t + attack + dur + 0.05);
  return o;
}

function noiseHit(v, t, dur, peak, freq = 3000, q = 1) {
  const s = v.ac.createBufferSource(), f = v.ac.createBiquadFilter(), g = v.ac.createGain();
  s.buffer = v.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  env(g, t, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(v.out);
  s.start(t, (t * 7.31) % 1.5); s.stop(t + dur + 0.05);
}

function roomTone(v, t0, t1, level) {
  const s = v.ac.createBufferSource(), f = v.ac.createBiquadFilter(), g = v.ac.createGain();
  s.buffer = v.noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 500;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(level, t0 + 1);
  g.gain.setValueAtTime(level, Math.max(t0 + 1, t1 - 1.5)); g.gain.linearRampToValueAtTime(0.0001, t1);
  s.connect(f); f.connect(g); g.connect(v.out); s.start(t0); s.stop(t1);
}

function staticBurst(v, t, dur) {
  const s = v.ac.createBufferSource(), f = v.ac.createBiquadFilter(), g = v.ac.createGain();
  s.buffer = v.noise; f.type = 'highpass'; f.frequency.value = 900;
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(v.out); s.start(t); s.stop(t + dur);
}

function finalCue(v, e) {
  const ec = e.seg.endCard, d = e.end - e.start;
  ec.lines.forEach((ln, i) => tone(v, e.start + ln.at * d, ln.style === 'big' ? 220 : 440 + i * 110, 0.6, ln.style === 'big' ? 0.09 : 0.04, 'sine', 0.01));
  const tc = e.start + ec.cardAt * d;
  tone(v, tc, 110, 2.4, 0.12, 'sine', 0.05);
  tone(v, tc, 165, 2.0, 0.05, 'triangle', 0.05);
}

function itemCount(e) { return e.page.items.length; }

function terminalCues(v, e) {
  const k = e.seg.kind;
  if (k === 'ident' || k === 'final') return;
  tone(v, e.start + 0.02, 1760, 0.05, 0.035, 'square');
  // keyboard clicks while names type (every other character, like the picture)
  e.page.items.forEach((it, i) => {
    const start = e.start + (k === 'creators' ? 0.45 + i * 0.35 : 0.5 + i * 0.16);
    const n = Math.min(String(it.name).length, 24), cps = k === 'creators' ? 30 : 34;
    for (let c = 0; c < n; c += 2) {
      const t = start + c / cps;
      if (t < e.end - 0.05) noiseHit(v, t, 0.018, 0.05, 2500 + ((c * 37 + i * 101) % 1800), 2);
    }
  });
  if (k === 'leaderboard') e.page.items.forEach((_, i) => tone(v, e.start + 0.35 + i * 0.22, 660 + i * 40, 0.04, 0.03, 'square'));
}

function midnightCues(v, e) {
  const k = e.seg.kind;
  if (e.pi === 0) {                                    // low drone per segment
    for (const f of [55, 82.5]) {
      const o = v.ac.createOscillator(), g = v.ac.createGain(), lp = v.ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 240;
      g.gain.setValueAtTime(0.0001, e.segStart); g.gain.linearRampToValueAtTime(0.025, e.segStart + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, e.segEnd);
      o.connect(lp); lp.connect(g); g.connect(v.out); o.start(e.segStart); o.stop(e.segEnd + 0.05);
    }
  }
  if (k !== 'final') { tone(v, e.start + 0.3, 660, 1.6, 0.03, 'sine', 0.02); tone(v, e.start + 0.3, 990, 1.2, 0.015, 'sine', 0.02); }
}

function beansCues(v, e) {
  const k = e.seg.kind;
  if (k === 'ident') { [262, 330, 392, 523].forEach((f, i) => tone(v, e.start + 0.2 + i * 0.12, f, 0.12, 0.05, 'square')); return; }
  if (k === 'final') return;
  if (k === 'leaderboard') {
    e.page.items.forEach((_, i) => {                 // coin per row
      const t = e.start + 0.35 + i * 0.22;
      tone(v, t, 988, 0.06, 0.05, 'square'); tone(v, t + 0.07, 1319, 0.25, 0.05, 'square');
    });
    return;
  }
  const n = itemCount(e);
  for (let i = 0; i < n; i++) tone(v, e.start + 0.3 + i * 0.09, 392 * Math.pow(2, (i % 5) / 12 * 2), 0.07, 0.035, 'square');
}

/** 16-bit PCM WAV. */
export function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
  const out = new ArrayBuffer(44 + n * ch * 2), dv = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return out;
}
