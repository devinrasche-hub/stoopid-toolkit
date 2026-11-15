import { CUE, DURATION, NARRATION, WRITE } from './timeline.js';
import { mulberry32 } from './util.js';

// ─────────────────────────────────────────────────────────────────────────────
// Procedural soundtrack. Everything is scheduled from the timeline into any
// BaseAudioContext — the live one, or an OfflineAudioContext for a WAV export.
// Seeking or pausing tears the graph down and reschedules from the new time,
// so playback, scrubbing and export all produce the same sound.
// ─────────────────────────────────────────────────────────────────────────────

// Bed levels over time. The room tone sits a little lower in each copy; the
// hall has its own buzz; after the microwave, nothing until the next door.
const ENV = {
  hum:    [[0, 0.012], [13.8, 0.012], [14.6, 0.006], [16.5, 0.003], [21.9, 0.003], [22, 0.011], [34, 0.011], [37.5, 0.003], [37.6, 0.009], [45.9, 0.009], [46.1, 0.003], [52.98, 0.003], [53, 0], [57.98, 0], [58, 0.007], [107.9, 0.007], [108, 0.012], [111.5, 0.012], [112.3, 0], [120, 0]],
  whine:  [[0, 0.0008], [14.5, 0.0004], [21.9, 0.0004], [22, 0.0008], [52.98, 0.0008], [53, 0], [57.98, 0], [58, 0.0008], [111.5, 0.0008], [112.3, 0], [120, 0]],
  air:    [[0, 0.04], [52.98, 0.04], [53, 0], [57.98, 0], [58, 0.03], [107.9, 0.03], [108.5, 0.045], [111.5, 0.045], [112.5, 0], [120, 0]],
  buzz:   [[0, 0.005], [14.5, 0.0], [21.9, 0], [22, 0.005], [34.5, 0.005], [35, 0], [37.6, 0.005], [45.9, 0.005], [46, 0], [57.98, 0], [58, 0.005], [111.5, 0.005], [112, 0], [120, 0]],
  hall:   [[0, 0], [15.5, 0], [16.5, 0.012], [21.9, 0.012], [22, 0], [35.5, 0], [36.2, 0.012], [37.5, 0.012], [37.6, 0], [45.98, 0], [46.05, 0.014], [52.98, 0.014], [53, 0], [120, 0]],
  drone:  [[0, 0], [22, 0], [28, 0.016], [37.6, 0.02], [46, 0.024], [52.98, 0.024], [53, 0], [58, 0], [66, 0.02], [84, 0.03], [97, 0.04], [104, 0.03], [105.6, 0], [120, 0]],
  snow:   [[0, 0], [103.98, 0], [104.05, 0.035], [105.5, 0.035], [105.7, 0], [120, 0]],
};
// 53–58: after the microwave, nothing, reverb tails included, until the next door.
const GATE = [[0, 1], [52.98, 1], [53.0, 0], [57.94, 0], [57.96, 1], [119.2, 1], [119.9, 0], [120, 0]];

const MOTIF = [659.25, 783.99, 1046.5, 987.77];
const MOTIF_DUR = [0.3, 0.3, 0.3, 0.62];
const lerpN = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

function cueList() {
  const L = [
    [CUE.door1, 'doors', { gain: 0.06, pan: -0.3, dur: 0.7 }],
    [CUE.copy1 + 0.05, 'latch', { gain: 0.05, pan: 0 }],
    [CUE.copy1 + 0.3, 'relay', { gain: 0.06, pan: -0.2 }],
    [CUE.door2 - 0.5, 'doors', { gain: 0.06, pan: 0.2, dur: 0.6 }],
    [CUE.copy2 + 0.05, 'latch', { gain: 0.05, pan: 0 }],
    [CUE.copy2 + 0.3, 'relay', { gain: 0.06, pan: -0.2 }],
    [CUE.beeps, 'microwave', { gain: 0.14, near: true }],
    [CUE.copy3 - 0.02, 'latch', { gain: 0.06, pan: 0 }],
    [CUE.copy3 + 0.3, 'relay', { gain: 0.06, pan: -0.2 }],
    [CUE.four, 'tick', { gain: 0.02, pan: 0.4 }],
    [CUE.again, 'tick', { gain: 0.02, pan: 0.2 }],
    [CUE.snow, 'crackle', { gain: 0.04, pan: 0.4, dur: 1.4 }],
    [CUE.black, 'crtOff', { gain: 0.08, pan: 0.4 }],
    [CUE.tick, 'click', { gain: 0.04, pan: 0 }],
    [CUE.end, 'note', { gain: 0.016, pan: 0 }],
  ];
  // footsteps while walking
  const walks = [[CUE.hall + 0.4, CUE.door1], [CUE.copy1, CUE.copy1 + 2.6], [CUE.cold, CUE.cold + 2.4], [CUE.out2 + 0.2, CUE.door2], [CUE.copy2, CUE.copy2 + 2.6], [CUE.copy2 + 3.2, CUE.copy2 + 5.4], [CUE.out3, CUE.fish], [CUE.copy3, CUE.four]];
  for (const [a, b] of walks) for (let tt = a; tt < b - 0.1; tt += 0.56) L.push([tt, 'step', { gain: 0.045, pan: ((tt * 1.8) | 0) % 2 ? 0.08 : -0.08 }]);
  return L.sort((a, b) => a[0] - b[0]);
}

