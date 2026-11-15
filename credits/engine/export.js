// In-browser exporters. Same renderFrame + same sequence as the preview.
//  - PNG cards (opaque or transparent) → one .zip
//  - realtime capture (MediaRecorder: MP4 where the browser supports it, else WebM) with the same audio
//  - sequence.json for the frame-exact local renderer (credits-render/)

import { renderFrame, W, H } from './themes.js';
import { timeline, cardTime } from './sequence.js';
import { renderAudio } from './audio.js';
import { zip } from './zip.js';
import { pad } from './util.js';

export function slugFor(seq) {
  return `stoopid_ep${pad(seq.episode.number)}_credits_${seq.theme}`;
}

function canvas() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; return c;
}

const toBlob = (c, type = 'image/png') => new Promise((res) => c.toBlob(res, type));

/** One still per page, at the moment everything is revealed. */
export async function exportCards(seq, { transparent = false, onProgress } = {}) {
  const c = canvas(), ctx = c.getContext('2d'), tl = timeline(seq), files = [];
  for (let i = 0; i < tl.length; i++) {
    const e = tl[i];
    renderFrame(ctx, seq, cardTime(e), { timeline: tl, transparent });
    const b = await toBlob(c);
    const name = `${pad(i + 1, 2)}_${e.seg.id.replace(/[^a-z0-9]+/gi, '-')}_p${e.pi + 1}${transparent ? '_alpha' : ''}.png`;
    files.push({ name, data: new Uint8Array(await b.arrayBuffer()) });
    onProgress && onProgress((i + 1) / tl.length);
  }
  files.push({ name: 'sequence.json', data: new TextEncoder().encode(JSON.stringify(seq, null, 2)) });
  return new Blob([zip(files)], { type: 'application/zip' });
}

export function pickRecorderType() {
  const MR = globalThis.MediaRecorder;
  if (!MR) return null;
  for (const t of ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MR.isTypeSupported(t)) return t;
  return null;
}

/** Plays the sequence in real time into MediaRecorder. Frames are drawn from the sequence clock,
 *  so content matches the preview; timing precision depends on the machine (use credits-render for frame-exact). */
export async function recordRealtime(seq, { transparent = false, onProgress, signal } = {}) {
  const type = pickRecorderType();
  if (!type) throw new Error('This browser cannot record video (no MediaRecorder).');
  const c = canvas(), ctx = c.getContext('2d'), tl = timeline(seq);
  renderFrame(ctx, seq, 0, { timeline: tl, transparent });
  const stream = c.captureStream(seq.fps);
  let ac = null;
  if (seq.audio) {
    const buf = await renderAudio(seq);
    ac = new AudioContext({ sampleRate: buf.sampleRate });
    const src = ac.createBufferSource(), dest = ac.createMediaStreamDestination();
    src.buffer = buf; src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    ac._src = src;
  }
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));
  rec.start(250);
  const t0 = performance.now() + 60;
  if (ac) ac._src.start(ac.currentTime + 0.06);
  await new Promise((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      if (signal && signal.aborted) return resolve();
      renderFrame(ctx, seq, Math.max(0, t), { timeline: tl, transparent });
      onProgress && onProgress(Math.min(1, t / seq.duration));
      if (t >= seq.duration) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  rec.stop(); await done;
  if (ac) ac.close();
  stream.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), type };
}

export function sequenceBlob(seq) {
  return new Blob([JSON.stringify(seq, null, 2)], { type: 'application/json' });
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
