# Worked Examples

Four complete pipelines, input to output, plus the anti-examples. All content here is
**generic placeholder material** — deliberately not show canon. Read one example that matches
the shape of the request; don't read all four.

## Contents
- [Example 1 — observation → 8s seamless loop](#example-1--observation--8s-seamless-loop)
- [Example 2 — concept → 20s explainer](#example-2--concept--20s-explainer)
- [Example 3 — script beat → video-gen prompt sheet](#example-3--script-beat--video-gen-prompt-sheet)
- [Example 4 — "what's the visual for this?" → a premise set](#example-4--whats-the-visual-for-this--a-premise-set)
- [Example 5 — a control string → a dialed piece](#example-5--a-control-string--a-dialed-piece)
- [Anti-examples](#anti-examples)

---

## Example 1 — observation → 8s seamless loop

**Input:** "Everyone says they're 'almost done' and then works another four hours."

### Internal plan (not shown to the user)
```
THESIS:         "almost done" is a permanent state, not a progress report
VISUAL PREMISE: a progress bar whose track extends every time it nears the end
FLIP:           pull-back — the track is a circle; it has been going around the whole time
FINAL IMAGE:    the bar chasing its own tail, still reporting 80%
```
**Controls:** `LOOPABLE yes · LENGTH 8s · ASPECT 9:16 · ABSURDITY 3 · SINCERITY 1 · CHAOS 1`
(LOOP mode, so the aspect defaults vertical.)

### Shot list
```
PIECE: ALMOST DONE   LENGTH: 8s   ASPECT: 9:16   LOOP: yes (modulo clock)
SHOT 01 · 0.0–1.0s · HOOK · CLOSE on the bar
  FRAME: teal progress bar at 80%, mono label 80%, counter ticking
  MOTION: bar advances at a believable rate — the ordinary world obeying its rule
  NOTE: one beat of things working correctly, so breaking it means something

SHOT 02 · 1.0–4.0s · ESCALATION (axis: scale) · same framing
  MOTION: bar reaches 99%; track extends to the right by 40%; percentage snaps back to 80%.
          Repeats at 1.6s and 2.6s, each extension bigger and faster.
  SOUND HIT: each extension (1.4s, 2.4s, 3.2s)
  NOTE: the SHAPE repeats, only the value grows — ladder, not pile

SHOT 03 · 4.0–6.4s · FLIP · PULL-BACK
  MOTION: world scale 1 → 0.3 over 800ms; the track is revealed as a closed circle,
          the bar chasing its own tail. Everything else stops. Counter keeps ticking.
  COLOR: burnt orange enters here, once, on the bar head
  HOLD: 900ms — the longest in the piece

SHOT 04 · 6.4–8.0s · RELEASE · loop-back
  MOTION: push back in to the original framing, bar reads 80% again, motion resumes
  NOTE: the seam IS the joke — frame 8.0 is frame 0.0
```

### Build notes
```js
const HOOK=1.0, ESC=3.0, FLIP=2.4, REL=1.6, TOTAL=8.0;   // frame(TOTAL) === frame(0)
// track length and fill are both f(t): nothing accumulates, so the loop closes by construction
const ext = t => 1 + 0.4*Math.floor(p(t,HOOK,HOOK+ESC)*3);      // stepped track extension
const fill = t => (t*0.34) % 1;                                  // the bar's own cycle
```
Loop verification: play three cycles, watch the seam, confirm the counter resets cleanly and no
canvas trail survives the wrap.

### Aspect variants
- **9:16** (primary): bar horizontal, circle reveal centered — vertical space carries the pull-back.
- **1:1**: same, tighter pull-back scale (0.42); the circle is the natural square composition.
- **16:9**: the bar reads best wide, but the pull-back needs the circle to fit — reduce extension count to 2 rungs and re-block the circle to fill the frame height.

---

## Example 2 — concept → 20s explainer

**Input:** "Explain why adding one more lane doesn't fix traffic."

### Internal plan (not shown to the user)
```
THESIS:         more capacity attracts more demand until it's congested again
VISUAL PREMISE: none needed — reality already contains the absurdity. The absurd party is the
                INTUITION, and the flip exposes it. (Explainers often invert the pattern.)
FLIP:           reversal — the new lane is full and the on-ramp queue is longer than before
FINAL IMAGE:    a wider road with a longer line
```
**Controls:** `EDUCATION 5 · ABSURDITY 2 · SINCERITY 2 · LENGTH 20s · ASPECT 16:9 · LOOPABLE no`

### Beat plan (teaching pattern: *break it on purpose*, run honestly)
| Time | Beat | On screen |
|---|---|---|
| 0–2s | Setup | Two lanes, cars entering at a fixed rate, flowing. Mono label: `FLOW: NORMAL` |
| 2–5s | The problem | Entry rate rises; cars bunch; speed drops. Red cost bar appears and grows. |
| 5–8s | The intervention | A third lane snaps in (90ms, snap easing). Flow recovers. Everything looks solved. Hold 700ms. |
| 8–15s | Run it | Entry rate climbs again — *because* the road got faster. The counter of cars entering per minute is visible and honest. Congestion returns; the red bar returns to where it was. |
| 15–17s | Flip (reversal) | Pull back: the queue at the on-ramp is now longer than in the two-lane version. Side-by-side with a ghost of the earlier state, aligned on the same baseline. Burnt orange, once. |
| 17–20s | Release | Still frame. One line: `THE ROAD GOT BIGGER. SO DID THE LINE.` |

### Honesty requirements for this piece
- Car speeds proportional to the modeled speed, not hand-animated for drama.
- The ghost comparison aligned on the same baseline, same scale, same time window.
- The demand-response rate is a *modelled assumption* — label it `SCHEMATIC · NOT TO SCALE` in mono, and don't put a fake percentage on screen. If a real figure is wanted, leave `[FIGURE — source needed]` visible for Dev to fill.

### Build notes
Simulate the cars — don't fake the outcome. A minimal car-following rule (match the speed of the
car ahead, keep a gap, cap at the speed limit) produces genuine stop-and-go waves, which is both
the honest result and the better-looking one. Hand-animating congestion looks wrong and is more work.

---

## Example 3 — script beat → video-gen prompt sheet

**Input:** a script line — *"I answered one email. The inbox added three."*

### Internal plan (not shown to the user)
```
THESIS:         clearing the queue is what refills the queue
VISUAL PREMISE: every sheet removed from the tray causes three more to arrive
FLIP:           obedience punchline — the delivery system is working perfectly, forever
FINAL IMAGE:    a room full of paper, still being fed from above
```
**Controls:** `LOOPABLE yes (cut-on-hit) · LENGTH 15s · ASPECT 9:16 · ABSURDITY 4 · CHAOS 3 ·
DEV ON SCREEN no` (so: hands and objects, never a face).
**Build:** generated plates (shots 1–4) + coded overlay (counter, stamp), composited in the edit.

```
STYLE BLOCK (paste verbatim into every prompt):
Shot on grainy 16mm with faint VHS tracking noise. Palette restricted to black, white and a
single neon teal light source; no other colors. Hard single overhead light, deep black shadows,
no fill. Locked-off camera unless stated. Deadpan observational documentary tone, unhurried.
Negative: text, captions, subtitles, watermarks, logos, extra people, fast cutting, slow motion,
color drift, lens flare.

— SHOT 01 · 0.0–3.0s · HOOK · locked medium
PROMPT: A single sheet of white paper sitting in a black metal desk tray in an otherwise empty
dark office. A hand enters frame from the right, lifts the sheet cleanly, and exits. The tray is
empty for a moment. Locked-off medium shot, 50mm, eye level, no camera movement. <STYLE BLOCK>
WHY: establishes the ordinary world and one complete normal action
IN-EDIT: no overlay; counter appears at 2.6s reading 1

— SHOT 02 · 3.0–7.0s · ESCALATION R1 · locked, same framing
PROMPT: Three sheets of white paper drop into the same black desk tray from above in quick
succession, landing with weight and sliding slightly. Nothing else in the room moves. Locked-off
medium shot, 50mm, no camera movement. <STYLE BLOCK>
WHY: same framing so the eye compares directly — the ladder's second rung
IN-EDIT: teal counter ticks 1 → 4 on the third landing (hit at 5.2s)

— SHOT 03 · 7.0–11.0s · ESCALATION R2 · slow push in
PROMPT: A continuous heavy stream of white paper sheets pouring into an overflowing black desk
tray, spilling across the desk and onto the floor, piling up. Slow push in, 50mm. <STYLE BLOCK>
WHY: same rule, unsustainable value — the viewer starts predicting the collapse
IN-EDIT: counter accelerating past readability, 4 → 9,417

— SHOT 04 · 11.0–14.0s · FLIP · pull back to wide
PROMPT: Wide shot pulling back to reveal an enormous dark office filled floor to ceiling with
drifts of white paper, hundreds of identical desks in rows, each with its own overflowing tray,
all still being fed from above. Slow steady pull back, 24mm. <STYLE BLOCK>
WHY: the obedience punchline — the system is functioning exactly as designed
IN-EDIT: motion stops for 900ms; burnt orange accent enters here, once

— SHOT 05 · 14.0–15.0s · RELEASE
IN-EDIT ONLY (coded): stamp slams in, 90ms snap, then still; hard cut to shot 01 frame 1.
WHY: text and timing are exact — belongs in code, never in a generation

LOOP STRATEGY: cut on the stamp hit (shot 05) back to shot 01 frame 1.
FALLBACK: if shot 04's pull-back loses the desk rows, build it in code — a grid of identical
cells is trivial and exact in canvas, and this shot is the flip, so it cannot be approximate.
AUDIO HITS: 2.6s · 4.1s · 4.7s · 5.2s · 9.0s (stream) · 11.6s (flip) · 14.0s (stamp)
```

Note what stayed in code: the counter, the stamp, the timing of the flip hold. Note what went to
the generator: rooms, paper physics, scale. That split is the point.

---

## Example 4 — "what's the visual for this?" → a premise set

**Input:** "What's the visual for doing unpaid emotional labor?"

```
PREMISE A — THE COVER CHARGE
  WORLD: a turnstile at the entrance to an ordinary room
  IMPOSSIBLE RULE: the turnstile only counts people going IN; nobody is ever billed on the way out
  ESCALATION AXIS: count — the counter climbs while the room's single occupant keeps holding the door
  FLIP: cost reveal — cut to the ledger, every line reading 0.00 next to a full tally
  WHY IT'S TRUE: the work is measured and still unpriced
  COST: low (counter + door + ledger; all code, no assets)

PREMISE B — THE SECOND SHIFT
  WORLD: a normal workday clock running 9 to 5
  IMPOSSIBLE RULE: at 5:00 the hands keep going, but only for one person in the frame
  ESCALATION AXIS: formality — the extra hours acquire timestamps, then forms, then an entire department
  FLIP: the persistence — everyone else's clock has stopped; theirs keeps ticking, and they keep working
  WHY IT'S TRUE: it doesn't end when the paid part ends
  COST: medium (clock mechanics, multiple figures)

PREMISE C — THE CARRY
  WORLD: someone walking down an ordinary hallway
  IMPOSSIBLE RULE: every door they pass adds one box to their arms, and no door ever takes one back
  ESCALATION AXIS: cost — the walk gets slower, the stack gets taller, the hallway doesn't end
  FLIP: pull-back — the hallway is a loop and the boxes are the walls
  WHY IT'S TRUE: it accumulates invisibly and becomes the structure you live in
  COST: medium-high (stacking physics, walk cycle)

RECOMMEND: A — it's shippable today, the counter carries the escalation without a word of text,
and the ledger flip is exact, which makes it funnier. C is the better 30-second piece if there's
time for the stacking physics.
```

Note that all three are *the same idea*, staged three ways — not three different ideas. That's
what a premise set is for. The generator's method lives in `stoopid-dna.md`.

---

## Example 5 — a control string → a dialed piece

**Input:** *"STOOPID animate why we can't remember what we watched after scrolling for an hour.
Absurdity 4. Education 5. Sincerity 2. 18 seconds."*

### Resolved controls
`ABSURDITY 4 · EDUCATION 5 · SINCERITY 2 · CHAOS 2 (default) · LOOPABLE no · DEV ON SCREEN no ·
LENGTH 18s · ASPECT 16:9` — state this line back at handoff so it can be re-dialed.

What the dials actually do to this piece:
- **ABSURDITY 4** — the impossible rule doesn't stay on one object; the environment reorganizes
  around it. So: things that have been watched don't just vanish, the *room* starts removing them.
- **EDUCATION 5** — the concept (encoding fails without attention and consolidation; rapid novelty
  keeps overwriting the buffer) must survive every joke being cut. So the mechanism is built first:
  a visible short buffer of fixed size, items entering faster than they can be written to storage.
- **SINCERITY 2** — deadpan release, no warmth, no lesson stated out loud.
- **CHAOS 2** — one dominant action at a time even though the frame gets full.

### Internal plan (not shown to the user)
```
THESIS:         novelty arrives faster than memory can write, so nothing gets stored
VISUAL PREMISE: a small shelf with exactly seven slots; new items shove old ones off the end
                before a tiny worker can finish labeling them
FLIP:           pull back — the floor behind the shelf is knee-deep in unlabeled items
FINAL IMAGE:    the worker still reaching for a label, mid-air, as another item lands
```

### Beat plan (18s, 16:9)
| Time | Beat | On screen |
|---|---|---|
| 0–3s | Hook | One item lands on the shelf. A worker labels it calmly. It slides into storage. The system works. |
| 3–9s | Escalation | Items arrive faster. The worker gets one label out of three, then one out of ten. Items shove each other off the shelf's end. Red cost bar appears. |
| 9–14s | Flip | All motion stops except the falling items. Camera pulls back: the floor is buried in unlabeled items, none of which reached storage. Burnt orange, once, on the storage door that never opened. |
| 14–18s | Release | Push back in. The worker reaches for one more label. An item lands on their hand. Cut. |

### Why this passes EDUCATION 5
Cut every joke — the worker, the shoving, the burial — and what remains is still a correct model:
fixed-capacity buffer, arrival rate exceeding write rate, items displaced before transfer. The
jokes are built around that, not in place of it. The honesty rules apply: the buffer size is
labelled `SCHEMATIC · NOT TO SCALE`, and no invented statistic appears anywhere.

---

## Anti-examples

### The randomness trap
**Wrong:** a printer spits paper, then a fish flies past, then the desk turns into a hand, then
everything is spaghetti. Nothing can be subverted because nothing was ever established.
**Right:** the printer spits paper. Then more paper. Then paper faster than a printer could
possibly print. One rule, followed too well.

### The caption trap
**Wrong:** a person standing still while text reads `WE'RE ALL JUST PRETENDING TO BE FINE`.
That's a tweet on a background.
**Right:** the person is holding a door shut. Something behind it is pushing. They keep smiling
at the camera, adjusting their stance every few seconds. No text until the stamp.

### The two-idea trap
**Wrong:** a piece about how algorithms flatten taste *and* how streaming pays artists nothing.
Fifteen seconds, two theses, no flip that serves both.
**Right:** pick one, ship it, and say out loud that the other is the next piece. Two 12-second
pieces beat one 24-second piece with a seam in the middle.

### The announced-flip trap
**Wrong:** the escalation runs, then a caption appears: `AND THAT'S THE REAL COST.` Telling the
viewer a flip happened is not a flip.
**Right:** the escalation runs, all motion stops, and the camera pulls back to show the bill.
Nobody says anything. The viewer does the work, which is why they remember it.

### The pretty-and-empty trap
**Wrong:** a beautifully eased particle system in the palette with perfect type and no idea. It
will get compliments and zero comments.
**Right:** check the internal plan. If THESIS or FLIP is empty, you have a texture, not a piece —
say so in a sentence and propose the idea that would make it one.

---

---

## Curation log

This is how the skill gets Dev-coded instead of merely competent. It grows by curation, not
training. After each piece, add one line here, then push the principle into the file that owns it.

```
### <date> · <piece> · WORKED
PRINCIPLE: <the one thing that made it land>
FILED TO: <stoopid-dna.md | motion-grammar.md | story-grammar.md | visual-language.md | ...>

### <date> · <piece> · MISSED
WHY IT WASN'T STOOPID: <the specific failure, not "it felt off">
RULE ADDED: <the new forbidden default or lexicon entry that prevents a repeat>
FILED TO: <file>
```

Rules for the log:
- A "worked" entry with no extractable principle is a compliment, not data — dig until there's a rule.
- A "missed" entry must end in a rule, or the same failure returns next week.
- When the same principle shows up three times, promote it from this log into SKILL.md.
- Twenty to thirty curated entries is the threshold where the skill stops being a style guide and
  starts being a brain.

*(Empty — awaiting the first real runs.)*

---

> **[CREATOR INPUT NEEDED]** — replace or supplement these with real worked examples once Dev has
> run the skill a few times: a bit that worked, a bit that didn't, and one educational piece, each
> with its internal plan filled in as he'd actually fill it. Real examples teach the voice; these
> generic ones only teach the structure.
