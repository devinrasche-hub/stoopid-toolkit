import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Position, perft, replay, START_FEN } from '../core/rules.js';

// Published perft counts (chessprogramming.org/Perft_Results). Any rules bug shows up here.
const PERFT = [
  [START_FEN, [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]], // "Kiwipete"
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];

for (const [fen, counts] of PERFT) {
  test(`perft ${fen.split(' ')[0].slice(0, 24)}…`, () => {
    const pos = new Position(fen);
    counts.forEach((want, i) => assert.equal(perft(pos, i + 1), want, `depth ${i + 1}`));
    assert.equal(pos.fen(), new Position(fen).fen(), 'make/unmake left the position unchanged');
  });
}

test('FEN round-trips', () => {
  for (const [fen] of PERFT) assert.equal(new Position(fen).fen(), fen);
});

test('hash is the same whether reached incrementally or loaded fresh', () => {
  const pos = replay(START_FEN, ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'e1e2', 'b8c6', 'e4e5', 'f7f5', 'e5f6']);
  const fresh = new Position(pos.fen());
  assert.equal(pos.hashLo, fresh.hashLo);
  assert.equal(pos.hashHi, fresh.hashHi);
});

test('SAN: disambiguation, castling, promotion, check and mate', () => {
  const p1 = new Position('3k4/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  const sans = p1.legalMoves().map(m => p1.san(m));
  assert.ok(sans.includes('O-O'));
  assert.ok(sans.includes('O-O-O+'));
  assert.ok(sans.includes('Ra8+'));
  const p1b = new Position('3k4/8/8/8/8/8/8/R4RK1 w - - 0 1');
  assert.ok(p1b.legalMoves().map(m => p1b.san(m)).includes('Rae1'));
  const mate = new Position('7k/6pp/8/8/8/8/8/R3K3 w Q - 0 1');
  assert.ok(mate.legalMoves().map(m => mate.san(m)).includes('Ra8#'));

  const p2 = new Position('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.ok(p2.legalMoves().map(m => p2.san(m)).includes('a8=Q'));

  const p3 = new Position('k7/8/8/8/8/1N3N2/8/K7 w - - 0 1');
  const s3 = p3.legalMoves().map(m => p3.san(m));
  assert.ok(s3.includes('Nbd4') && s3.includes('Nfd4'));

  const p4 = new Position('k7/8/8/8/N7/8/N7/K7 w - - 0 1');
  const s4 = p4.legalMoves().map(m => p4.san(m));
  assert.ok(s4.includes('N4c3') && s4.includes('N2c3'));
});

test('SAN input is forgiving', () => {
  const pos = new Position();
  assert.equal(pos.uci(pos.moveFromSan('e4')), 'e2e4');
  assert.equal(pos.uci(pos.moveFromSan('Nf3')), 'g1f3');
  assert.equal(pos.uci(pos.moveFromSan('nf3')), 'g1f3');
  assert.equal(pos.uci(pos.moveFromSan('g1f3')), 'g1f3');
  assert.equal(pos.moveFromSan('Ke2'), 0);
});

test('checkmate and stalemate', () => {
  const mate = replay(START_FEN, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(mate.status(), { over: true, result: '0-1', reason: 'checkmate' });
  const stale = new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(stale.status().reason, 'stalemate');
});

test('threefold repetition', () => {
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const pos = replay(START_FEN, shuffle.slice(0, 7));
  assert.equal(pos.status().over, false);
  pos.make(pos.moveFromUci(shuffle[7]));
  assert.deepEqual(pos.status(), { over: true, result: '1/2-1/2', reason: 'threefold' });
});

test('a double push with no capturer does not break repetition', () => {
  // After 1.e4 the e3 square is set, but nothing can take en passant, so it's the same position later.
  const pos = new Position();
  pos.make(pos.moveFromUci('e2e4'));
  const lo = pos.hashLo;
  assert.equal(new Position(pos.fen().replace(' e3 ', ' - ')).hashLo, lo);
});

test('fifty-move rule', () => {
  const pos = new Position('7k/8/8/8/8/8/R7/K7 w - - 99 80');
  assert.equal(pos.status().over, false);
  pos.make(pos.moveFromUci('a2b2'));
  assert.deepEqual(pos.status(), { over: true, result: '1/2-1/2', reason: 'fifty' });
});

test('insufficient material', () => {
  const draw = ['8/8/4k3/8/8/4K3/8/8 w - - 0 1', '8/8/4k3/8/8/4KN2/8/8 w - - 0 1',
    '8/8/4kb2/8/8/4B3/3K4/8 w - - 0 1', '8/2b5/4k3/8/8/4K3/8/2B5 w - - 0 1'];
  const play = ['8/8/4kb2/8/8/4KB2/8/8 w - - 0 1', '8/8/4k3/8/8/4KNN1/8/8 w - - 0 1',
    '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', '8/8/4kn2/8/8/4KB2/8/8 w - - 0 1'];
  for (const f of draw) assert.equal(new Position(f).insufficientMaterial(), true, f);
  for (const f of play) assert.equal(new Position(f).insufficientMaterial(), false, f);
});

test('castling rights die when the rook is captured', () => {
  const pos = new Position('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
  pos.make(pos.moveFromUci('g2h1'));
  assert.ok(!pos.fen().split(' ')[2].includes('K'));
  assert.ok(pos.legalMoves().every(m => pos.san(m) !== 'O-O'));
});

test('bad FEN is rejected', () => {
  assert.throws(() => new Position('8/8/8/8/8/8/8/8 w - - 0 1'));
  assert.throws(() => new Position('nonsense'));
});
