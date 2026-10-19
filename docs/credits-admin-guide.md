# THE CREDITS DEPARTMENT — admin guide

*Form CD-002: "How To Thank People Without Rebuilding Anything."*

The console lives at **`/credits/admin/`** (`https://devinrasche-hub.github.io/stoopid-toolkit/credits/admin/`). Sign in with the admin token (see `credits-deployment.md`). Tick *Remember on this device* only on your own computer. Otherwise the token is forgotten when the tab closes.

The page itself holds nothing. Every number, name and button goes through the Credits API, which checks the token on every request. Every change lands in the **Audit Log** with the name you typed at sign-in.

---

## 1. The per-episode workflow (PRODUCE CREDITS)

| Step | What you do | What's automatic |
|---|---|---|
| 1. Open | Sign in. | — |
| 2. Select episode | Pick it, or **+ NEW EPISODE** (number + title). | Theme, timing, end card and top-N carry over from the last episode. |
| 3. Review supporters | Clear **Requests** and confirm any self-reported 𝕏 subscribers in **Contributors**. Add new paid subscribers (manual or **Import**). | The workflow strip turns gold until requests are reviewed. |
| 4. Preview eligible | Read **WHO'S IN, WHO'S NEXT**. | Fair Recognition Engine runs on every change. |
| 5. Freeze arcade | **FREEZE SNAPSHOT** (optional: change TOP N). | Finalising freezes one automatically if you forget. |
| 6. Collaborators | Add people who worked on this episode with their role. | They're always credited and never rotated out. |
| 7. Consent & rules | Read the warnings list (shortened names, overflow, skipped empty sections). | Dedupe, consent and caps are applied for you. |
| 8. Preview credits | Play / pause / scrub, switch segments on/off, change seconds, reorder, theme, end card, notices. **↻ REGENERATE** reshuffles. **SAVE DRAFT**. | The preview *is* the export renderer. |
| 9. Export | PNG cards, transparent cards, real-time recording, or `sequence.json` / the render command for frame-exact MP4. | See `credits-video-export.md`. |
| 10. Publish | **FINALISE & PUBLISH**. | Locks revision 1, records who appeared (for next episode's rotation), publishes to `/credits/episodes/?ep=N`. |

**Next episode:** click **+ NEW EPISODE**. Everything above starts from where you left off, and people shown this time move to the back of the queue.

### Corrections after publishing
Published credits never change silently. On a published episode:
- Edit the draft (or contributors) and use **ISSUE CORRECTION** with a reason → revision 2, 3… Old revisions stay public under *Revision history*.
- To fix the leaderboard (e.g. a name excluded after review): set the rule in **Arcade**, then **RE-FREEZE** with a reason in Produce. The new snapshot *supersedes* the old one, and a corrected revision is issued.

### Per-episode choices in WHO'S IN
- **✕** next to a name leaves them out of *this* episode only (they keep their place in line).
- **＋** next to a deferred name brings them forward this episode.
- Expand *Excluded & why* to see consent, dedupe and producer exclusions.

## 2. Adding supporters (THE FINANCIALLY IRRESPONSIBLE)

𝕏 does not offer an API for your subscriber list (`credits-integrations.md`), so supporters come from you:

- **One at a time:** Contributors → **+ ADD PERSON** → name, visibility, consent, then tick *THE FINANCIALLY IRRESPONSIBLE* and **SAVE**, then add their 𝕏 handle under Accounts.
- **In bulk:** Import → choose your CSV (any columns; the department guesses the mapping and you can change it) → **DRY RUN** → check the preview → **IMPORT FOR REAL**. People already on file (same handle) are updated, not duplicated. A "status" column with *cancelled / expired / inactive* makes them *former*.
- **Consent:** imported people default to **Private**. Make someone Public only when they agreed to be named. Record how in *Consent note*, which is kept in history.
- **Anonymous** supporters are counted on screen ("+ 3 ANONYMOUS") and on the Hall, never named.
- **Former** supporters stay on file for historical recognition but stop rotating into new episodes.

Payment amounts, emails and billing data are never needed. Don't import them.

## 3. Adding creators (MUTUAL ENABLERS)

Creators → **ADD A CREATOR**: name, 𝕏 handle, kind of work, *why you support them* (public), optional link. Then in the table:
- **Featured** puts them first in the credits and on the Hall's Creator Discovery.
- **Order** sorts the directory.
- **APPROVE LINK** publishes their website link. 𝕏 profile links appear automatically from the handle.

The directory says plainly that listing is appreciation, not sponsorship or endorsement. Add an avatar URL only if you have the rights to use the image.

## 4. Category memberships

Open any contributor. Under **CATEGORIES** tick a box, choose verification (*Manual*, *Verified*, *Self-reported*), optionally *Featured*, a label and a public reason, and click **SAVE** on that row. One person can be in every category. They're still one record, and the engine shows them at most once per episode among rotating sections.

Category names, taglines, caps (how many per episode), seconds on screen, order and on/off are in **Settings → Categories**. You can add your own categories there (curated, rotating or episode-specific).

## 5. YouTube subscribers (THE VOLUNTARY WITNESSES)

Viewers ask at `/credits/join/`. Their requests arrive in **Requests**:
- The department suggests a *possible match* if the handle or name is already on file. Tick it to attach instead of creating a duplicate.
- Choose the category (it defaults from what they picked), verification (*self-reported* unless you checked), and whether the link is approved.
- **APPROVE** creates or updates the contributor and records their consent. **REJECT** keeps it private.

Self-reported subscriptions are labelled *SELF-REPORTED* everywhere they're shown.

If “Verify with YouTube” is switched on (`credits-integrations.md`), viewers can confirm their subscription with Google from their receipt. The request then shows **VERIFIED WITH GOOGLE** and approval defaults to *Verified*. If they verify after you approved, their credit upgrades automatically.

## 6. The Fair Recognition Engine (the rules)

In this order, per episode:
1. **Episode contributions** (ACTUAL HUMAN RESOURCES) are always credited, if the person consented.
2. **Arcade positions** are facts from the frozen snapshot: top N by the feed's own position. Equal Beans share a rank (T-03). People tied just outside the top N are noted ("+2 MORE TIED AT 5 BEANS").
3. **Creators**: featured first, then your order, then rotation.
4. **Rotating & curated sections**: eligible = active member + public + consented. Order: featured → never shown → shown longest ago → shown fewest times → member longest → seeded tiebreak. Cap per category; the rest are *deferred* to next episode.
5. **Dedupe**: once someone is credited in a fixed or earlier section, rotating sections skip them (toggle in Settings).
6. **Display order** inside a page is shuffled by the episode's seed so nobody is always last.
7. **Overflow**: pages hold a fixed number of names (10 Terminal / 8 Midnight / 10 Beans). If a segment can't show everyone with at least 3 s per page, the last slot says "+N MORE IN THE ARCHIVE" (or switch *Names* to *lengthen segment*). Text is never shrunk below 40 px at 1080p. Names over 24–26 characters are shortened *on screen only*; the archive keeps the full name.

No likes, reposts, view counts or AI are used anywhere.

## 7. The arcade (Bean Counters)

**Arcade** shows the live feed with moderation:
- **EXCLUDE** a name (with a reason) to keep it out of credits and the Hall. Positions are never renumbered.
- Names matching **Settings → Name filter** are *flagged* and held until you **APPROVE** them.
- **RECORD NOW** saves today's feed copy. A daily job does this anyway, and also imports the feed's past versions from GitHub a batch at a time. **IMPORT FEED GIT HISTORY** runs those batches now.
- Weekly and monthly leaders only appear once the department has a real copy from 7 / 30 days earlier. They are never estimated.

## 8. Spotlight, Hall of Fame, Humor Engine

- **Spotlight & Fame → Community Spotlight**: pick a person, a headline and an optional date window. Active spotlights rotate weekly on the Hall.
- **Hall of Fame**: induct a contributor *or* name a moment ("The First Eight Players"), with season and date. **Bean champions** fill themselves in from each published episode's snapshot.
- **Humor Engine**: the footer notices. Enable/disable, restrict to themes (`*` or `terminal,midnight,beans`). Each episode draws them with its saved seed, or pick your own under *Notices: my picks* in Produce. Jokes are never generated about named people.

## 9. Privacy requests

| Request | Do this |
|---|---|
| "Stop showing my name" | They can do it themselves at `/credits/join/#withdraw` with their reference + key (immediate). Or open their record and set Visibility to *Private* (add a consent note). |
| "Show me my data" | Contributor → **EXPORT THIS PERSON'S DATA** (JSON). |
| "Delete me" | Contributor → **ERASE (PRIVACY REQUEST)** and type `ERASE`. Personal data is deleted; a tombstone keeps archives redacted. |
| "Change my name / link" | Edit the record, or they send an update from the join page (it comes back to Requests). |

Withdrawal and erasure take effect on **every** public page and archived episode at once. Archived versions aren't edited; names are redacted when served.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Sign-in says "Admin is not configured" | `ADMIN_TOKEN` secret missing or < 32 chars. Set `CREDITS_ADMIN_TOKEN` and re-run the deploy workflow. |
| "Too many failed sign-ins" | 20 wrong tokens in an hour from your connection. Wait an hour. |
| Public pages say "THE CREDITS OFFICE IS TEMPORARILY CLOSED" | API unreachable. Bean Legends falls back to the raw feed automatically. Check Cloudflare and the deploy workflow. |
| Beans feed shows **ERROR** in Overview | The feed file is missing, malformed, or GitHub is down. Nothing is published from a broken feed; finalising refuses until it's readable. **CHECK BEANS FEED NOW** retries. |
| A name looks cut off in the video | It's over the theme's on-screen limit. The archive shows it in full. A warning tells you which. |
| Real-time recording stutters | Background tabs throttle. Keep the tab visible, or use the render command (frame-exact). |
| Preview shows "LIVE" leaderboard warning | You haven't frozen a snapshot yet. Freeze it, or finalising will. |