// ── Buffers ──────────────────────────────────────────────────────────────────
function noiseBuffer(ctx, seconds, color, seed) {
  const rnd = mulberry32(seed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    // short crossfade so the loop is seamless
    const f = Math.min(2048, n >> 2);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
  }
  return buf;
}

function impulse(ctx, seconds, seed, damp = 0.5) {
  const rnd = mulberry32(seed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = Math.pow(1 - t, 3.2);
      const k = 0.85 - damp * 0.8 * t;
      lp = lp * (1 - k) + (rnd() * 2 - 1) * k;
      d[i] = lp * a * (i < 40 ? i / 40 : 1);
    }
  }
  return buf;
}

// ── Engine ──────────────────────────────────────────────────────────────────
export class Soundtrack {
  constructor() {
    this.ctx = null;
    this.live = [];
    this.muted = false;
    this.playing = false;
    this.vo = {};
    this.from = 0;
    this.t0 = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.bus = makeBus(this.ctx, this.ctx.destination);
    this.bus.master.gain.value = this.muted ? 0 : 1;
    this.recordDest = this.ctx.createMediaStreamDestination ? this.ctx.createMediaStreamDestination() : null;
    if (this.recordDest) this.bus.out.connect(this.recordDest);
    return this.ctx;
  }

  // Optional recorded narration: files named after NARRATION ids in `base`.
  async loadVO(base) {
    const ctx = this.ensure();
    if (!ctx) return;
    await Promise.all(NARRATION.map(async (n) => {
      for (const ext of ['mp3', 'wav', 'ogg']) {
        try {
          const r = await fetch(`${base}${n.id}.${ext}`);
          if (!r.ok) continue;
          this.vo[n.id] = await ctx.decodeAudioData(await r.arrayBuffer());
          return;
        } catch (e) { /* not present */ }
      }
    }));
  }

  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  play(from) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopNodes();
    if (ctx.state === 'suspended') ctx.resume();
    this.from = from;
    this.t0 = ctx.currentTime + 0.06;
    this.live = schedule(ctx, this.bus, from, this.t0, this.vo);
    this.playing = true;
  }

  pause() { this.stopNodes(); this.playing = false; }

  stopNodes() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this.live) { try { n.stop(now + 0.01); } catch (e) { /* already stopped */ } }
    if (this.live.gains) for (const g of this.live.gains) { try { g.disconnect(); } catch (e) { /* noop */ } }
    this.live = [];
  }

  // Timeline time according to the audio clock.
  time() {
    if (!this.ctx || !this.playing) return null;
    return this.from + (this.ctx.currentTime - this.t0);
  }

  get running() { return this.ctx && this.ctx.state === 'running'; }

  async renderBuffer(sr = 48000) {
    const off = new OfflineAudioContext(2, sr * DURATION, sr);
    const bus = makeBus(off, off.destination);
    schedule(off, bus, 0, 0, this.vo);
    return off.startRendering();
  }

  async renderWav() {
    return encodeWav(await this.renderBuffer());
  }
}

function makeBus(ctx, destination) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.35;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  const out = ctx.createGain();
  out.gain.value = 0.8;
  const gate = ctx.createGain();
  master.connect(gate); gate.connect(comp); comp.connect(lim); lim.connect(out); out.connect(destination);

  const room = ctx.createConvolver(); room.buffer = impulse(ctx, 1.6, 101, 0.5);
  const hall = ctx.createConvolver(); hall.buffer = impulse(ctx, 4.2, 202, 0.7);
  const roomRet = ctx.createGain(); roomRet.gain.value = 0.35;
  const hallRet = ctx.createGain(); hallRet.gain.value = 0.42;
  room.connect(roomRet); roomRet.connect(master);
  hall.connect(hallRet); hallRet.connect(master);
  const vast = ctx.createConvolver(); vast.buffer = impulse(ctx, 7.5, 303, 0.85);
  const vastRet = ctx.createGain(); vastRet.gain.value = 0.5;
  vast.connect(vastRet); vastRet.connect(master);

  const buffers = {
    white: noiseBuffer(ctx, 4, 'white', 7),
    pink: noiseBuffer(ctx, 6, 'pink', 8),
    brown: noiseBuffer(ctx, 8, 'brown', 9),
  };
  return { master, gate, out, room, hall, vast, buffers };
}

