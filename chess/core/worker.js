// STOOPID CHESS — the engine's Web Worker. One job at a time: { id, fen, moves, opts } → result.
import { Engine } from './engine.js';
import { replay } from './rules.js';

const engine = new Engine();

self.onmessage = e => {
  const { id, fen, moves, opts } = e.data;
  try {
    if (opts && opts.clear) engine.clear();
    const pos = replay(fen, moves);
    const r = engine.search(pos, opts || {});
    self.postMessage({ id, uci: r.uci, score: r.score, depth: r.depth, nodes: r.nodes, mate: r.mate, white: pos.turn === 0 });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
