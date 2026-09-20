# External Video-Generation Prompting

For when the deliverable is prompts rather than code — text-to-video / image-to-video tools
(Sora, Veo, Kling, Runway, Grok Imagine, Luma and the rest). Read this before writing any
video prompt sheet.

## Contents
- [What these tools are for](#what-these-tools-are-for)
- [One action per clip](#one-action-per-clip)
- [Prompt anatomy](#prompt-anatomy)
- [The continuity kit](#the-continuity-kit)
- [The prompt sheet](#the-prompt-sheet)
- [Hard limits to design around](#hard-limits-to-design-around)
- [Image-to-video](#image-to-video)
- [Loops from generated clips](#loops-from-generated-clips)
- [Aspect and length](#aspect-and-length)
- [Editing assumptions](#editing-assumptions)
- [Iteration protocol](#iteration-protocol)
- [Checklist](#checklist)

---

## What these tools are for

Generators are good at **texture, atmosphere, plausible physical worlds, creatures, crowds,
weather, scale, and footage that looks shot.** They are bad at **precision** — exact timing,
exact counts, readable text, exact repetition, and a joke that depends on a specific frame.

So the division of labor:

| Use generated video for | Use code (HTML/canvas/SVG) for |
|---|---|
| The recognizable real world of the hook | Counters, meters, data, interfaces |
| Impossible-but-physical events | Anything requiring exact timing |
| Scale, crowds, environments, weather | Text, stamps, verdicts, labels |
| A shot that should look filmed | Seamless loops |
| Escalation rungs that need spectacle | The flip, when it must land on a specific frame |

A hybrid piece — generated plates with coded overlays composited in the edit — is usually the
strongest and cheapest route. Say so when it applies, and specify which layer is which.

## One action per clip

**The single most important rule.** One clip = one continuous action, one camera move, one
subject, no cuts inside it. Prompts that request a sequence ("then it falls, then the crowd
reacts, then we see the sign") produce mush in every generator family.

So: break the piece into micro-shots *first* (see `story-grammar.md`), then write one prompt
per shot. A 15-second piece is typically 4–6 prompts.

## Prompt anatomy

Write prompts as ordered, comma-light prose in this sequence. Front-load the subject — most
models weight early tokens heavily.

```
[SUBJECT + STATE] · [ONE ACTION, with direction and speed] · [CAMERA: framing, move, lens]
· [LIGHT] · [PALETTE] · [MEDIUM / TEXTURE] · [MOOD / PACE] · [NEGATIVE]
```

Worked shape:

> A single beige office chair alone on wet asphalt at night, seen from the front. The chair
> tips slowly forward and topples, hitting the ground hard and sliding a few inches. Static
> locked-off medium-wide shot, 35mm, eye level, no camera movement. Hard single overhead
> streetlight, deep black shadows. Black, white, and a thin neon teal rim light; no other
> colors. Shot on grainy 16mm with slight VHS tracking noise. Deadpan, unhurried, documentary.
> — Negative: text, captions, logos, people, extra chairs, fast cuts, camera shake, lens flare,
> color grading drift, slow motion.

Craft notes:
- **Describe the action's physics**, not its meaning. "Topples and slides on impact" beats "comically falls over."
- **Name the camera explicitly** including "no camera movement" when you want a locked shot — generators drift toward slow pushes by default.
- **Specify the palette as a restriction** ("only black, white and neon teal; no other colors"). Positive palette lists alone get ignored.
- **Deadpan is a prompt word.** "Documentary," "observational," "unhurried," "matter-of-fact" all pull toward treating the absurdity seriously. Avoid "funny," "cartoonish," "wacky" — they produce mugging.
- **Put the wrongness in the action**, not in an adjective. The comedy has to be a physical event the model can render.
- **Negatives always include:** text, captions, subtitles, watermarks, logos. Generated text is unusable and the house style adds its own type in the edit.

## The continuity kit

A piece made of generated clips only holds together if the style block is **identical, verbatim,
copy-pasted** into every prompt. Write it once at the top of the sheet:

```
STYLE BLOCK (paste verbatim into every prompt):
Shot on grainy 16mm with faint VHS tracking noise. Palette restricted to black, white and neon
teal; no other colors. Hard single-source light, deep black shadows, no fill. Locked-off camera
unless stated. Deadpan observational tone, unhurried. Anamorphic-free, no lens flare.
Negative: text, captions, subtitles, watermarks, logos, extra characters, fast cutting,
slow motion, color drift.
```

Also in the kit:
- **Subject card** — one fixed description of each recurring subject, reused word-for-word. Changing a single adjective between shots changes the subject.
- **Environment card** — the location described the same way every time.
- **Seed / reference discipline** — reuse the same seed and, where the tool supports it, the same reference image across shots. Note in the sheet that consistency comes from the reference, not from the wording.
- **Time-of-day lock** — state it in every prompt; generators drift toward golden hour.

Accept the truth: **cross-shot character consistency is unreliable.** Design the piece so it
doesn't depend on it — favor objects, silhouettes, backs of heads, hands, environments, or a
subject whose identity is carried by a silhouette and a color.

## The prompt sheet

Deliver this format, always. It is copy-paste ready, in shot order.

```
PIECE: <title>   LENGTH: 15s   ASPECT: 9:16   LOOP: cut-on-stamp
ONE IDEA: <one sentence>   CHANGED RULE: <one law>   FLIP: <the moment, which kind>
BUILD: generated plates (shots 1,2,4) + coded overlay (counter, stamp) composited in edit

STYLE BLOCK (verbatim in every prompt):
<block>

— SHOT 01 · 0.0–3.0s · HOOK · locked medium-wide
PROMPT: <full prompt including the style block>
WHY: establishes the ordinary world and the one wrong detail
IN-EDIT: no overlay

— SHOT 02 · 3.0–7.0s · ESCALATION R1 · slow push
PROMPT: <...>
WHY: same rule, bigger value
IN-EDIT: teal counter, top third, ticking 1→847

— SHOT 03 · 7.0–11.0s · FLIP · pull back to wide
PROMPT: <...>
WHY: reveals it was one cell of a grid all doing the same thing
IN-EDIT: burnt-orange accent enters here, once; hold 900ms

— SHOT 04 · 11.0–15.0s · RELEASE
PROMPT: <...>
IN-EDIT: stamp, 90ms snap; cut to frame 1 of shot 01 for the loop

FALLBACK: if shot 03's pull-back fails to hold the subject, build it in code instead —
a grid of copies is trivial in canvas and exact.
```

Always include the **IN-EDIT** column. It's what makes the sheet usable in CapCut instead of a
wish list, and it's where all the text and precision live.

## Hard limits to design around

Treat these as properties of the medium, true across generator families (specific versions vary —
check the current tool, don't assume):

- **Text is unusable.** Never ask for on-screen words. Add them in the edit.
- **Counts are approximate.** "Seven birds" yields "some birds." If the count is the joke, code it.
- **Timing is approximate.** You cannot specify "at 1.4 seconds." Beat-exact comedy must be cut in the edit or coded.
- **No cuts inside a clip.** Ask for one and you get a dissolve or a morph.
- **Cause and effect is weak.** A collision that must produce an exact consequence often doesn't. Split it into two shots: the impact, then the aftermath.
- **Hands, faces, gravity-critical actions** are still failure-prone. Use silhouettes, obscured angles, objects.
- **Repetition across generations drifts.** Two clips of "the same" thing will differ. Never build a piece that needs frame-level continuity between two generations.
- **Clip length is capped and short.** Plan in shots of a few seconds, and retime in the edit.
- **Prompt-only loops are unreliable.** See below.

Design *with* these limits: the one changed rule should be something a generator can render
physically, and everything precise should be the coded layer.

## Image-to-video

Usually the more controllable path, and the show already generates stills.

- Compose the still exactly — framing, palette, subject, negative space for overlays. Then the prompt only describes *motion*.
- Keep the motion prompt to one sentence of action plus one of camera. Long prompts fight the image.
- The still is the continuity anchor: use the same still (or a frame lifted from the previous clip) to start each shot of a sequence.
- **The last-frame trick:** export the final frame of clip A as the starting image for clip B. Best available continuity between generated shots.
- Note in the sheet which stills are needed, at what aspect, and what should be left empty for the coded overlay.

## Loops from generated clips

Generators don't reliably produce a seamless loop from a prompt. Strategies that do work:

1. **Cut on a hit.** End on an impact, a stamp, a blackout, or a whip pan, then cut to frame 1. The seam hides inside the event.
2. **Symmetric action.** Ask for an action that returns to its starting state (a door closing, a wave receding, something settling back). Then trim to the matching frames in the edit.
3. **Start-frame = end-frame.** Where the tool supports both a start and an end image, pass the same image for both.
4. **Palindrome.** Duplicate the clip reversed. Works for physical motion, obviously wrong for anything with direction (falling, reading, walking).
5. **Overlay carries the loop.** Let the generated plate be ambient and non-looping while a coded overlay does the exact cycle. Nobody notices the plate.

State which strategy the sheet is using — the editor needs to know before they trim.

## Aspect and length

- Generate in the target aspect where the tool allows it; generating wide and cropping to 9:16 loses the blocking you specified (see `visual-language.md` — re-block, don't crop).
- If only one aspect is available, compose for the *tightest* one and let the wider versions have margin.
- Ask for a shot ~1 second longer than needed at each end. Trim handles are free; re-generating isn't.
- Total piece length still obeys 5–30 s. More clips is not more piece.

## Editing assumptions

The show cuts in CapCut on iPhone/desktop. So:

- Deliver shots that survive being trimmed to the frame.
- Put all text, counters, stamps and verdicts in the edit, not the generation.
- Call out the audio hit points by timecode, as with coded pieces.
- Prefer 4–6 shots over 10 — each extra shot is a generation, a review and a trim.
- Say plainly which shots are likely to need re-rolls, so the budget lands where it's risky.

## Iteration protocol

When a generation misses, change **one** thing per attempt, in this order:

1. The **action** (is it physically describable?)
2. The **camera** (is drift ruining the framing? lock it explicitly)
3. The **negatives** (what unwanted thing keeps appearing?)
4. The **subject description** (simplify — fewer adjectives, stronger silhouette)
5. The **approach** (switch to image-to-video, or move the shot to code)

Three failed rolls on the same shot means the shot is wrong for generation. Code it or restage it.

## Checklist

- One action per prompt, no internal cuts.
- Style block verbatim in every prompt.
- Camera stated explicitly, including "locked-off, no camera movement" where wanted.
- Palette written as a restriction.
- Negatives include text/captions/logos/watermarks.
- Precision (counts, timing, numbers, text) moved to the coded/edit layer.
- IN-EDIT notes present for every shot.
- Loop strategy named.
- Aspect stated, with 1 s of handle at both ends.
- Fallbacks named for the risky shots.

---

> **[CREATOR INPUT NEEDED]**
> - Which generators Dev actually uses and in what order (the show's notes name Grok Imagine for image generation with his own photo as character reference, CapCut for the edit) — plus current clip-length and aspect options per tool, since these change fast.
> - His working prompt fragments that reliably produce the show's look, so the style block above can be replaced with the real one.
> - Whether generated footage is allowed on-channel for every format, or reserved for specific lanes.
