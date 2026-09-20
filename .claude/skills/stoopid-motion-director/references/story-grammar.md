# Story Grammar

Structure for 5–30 seconds. Read this when shaping beats, escalating, finding the flip, or
breaking a piece into shots.

## Contents
- [The spine](#the-spine)
- [Hook](#hook)
- [Escalation ladders](#escalation-ladders)
- [The flip — eight kinds](#the-flip--eight-kinds)
- [Release](#release)
- [Micro-shots](#micro-shots)
- [Shot list format](#shot-list-format)
- [Adapting a written script](#adapting-a-written-script)
- [Premise sets](#premise-sets)
- [Diagnostics](#diagnostics)

---

## The spine

**Hook → Escalation → Flip → Release.** Every piece. Default runtime is 15–20s in 3–6 beats
(18s: hook 0–3 · escalation 3–9 · flip 9–14 · release 14–18). Other budgets are in SKILL.md.

Before any of this, the four internal lines — THESIS / VISUAL PREMISE / FLIP / FINAL IMAGE — plus
three competing premises (`stoopid-dna.md` → *The visual premise generator*). Keep that planning
internal unless the user asks for options.

The spine is about *meaning arriving late*. The first three quarters are a machine running;
the flip is the moment the viewer understands what machine they've been watching.

## Hook

Under one second, the viewer must have: a recognizable world, and something wrong in it.

Strong hook openings:
- **Mid-action.** The piece starts with the thing already happening. No establishing frame, no logo.
- **One wrong detail in a normal frame.** Everything ordinary except one element at the wrong scale, the wrong count, or moving the wrong way.
- **A completed normal cycle, fast.** Show the rule being obeyed once (0.4 s) so breaking it means something.
- **A number already climbing.** Motion in progress implies a story that started before we arrived.

Never: a title card before motion, a slow fade-up, a logo sting, or a caption stating the premise.
The watermark and any chrome can sit there from frame 1 — they aren't an opening.

## Escalation ladders

Escalation = **the same rule, harder.** Pick one axis and climb it. Two or three rungs, max.

| Axis | Rung 1 → Rung 3 |
|---|---|
| **Scale** | one → a hundred → filling the frame |
| **Speed** | occasional → constant → faster than the system can process |
| **Scope** | one object → the room → everything on screen |
| **Cost** | mildly inconvenient → expensive → structurally load-bearing |
| **Formality** | a glitch → a procedure → an institution with forms for it |
| **Intimacy** | a stranger's problem → your problem → the thing you do too |

Rules for rungs:
- Each rung repeats the *shape* of the previous one so the eye recognizes the pattern (same framing, same timing, bigger value). Recognition is what makes rung 3 funny.
- Rung 3 should be visibly *unsustainable* — the viewer starts predicting collapse. That prediction is the setup the flip pays off.
- Rule of three works because the third instance is where prediction becomes certainty. In 5–8 seconds you only get one rung; make it a big one.
- **"And also" is a pile; "and then" is a ladder.** If a rung introduces a new kind of weirdness, cut it.

## The flip — eight kinds

The flip is where the piece earns its existence: absurdity becomes something true. It must be
**seen, not stated.** Eight reliable mechanisms:

1. **The pull-back.** Widen the frame; the situation was one cell of a much larger grid doing the same thing. (Fastest to animate, highest hit rate.)
2. **The cost reveal.** Cut to what the escalation was consuming all along — a meter at zero, a queue of people waiting, a bill totalling.
3. **The reversal.** The absurd element turns out to be the reasonable one; the "normal" background is revealed as the actual problem.
4. **The literalization.** The metaphor stops being figurative — the full plate is a plate, the moved goalposts are goalposts on wheels.
5. **The mirror.** The frame turns around: the thing being watched is watching, or the audience's own position appears in the scene.
6. **The obedience punchline.** The machine, still perfectly obedient, does the correct thing with a devastating input. Nothing breaks. That's the horror.
7. **The subtraction.** Everything is removed except one element — revealing what the piece was actually about.
8. **The persistence.** The escalation stops, and one small thing keeps going anyway (someone still building, still waiting, still swinging). This is the sincere flip, and it's the strongest one in this show's register when it's earned.

Flip craft:
- **One beat of silence before it.** Motion stops, or drops to a single continuing element.
- **Burnt orange belongs here** (documented brand meaning: earned sincerity / the flip landing). Use it once, at the flip.
- **Longest hold in the piece** (600–1000 ms).
- No glitch, no shake, no effects during the flip. Clarity.
- If you can delete the flip and the piece still parses, it wasn't a flip — it was a second escalation rung.

## Release

Land it and get out. Four types:

- **The button.** One small deadpan action after the flip (a light clicks off, a lid closes, a figure sits down).
- **The stamp.** A verdict/label slams in — 90 ms, snap easing, then stillness. Fake-serious register.
- **The loop-back.** Cut to frame 1 and start over; the system's indifference is the joke. Best release for social loops.
- **The plain true line.** A calm statement, no wink, on a still frame. Use rarely; it's the most powerful and the easiest to overuse.

Never explain the joke in the release. Never add a second punchline. Never end on a shrug.

## Micro-shots

A 15-second piece is typically 4–8 shots. Shots are cheap; keep them purposeful.

- **Minimum 0.5 s.** Below that it's a glitch effect, not a shot.
- **One change per shot.** A shot exists to show one thing happening.
- **Cut on the action**, not after it — cut while the object is still moving and the eye stitches it.
- **Vary the size.** Wide (the system) → medium (the mechanism) → close (the detail that hurts). Two consecutive shots at identical scale read as a mistake.
- **Escalation can be carried by cutting rhythm**: shots get shorter as it climbs (1.4 s → 1.0 s → 0.6 s), then the flip gets a long one (1.8 s). The cutting itself escalates.
- **Continuity over prettiness.** Keep the moving object on the same side of frame across a cut, or the viewer loses it.

## Shot list format

Use this exact shape when asked to storyboard or break out shots. Timecodes are absolute and
must sum to the stated length.

```
PIECE: <title>   LENGTH: 14s   ASPECT: 9:16   LOOP: yes (cut-on-stamp)
ONE IDEA: <one sentence, no "and">
CHANGED RULE: <the single broken law>
FLIP: <the moment, and which of the eight kinds>

SHOT 01 · 0.0–1.2s · HOOK · WIDE
  FRAME: what we see, where it sits
  MOTION: what moves, how fast, what easing
  SOUND HIT: 0.9s
  NOTE: why this shot exists

SHOT 02 · 1.2–3.0s · ESCALATION R1 · MEDIUM
  ...

SHOT 05 · 8.0–10.4s · FLIP · PULL-BACK
  FRAME: ...
  MOTION: everything stops except <one element>; world scale 1 → 0.55 over 800ms
  COLOR: burnt orange enters here, once
  ...
```

Follow the list with one line on what you'd build it in (canvas/SVG/CSS) and an offer to
build it. If the user asked for a storyboard *and* an artifact, ship the list first — it's
faster to correct a list than a file.

## Adapting a written script

When given a script, an episode beat, or a transcript:

1. **Find the one idea.** If the script has three, pick the one with the strongest physical image and say which one you took. The other two are future pieces.
2. **Find the line that's already visual.** Scripts usually contain one phrase that is secretly a picture. That's the piece.
3. **Delete the dialogue.** Rebuild the beat as physical events. Then check what's lost — usually nothing but the explanation.
4. **Locate the existing flip.** Written material often already has one; keep it and find its visual equivalent (map it to one of the eight kinds).
5. **Keep at most one line of text**, usually at the release.
6. **Time it.** 5–30 seconds means one beat of a script, not a whole segment. Cutting scope is the job, not a failure.

## Premise sets

The generator itself — method, format and the worked example — lives in `stoopid-dna.md`
→ *The visual premise generator*, because it's DNA, not structure. What belongs here is what
the three premises have to *contain* structurally:

- Each premise names its **escalation axis** and **which of the eight flips** it uses. A premise
  without a flip is a picture.
- The three are **the same idea staged three ways**, never three ideas.
- Spread them across build cost so one is shippable today.
- In CONCEPT mode, show all three and recommend one, with the reason. In ARTIFACT mode, generate
  them internally, pick, and build — unless the user asks to see the options.

## Diagnostics

| Symptom | Diagnosis | Fix |
|---|---|---|
| Piece feels flat but looks fine | No flip — the ending restates the opening | Apply the pull-back or the cost reveal |
| Feels chaotic, not funny | More than one changed rule | Cut to one; move the others to other pieces |
| Escalation feels like a list | "And also" structure | Pick one axis, repeat the shape at bigger values |
| Joke lands but means nothing | No truth underneath | Ask what real behavior this indicts, then make the flip that |
| Meaningful but not funny | Sincerity without absurd setup | Build the ordinary world, break one rule, *then* land the sincere beat |
| Viewer misses the point | The flip was too fast, or effects covered it | Longer hold, stop all other motion, remove effects |
| Loop feels off | Accumulated state or unseeded randomness | Recompute everything from `t`; verify across three cycles |
| Too long | Two ideas, or a redundant escalation rung | Cut a rung before cutting a hold — holds are what make it land |

---

> **[CREATOR INPUT NEEDED]** — to sharpen this file:
> - Dev's own best flip moments (episode/bit + the exact moment), mapped onto the eight kinds, so the taxonomy is grounded in real work rather than generic patterns.
> - Which release type he actually prefers by default, and any release move he considers played out.
> - Any escalation shape recognizable as *his* (a rhythm, a recurring structure) worth codifying here.
