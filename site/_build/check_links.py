#!/usr/bin/env python3
"""Checks the built stoopidtv.com site for link problems.

Run from anywhere:  python3 site/_build/check_links.py
build.py runs it automatically after every build and fails if it finds anything.

Two rules:
1. Every link is relative. No root-absolute paths ("/beans/") and no absolute
   links back to our own domain ("https://www.stoopidtv.com/beans"), so the
   folder works at a domain root, in a subfolder, and on the GitHub Pages preview.
   Exceptions: 404.html (served from any depth, so it must be root-absolute),
   <link rel="canonical"> and og:/twitter: meta tags (previews need full URLs).
2. No dead internal links. Every relative href/src/action/srcset/poster and CSS
   url() must point at a file that exists in site/. Links into api/ must match a
   Cloudflare Pages Function in _cloudflare/functions/api/. "#id" fragments must
   match an id (or <a name>) on the target page.

External links (other domains) aren't fetched; this is an offline check.
"""
import html.parser
import pathlib
import re
import sys
from urllib.parse import unquote, urlsplit

SITE = pathlib.Path(__file__).resolve().parent.parent
FUNCTIONS = SITE / "_cloudflare" / "functions"
SKIP_DIRS = {"_build", "_cloudflare"}
OWN_DOMAIN = re.compile(r"^(https?:)?//(www\.)?stoopidtv\.com(/|$)", re.I)
# Pages allowed to use root-absolute links, relative to site/.
ROOT_ABSOLUTE_OK = {"404.html"}
LINK_ATTRS = {"href", "src", "action", "poster", "data-src"}
NOT_A_FILE = re.compile(r"^(mailto:|tel:|sms:|javascript:|data:|blob:|about:)", re.I)
CSS_URL = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""")


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []          # (line, attr, value)
        self.ids = set()
        self.styles = []         # (line, css text)
        self._in_style = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        for key in ("id", "name") if tag == "a" else ("id",):
            if a.get(key):
                self.ids.add(a[key])
        if tag == "link" and "canonical" in (a.get("rel") or "").lower().split():
            return
        for attr in LINK_ATTRS:
            if a.get(attr):
                self.links.append((line, attr, a[attr].strip()))
        if a.get("srcset"):
            for part in a["srcset"].split(","):
                if part.strip():
                    self.links.append((line, "srcset", part.strip().split()[0]))
        if a.get("style"):
            self.styles.append((line, a["style"]))
        self._in_style = tag == "style"

    handle_startendtag = handle_starttag

    def handle_endtag(self, tag):
        if tag == "style":
            self._in_style = False

    def handle_data(self, data):
        if self._in_style:
            self.styles.append((self.getpos()[0], data))


_pages = {}


def parse(path):
    if path not in _pages:
        p = Page()
        p.feed(path.read_text(encoding="utf-8", errors="replace"))
        for line, css in p.styles:
            for m in CSS_URL.finditer(css):
                p.links.append((line + css[:m.start()].count("\n"), "url()", m.group(2).strip()))
        _pages[path] = p
    return _pages[path]


def resolve(base_file, value, root_absolute):
    """Turn a link into (file path, fragment), or None if it isn't a local file link."""
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or NOT_A_FILE.match(value):
        return None
    path = unquote(parts.path)
    if path.startswith("/"):
        target = SITE / path.lstrip("/")
    elif path:
        target = base_file.parent / path
    else:
        target = base_file                      # "#id" or "?x" on the same page
    target = pathlib.Path(*_normalize(target.parts))
    return target, parts.fragment


def _normalize(parts):
    out = []
    for p in parts:
        if p == "..":
            if out:
                out.pop()
        elif p != ".":
            out.append(p)
    return out


def find_file(target):
    """The file a URL path would serve, mirroring Pages: dir -> index.html, /x -> x.html."""
    if target.is_file():
        return target
    if target.is_dir() and (target / "index.html").is_file():
        return target / "index.html"
    if target.with_suffix(".html").is_file():
        return target.with_suffix(".html")
    return None


def is_function(target):
    """api/foo -> _cloudflare/functions/api/foo.js (or .ts)."""
    try:
        rel = target.relative_to(SITE)
    except ValueError:
        return False
    if not rel.parts or rel.parts[0] != "api":
        return False
    return any((FUNCTIONS / rel).with_suffix(ext).is_file() for ext in (".js", ".ts"))


def check_file(f, css_only=False):
    problems = []
    rel = f.relative_to(SITE).as_posix()
    if css_only:
        text = f.read_text(encoding="utf-8", errors="replace")
        links = [(text[:m.start()].count("\n") + 1, "url()", m.group(2).strip()) for m in CSS_URL.finditer(text)]
    else:
        links = parse(f).links
    root_ok = rel in ROOT_ABSOLUTE_OK
    for line, attr, value in links:
        if not value or value.startswith("%23"):          # inline SVG gradient refs
            continue
        where = f"{rel}:{line}"
        if OWN_DOMAIN.match(value):
            problems.append(f"{where}  not relative: {attr}=\"{value}\"  (link to our own domain; use a relative path)")
            continue
        if value.startswith("/") and not value.startswith("//") and not root_ok:
            problems.append(f"{where}  not relative: {attr}=\"{value}\"  (root-absolute; breaks in a subfolder)")
        r = resolve(f, value, root_ok)
        if r is None:
            continue
        target, frag = r
        hit = find_file(target)
        if hit is None:
            if attr == "action" or is_function(target):
                if not is_function(target):
                    problems.append(f"{where}  dead link: {attr}=\"{value}\"  (no file and no Pages Function for it)")
                continue
            problems.append(f"{where}  dead link: {attr}=\"{value}\"  (nothing at {target.relative_to(SITE).as_posix() if SITE in target.parents else target})")
            continue
        if frag and hit.suffix == ".html" and frag not in parse(hit).ids:
            problems.append(f"{where}  dead anchor: {attr}=\"{value}\"  (no id=\"{frag}\" in {hit.relative_to(SITE).as_posix()})")
    return problems


def site_files(pattern):
    for f in sorted(SITE.rglob(pattern)):
        if not SKIP_DIRS.intersection(f.relative_to(SITE).parts[:-1]):
            yield f


def main():
    problems = []
    pages = list(site_files("*.html"))
    for f in pages:
        problems += check_file(f)
    for f in site_files("*.css"):
        problems += check_file(f, css_only=True)
    if problems:
        print(f"link check: {len(problems)} problem(s) in {SITE}")
        for p in problems:
            print("  " + p)
        return 1
    print(f"link check: {len(pages)} pages OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
