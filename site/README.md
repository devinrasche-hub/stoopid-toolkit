# stoopidtv.com

The public site, rebuilt from the Wix snapshot of 2026-11-11 (see `docs/stoopidtv-wix-snapshot/`). Plain static files; every link is relative, so this folder works at a domain root or in a subfolder.

- Edit page bodies in `_build/embeds-original/*.html` (the original embeds) or the hand-written pages, nav and footer in `_build/build.py`, then run `python3 site/_build/build.py`. Don't edit the generated `index.html` files or `embeds/` directly.
- `assets/site.js` sizes each framed page to its content.
- Donate goes to Buy Me a Coffee. Hire Dev "Book Now" goes to Ask Dev.
- The footer newsletter box and the Earn form post to `/api/signup`, a Cloudflare Pages Function in `_cloudflare/` that writes to the D1 database `stoopidtv_signups`. It only writes; nothing reads sign-ups back out. They only work on the Cloudflare deployment, not on the GitHub Pages preview.
- Not carried over from Wix: online booking/checkout, the store.
- Fonts (Anton, Poppins) still load from Google Fonts, as the original pages did.

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
- **Price**: change `BILLBOARD_PRICE`.
- **Alerts**: each new request sends an ntfy push ("New billboard request", which slot and the request number; no names or emails) to the topic in the repo secret `NTFY_TOPIC`, the same one Ask Dev uses. The deploy workflow copies it onto the Pages project. A failed push never loses a request.

Reading requests (Cloudflare dashboard → D1 → `stoopidtv_signups` → Console, or `npx wrangler d1 execute stoopidtv_signups --remote --command "..."`):

```sql
SELECT created_at, slot, name, email, promote, link FROM billboard_requests ORDER BY created_at DESC;
```
