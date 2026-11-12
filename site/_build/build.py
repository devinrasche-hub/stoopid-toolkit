#!/usr/bin/env python3
"""Builds the stoopidtv.com static site into site/.

Run from anywhere:  python3 site/_build/build.py

- embeds-original/*.html are the page bodies exactly as they were served inside
  the old Wix site. They are copied to site/embeds/ with only their
  stoopidtv.com links rewritten to relative ones.
- Every page is a thin shell (header, nav, footer) around one or more of those
  embeds, or around the hand-written content below.
- All links are relative, so the folder works at a domain root or in a subfolder.
"""
import html
import pathlib
import re

BUILD = pathlib.Path(__file__).resolve().parent
SITE = BUILD.parent

CANONICAL = "https://www.stoopidtv.com"
ASK_DEV = "https://devinrasche-hub.github.io/stoopid-toolkit/ask-dev/"
BMC = "https://buymeacoffee.com/devinrasche"
DISCORD = "https://discord.gg/HfMSzrEEx"

NAV = [
    ("", "Home"),
    ("episodes", "Watch"),
    ("music", "Humble Poe"),
    ("book", "Book"),
    ("beans", "Beans"),
    ("arcade", "Arcade"),
    ("realm", "The Realm"),
    ("donate", "Back the Show"),
]

SOCIAL = [
    ("YouTube", "https://www.youtube.com/@STOOPIDShow",
     '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>'),
    ("X, the show", "https://x.com/STOOPIDshow",
     '<path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.5z"/>'),
    ("X, Dev", "https://x.com/xbSTOOPID",
     '<path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.5z"/>'),
    ("Instagram", "https://www.instagram.com/xbstoopidshow",
     '<path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM21 8a5.4 5.4 0 0 0-1.5-3.8A5.4 5.4 0 0 0 15.700 2.700C14.200 2.600 9.800 2.600 8.300 2.700A5.400 5.400 0 0 0 4.500 4.200 5.400 5.400 0 0 0 3 8c-.100 1.500-.100 6.500 0 8a5.400 5.400 0 0 0 1.500 3.800A5.400 5.400 0 0 0 8.300 21.300c1.500.100 5.900.100 7.400 0a5.400 5.400 0 0 0 3.800-1.500A5.400 5.400 0 0 0 21 16c.100-1.500.100-6.500 0-8zm-2 9.100a3.100 3.100 0 0 1-1.700 1.700c-1.200.500-4 .400-5.300.400s-4.100.100-5.300-.400A3.100 3.100 0 0 1 5 17.100c-.500-1.200-.400-4-.400-5.100s-.100-3.900.400-5.100A3.100 3.100 0 0 1 6.700 5.200c1.200-.500 4-.400 5.300-.400s4.100-.100 5.300.400A3.100 3.100 0 0 1 19 6.900c.500 1.200.400 4 .400 5.100s.100 3.900-.400 5.100z"/>'),
    ("Discord", DISCORD,
     '<path d="M19.5 5.300A17 17 0 0 0 15.300 4l-.500 1.100a15.600 15.600 0 0 0-5.600 0L8.700 4a17 17 0 0 0-4.200 1.300C1.800 9.400 1.100 13.300 1.500 17.200A17 17 0 0 0 6.700 19.800l1.100-1.800a11 11 0 0 1-1.800-.900l.400-.300a12.100 12.100 0 0 0 11.200 0l.400.300c-.600.300-1.200.600-1.800.900l1.100 1.800a17 17 0 0 0 5.200-2.600c.500-4.500-.700-8.400-3-11.900zM8.700 14.800c-1 0-1.900-1-1.900-2.100s.800-2.100 1.900-2.100 1.900 1 1.900 2.100-.800 2.100-1.900 2.100zm6.600 0c-1 0-1.900-1-1.900-2.100s.800-2.100 1.900-2.100 1.900 1 1.900 2.100-.800 2.100-1.900 2.100z"/>'),
]

# ---------------------------------------------------------------- pages

def frame(name, title, cls="embed", extra=""):
    return (f'<iframe class="{cls}" src="{{root}}embeds/{name}.html" title="{html.escape(title)}" '
            f'loading="eager"{extra}></iframe>')


