# stoopidtv.com

The public site, rebuilt from the Wix snapshot of 2026-11-11 (see `docs/stoopidtv-wix-snapshot/`). Plain static files; every link is relative, so this folder works at a domain root or in a subfolder.

- Edit page bodies in `_build/embeds-original/*.html` (the original embeds) or the hand-written pages, nav and footer in `_build/build.py`, then run `python3 site/_build/build.py`. Don't edit the generated `index.html` files or `embeds/` directly.
- `assets/site.js` sizes each framed page to its content.
- Donate goes to Buy Me a Coffee. Hire Dev "Book Now" goes to Ask Dev. Earn goes to Discord.
- Not carried over from Wix: the newsletter signup, the Earn early-access form, online booking/checkout, the store.
- Fonts (Anton, Poppins) still load from Google Fonts, as the original pages did.

## Deploying

`.github/workflows/deploy-site.yml` publishes this folder to Cloudflare Pages (project `stoopidtv`) on every push to `main` that touches `site/`. Run it by hand with **cutover** ticked to point stoopidtv.com at it.
