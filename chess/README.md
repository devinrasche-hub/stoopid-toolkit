# STOOPID CHESS — source

Builds into the root page **`stoopid_chess.html`** (vault item 036). Read `BRIEF.md` for the plan and the phases.

```
core/rules.js       full legal chess (0x88 board, make/unmake, SAN, FEN, draws). No DOM: the Phase 2 server will use it too
core/engine.js      THE HOUSE: alpha-beta search, transposition table, quiescence, null move, late-move reductions
core/levels.js      strength 0–100 → search settings; the named levels
core/commentary.js  the booth (commentator lines), move grading, accuracy, verdicts
core/worker.js      the Web Worker wrapper around the engine
app/                the page: index.html template, style.css, main.js
pieces/             Cburnett piece SVGs (see NOTICE.md)
build.mjs           inlines everything into ../stoopid_chess.html, with no CDN and no runtime fetches
test/               perft (the move-generator proof), rules, and engine tests
```

```
npm test        # 27 tests: perft on six standard positions, draws, SAN, engine mates and time limits
npm run build   # writes ../stoopid_chess.html
```

Edit the sources here, run the tests, build, and commit both the sources and the built page. The page runs the engine in two Web Workers: THE HOUSE makes its moves in one, and the coach grades every position in the other. Both start from an inline Blob, so the page works from GitHub Pages or straight from disk.

The build concatenates the modules with their `import`/`export` lines stripped, so top-level names must be unique across the files that go into each bundle. The build fails if they aren't.
