# stoopidtv.com

The public site, rebuilt from the Wix snapshot of 2026-11-11 (see `docs/stoopidtv-wix-snapshot/`). Plain static files; every link is relative, so this folder works at a domain root or in a subfolder.

- Edit page bodies in `_build/embeds-original/*.html` (the original embeds) or the hand-written pages, nav and footer in `_build/build.py`, then run `python3 site/_build/build.py`. Don't edit the generated `index.html` files or `embeds/` directly.
- `build.py` finishes with a link check (`_build/check_links.py`, also runnable on its own) and exits with an error if any link is root-absolute, points back at stoopidtv.com instead of being relative, or leads to a missing page, file, `#anchor` or `api/` function. `404.html`, `rel="canonical"` and the `og:`/`twitter:` tags are allowed full URLs. It also covers `museum/`, which `build.py` doesn't generate. The deploy workflow runs `build.py`, so a broken link stops the deploy.
- `assets/site.js` sizes each framed page to its content.
- Donate goes to Buy Me a Coffee. Hire Dev "Book Now" goes to Ask Dev.
- The footer newsletter box and the Earn form post to `/api/signup`, a Cloudflare Pages Function in `_cloudflare/` that writes to the D1 database `stoopidtv_signups`. It only writes; nothing reads sign-ups back out. They only work on the Cloudflare deployment, not on the GitHub Pages preview.
- Not carried over from Wix: online booking/checkout, the store.
- Fonts are self-hosted in `assets/fonts/` (woff2 + `fonts.css`, latin and latin-ext), so no page talks to Google. The shell and every embed link `fonts.css`. Stoopid Boy's cartridges are compressed text, so its loader swaps their Google font link for `fonts.css` as each game opens (don't edit the compressed `<script type=text/plain>` blocks by hand). To add a family or weight, add it to `REQUESTS` in `_build/fetch_fonts.py` and run `python3 site/_build/fetch_fonts.py`.

## Deploying

`.github/workflows/deploy-site.yml` publishes this folder to Cloudflare Pages (project `stoopidtv`) on every push to `main` that touches `site/`. Run it by hand with **cutover** ticked to point stoopidtv.com at it.

## Reading sign-ups

Cloudflare dashboard → Storage & databases → D1 → `stoopidtv_signups` → Console:

```sql
SELECT created_at, list, email, first_name, hangout FROM signups ORDER BY created_at DESC;
```

`list` is `newsletter` or `earn`. The same address can only appear once per list.

## Arcade billboards

Six little billboards sit beside STOOPID BOY on `/arcade/` (three each side; a grid under the game on narrow screens). The slots, the price and who has rented what are all in the `BILLBOARDS` block near the top of `_build/build.py`.

- **Empty slot** (`None`): shows "Insert your ad here!" and the price, and opens a "Rent a billboard" form with that slot picked. Requests go to `/api/billboard` (`_cloudflare/functions/api/billboard.js`) and into the D1 table `billboard_requests`. Nothing is charged on the site; Dev follows up by email.
- **Rented slot**: set it to `{"name": "...", "url": "https://...", "img": "assets/ads/<file>.png"}`, put a 300 x 250 image in `site/assets/ads/`, rebuild and push. It shows the image with a small "Ad" tag and links out with `rel="sponsored"`.
- **Price**: `BILLBOARD_PRICES` sets the monthly price per row, the same on both sides, climbing from the bottom (bottom $10, middle $15, top $20).
- **Alerts**: each new request sends an ntfy push ("New billboard request", which slot and the request number; no names or emails) to the topic in the repo secret `NTFY_TOPIC`, the same one Ask Dev uses. The deploy workflow copies it onto the Pages project. A failed push never loses a request.

Reading requests (Cloudflare dashboard → D1 → `stoopidtv_signups` → Console, or `npx wrangler d1 execute stoopidtv_signups --remote --command "..."`):

```sql
SELECT created_at, slot, name, email, promote, link FROM billboard_requests ORDER BY created_at DESC;
```

## The Unmade Museum

`museum/` is the game, served as-is (it isn't built by `build.py`). To ship a new build, replace `museum/index.html`, then re-add the link-preview block (`og:` / `twitter:` tags, marked with a comment near the top of `<head>`). `exhibits/` rarely changes. `_headers` stops other sites from framing it. The homepage section and trailer (`assets/museum-trailer.mp4`, `assets/museum-poster.jpg`) live outside `museum/` so a new build can't break them.