DONATE = """
<section class="page split">
  <div class="split-art" aria-hidden="true"><div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>STV</span></div>
  <div class="split-copy">
    <p class="tag">Back the Show</p>
    <h1>Fuel the Weird</h1>
    <p class="lede">Every dollar goes back into making the show, the music, and the community better. No investors. No ads. Just you keeping this human.</p>
    <p><a class="btn" href="{bmc}" target="_blank" rel="noopener">Chip in on Buy Me a Coffee</a></p>
    <p class="fine">One time or monthly, any amount. Opens buymeacoffee.com.</p>
    <p class="aside">Can't chip in? <a href="{root}episodes/">Watch an episode</a>, share it with a friend, <a href="{discord}" target="_blank" rel="noopener">join the community</a>. That counts too.</p>
  </div>
</section>
"""

SERVICES = [
    ("Set Up Your AI Helpers", "1 hr", "$99",
     "you leave with your own ai assistant, a posting schedule, and one thing on your plate automated. written recap after. intro price for the first 10 bookings, then $150."),
    ("Posting Game Plan", "1 hr", "$99",
     "i look at your profiles first, then we figure out what to post, how often, and how to get people to actually reply. one-page plan after. intro price, then $150."),
    ("Clip Pack (5 clips)", "15 min", "$149",
     "send me one long video. i pick the moments and send back 5 captioned vertical clips for x, tiktok, reels and shorts. one round of tweaks. intro price, then $175."),
    ("Clip Pack (10 clips)", "15 min", "$249",
     "same deal, 10 clips. one round of tweaks. intro price, then $295."),
]

HIRE = """
<section class="page">
  <p class="tag">Hire Dev</p>
  <h1>Our Services</h1>
  <p class="lede">Online, by video call. Pick one and tell me a little about what you need.</p>
  <div class="cards">
{cards}
  </div>
</section>
"""

CARD = """    <article class="card">
      <h2>{name}</h2>
      <p class="meta"><span>{length}</span><b>{price}</b></p>
      <p>{blurb}</p>
      <p><a class="btn" href="{ask}" target="_blank" rel="noopener">Book Now</a></p>
    </article>"""

EARN = """
<section class="page narrow">
  <p class="tag">Earn</p>
  <h1>Your time is worth money. Finally.</h1>
  <p class="lede">STOOPID is a platform that pays you for your time and attention.</p>
  <p class="lede">Get early access before we launch.<br><span class="fine">(Or, well, it WILL be!)</span></p>
  <form class="signup stack" data-list="earn" action="{root}api/signup" method="post" novalidate>
    <label>First name *<input type="text" name="first_name" autocomplete="given-name" maxlength="80" required></label>
    <label>Email address *<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
    <label>Where do you mainly hang out?<input type="text" name="hangout" maxlength="200"></label>
    <label class="hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
    <button class="btn" type="submit">Submit</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <p class="aside">Already earning beans? <a href="{root}beans/">See how beans work</a>.</p>
</section>
"""

NOTFOUND = """
<section class="page narrow">
  <p class="tag">No signal</p>
  <h1>Nothing on this channel.</h1>
  <p class="lede">That page isn't here. Try one of the channels up top.</p>
  <p><a class="btn" href="/">Back to STOOPID TV</a></p>
</section>
"""

HOME_DESC = ("A dumb little show and a not-so-dumb little band from the same guy. "
             "Watch episodes, hear Humble Poe, grab the book, earn beans.")

PAGES = [
    # path, nav key, title, description, body
    ("", "", "STOOPID TV | The Stoopid Show + Humble Poe", HOME_DESC, frame("home", "STOOPID TV")),
    ("episodes", "episodes", "Watch | STOOPID TV", "Every episode of The Stoopid Show.", frame("watch", "Watch")),
    ("music", "music", "Humble Poe | STOOPID TV", "Humble Poe: the not-so-dumb little band on channel 2.", frame("humble-poe", "Humble Poe")),
    ("book", "book", "Book | STOOPID TV", "STOOPID, But True: the book.", frame("book", "STOOPID, But True")),
    ("beans", "beans", "Beans | STOOPID TV", "What beans are, how to earn them, and the leaderboard.", frame("beans", "Beans")),
    ("arcade", "arcade", "Arcade | STOOPID TV", "Play STOOPID BOY and the rest of the arcade.",
     '<div class="game-wrap">' + frame("stoopid-boy", "STOOPID BOY", "game", ' scrolling="no" allow="autoplay; fullscreen"') + "</div>\n"
     + frame("arcade", "The Arcade")),
    ("realm", "realm", "The Realm | STOOPID TV", "The Stoopid Realm: the community.", frame("realm", "The Stoopid Realm")),
    ("magic-errands", None, "Magic Errands | STOOPID TV", "Magic Errands: get it done.", frame("magic-errands", "Magic Errands")),
    ("magic-errands-what-do-you-need-done", None, "Magic Errands | STOOPID TV", "Magic Errands: what do you need done?",
     frame("magic-errands-request", "Magic Errands")),
    ("donate", "donate", "Fuel the Weird | STOOPID TV",
     "Support the STOOPID Show directly. Every dollar goes back into the show, the music, and the community. No investors, no ads.", DONATE),
    ("book-online", None, "Hire Dev | STOOPID TV", "Hire Dev: AI setup, posting game plans and clip packs.",
     HIRE.replace("{cards}", "\n".join(
         CARD.format(name=n, length=l, price=p, blurb=b, ask="{ask}") for n, l, p, b in SERVICES))),
    ("earn", None, "EARN | STOOPID TV", "STOOPID is a platform that pays you for your time and attention.", EARN),
    # The Library scrolls inside its own window (sticky reader bar, drawer, progress), so its frame
    # is one screen tall instead of being stretched to fit like the other embeds.
    ("library", None, "STOOPID Library | STOOPID TV",
     "Free public-domain books on STOOPID shelves, with a reader that remembers your place.",
     frame("library", "STOOPID Library", "embed-full")),
]

