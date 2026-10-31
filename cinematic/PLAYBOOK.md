# STOOPID CINEMATICS — the playbook

How **PLEASE REMAIN SEEN** (the 2026 Halloween special, VAULT item 030) was made, so the next one starts from here instead of from zero. Read this before building the next cinematic.

- The film: `../stoopid_please_remain_seen.html`
- The source: `please-remain-seen/`
- The exact prompt that produced it: `please-remain-seen/BRIEF.md`
- The sequels: `please-hold/` (02), `still-here/` (03), `signal-received/` (04) and `overnight-operator/` (05, the first of the creepypasta run) `please-share/` (06) and `count-again/` (07). Each has its `BRIEF.md` and a README listing its limits. **Start a new film by copying the latest, `count-again/`.** It has the newest engine: caption layers burned into captures, feeds of one scene shown inside another, per-world looks, a bundled image asset, and a master silence gate. Portals live in `still-here/` if you need one.

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

### Added after STILL HERE (03)
- **Lock three blanks before designing anything:** the one idea, the flip, and a real-life anchor (`still-here/BRIEF.md`). The anchor gave the film a single concrete line to build toward, "You forgot our minute.", and every beat could be tested against it.
- **Two worlds, two photographic treatments.** Mark each shot `world: 'false' | 'real'` and switch the look per world in `main.js`. For the real world that means no instability, no halation, less grain, no teal. It's the cheapest way to make the ending feel more real than everything before it.
- **Story captions can carry who is speaking.** Station text wavers on its raster; The Algorithm is thin; family lines are clean and stable. Viewers read the difference before they read the words.
- **Outline and seam strips: additive blending, in front of the surface.** A black `MeshBasicMaterial` "off" state draws visible black lines; additive black is invisible. And a door box in front of its seams hides them.
- **Bodies: one smooth shape, not a pile of spheres.** Spheres stacked into a head or hand read as a doll. Instead, build the body under a blanket from one smooth profile along a centreline (height and width keyed along its length), and a hand from an extruded, bevelled outline with the fingers together. Keep them small, at the edge of the frame, in lamplight.
- **Put the practical lamp on the camera's side.** A lamp behind the headboard turned the headboard into a black slab that filled half the frame.
- **Metal needs an environment map.** Without one, `metalness: 0.8` renders black. Use low metalness and a light colour.
- **Reduced motion can break a shot whose story is the motion.** Damping toward the shot's midpoint turned the sit-down into a hover. Mark those moves `essential`.
- **A scripted silence gates everything**, voice slots included. Say so wherever the slots are documented.

