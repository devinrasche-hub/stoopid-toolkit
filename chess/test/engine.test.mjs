import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, evaluate, MATE } from '../core/engine.js';
import { settingsFor, LEVELS } from '../core/levels.js';
import { Position, replay, START_FEN } from '../core/rules.js';

const engine = new Engine();
const best = (fen, opts) => engine.search(new Position(fen), opts);

test('start position is roughly level', () => {
  assert.ok(Math.abs(evaluate(new Position())) < 30);
  // Mirror symmetry: the same position with colors swapped scores the same for the side to move.
  const a = new Position('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  const b = new Position('rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 2 3');
  assert.equal(evaluate(a), evaluate(b));
});

test('finds mate in one', () => {
  const r = best('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { depth: 4 });
  assert.equal(r.uci, 'a1a8');
  assert.equal(r.mate, 1);
});

test('finds mate in two', () => {
  // 1.Nf6+ gxf6 2.Bxf7#
  const r = best('r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1', { depth: 6 });
  assert.equal(r.mate, 2);
  assert.equal(r.uci, 'd5f6');
});

test('takes a free queen and saves its own', () => {
  assert.equal(best('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', { depth: 4 }).uci, 'd1d5');
  const r = best('4k3/8/8/8/8/2n5/8/3QK3 w - - 0 1', { depth: 4 });
  const pos = new Position('4k3/8/8/8/8/2n5/8/3QK3 w - - 0 1');
  pos.make(pos.moveFromUci(r.uci));
  // After our move the knight can't win the queen for nothing.
  const reply = engine.search(pos, { depth: 4 });
  assert.ok(reply.score < 300, 'black should not be winning big');
});

test('sees stalemate as a draw, not a win', () => {
  // White to move: Qb6?? is stalemate. The engine should find a real mate instead.
  const r = best('k7/8/2Q5/8/8/8/8/K7 w - - 0 1', { depth: 6 });
  const pos = new Position('k7/8/2Q5/8/8/8/8/K7 w - - 0 1');
  pos.make(pos.moveFromUci(r.uci));
  assert.notEqual(pos.status().reason, 'stalemate');
  assert.ok(r.score > 500);
});

test('respects the time budget', () => {
  const t0 = Date.now();
  const r = engine.search(new Position(), { timeMs: 400 });
  const took = Date.now() - t0;
  assert.ok(took < 900, `took ${took}ms`);
  console.log(`start position, 400ms: depth ${r.depth}, ${r.nodes} nodes (${Math.round(r.nodes / took)}k nps)`);
  assert.ok(r.depth >= 4, `reached depth ${r.depth}`);
  assert.ok(new Position().moveFromUci(r.uci));
});

test('avoids a repetition draw when winning', () => {
  const pos = replay('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', ['a1a2', 'e8d8', 'a2a1', 'd8e8', 'a1a2', 'e8d8']);
  const r = engine.search(pos, { depth: 5 });
  assert.ok(r.score > 500, 'still sees itself as winning');
});

test('levels map to sensible settings', () => {
  for (const l of LEVELS) {
    const s = settingsFor(l.strength);
    assert.ok(s.depth >= 1 && s.noise >= 0);
  }
  assert.ok(settingsFor(0).noise > settingsFor(50).noise);
  assert.equal(settingsFor(100).noise, 0);
});

test('weak levels still play legal moves and sometimes miss things', () => {
  const pos = new Position(START_FEN);
  const seen = new Set();
  for (let i = 0; i < 12; i++) seen.add(engine.search(pos, settingsFor(5)).uci);
  assert.ok(seen.size > 2, 'beginner level varies its play');
  for (const u of seen) assert.ok(pos.moveFromUci(u));
});

test('mate score shape', () => {
  const r = best('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { depth: 3 });
  assert.equal(r.score, MATE - 1);
});