# ---------------------------------------------------------------- shell

SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:site_name" content="STOOPID TV">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{site}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F0B1E">
<link rel="icon" href="{root}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to Main Content</a>
<header class="top">
  <a class="brand" href="{home}"><span>STOOPID TV</span></a>
  <nav aria-label="Main">
{nav}
  </nav>
</header>
<main id="main">
{body}
</main>
<footer class="foot">
  <form class="signup news" data-list="newsletter" action="{root}api/signup" method="post" novalidate>
    <h2>the not so stoopid newsletter. sometimes. when there's something.</h2>
    <label>Get the weekly weird delivered. *<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
    <label class="hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
    <button class="btn" type="submit">Sign me up</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <p class="foot-links"><a href="{root}donate/">Contribute</a> · <a href="{root}book-online/">Hire Dev</a> · <a href="{root}magic-errands/">Magic Errands</a> · <a href="{root}beans/">Beans FAQ</a></p>
  <p class="social">
{social}
  </p>
  <p class="copy">© 2026 STOOPID TV · made by Dev in the Quad Cities with a lot of help</p>
</footer>
<script src="{root}assets/site.js"></script>
</body>
</html>
"""


def render(path, key, title, desc, body, root=None, canonical=None):
    if root is None:
        root = "../" if path else "./"
    home = root if root != "./" else "./"
    nav = "\n".join(
        '    <a href="{}"{}>{}</a>'.format(
            (root + p + "/") if p else home,
            ' aria-current="page"' if p == key and key is not None else "",
            label)
        for p, label in NAV)
    social = "\n".join(
        f'    <a href="{u}" target="_blank" rel="noopener" aria-label="{n}">'
        f'<svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg></a>'
        for n, u, d in SOCIAL)
    body = (body.replace("{root}", root).replace("{bmc}", BMC)
            .replace("{discord}", DISCORD).replace("{ask}", ASK_DEV))
    return SHELL.format(
        title=html.escape(title), desc=html.escape(desc, quote=True), root=root, home=home,
        canonical=canonical or (CANONICAL + "/" + path), site=CANONICAL,
        nav=nav, body=body.strip("\n"), social=social)


def build_embeds():
    out = SITE / "embeds"
    out.mkdir(exist_ok=True)
    for src in sorted((BUILD / "embeds-original").glob("*.html")):
        text = src.read_text(encoding="utf-8")

        def fix(m):
            path = m.group(2).strip("/")
            target = "../" + (path + "/" if path else "")
            return f'href="{target}"'

        # Old absolute links to the Wix site become relative links to the new pages.
        text = re.sub(r'href="https?://(www\.)?stoopidtv\.com/?([^"#?]*)"', fix, text)
        (out / src.name).write_text(text, encoding="utf-8")


def main():
    build_embeds()
    for path, key, title, desc, body in PAGES:
        d = SITE / path
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(render(path, key, title, desc, body), encoding="utf-8")
    # 404 can be served from any depth, so it uses root-absolute links.
    (SITE / "404.html").write_text(
        render("404", None, "No signal | STOOPID TV", "Page not found.", NOTFOUND,
               root="/", canonical=CANONICAL + "/"), encoding="utf-8")
    urls = "\n".join(f"  <url><loc>{CANONICAL}/{p}</loc></url>" for p, *_ in PAGES)
    (SITE / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n", encoding="utf-8")
    (SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {CANONICAL}/sitemap.xml\n", encoding="utf-8")
    print(f"built {len(PAGES)} pages into {SITE}")


if __name__ == "__main__":
    main()