### Added after SIGNAL RECEIVED (04)
- **A twist can turn the camera around.** 01–03 trained the audience to fear the watchers. 04 just shows the watchers, from behind, and lets one light source reveal who they are. The flip is a lighting cue, not a caption.
- **Silhouettes need a long lens.** From inside the crowd, heads filled the frame and read as mushrooms. From the back wall at about 17° FOV, a row of heads against one bright screen reads instantly.
- **Keep the heads in the dark until the reveal.** Light the floor and lower wall behind them (bodies read, heads don't) and save the light that shows the head shape for the flip.
- **A previous film's set can play inside the new one.** 04 imports 03's bedside room and renders it into a CRT through a `Feed`. Continuity costs almost nothing.
- **Formant filters need a low Q.** At Q 4–6 the humming choir all but disappeared, because the sawtooth harmonics missed the narrow bands. Measure it with `audio-levels`.
- **A dark object on a dark set needs its own key.** The hand on top of the set was invisible until it got a lighter material and a small spotlight.
- **Bundling an image:** import it (Vite inlines it as a data URL), `await img.decode()` at the top level (build target es2022), then build the world.

### Added after OVERNIGHT OPERATOR (05)
- **The creepypasta run takes shapes, not stories.** Use a pasta's form (rules for the night shift, the cursed image), never its characters or text. The repo is public. Free-license material (SCP is CC BY-SA) can come in with credit.
- **A prop can be the script.** The laminated card carries every beat: the camera reads a rule, then the station tests it. Lay the card out in code (`card.js`) and aim the camera at a rule's coordinates, never at guessed positions.
- **A desk lamp at 30 cm needs almost nothing.** A SpotLight at intensity ≈ 0.55 (decay 2) lights the card. 2.6 blew it out to white. Keep paper albedo off-white (`#cfc9b6`) and clearcoat low, or the hotspot eats the line that matters.
- **Props between the camera and the subject get huge.** The talkback panel sat in front of the card and filled half the frame in red. Put small props beside or behind the hero prop.
- **A flat hand reads as a slab when it holds something.** A loose fist of a few soft ellipsoids around the barrel, plus a dark sleeve, reads as a hand at the edge of frame.
- **LED clocks: no "88:88" ghost.** Under bloom it reads as a real digit ("84:58").
- **Playwright in a container:** if the pinned version can't find its browser, set `CHROMIUM_PATH` (the scripts in 05 read it).

### Added after PLEASE SHARE (06)
- **A sequel can reuse the whole set.** 06 is 05's control room the next night. The world barely changed: a trackball, the card's rule 9. Almost all the work went into what the screens show.
- **Place the reveal where the loading bar gets to it.** The image loads from the top, so the face had to sit low. The eyes are at about 62% and the smile below 93%, so nobody sees the smile until 100%. Check by snapshotting at each load step.
- **A held object and a hand on something are two different rigs.** The pen grip seen from the side read well. The same rig on a trackball hid the fist behind its own sleeve. Build each pose from the camera's side.
- **Keep the cursor off the line that matters.** It sat on top of "one more minute?" until it was moved to the end of the row.

### Added after COUNT AGAIN (07)
- **A window is a feed of the same scene in another state.** `main.js` lets a feed carry `pre()` and `post()`. The fourth monitor sets the room to "real" (warm mug, dry ink, the new operator), renders, then sets it back. That works without a second scene or a portal.
- **Walking needs only a bob and cuts.** The hall walks are keyed paths with a small step bob. Every "door" is a cut to the same entrance path, and the repetition sells the loop.
- **Dark on dark disappears in a feed.** The hood's black opening didn't show until the hood was a lighter burnt orange and had its own key light (on only while the window renders).
- **Check the line of sight before framing through a doorway.** The first microwave shot looked at the hall wall. The camera has to stand in front of the opening.

### Finding an anchor
Dev said he didn't know what his anchors would be. An anchor is one small, real thing the film can build toward. If nothing comes to mind, these questions help:
- What's something you do every night that nobody else knows about?
- What object would you grab first if you had to leave the house fast?
- What's the last message on your phone from someone you love, and what did it say?
- What job, room or routine do you remember better than you should?
- What sound means "home" to you?

When there's no answer, borrow one from the series (01's chair, 03's "one more minute"). Or use a small object the film can make physical (07's warm mug).

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

**STILL HERE (03)**
- Moments people mentioned:
- Did the knocks and "You forgot our minute." land as the turn without explanation?
- Did the real room feel more real than the station, or just different?
- Did the simple hands and the child under the quilt hold up, or distract?
- What to do more of:

**COUNT AGAIN (07)**
- Did the copies read as copies (chair, light, bars, wet ink) without being pointed at?
- Did the fourth monitor read as a window, and the hood as the next operator?
- Did FISH land as the one joke?
- What to do more of:

**PLEASE SHARE (06)**
- Did KIDDO and "night dad. one more minute?" land as the reason to cancel, without 03?
- Did "0 people felt better." land as the one joke?
- Was the face at 100% unsettling enough, or too plain?
- What to do more of:

**OVERNIGHT OPERATOR (05)**
- Did the microwave land as the one joke, and did it make the next beat worse?
- Did the rule-1 feed (the room from behind you, no one in the chair) read without explanation?
- Did the hand writing rule 7 land as the flip?
- What to do more of:

**SIGNAL RECEIVED (04)**
- Did the bowl-cut reveal land as a laugh, a chill, or both?
- Did "THIS PLANET IS NO LONGER AVAILABLE IN YOUR REGION." play as the one joke?
- Did Earth's ending (white, NO SIGNAL, the empty bracket) feel too heavy after 03, or right?
- What to do more of:
