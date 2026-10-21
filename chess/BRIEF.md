# STOOPID CHESS — the brief

Our own chess site for stoopidtv.com: play people, play THE HOUSE, get better. **Straight chess with a STOOPID skin.** The rules are real and untouched. The personality lives in the look, the booth (commentator) and the verdict.

## Decisions so far

| Question | Decision |
|---|---|
| Rules | Full legal FIDE chess. No variants in the main game. |
| Tone | Straight chess with a STOOPID skin: the commentator line plus an end-of-game verdict (STOOPID vs STUPID). Brand-gear Stoo voice: calm, sincere, parenthetical asides. |
| Look | Classic first. Cburnett pieces on a purple and teal board with gridlines and coordinates. Other board themes are optional. |
| Devices | Phone, tablet and desktop, with touch, mouse and pen. Drag or tap to move. |
| Opponents | THE HOUSE (computer) now, pass-and-play on one device now, **online player vs player next**. |
| Accounts | Anonymous play by default. Optional **email sign-in link** (no passwords) to keep a rating and game history across devices. |
| Audience | Not known yet, so we build for all ages: no free-text chat at launch, no personal data in public, and nothing that needs an age gate. |
| Host | stoopidtv.com is on Wix. The game is served from our own infrastructure and Wix links or embeds it (see Phase 2). |

## Phases

**Phase 1 — The Board (this folder, shipped as `stoopid_chess.html`)**
- Full rules: castling, en passant, promotion, check, checkmate, stalemate, threefold repetition, the fifty-move rule, insufficient material. Proven by perft.
- THE HOUSE has five levels (BEANS → THE HOUSE) plus MATCH ME, which adjusts to your results.
- Pass-and-play with names, and optional clocks (3|2 up to 30|0).
- Training wheels: legal-move dots, last move and check highlights, pieces-in-danger warnings, hints, an eval bar, and a coach that grades every move (best / inaccuracy / mistake / blunder) with "X was better" arrows when you replay the game.
- The booth commentates every move. The verdict card shows accuracy, blunders and the final position, and downloads as a PNG.
- Move list with replay, takebacks, drawn arrows and marked squares, typed moves, PGN copy and download, and four board themes. Sound effects are synthesized in the browser.
- The game in progress, your settings and your record are saved on the device (localStorage).

**Phase 2 — Play People**
- `chess-api/`: a Cloudflare Worker with a **Durable Object per live game**. It referees every move with `core/rules.js` (the same file the browser uses), runs the clocks, keeps the game across reconnects, and handles draw offers, resignations and rematches. WebSockets carry the moves.
- A D1 database holds players, games (PGN + metadata) and ratings (Glicko-2).
- Challenge a friend by link first. Matchmaking comes after.
- Live time controls plus daily (correspondence) games.
- Anonymous guests get a random handle. The email sign-in link upgrades a guest to a saved account.
- Preset messages only ("Good game", "Nice move", "Rematch?").
- **Domain**: `play.stoopidtv.com`. Ask Dev showed (deploy error 10083) that a custom domain on a Worker needs the stoopidtv.com zone in the *same* Cloudflare account as the Worker, so that has to be sorted out first. Until then, the Worker's own address works. Wix gets a "Play chess" button or an embedded page.

**Phase 3 — Premium**
- Full game review powered by Stockfish (WebAssembly, served from our own origin, GPL — our source is public). Accuracy, move classes and "best was…" go deeper than the Phase 1 coach.
- Puzzles plus a daily puzzle. Lobby matchmaking by rating. Profiles, history, leaderboards.
- **THE HOUSE learns** (see below).

**Phase 4 — Community**
- Spectating, tournaments (arena and Swiss), friends, clubs.
- Moderation tools and anti-cheat (engine-correlation checks, server-side timing).
- Free-text chat only once moderation exists and we know who's playing.

## THE HOUSE learns — the roadmap

1. **MATCH ME** (shipped): strength moves up or down with your results, so it keeps finding your level.
2. **The House Book**: an opening book built from games played on the site. It favors lines that worked against our players, so THE HOUSE picks up a personality that comes from the community.
3. **A human-like bot**: once there are thousands of site games, train a small network on them (in the spirit of the open-source Maia project) so THE HOUSE plays like a real person at a given rating, mistakes included.

## Open decisions

- Who plays (kids or not). This decides chat, sign-up rules and privacy wording.
- Which Cloudflare account owns stoopidtv.com, needed for `play.stoopidtv.com`.
- Wix: a button to the game, or an embedded page.
- Whether a ranked rating is public, and what name it shows (handle, never an email).
