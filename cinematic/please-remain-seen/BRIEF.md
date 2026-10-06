# The original brief — PLEASE REMAIN SEEN

This is the prompt that produced the Halloween special, kept word for word because it worked. The last sentence was cut off in the original message ("...while retaining"). It was interpreted as "while retaining captions and audio."

Reuse its *shape* for the next one (see `../PLAYBOOK.md`).

---

Build a complete, visually ambitious Halloween horror cinematic for THE STOOPID SHOW using JavaScript. Work in the current repository. Inspect it first, preserve existing work, then implement and run the experience. Make reasonable creative decisions and carry this through to a working result.

TITLE: "PLEASE REMAIN SEEN"
FORMAT: A 90-second, automatically choreographed browser cinematic, primarily 16:9 at 1920×1080, suitable for recording and editing into a show.
GENRE: Supernatural broadcast horror, liminal architecture, psychological dread, and one perfectly timed absurdist joke.
You are acting as a film director, cinematographer, sound designer, and creative graphics engineer. Build an actual film with spatial environments, purposeful shots, lighting, editing, and sound.

CREATIVE CONTEXT
THE STOOPID SHOW combines existential reflection, strange humor, and unsettling media satire. Its recurring narrator, "The Algorithm," treats human behavior like a nature documentary.
For this standalone Halloween special, The Algorithm has become frightened of something living inside its audience metrics. The entity survives by being observed.
The emotional idea: even something monstrous can be terrified of being forgotten.
Keep the horror sincere. Let one bureaucratically stupid interruption make the dread stranger. Avoid generic Halloween decoration, meme overload, and nonstop glitch effects.

VISUAL DIRECTION
Create a deserted late-night television station connected to a physically impossible hallway.
Build a small number of excellent environments:
* A dark broadcast control room with a CRT, mixing console, scattered cables, glass partition, and an empty chair.
* A corridor with repeated doorframes, damaged ceiling fixtures, damp reflective flooring, and a distant red tally light.
* A studio containing one chair beneath a hanging microphone.

Reuse these spaces through different camera angles and changed lighting.
Palette: deep charcoal, dirty teal, restrained ultraviolet, sickly off-white, and tiny amounts of emergency orange/red.
Use cinematic composition:
* Foreground obstructions and strong silhouettes.
* Deliberate pools of light with readable shadow detail.
* Slow dolly movement with subtle acceleration and deceleration.
* Perspective compression, negative space, and motivated focus changes.
* Sparing film grain, halation, vignette, and analog image instability.
* Wet-floor reflections or a convincing economical approximation.
* Dust visible only where light catches it.

Preserve visual clarity. Darkness must conceal specific information without making the whole frame unreadable.

THE ENTITY
A tall, almost human silhouette assembled from misaligned pieces of broadcast imagery. Its body seems a few frames out of sync with the room.
Avoid a detailed humanoid model if it would look cheap. A carefully lit silhouette with displaced geometry and a custom material is preferable.
Its appearance follows rules:
1. It first appears only in the CRT image.
2. Its shadow appears in the room before its body does.
3. It moves during motivated obstructions or cuts.
4. When physically revealed, it is facing away from the camera.
5. Its final approach happens without a loud musical sting.

No webcam access, microphone access, personal-data collection, or fake system warnings. All apparent "observation" is fictional.

EXACT 90-SECOND STORYBOARD
0–10 seconds — STATION IDENT
Open on near-black with faint electrical hum.
Reveal a CRT in a dark control room through a slow camera move.
On its screen: "STOOPID AFTER HOURS" / "HALLOWEEN SPECIAL"
Briefly show: "VIEWERS: 1"
The CRT image contains a tiny silhouette that is absent from the actual room.

10–24 seconds — THE EMPTY CHAIR
Cut to the studio chair through the control-room window.
The hanging microphone rotates slightly with no obvious cause.
The Algorithm's caption: "Here we observe a creator in its natural habitat."
Pause. "The creator is absent."
The chair slowly turns toward the glass.
A second shadow crosses behind the camera's reflected position.

