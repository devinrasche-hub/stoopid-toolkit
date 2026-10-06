# STOOPID CINEMATICS — the playbook

How **PLEASE REMAIN SEEN** (the 2026 Halloween special, VAULT item 030) was made, so the next one starts from here instead of from zero. Read this before building the next cinematic.

- The film: `../stoopid_please_remain_seen.html`
- The source: `please-remain-seen/`
- The exact prompt that produced it: `please-remain-seen/BRIEF.md`

---

## 1. Why it worked

These were the ingredients. Keep all of them next time.

1. **A brief with an exact storyboard.** Second-by-second beats, the exact on-screen words, and what the camera does. Everything vague got decided by the director; everything exact landed.
2. **One emotional idea.** *Even something monstrous can be terrified of being forgotten.* Every shot serves that. This is the show's One Idea Law applied to film.
3. **Rules for the monster.** Five rules for how the entity may appear. Rules make dread: the audience learns the rules without being told, then feels them tighten.
4. **One joke, perfectly placed.** "YOUR FEAR IS IMPORTANT TO US. / Please remain frightened." with the bar stuck at 99%. It sits at the exact midpoint, held too long, in total silence except one chime. The joke makes the horror after it worse, not lighter. That's the flip working in reverse.
5. **A few spaces, reused.** Three environments (control room, studio, corridor) shot from many angles with changed lighting. A few excellent sets beat many okay ones.
6. **Real screens.** Every monitor shows a live camera from inside the world. The hallway CRT really is filming from behind you. Diegetic truth makes the fiction scary.
7. **Sound as half the film.** Hum, relays, a sub-bass swell, sound placed behind the listener, then real silence. The ending is quiet on purpose.
8. **Restraint.** No gore, no jump-scare sting, no strobing, no meme overload. The brief said so, and it was right.

## 2. The brief template

Copy this and fill it in. The structure of `please-remain-seen/BRIEF.md` is the proven shape.

```
Build a complete, visually ambitious <occasion> cinematic for THE STOOPID SHOW using JavaScript.
Work in this repository. Read cinematic/PLAYBOOK.md first and build on cinematic/please-remain-seen/.

TITLE:
FORMAT:  <length>-second browser cinematic, 16:9 1920×1080, for recording into the show.
GENRE:   <genre> + exactly ONE <kind of> joke.
ROLE:    director, cinematographer, sound designer, graphics engineer.

CREATIVE CONTEXT
- The one idea (one sentence, no "and"):
- The emotional truth underneath:
- Who narrates (The Algorithm? Dev? nobody?):
- The flip — the moment the absurd turns true:
- Family / real-life anchor (if any):
- Tone guardrails (what to avoid):

VISUAL DIRECTION
- 2–3 environments, each described in one line with its key props:
- Palette (or "SIGNAL palette"):
- Camera language (dolly, handheld, locked-off…):
- Image treatment limits:

THE <SUBJECT>
- What it is, what it must NOT look like:
- Rules for how it appears (3–5 numbered rules):

EXACT STORYBOARD
<start–end seconds> — <BEAT NAME>
  What we see. Exact on-screen text in quotes. Exact captions in quotes.
  What the camera does. What changes in light or sound.
(repeat for every beat; put the joke/interruption at the midpoint)

AUDIO DIRECTION
- Beds, one-shots, where it gets quiet, how it ends:

PLAYBACK AND CAPTURE
- Same as PLEASE REMAIN SEEN unless changed: opening screen, auto-hiding controls,
  captions toggle, clean capture mode (keeps captions + audio), REC, WAV, frame render.
```

## 3. How the build went (do it in this order)

1. **Read the repo and the brief.** Decide where the source and the published file live. Source goes in `cinematic/<slug>/`, the build is published as `/stoopid_<slug>.html`, and the film is added to THE VAULT.
2. **Timeline first.** Write every beat as a named time in `timeline.js` (`CUE`), plus the shot list and the captions. Every other file reads times from there.
3. **Engine pieces.** CRT, reflections/shafts/dust/feeds, post pipeline, audio engine. These are reusable as-is (see §5).
4. **Environments.** Rough geometry, then lights, then materials.
5. **Cameras.** One function per shot in `shots.js`.
6. **The director.** Map `t` → lights, props, screens, the subject.
7. **The look-at-it loop (§4)** until every shot reads. This took more passes than anything else and is where the quality came from.
8. **Sound pass, then measure levels.**
9. **UI flow test, publish, add to the vault, README.**

## 4. The look-at-it loop

Never trust a shot you haven't looked at. From `please-remain-seen/`:

```
npm install && npm i -D playwright
npm run build
npm run snapshot -- --t 4.5,13,22.4,33.5,52,79,87 --quality low
npm run audio-levels
```

- `snapshot` renders stills at the given times, writes a contact sheet, and lists console errors. Look at the whole sheet each round. Fix the worst-reading shot first.
- `audio-levels` prints peak/RMS for every second. Use it for audio QA when you can't listen. Targets: peaks ≤ −6 dBFS, quiet beats below −45, true silence at −120.
- Headless rendering uses software GL. It's good for composition, useless for frame rate. Test real speed on a real GPU.

## 5. Reuse map

| Keep as-is (engine) | Rewrite per film (content) |
|---|---|
| `util.js` — easing, seeded noise, keyframes | `timeline.js` — beats, shots, captions |
| `crt.js` — CRT model, screen shader, overlay text | `shots.js` — camera paths |
| `fx.js` — reflections, light shafts, lit dust, live feeds | `director.js` — what happens when |
| `post.js` — DOF, bloom/halation, grade, grain, card tear | `world.js` — the sets |
| `audio.js` engine half (buses, `schedule`, FX library, WAV) | `audio.js` `ENV` + `cueList()` — the score |
| `main.js` — player, controls, capture, REC | `entity.js` — the subject |
| `scripts/*` — publish, frames, snapshot, levels | `cards.js` — interruption + title text |

To start: copy `please-remain-seen/` to `cinematic/<new-slug>/`, rename the publish target in `scripts/publish.mjs`, and replace the right-hand column.

## 6. Lessons that cost real time (don't relearn these)

- **Light units.** Three.js uses physical lights and converts hex colors to linear, so dark hex colors become *very* dark. Use mid-gray-ish albedos (e.g. `0x8a918d` with a grime texture) and strong lights (studio key ≈ 320, corridor fixtures ≈ 10, practicals 2–6). Judge the result in stills, not in your head.
- **Instanced, scaled geometry needs inverse-transpose normals.** `transpose(inverse(mat3(instanceMatrix))) * normal`. Without it the entity looked like a lit robot instead of a silhouette.
- **Never add color to black in the grade.** A teal lift on shadows killed the "cut to black". Tint shadows *multiplicatively* instead.
- **Apply grain in display space (after sRGB).** In linear space it explodes in the shadows.
- **Reverb sends go after the envelope gain.** Sending pre-envelope made two beds drone through the entire film, including the "silent" ending. `audio-levels` caught it.
- **A light in front of a screen lights its own bezel.** Use matte plastic (roughness 0.85) and set the light offset per monitor.
- **`hidden` attributes lose to CSS `display`.** Keep `[hidden]{display:none!important}`.
- **Silhouettes need something to stand against.** Add a back-wall wash, a lit doorway, or haze. Black on black reads as nothing.
- **Shadows thrown by a near lamp are bigger than the body.** Scale them up, or they don't read in a reflection.
- **Close foreground blur needs a big aperture value** (blur ≈ 0.045). Small values do nothing at short distances.
- **Keep lens-side clutter on render layer 2** so in-world cameras don't see props meant only for the cinematic camera.

### Added after PLEASE HOLD (02)
- **Burn captions into the picture.** HTML captions don't appear in canvas recordings. Paint them on a canvas layer composited in the final pass (`cards.js` + `post.js`).
- **Impossible architecture:** use a portal (render the far scene from `toAnchor · fromAnchor⁻¹ · viewer`, sample in screen space, clip plane at the doorway). Set the portal camera's `matrix`, not only `matrixWorld`, because `render()` copies one into the other. Sample with the *main* frame size, not the render-target size.
- **"Frame-exact" means settled.** Double-buffered feeds need two passes. A portal whose CRT shows a feed containing the portal needs three. Reflectors inside a portal must render, not be skipped, or they show a stale image.
- **A reaching arm must shorten to its target**, or it passes through what it touches (and across the lens).
- **Self-lit indicators shouldn't take fog** (`fog: false`), or a row of distant lamps vanishes.
- **A shadow-only object** is a material with `colorWrite: false, depthWrite: false`; it still casts into shadow maps.
- **A master gate on the mix** is the reliable way to make silence silent: it removes every reverb tail at once.
- **Prewarm**: compile each scene and render each shot once behind the opening screen, then enable Start.

## 7. Brand note

The brief set its own palette (charcoal, dirty teal, restrained ultraviolet, sickly off-white, a little emergency red/orange). That's darker and dirtier than the SIGNAL palette (`#000 #FFF #00FFC6 #8A2BE2 #FF2D2D #CC5500`). For a special, the brief wins. For on-brand pieces, start from SIGNAL, and keep Burnt Orange `#CC5500` for the moment the flip lands.

## 8. Audience notes

*Fill this in after each release. It's the most valuable section for the next one.*

**PLEASE REMAIN SEEN (Halloween 2026)**
- People loved it.
- Moments people mentioned:
- Where people said it dragged or confused them:
- Where it was posted and how it did:
- What to do more of:

**PLEASE HOLD (02)**
- Moments people mentioned:
- Did the elevator / control-room reveal read without explanation?
- Did the phone joke land?
- What to do more of:
