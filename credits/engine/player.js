// CREDITS PLAYER — play / pause / scrub a sequence on a canvas, with the same audio buffer the exporter uses.
// Used by the admin preview and the public archive replay.

import { renderFrame } from './themes.js';
import { timeline } from './sequence.js';
import { renderAudio } from './audio.js';

export class CreditsPlayer {
  constructor(canvas, { onTime, onState } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    canvas.width = 1920; canvas.height = 1080;
    this.onTime = onTime || (() => {}); this.onState = onState || (() => {});
    this.seq = null; this.tl = null; this.t = 0; this.playing = false; this.raf = 0;
    this.ac = null; this.buf = null; this.src = null; this.muted = false; this.audioFor = null;
    this.warnings = new Set();
  }

  load(seq, { keepTime = false } = {}) {
    this.pause();
    this.seq = seq; this.tl = timeline(seq); this.warnings.clear();
    this.buf = null; this.audioFor = null;
    if (!keepTime) this.t = 0;
    this.t = Math.min(this.t, seq.duration);
    this.draw();
  }

  draw() {
    if (!this.seq) return;
    const loc = renderFrame(this.ctx, this.seq, this.t, { timeline: this.tl, onWarn: (w) => this.warnings.add(w) });
    this.onTime(this.t, loc);
  }

  async ensureAudio() {
    if (!this.seq || !this.seq.audio || this.muted) return null;
    if (this.buf && this.audioFor === this.seq) return this.buf;
    this.buf = await renderAudio(this.seq); this.audioFor = this.seq;
    return this.buf;
  }

  async play() {
    if (!this.seq || this.playing) return;
    if (this.t >= this.seq.duration - 0.01) this.t = 0;
    this.playing = true; this.onState(true);
    let buf = null;
    try { buf = await this.ensureAudio(); } catch { buf = null; }
    if (!this.playing) return;
    if (buf) {
      this.ac = this.ac || new AudioContext();
      if (this.ac.state === 'suspended') await this.ac.resume();
      this.src = this.ac.createBufferSource(); this.src.buffer = buf; this.src.connect(this.ac.destination);
      this.startAt = this.ac.currentTime + 0.05; this.src.start(this.startAt, this.t);
      this.clock = () => this.t0 + Math.max(0, this.ac.currentTime - this.startAt);
    } else {
      const p0 = performance.now();
      this.clock = () => this.t0 + (performance.now() - p0) / 1000;
    }
    this.t0 = this.t;
    const step = () => {
      if (!this.playing) return;
      this.t = Math.min(this.clock(), this.seq.duration);
      this.draw();
      if (this.t >= this.seq.duration) { this.pause(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  pause() {
    this.playing = false; cancelAnimationFrame(this.raf);
    if (this.src) { try { this.src.stop(); } catch {} this.src = null; }
    this.onState(false);
  }

  toggle() { return this.playing ? this.pause() : this.play(); }

  seek(t) {
    const was = this.playing;
    if (was) this.pause();
    this.t = Math.max(0, Math.min(t, this.seq ? this.seq.duration : 0));
    this.draw();
    if (was) this.play();
  }

  setMuted(m) { this.muted = m; if (m && this.src) { const was = this.playing; this.pause(); if (was) this.play(); } }
}

export function fmtTime(t) {
  const s = Math.max(0, t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