24–40 seconds — THE HALLWAY
Slow forward tracking shot down the corridor.
Each ceiling fixture dims as the camera passes beneath it.
The CRT at the far end displays this same hallway from a camera position several feet behind us.
Its feed reveals the silhouette standing directly behind the cinematic camera.
Do not immediately turn around.
Caption: "Something has remained to maintain engagement."
Viewer counter changes to 2.

40–49 seconds — REQUIRED INTERRUPTION
Hard cut to a sterile station card: "YOUR FEAR IS IMPORTANT TO US."
Below: "Please remain frightened."
A tiny progress indicator gets stuck at 99%.
Hold long enough to become uncomfortable and briefly funny.
One dry notification chime.
Then the card tears away into the actual room, as if it was covering a window.

49–67 seconds — THE OBSERVER
Return to the studio.
The entity stands beneath the microphone, facing away.
The camera arcs slowly; the entity's orientation subtly changes to keep its face hidden.
Caption: "It does not want to hurt you."
Long pause. "It wants you to keep watching."
The studio's red tally light illuminates.
The empty chair is now visibly behind the camera in the control-room monitor.

67–81 seconds — DISCONNECTION
The Algorithm's delivery breaks down, represented by increasingly incomplete captions:
"If you leave…" / "…does it stop existing?"
All monitors lose their pictures one at a time.
Each lost picture removes a light source from the room.
The entity is closer after each motivated moment of darkness.
No rapid strobing.
The final CRT says: "VIEWERS: 1" Then: "WHO IS WATCHING WHOM?"
Almost all sound falls away.

81–90 seconds — THE REQUEST
Cut to black for a deliberate beat.
A small, centered line appears: "Stay?"
Hold.
Reveal that the word is displayed on a CRT inches from the lens.
A hand made of faint scanlines gently rests on top of the screen.
Final card: "THE STOOPID SHOW" / "PLEASE REMAIN SEEN"
Finish with a soft relay click and complete silence.
Do not add a comedic postscript.

TECHNICAL IMPLEMENTATION
Use Three.js with JavaScript and an appropriate lightweight build setup, such as Vite, unless the repository already provides suitable tools.
Use:
* Real 3D environments and carefully art-directed procedural geometry.
* Custom shaders where they materially improve the CRT, entity, atmosphere, or image treatment.
* Canvas textures for readable CRT graphics.
* Web Audio for an original procedural soundtrack and sound effects.
* A central, deterministic timeline driving every shot, transition, subtitle, light cue, and audio cue.

Do not require paid assets, API keys, remote generation services, or externally hosted models. Bundle dependencies and assets appropriately. The finished experience should not depend on a CDN at playback time.
Prioritize excellent composition and sound over expensive effects. Use restrained bloom and selective shadows. Approximate atmospheric light with economical techniques if necessary. Avoid layering full-screen effects until the image becomes muddy.
Make animation state derive from timeline time so pause, replay, and seeking work correctly. Use seeded randomness for flicker, grain behavior, and entity distortion where repeatability matters.

AUDIO DIRECTION
Build tension through:
* Transformer hum and subtle room tone.
* Distant metal movement.
* Relay clicks and CRT power sounds.
* Quiet stereo movement suggesting something off-screen.
* Slow, restrained low-frequency swells.
* Silence before the ending.

Keep volume comfortable, avoid extreme peaks, and provide a visible mute control before playback.
Do not use browser speech synthesis for the narrator. Present the scripted lines as carefully timed cinematic captions. Structure narration cues so recorded voice-over can be added later without rewriting the timeline.

PLAYBACK AND CAPTURE
Provide a minimal opening screen: "STOOPID AFTER HOURS" / "Enter broadcast"
A short note: "Contains unsettling imagery and mild flicker."
One click starts playback and unlocks audio.
Include discreet controls that disappear during playback:
* Play/pause. * Restart. * Mute. * Fullscreen. * Timeline scrubber. * Quality selection. * Captions toggle.

Provide a clean capture mode with all interface elements hidden, while retaining *(message ends here)*
