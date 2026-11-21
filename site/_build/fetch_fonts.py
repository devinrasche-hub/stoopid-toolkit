"""Download the Google Fonts stoopidtv.com uses and write site/assets/fonts/ (woff2 + fonts.css).

Run from anywhere:  python3 site/_build/fetch_fonts.py
Only needed when a page starts using a new family or weight: add it to REQUESTS and rerun.
Keeps the latin and latin-ext subsets; browsers only download a file when the page uses that
family/weight and a character in its unicode-range.
"""
import re, pathlib, urllib.request

SITE = pathlib.Path(__file__).resolve().parent.parent
OUT = SITE / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
REQUESTS = [  # every family/weight any stoopidtv.com page asks Google for
    "family=Anton&family=Poppins:wght@400;600;700",
    "family=Bowlby+One&family=Archivo:wght@400;600;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400",
    "family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300",
]
KEEP = {"latin", "latin-ext"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA})).read()

faces = {}   # (family, style, subset, file url) -> {"weights": [...], "range": str}
for q in REQUESTS:
    css = get(f"https://fonts.googleapis.com/css2?{q}&display=swap").decode()
    for subset, body in re.findall(r"/\* ([\w-]+) \*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        if subset not in KEEP:
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        style = re.search(r"font-style:\s*(\w+)", body).group(1)
        weight = int(re.search(r"font-weight:\s*(\d+)", body).group(1))
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1)
        rng = re.search(r"unicode-range:\s*([^;]+);", body).group(1)
        f = faces.setdefault((fam, style, subset, url), {"weights": [], "range": rng})
        if weight not in f["weights"]:
            f["weights"].append(weight)

rules, total, names = [], 0, set()
for (fam, style, subset, url), f in sorted(faces.items(), key=lambda kv: (kv[0][0], kv[0][1], min(kv[1]["weights"]), kv[0][2])):
    w = sorted(f["weights"])
    wname = f"{w[0]}-{w[-1]}" if len(w) > 1 else str(w[0])
    name = f"{fam.lower().replace(' ', '-')}-{'italic-' if style == 'italic' else ''}{wname}-{subset}.woff2"
    assert name not in names, name
    names.add(name)
    data = get(url)
    assert data[:4] == b"wOF2", url
    (OUT / name).write_bytes(data)
    total += len(data)
    wcss = f"{w[0]} {w[-1]}" if len(w) > 1 else str(w[0])
    rules.append(f"/* {subset} */\n@font-face {{\n  font-family: '{fam}';\n  font-style: {style};\n  font-weight: {wcss};\n"
                 f"  font-display: swap;\n  src: url({name}) format('woff2');\n  unicode-range: {f['range']};\n}}")
    print(f"{name:48} {len(data)/1024:6.1f} KB")

head = ("/* stoopidtv.com fonts, self-hosted so no page loads anything from Google at runtime.\n"
        "   Anton, Archivo, Bebas Neue, Bowlby One, DM Sans, Literata and Poppins are under the\n"
        "   SIL Open Font License 1.1. Regenerate with site/_build/fetch_fonts.py. */\n")
(OUT / "fonts.css").write_text(head + "\n".join(rules) + "\n", encoding="utf-8")
print(f"{len(names)} files, {total/1024:.0f} KB total")
