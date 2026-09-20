# Worked Examples

Four complete pipelines, input to output, plus the anti-examples. All content here is
**generic placeholder material** — deliberately not show canon. Read one example that matches
the shape of the request; don't read all four.

## Contents
- [Example 1 — observation → 8s seamless loop](#example-1--observation--8s-seamless-loop)
- [Example 2 — concept → 20s explainer](#example-2--concept--20s-explainer)
- [Example 3 — script beat → video-gen prompt sheet](#example-3--script-beat--video-gen-prompt-sheet)
- [Example 4 — "what's the visual for this?" → three metaphors](#example-4--whats-the-visual-for-this--three-metaphors)
- [Anti-examples](#anti-examples)

---

## Example 1 — observation → 8s seamless loop

**Input:** "Everyone says they're 'almost done' and then works another four hours."

### Intake gate
1. **One idea:** "almost done" is a permanent state, not a progress report.
2. **Ordinary world:** a progress bar filling toward the end of its track.
3. **Changed rule:** the bar fills normally, but the track extends every time it nears the end.
4. **Flip:** the pull-back — the track is a loop, and it has been going around a circle the whole time.
5. **Length / aspect / loop:** 8s · 9:16 · seamless (narrative loop, release becomes hook).

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

### Intake gate
1. **One idea:** more capacity attracts more demand until it's congested again.
2. **Ordinary world:** a road with cars moving at a normal rate.
3. **Changed rule:** none needed — reality already contains the absurdity. The absurd party is the *intuition*, and the flip reveals that. (Explainers often invert the pattern this way.)
4. **Flip:** the reversal — the new lane is full, and the queue is longer than before.
5. **Length / aspect / loop:** 20s · 16:9 (horizontal beats a horizontal subject) · lands, no loop.

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

### Intake gate
1. **One idea:** clearing the queue is what refills the queue.
2. **Ordinary world:** a desk, a paper tray, an ordinary person doing ordinary work.
3. **Changed rule:** every sheet removed from the tray causes three more to arrive.
4. **Flip:** the obedience punchline — the delivery system is working perfectly, forever, and the room is now full.
5. **Length / aspect / loop:** 15s · 9:16 · cut-on-hit loop.
6. **Build:** generated plates (shots 1–4) + coded overlay (counter, stamp), composited in the edit.

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

## Example 4 — "what's the visual for this?" → three metaphors

**Input:** "What's the visual for doing unpaid emotional labor?"

```
OPTION A — THE COVER CHARGE
  WORLD: a turnstile at the entrance to an ordinary room
  CHANGED RULE: the turnstile only counts people going IN; nobody is ever billed on the way out
  ESCALATION AXIS: count — the counter climbs while the room's single occupant keeps holding the door
  FLIP: cost reveal — cut to the ledger, every line reading 0.00 next to a full tally
  WHY IT'S TRUE: the work is measured and still unpriced
  COST TO BUILD: low (counter + door + ledger; all code, no assets)

OPTION B — THE SECOND SHIFT
  WORLD: a normal workday clock running 9 to 5
  CHANGED RULE: at 5:00 the hands keep going, but only for one person in the frame
  ESCALATION AXIS: formality — the extra hours acquire timestamps, then forms, then an entire department
  FLIP: the persistence — everyone else's clock has stopped; theirs keeps ticking, and they keep working
  WHY IT'S TRUE: it doesn't end when the paid part ends
  COST TO BUILD: medium (clock mechanics, multiple figures)

OPTION C — THE CARRY
  WORLD: someone walking down an ordinary hallway
  CHANGED RULE: every door they pass adds one box to their arms, and no door ever takes one back
  ESCALATION AXIS: cost — the walk gets slower, the stack gets taller, the hallway doesn't end
  FLIP: pull-back — the hallway is a loop and the boxes are the walls
  WHY IT'S TRUE: it accumulates invisibly and becomes the structure you live in
  COST TO BUILD: medium-high (stacking physics, walk cycle)

RECOMMEND: A — it's shippable today, the counter carries the escalation without a word of text,
and the ledger flip is exact, which makes it funnier. C is the better 30-second piece if there's
time for the stacking physics.
```

Note that all three are *the same idea*, staged three ways — not three different ideas. That's
what a metaphor set is for.

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
**Right:** check the intake gate. If blank 1 or blank 4 is empty, you have a texture, not a piece
— say so and propose the idea that would make it one.

---

> **[CREATOR INPUT NEEDED]** — replace or supplement these with real worked examples once Dev
> has run the skill a few times: a bit that worked, a bit that didn't, and one educational piece,
> each with its intake gate filled in as he'd actually fill it. Real examples teach the voice;
> these generic ones only teach the structure.