function schedule(ctx, bus, from, t0, vo) {
  const nodes = [];
  nodes.gains = [];
  const at = (t) => t0 + Math.max(0, t - from);
  const endT = at(DURATION) + 0.2;

  const envelope = (param, keys) => {
    let v0 = keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (from >= ta && from <= tb) { v0 = tb > ta ? va + (vb - va) * (from - ta) / (tb - ta) : vb; break; }
      if (from > tb) v0 = vb;
    }
    param.setValueAtTime(v0, t0);
    for (const [t, v] of keys) if (t > from) param.linearRampToValueAtTime(v, at(t));
  };
  const gain = (v = 1, dest = bus.master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); nodes.gains.push(g); return g; };
  const osc = (type, freq, dest, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(dest); o.start(t0); o.stop(endT); nodes.push(o); return o;
  };
  const loop = (buf, dest, rate = 1) => {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.connect(dest); s.start(t0, (from * 0.37) % buf.duration); s.stop(endT); nodes.push(s); return s;
  };
  const filter = (type, f, Q = 0.7, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.connect(dest); return b; };
  const panner = (p, dest) => { const s = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (!s) return dest; s.pan.value = p; s.connect(dest); return s; };

  // ── Beds ──
  envelope(bus.gate.gain, GATE);
  { // the sets' hum
    const g = gain(0); envelope(g.gain, ENV.hum);
    const lp = filter('lowpass', 700, 0.5, g);
    [[60, 'sine', 0.5, 0], [120, 'sine', 0.34, 3], [180, 'triangle', 0.1, -4]].forEach(([f, ty, a, d]) => osc(ty, f, gain(a, lp), d));
  }
  { const g = gain(0); envelope(g.gain, ENV.whine); osc('sine', 15734, g); }
  { // the air handler, a small hard room
    const g = gain(0); envelope(g.gain, ENV.air);
    g.connect(gain(0.3, bus.room));
    loop(bus.buffers.brown, filter('bandpass', 220, 0.7, g), 0.8);
    loop(bus.buffers.pink, filter('bandpass', 1800, 0.5, gain(0.1, g)), 0.6);
  }
  { // the desk lamp's ballast, very close
    const g = gain(0); envelope(g.gain, ENV.buzz);
    const bp = filter('bandpass', 240, 3, g);
    osc('sawtooth', 120, gain(0.5, bp)); osc('square', 240, gain(0.15, bp), 4);
  }
  { // pressure
    const g = gain(0); envelope(g.gain, ENV.drone);
    const lp = filter('lowpass', 140, 0.5, g);
    osc('sine', 36.71, gain(0.6, lp)); osc('sine', 38.89, gain(0.5, lp));
  }
  { // the hall's tube, a different buzz
    const g = gain(0); envelope(g.gain, ENV.hall);
    const bp = filter('bandpass', 360, 2, g);
    osc('sawtooth', 120, gain(0.4, bp), 7); osc('square', 360, gain(0.1, bp));
    g.connect(gain(0.4, bus.hall));
  }
  { // snow on the fourth monitor
    const g = gain(0); envelope(g.gain, ENV.snow);
    loop(bus.buffers.white, filter('bandpass', 3000, 0.6, panner(0.4, g)), 1);
  }

  // ── One-shots ──
  const W = bus.buffers.white;
  const burst = (t, dur, dest, { rate = 1, offset = 0 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = W; s.playbackRate.value = rate;
    s.connect(dest); s.start(t, offset % (W.duration - dur - 0.01), dur); nodes.push(s); return s;
  };
  const envGain = (dest, t, a, peak, d) => {
    const g = ctx.createGain(); g.connect(dest); nodes.gains.push(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  };
  const tone = (t, f, dest, { type = 'sine', a = 0.003, d = 0.3, peak = 1, f2 = null } = {}) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    o.connect(envGain(dest, t, a, peak, d)); o.start(t); o.stop(t + a + d + 0.05); nodes.push(o);
  };

  const FX = {
    relay(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const verb = o.dry ? null : gain(o.gain * 0.3, bus.room);
      [0, 0.017].forEach((dt, i) => {
        const bp = filter('bandpass', i ? 1300 : 2100, 6, envGain(p, t + dt, 0.0005, i ? 0.6 : 1, 0.03));
        burst(t + dt, 0.04, bp, { offset: 0.3 + i });
        tone(t + dt, i ? 900 : 1600, p, { d: 0.035, peak: 0.25 });
        if (verb) burst(t + dt, 0.03, filter('bandpass', 1800, 3, envGain(verb, t + dt, 0.0005, 1, 0.02)), { offset: 1.1 });
      });
    },
    crtOn(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 70, p, { d: 0.5, peak: 0.6, f2: 38 });
      const am = gain(0, p);
      am.gain.setValueAtTime(0, t); am.gain.linearRampToValueAtTime(0.2, t + 0.15); am.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      const o1 = ctx.createOscillator(); o1.frequency.value = 60; o1.connect(am); o1.start(t); o1.stop(t + 1.3); nodes.push(o1);
      burst(t + 0.05, 0.6, filter('bandpass', 4200, 0.8, envGain(p, t + 0.05, 0.01, 0.35, 0.5)), { offset: 0.7 });
      tone(t + 0.1, 11000, p, { d: 0.6, peak: 0.01, f2: 15700, a: 0.2 });
    },
    crtOff(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      burst(t, 0.03, filter('lowpass', 900, 0.7, envGain(p, t, 0.001, 1, 0.05)), { offset: 2.2 });
      tone(t, 15600, p, { d: 0.4, peak: 0.012, f2: 5000 });
      burst(t + 0.02, 0.3, filter('bandpass', 3500, 1, envGain(p, t + 0.02, 0.005, 0.25, 0.25)), { offset: 1.7 });
      tone(t, 60, p, { d: 0.35, peak: 0.4, f2: 35 });
      const v = gain(o.gain * 0.4, bus.room);
      burst(t, 0.05, filter('bandpass', 1200, 1, envGain(v, t, 0.001, 1, 0.05)), { offset: 2.9 });
    },
    metal(t, o) {
      const dry = gain(o.gain * 0.35);
      const p = panner(o.pan || 0, dry);
      const wet = gain(o.gain * 1.1, bus.hall);
      const lp = filter('lowpass', o.far ? 520 : 800, 0.7, p); lp.connect(wet);
      [87, 141, 213.5, 379, 561, 822].forEach((f, i) => tone(t + i * 0.004, f, lp, { d: 2.2 + (i % 3), peak: 0.22 / (1 + i * 0.4), f2: f * 0.985 }));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.connect(envGain(lp, t + 0.1, 0.25, 0.4, 1.4));
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(260, t + 1.6);
      burst(t + 0.1, 1.7, bp, { offset: 0.4, rate: 0.6 });
    },
    creak(t, o) {
      const p0 = panner(o.pan || 0, gain(o.gain));
      const p = o.far ? filter('lowpass', 900, 0.6, p0) : p0;
      const v = gain(o.gain * 0.5, bus.room);
      const len = o.len || 1.6;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 12; bp.connect(p); bp.connect(v);
      bp.frequency.setValueAtTime(410, t); bp.frequency.linearRampToValueAtTime(330, t + len);
      const g = ctx.createGain(); g.connect(bp); nodes.gains.push(g);
      g.gain.setValueAtTime(0, t);
      const rnd = mulberry32(Math.floor(t * 100));
      for (let k = 0; k < len * 9; k++) { const tk = t + k / 9 + rnd() * 0.05; g.gain.setTargetAtTime(rnd() * 0.8, tk, 0.03); }
      g.gain.setTargetAtTime(0, t + len, 0.1);
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = 38; s.connect(g); s.start(t); s.stop(t + len + 0.6); nodes.push(s);
    },
    behind(t, o) {
      // Cloth and a soft weight shift, placed behind the listener with HRTF.
      const g = gain(o.gain);
      let dest = g, pn = null;
      if (ctx.createPanner) {
        pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1;
        pn.connect(g);
        const set = (p, v, tt) => { if (p && p.linearRampToValueAtTime) { p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, tt); } };
        if (pn.positionX) {
          pn.positionX.setValueAtTime(o.from, t); pn.positionY.setValueAtTime(0, t); pn.positionZ.setValueAtTime(1.4, t);
          set(pn.positionX, o.to, t + o.dur);
        } else pn.setPosition(o.from, 0, 1.4);
        dest = pn;
      }
      const bp = filter('bandpass', 2300, 0.9, dest);
      const rnd = mulberry32(Math.floor(t * 31));
      const steps = Math.round(o.dur * 2.2);
      for (let k = 0; k < steps; k++) {
        const tk = t + (k / steps) * o.dur + rnd() * 0.1;
        burst(tk, 0.35, filter('bandpass', 1800 + rnd() * 1400, 0.8, envGain(bp, tk, 0.08, 0.5 + rnd() * 0.3, 0.25)), { offset: rnd() * 3 });
        tone(tk + 0.05, 95 + rnd() * 20, dest, { d: 0.18, peak: 0.25, f2: 70 });
      }
    },
    tick(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 1500, p, { d: 0.03, peak: 0.6 });
      burst(t, 0.02, filter('highpass', 3000, 0.7, envGain(p, t, 0.0005, 0.4, 0.015)), { offset: 0.9 });
    },
    chime(t, o) {
      const g = gain(o.gain);
      tone(t, 1318.5, g, { d: 1.1, peak: 1 });
      tone(t, 2637, g, { d: 0.6, peak: 0.28 });
      tone(t, 3955.5, g, { d: 0.25, peak: 0.08 });
    },
    tear(t, o) {
      const g = gain(o.gain);
      const v = gain(o.gain * 0.25, bus.room);
      const rnd = mulberry32(4242);
      const dur = o.dur * 0.55;
      const n = 70;
      for (let k = 0; k < n; k++) {
        const tk = t + (k / n) * dur + rnd() * 0.01;
        const f = 1400 + rnd() * 2600;
        const bp = filter('bandpass', f, 1.2, envGain(g, tk, 0.001, 0.4 + rnd() * 0.6, 0.012 + rnd() * 0.02));
        bp.connect(v);
        burst(tk, 0.04, bp, { offset: rnd() * 3 });
      }
      // the two halves pulling away
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.connect(envGain(g, t + dur * 0.8, 0.15, 0.35, o.dur * 0.6));
      lp.frequency.setValueAtTime(2500, t + dur * 0.8); lp.frequency.exponentialRampToValueAtTime(300, t + o.dur * 1.2);
      burst(t + dur * 0.8, o.dur, lp, { offset: 1.3 });
    },
    clunk(t, o) {
      FX.relay(t, { gain: o.gain * 0.8, pan: o.pan });
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t + 0.01, 72, p, { d: 0.3, peak: 0.7, f2: 48 });
      tone(t + 0.01, 880, p, { d: 0.08, peak: 0.12 });
    },
    sag(t, o) {
      const g = gain(o.gain);
      tone(t, 120, g, { type: 'triangle', a: 0.05, d: 0.9, peak: 0.25, f2: 96 });
    },
    ballast(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 2400, p, { d: 0.06, peak: 0.25 });
      burst(t, 0.04, filter('bandpass', 3000, 2, envGain(p, t, 0.0005, 0.4, 0.03)), { offset: 2.4 });
      const h = gain(o.gain * 0.5, bus.hall);
      tone(t, 120, h, { type: 'sawtooth', d: 0.6, peak: 0.05, f2: 100 });
    },
    melody(t, o) {
      // voice: 'crt' tinny speaker · 'phone' cheap hold music · 'muzak' elevator
      const out = panner(o.pan || 0, gain(o.gain));
      let dest = out;
      if (o.voice === 'crt') dest = filter('bandpass', 1500, 1.4, out);
      if (o.voice === 'phone') { const lp = filter('lowpass', 3200, 0.7, out); dest = filter('highpass', 380, 0.7, lp); }
      if (o.voice === 'muzak') { dest = filter('lowpass', 1600, 0.6, out); dest.connect(gain(o.gain * 3, bus.hall)); }
      if (o.voice === 'under') { dest = filter('lowpass', 900, 0.5, out); }
      const oct = o.octave || 1, sl = o.slow || 1;
      let tt = t;
      for (let i = 0; i < o.notes; i++) {
        const f = MOTIF[i] * oct * (o.voice === 'muzak' || o.voice === 'under' ? 0.5 : 1);
        const d = MOTIF_DUR[i] * sl;
        const type = o.voice === 'muzak' || o.voice === 'under' ? 'triangle' : 'square';
        tone(tt, f, dest, { type, a: 0.008, d: d * 0.95, peak: o.voice === 'muzak' ? 0.8 : 0.45 });
        if (o.voice === 'phone') tone(tt, f * 2.0, dest, { type: 'triangle', a: 0.005, d: d * 0.5, peak: 0.12 });
        tt += d;
      }
    },
    note(t, o) {
      // a single note of the motif from far away
      const out = panner(o.pan || 0, gain(o.gain));
      out.connect(gain(o.gain * 4, bus.vast));
      const bp = filter('bandpass', 1300, 1.2, out);
      tone(t, MOTIF[0], bp, { type: 'square', a: 0.01, d: 0.5, peak: 0.4 });
    },
    rewind(t, o) {
      // tape winding back: a thin rising squeal under static
      const g = gain(o.gain);
      const bp = filter('bandpass', 3000, 3, g);
      const os = ctx.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(900, t); os.frequency.exponentialRampToValueAtTime(4200, t + o.dur);
      os.connect(envGain(bp, t, 0.05, 0.5, o.dur)); os.start(t); os.stop(t + o.dur + 0.1); nodes.push(os);
    },
    choir(t, o) {
      // the watchers hum his hold melody back, slowly, once: many voices, no words.
      // Sawtooth through two vowel formants ("oo"), two octaves down, a little apart.
      const out = gain(o.gain);
      out.connect(gain(o.gain * 3.5, bus.vast));
      const f1 = filter('bandpass', 400, 1.3, out), f2 = filter('bandpass', 850, 2.2, gain(0.4, out));
      const lp = filter('lowpass', 1300, 0.5, f1); lp.connect(f2); lp.connect(gain(0.18, out));
      const rnd = mulberry32(88);
      const dur = [2.1, 2.1, 2.1, 3.6];
      for (let v = 0; v < 9; v++) {
        let tt = t + rnd() * 0.25;
        const det = (rnd() - 0.5) * 22;
        const pan = panner((rnd() - 0.5) * 1.4, lp);
        for (let i = 0; i < 4; i++) {
          const f = MOTIF[i] * 0.25 * (v % 3 === 2 ? 2 : 1);
          const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f; os.detune.value = det;
          const vib = ctx.createOscillator(); vib.frequency.value = 4.6 + rnd(); const vg = ctx.createGain(); vg.gain.value = f * 0.006;
          vib.connect(vg); vg.connect(os.frequency);
          const d = dur[i];
          const e = ctx.createGain(); e.connect(pan); nodes.gains.push(e);
          e.gain.setValueAtTime(0, tt); e.gain.linearRampToValueAtTime(0.11, tt + 0.5); e.gain.linearRampToValueAtTime(0.09, tt + d - 0.3); e.gain.linearRampToValueAtTime(0, tt + d + 0.25);
          os.connect(e); os.start(tt); os.stop(tt + d + 0.3); vib.start(tt); vib.stop(tt + d + 0.3); nodes.push(os, vib);
          tt += d;
        }
      }
    },
    behindClick(t, o) {
      // a small electrical click placed behind the listener
      const g = gain(o.gain);
      let dest = g;
      if (ctx.createPanner) {
        const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.refDistance = 1; pn.connect(g);
        if (pn.positionX) { pn.positionX.value = o.from; pn.positionY.value = 0.6; pn.positionZ.value = 1.6; } else pn.setPosition(o.from, 0.6, 1.6);
        dest = pn;
      }
      burst(t, 0.02, filter('bandpass', 2600, 4, envGain(dest, t, 0.0005, 1, 0.02)), { offset: 0.5 });
      tone(t, 1800, dest, { d: 0.03, peak: 0.3 });
      tone(t + 0.03, 100, dest, { type: 'sawtooth', a: 0.05, d: 1.4, peak: 0.04 });
    },
    latch(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      [0, 0.06].forEach((dt, i) => {
        burst(t + dt, 0.03, filter('bandpass', i ? 1100 : 2200, 3, envGain(p, t + dt, 0.0005, 1, 0.04)), { offset: 1.2 + i });
        tone(t + dt, i ? 420 : 760, p, { d: 0.05, peak: 0.25 });
      });
    },
    thud(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 62, p, { d: 0.35, peak: 0.8, f2: 40 });
      burst(t, 0.08, filter('lowpass', 500, 0.7, envGain(p, t, 0.002, 0.5, 0.1)), { offset: 2.0 });
    },
    contactor(t, o) {
      // heavy elevator contactor: two hard clicks and a low thunk
      const p = panner(o.pan || 0, gain(o.gain));
      p.connect(gain(o.gain * 0.3, bus.room));
      [0, 0.024].forEach((dt, i) => burst(t + dt, 0.03, filter('bandpass', i ? 900 : 1700, 3, envGain(p, t + dt, 0.0005, 1, 0.05)), { offset: 0.8 + i }));
      tone(t, 80, p, { d: 0.25, peak: 0.7, f2: 52 });
    },
    doors(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.connect(envGain(p, t, 0.2, 0.7, o.dur));
      bp.frequency.setValueAtTime(240, t); bp.frequency.linearRampToValueAtTime(330, t + o.dur);
      burst(t, o.dur + 0.3, bp, { offset: 0.3, rate: 0.5 });
      tone(t + o.dur - 0.05, 95, p, { d: 0.18, peak: 0.5, f2: 70 });
    },
    floor(t, o) {
      const p = panner(0, gain(o.gain));
      tone(t, 58, p, { d: 0.22, peak: 0.6, f2: 45 });
      burst(t, 0.03, filter('bandpass', 1400, 3, envGain(p, t, 0.0005, 0.5, 0.03)), { offset: 1.7 });
    },
    ring(t, o) {
      // one ring: a bell struck at 20 Hz, about 1.4 s
      const p = panner(o.pan || 0, gain(o.gain));
      p.connect(gain(o.gain * 0.5, bus.hall));
      const am = ctx.createGain(); am.gain.value = 0; am.connect(p); nodes.gains.push(am);
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 20;
      const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.02);
      env.gain.setValueAtTime(1, t + 1.3); env.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
      env.connect(am); nodes.gains.push(env);
      [1040, 1270, 2090].forEach((f, i) => {
        const oo = ctx.createOscillator(); oo.frequency.value = f; const og = ctx.createGain(); og.gain.value = [0.5, 0.35, 0.12][i];
        oo.connect(og); og.connect(env); oo.start(t); oo.stop(t + 1.8); nodes.push(oo);
      });
      lfo.start(t); lfo.stop(t + 1.8); nodes.push(lfo);
      am.gain.setValueAtTime(0.5, t);
    },
    clack(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      burst(t, 0.04, filter('bandpass', 1900, 2, envGain(p, t, 0.0005, 1, 0.05)), { offset: 2.6 });
      tone(t, 300, p, { d: 0.06, peak: 0.3, f2: 220 });
    },
    crackle(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const rnd = mulberry32(Math.floor(t * 77));
      for (let k = 0; k < o.dur * 30; k++) {
        const tk = t + rnd() * o.dur;
        burst(tk, 0.01, filter('highpass', 3500, 0.7, envGain(p, tk, 0.0005, rnd(), 0.008)), { offset: rnd() * 3 });
      }
    },
    structure(t, o) {
      // a large, distant structural groan; behind the listener or far off in the chamber
      const g = gain(o.gain);
      let dest = g;
      if (o.behind && ctx.createPanner) {
        const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.connect(g);
        if (pn.positionX) { pn.positionX.value = 0.3; pn.positionY.value = 0; pn.positionZ.value = 3; } else pn.setPosition(0.3, 0, 3);
        dest = pn;
      } else dest = panner(o.pan || 0, g);
      dest.connect(gain(o.gain * (o.vast ? 2.2 : 1.2), o.vast ? bus.vast : bus.hall));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.connect(envGain(dest, t, 0.4, 0.8, 1.6));
      bp.frequency.setValueAtTime(140, t); bp.frequency.linearRampToValueAtTime(96, t + 1.9);
      const sw = ctx.createOscillator(); sw.type = 'sawtooth'; sw.frequency.setValueAtTime(31, t); sw.frequency.linearRampToValueAtTime(24, t + 2);
      sw.connect(bp); sw.start(t); sw.stop(t + 2.2); nodes.push(sw);
      burst(t + 0.2, 1.6, filter('lowpass', 300, 0.7, envGain(dest, t + 0.2, 0.5, 0.4, 1.0)), { offset: 0.9, rate: 0.4 });
    },
    swell(t, o) {
      const g = gain(o.gain);
      const lp = filter('lowpass', 160, 0.6, envGain(g, t, o.dur * 0.6, 1, o.dur * 0.8));
      tone(t, 49, lp, { a: o.dur * 0.6, d: o.dur, peak: 0.8 });
      burst(t, o.dur * 1.4, lp, { offset: 1.5, rate: 0.3 });
    },
    lure(t, o) {
      // the bright screen: a thin rising tone that stops when it is blocked
      const g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain, Math.max(t + 0.01, at(o.until) - 0.06));
      g.gain.linearRampToValueAtTime(0, at(o.until));
      const oo = ctx.createOscillator(); oo.type = 'triangle';
      oo.frequency.setValueAtTime(880, t); oo.frequency.exponentialRampToValueAtTime(1760, at(o.until));
      oo.connect(filter('bandpass', 1400, 1.0, g)); oo.start(t); oo.stop(at(o.until) + 0.05); nodes.push(oo);
    },
    switch(t, o) {
      // one deliberate mechanical movement. No boom.
      const p = panner(o.pan || 0, gain(o.gain));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.connect(envGain(p, t - 0.18, 0.15, 0.25, 0.2));
      bp.frequency.setValueAtTime(900, t - 0.18); bp.frequency.linearRampToValueAtTime(600, t);
      burst(t - 0.18, 0.35, bp, { offset: 0.2 });
      [0, 0.012].forEach((dt, i) => burst(t + dt, 0.03, filter('bandpass', i ? 800 : 1500, 3, envGain(p, t + dt, 0.0005, 1, 0.06)), { offset: 1.9 + i }));
      tone(t, 70, p, { d: 0.3, peak: 0.7, f2: 46 });
    },
    click(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      if (o.vast) p.connect(gain(o.gain * 1.4, bus.vast));
      burst(t, 0.02, filter('bandpass', 2400, 4, envGain(p, t, 0.0005, 1, 0.02)), { offset: 0.6 });
      tone(t, 1500, p, { d: 0.025, peak: 0.25 });
    },
    bird(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      p.connect(gain(o.gain * 0.4, bus.room));
      [0, 0.16, 0.3].forEach((dt, i) => {
        const oo = ctx.createOscillator(); oo.type = 'sine';
        const f0 = [3100, 3500, 2900][i];
        oo.frequency.setValueAtTime(f0, t + dt); oo.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + dt + 0.06);
        oo.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + dt + 0.11);
        oo.connect(envGain(p, t + dt, 0.005, 0.6, 0.1)); oo.start(t + dt); oo.stop(t + dt + 0.16); nodes.push(oo);
      });
    },
    knock(t, o) {
      // knuckles on a door, heard from the other side of a wall
      const p = panner(o.pan || 0, gain(o.gain));
      const lp = filter('lowpass', 900, 0.7, p);
      tone(t, 118, lp, { d: 0.16, peak: 0.9, f2: 92 });
      tone(t, 236, lp, { d: 0.07, peak: 0.25 });
      burst(t, 0.03, filter('bandpass', 700, 1.2, envGain(lp, t, 0.001, 0.6, 0.05)), { offset: 1.4 });
    },
    beep(t, o) { const p = panner(o.pan || 0, gain(o.gain)); tone(t, 2100, p, { d: 0.09, peak: 0.6 }); },
    latchTurn(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.connect(envGain(p, t, 0.2, 0.45, 0.9));
      bp.frequency.setValueAtTime(1400, t); bp.frequency.linearRampToValueAtTime(900, t + 1.1);
      burst(t, 1.2, bp, { offset: 0.9, rate: 0.6 });
      burst(t + 1.15, 0.03, filter('bandpass', 1800, 3, envGain(p, t + 1.15, 0.0005, 1, 0.05)), { offset: 2.2 });
    },
    clickBurst(t, o) {
      // every screen behind us, clicking at once — relays, not voices
      const rnd = mulberry32(911);
      const end = at(o.until);
      let tk = t;
      while (tk < end - 0.01) {
        const k = (tk - t) / Math.max(0.1, end - t);
        const g = gain(o.gain * (0.4 + 0.6 * k));
        let dest = g;
        if (ctx.createPanner) {
          const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.connect(g);
          const a = rnd() * Math.PI * 2;
          if (pn.positionX) { pn.positionX.value = Math.sin(a) * 2; pn.positionY.value = rnd() - 0.3; pn.positionZ.value = 1.0 + Math.abs(Math.cos(a)) * 2; } else pn.setPosition(Math.sin(a) * 2, 0, 2);
          dest = pn;
        }
        burst(tk, 0.025, filter('bandpass', 1400 + rnd() * 1600, 4, envGain(dest, tk, 0.0005, 1, 0.02)), { offset: rnd() * 3 });
        tk += lerpN(0.16, 0.012, k) * (0.6 + rnd() * 0.8);
      }
    },
    step(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const lp = filter('lowpass', 420, 0.7, p);
      tone(t, 70, lp, { d: 0.12, peak: 0.6, f2: 55 });
      burst(t, 0.09, filter('bandpass', 380, 0.8, envGain(lp, t, 0.01, 0.4, 0.08)), { offset: 2.7 });
    },
    chair(t, o) {
      FX.creak(t, { gain: o.gain * 0.8, pan: o.pan, len: 0.7 });
      FX.rustle(t + 0.05, { gain: o.gain * 0.6, pan: o.pan, dur: 0.6 });
      FX.step(t + 0.35, { gain: o.gain * 0.5, pan: o.pan });
    },
    rustle(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const rnd = mulberry32(Math.floor(t * 13));
      for (let k = 0; k < o.dur * 10; k++) {
        const tk = t + rnd() * o.dur;
        burst(tk, 0.12, filter('bandpass', 2400 + rnd() * 1800, 0.8, envGain(p, tk, 0.03, 0.3 + rnd() * 0.5, 0.1)), { offset: rnd() * 3 });
      }
    },
    breath(t, o) {
      // in … out, slow, small
      const p = panner(o.pan || 0, gain(o.gain));
      const bp1 = filter('bandpass', 1300, 0.7, envGain(p, t, 0.6, 0.6, 0.6));
      burst(t, 1.3, bp1, { offset: 0.4 + (t % 1), rate: 0.9 });
      const bp2 = filter('bandpass', 900, 0.7, envGain(p, t + 1.4, 0.3, 0.8, 1.1));
      burst(t + 1.4, 1.5, bp2, { offset: 1.9 + (t % 1), rate: 0.8 });
    },
    house(t, o) {
      // a house settling: one low, dry creak
      const p = panner(o.pan || 0, gain(o.gain));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14; bp.connect(envGain(p, t, 0.15, 0.9, 0.8));
      bp.frequency.setValueAtTime(190, t); bp.frequency.linearRampToValueAtTime(160, t + 0.9);
      const sw = ctx.createOscillator(); sw.type = 'sawtooth'; sw.frequency.value = 42; sw.connect(bp); sw.start(t); sw.stop(t + 1.1); nodes.push(sw);
    },
    page(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.connect(envGain(p, t, 0.08, 0.8, 0.35));
      bp.frequency.setValueAtTime(2600, t); bp.frequency.linearRampToValueAtTime(4200, t + 0.3);
      burst(t, 0.45, bp, { offset: 2.4 });
      burst(t + 0.38, 0.05, filter('bandpass', 1800, 1.5, envGain(p, t + 0.38, 0.002, 0.5, 0.05)), { offset: 1.1 });
    },
    clock(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      burst(t, 0.012, filter('bandpass', 3200, 5, envGain(p, t, 0.0005, 1, 0.01)), { offset: 0.33 });
    },
    microwave(t, o) {
      // far down the hall behind you: three beeps, and the room they're in
      const g = gain(o.gain);
      let dest = g;
      if (ctx.createPanner && !o.near) {
        const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1; pn.connect(g);
        if (pn.positionX) { pn.positionX.value = 0.9; pn.positionY.value = 0; pn.positionZ.value = 4; } else pn.setPosition(0.9, 0, 4);
        dest = pn;
      }
      const lp = filter('lowpass', 2600, 0.7, dest);
      lp.connect(gain(o.gain * 2.2, bus.hall));
      for (let k = 0; k < 3; k++) {
        const tk = t + k * 0.62;
        tone(tk, 2050, lp, { type: 'square', a: 0.004, d: 0.3, peak: 0.22 });
        tone(tk, 4100, lp, { type: 'sine', a: 0.004, d: 0.18, peak: 0.05 });
      }
    },
    marker(t, o) {
      // felt tip on laminate: a short dry squeak
      const p = panner(o.pan || 0, gain(o.gain));
      const rnd = mulberry32(31 + o.seed * 7);
      const n = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const tk = t + (k / n) * o.dur * 0.9;
        const d = o.dur * (0.25 + rnd() * 0.2);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.connect(envGain(p, tk, 0.01, 0.6 + rnd() * 0.4, d));
        const f0 = 2600 + rnd() * 1600;
        bp.frequency.setValueAtTime(f0, tk); bp.frequency.linearRampToValueAtTime(f0 * (0.85 + rnd() * 0.3), tk + d);
        burst(tk, d + 0.05, bp, { offset: rnd() * 3 });
        burst(tk, d, filter('highpass', 5000, 0.7, envGain(p, tk, 0.005, 0.2, d)), { offset: rnd() * 3 });
      }
    },
    whoosh(t, o) {
      // a share leaving: air, sweeping up and away
      const p = panner(o.pan || 0, gain(o.gain));
      p.connect(gain(o.gain * 0.6, bus.room));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.connect(envGain(p, t, 0.25, 0.8, 0.45));
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.6);
      burst(t, 0.8, bp, { offset: 1.2 });
    },
    roll(t, o) {
      // a trackball rolled against its will: a low, grainy rumble in pushes
      const p = panner(o.pan || 0, gain(o.gain));
      const rnd = mulberry32(55);
      for (let k = 0; k < o.dur * 4; k++) {
        const tk = t + k / 4 + rnd() * 0.08;
        burst(tk, 0.3, filter('bandpass', 260 + rnd() * 200, 1.2, envGain(p, tk, 0.05, 0.4 + rnd() * 0.5, 0.2)), { offset: rnd() * 3, rate: 0.5 });
      }
    },
    cut() {},
  };

  for (const [t, kind, o] of cueList()) {
    if (t < from - 0.01) continue;
    FX[kind](at(t), o);
  }

  // Recorded narration, if provided
  for (const n of NARRATION) {
    const buf = vo[n.id];
    if (!buf || n.start + buf.duration < from) continue;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = gain(0.95); s.connect(g);
    const r = gain(0.12, bus.room); s.connect(r);
    const offset = Math.max(0, from - n.start);
    s.start(at(n.start), offset);
    nodes.push(s);
  }
  return nodes;
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const ab = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}
