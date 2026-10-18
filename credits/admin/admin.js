// THE CREDITS DEPARTMENT — admin console.
// Holds no data of its own: everything is read from and written to the Credits API with the admin token.
// All dynamic text is rendered through text nodes (h()), never innerHTML.

import { h, ext, API } from '../assets/site.js';
import { CreditsPlayer, fmtTime } from '../engine/player.js';
import { exportCards, recordRealtime, sequenceBlob, download, slugFor, pickRecorderType } from '../engine/export.js';
import { parseCsv, guessMapping } from '../engine/csv.js';

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch { return null; } },
  set: (k, v, persist) => { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch {} },
  clear: () => { try { for (const s of [sessionStorage, localStorage]) { s.removeItem('cd_token'); s.removeItem('cd_who'); } } catch {} } };
let TOKEN = store.get('cd_token'), WHO = store.get('cd_who') || 'admin';

// ── API ──
async function api(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${TOKEN}`, 'x-admin-name': WHO, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { signOut('Your token was not accepted.'); throw new Error('Not authorised.'); }
  if (raw) { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res; }
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
function toast(msg, err = false) {
  const d = h('div', { class: err ? 'err' : '' }, msg);
  $('toast').append(d); setTimeout(() => d.remove(), err ? 7000 : 3500);
}
/** Run an action with a busy button and a toast either way. */
async function act(btn, fn, ok) {
  const label = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = 'WORKING…'; }
  try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); return r; }
  catch (e) { toast(e.message, true); throw e; }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
const field = (label, input, hint) => h('div', {}, h('label', { for: input.id || null }, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
let uid = 0;
const inp = (attrs = {}) => h('input', { id: 'f' + ++uid, ...attrs });
const sel = (options, value, attrs = {}) => { const s = h('select', { id: 'f' + ++uid, ...attrs }, options.map(([v, l]) => h('option', { value: v }, l))); s.value = value ?? ''; return s; };
const chk = (label, checked, attrs = {}) => { const c = h('input', { type: 'checkbox', id: 'f' + ++uid, ...attrs }); c.checked = !!checked; return { el: h('label', { class: 'inline', for: c.id }, c, h('span', {}, label)), input: c }; };
const btn = (label, onclick, cls = '') => h('button', { class: 'btn sm ' + cls, type: 'button', onclick }, label);
const pill = (text, cls = '') => h('span', { class: 'pill ' + cls }, text);
const VIS_PILL = { public: 'ok', anonymous: 'gold', private: 'err' };

// ── sign in ──
$('api-host').textContent = API;
$('signin').addEventListener('submit', async (e) => {
  e.preventDefault();
  TOKEN = $('token').value.trim(); WHO = $('who').value.trim() || 'admin';
  try {
    await api('/admin/me');
    store.set('cd_token', TOKEN, $('remember').checked); store.set('cd_who', WHO, $('remember').checked);
    $('token').value = ''; boot();
  } catch (err) { $('gate-err').hidden = false; $('gate-err').textContent = err.status === 503 ? err.message : err.status === 429 ? err.message : 'The department does not recognise that token.'; }
});
function signOut(msg) {
  store.clear(); TOKEN = null; $('app').hidden = true; $('gate').hidden = false;
  if (msg) { $('gate-err').hidden = false; $('gate-err').textContent = msg; }
}
$('signout').addEventListener('click', () => signOut());

// ── shell ──
const VIEWS = [
  ['overview', 'OVERVIEW'], ['produce', 'PRODUCE CREDITS'], ['people', 'CONTRIBUTORS'], ['creators', 'CREATORS'], ['arcade', 'ARCADE'],
  ['requests', 'REQUESTS'], ['recognition', 'SPOTLIGHT & FAME'], ['jokes', 'HUMOR ENGINE'], ['import', 'IMPORT'], ['settings', 'SETTINGS'], ['audit', 'AUDIT LOG'],
];
let pending = 0;
function menu() {
  const cur = (location.hash.slice(1) || 'overview').split('/')[0];
  $('menu').replaceChildren(...VIEWS.map(([k, label]) => h('a', { href: '#' + k, 'aria-current': k === cur ? 'page' : null }, label, k === 'requests' && pending ? h('span', { class: 'count' }, pending) : null)));
}
async function route() {
  menu();
  const [view, arg] = (location.hash.slice(1) || 'overview').split('/');
  const main = $('view');
  main.replaceChildren(h('div', { class: 'empty loading' }, 'OPENING FILE'));
  try { await (R[view] || R.overview)(main, arg); }
  catch (e) { if (e.message !== 'Not authorised.') main.replaceChildren(h('div', { class: 'notice err' }, 'Could not load: ' + e.message)); }
  main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
async function boot() {
  $('gate').hidden = true; $('app').hidden = false; $('actor').textContent = `SIGNED IN AS ${WHO.toUpperCase()}`;
  try { pending = (await api('/admin/overview')).pendingSubmissions; } catch { return; }
  route();
}
if (TOKEN) boot();

// ── contributor picker (datalist "Name · #id") ──
let peopleCache = null;
async function people(force) { if (!peopleCache || force) peopleCache = (await api('/admin/contributors')).contributors; return peopleCache; }
async function picker(placeholder = 'Start typing a name…') {
  const list = h('datalist', { id: 'dl' + ++uid }, (await people()).map((p) => h('option', { value: `${p.display_name} · #${p.id}` })));
  const input = inp({ list: list.id, placeholder, autocomplete: 'off' });
  return { el: h('span', {}, input, list), input, id: () => { const m = /#(\d+)\s*$/.exec(input.value); return m ? Number(m[1]) : null; } };
}

const R = {};

// ══ OVERVIEW ══
R.overview = async (main) => {
  const o = await api('/admin/overview');
  pending = o.pendingSubmissions; menu();
  const integ = o.integrations.map((i) => h('tr', {}, h('td', {}, i.provider), h('td', {}, pill(i.mode.toUpperCase(), i.mode === 'automatic' ? 'ok' : '')),
    h('td', {}, pill(i.status.toUpperCase(), i.status === 'ok' ? 'ok' : i.status === 'error' ? 'err' : '')), h('td', { class: 'hint' }, i.last_error || i.detail || '')));
  main.replaceChildren(
    h('h1', {}, 'OVERVIEW'), h('p', { class: 'lede' }, 'THE STATE OF APPRECIATION, AS OF ', new Date().toLocaleString()),
    h('div', { class: 'stats', style: 'margin:0 0 18px' },
      h('div', { class: 'stat' }, h('div', { class: 'n' }, o.publicContributors), h('div', { class: 'l' }, `PUBLIC (OF ${o.totalContributors})`)),
      h('div', { class: 'stat' }, h('div', { class: 'n' }, o.pendingSubmissions), h('div', { class: 'l' }, 'REQUESTS TO REVIEW')),
      h('div', { class: 'stat' }, h('div', { class: 'n' }, o.featuredCreators.length), h('div', { class: 'l' }, 'FEATURED CREATORS')),
      h('div', { class: 'stat' }, h('div', { class: 'n' }, o.unverifiedSupporters), h('div', { class: 'l' }, 'SELF-REPORTED SUPPORTERS'))),
    h('div', { class: 'cols' },
      h('div', { class: 'card' }, h('h2', {}, 'NEXT EPISODE'), o.nextEpisode
        ? h('div', {}, h('div', { class: 'big' }, `EP ${o.nextEpisode.number}`), h('div', {}, o.nextEpisode.title),
          h('p', { style: 'margin:8px 0' }, pill(o.nextEpisode.status.toUpperCase(), o.nextEpisode.status === 'final' ? 'ok' : 'gold'),
            pill(o.nextEpisode.snapshot_id ? 'SNAPSHOT FROZEN' : 'NO SNAPSHOT YET', o.nextEpisode.snapshot_id ? 'ok' : 'warn'),
            o.nextEpisode.current_version ? pill('REV ' + o.nextEpisode.current_version) : null),
          h('a', { class: 'btn sm', href: '#produce/' + o.nextEpisode.id }, 'OPEN IN PRODUCE ▸'))
        : h('div', {}, h('p', { class: 'hint' }, 'No episodes yet.'), h('a', { class: 'btn sm', href: '#produce' }, 'CREATE THE FIRST ▸'))),
      h('div', { class: 'card' }, h('h2', {}, 'BEANS, LIVE'), o.beans
        ? h('div', {}, h('p', { class: 'hint' }, `Feed as of ${o.beans.asof} · ${o.beans.players} players`, o.beans.flagged ? ` · ${o.beans.flagged} name(s) flagged` : ''),
          h('table', { class: 'admin' }, h('tbody', {}, o.beans.top.map((e) => h('tr', {}, h('td', {}, e.pos), h('td', {}, e.display, e.excluded ? pill('EXCLUDED', 'err') : null), h('td', { style: 'text-align:right;color:var(--gold)' }, e.beans))))))
        : h('div', { class: 'notice err' }, 'Beans feed unreachable. See integrations.')),
      h('div', { class: 'card' }, h('h2', {}, 'CATEGORIES'), h('table', { class: 'admin' },
        h('thead', {}, h('tr', {}, h('th', {}, 'CATEGORY'), h('th', {}, 'MEMBERS'), h('th', {}, 'PUBLIC'))),
        h('tbody', {}, o.byCategory.map((c) => h('tr', {}, h('td', {}, c.name, c.enabled ? null : pill('OFF')), h('td', {}, c.kind === 'leaderboard' ? '— (feed)' : c.members), h('td', {}, c.kind === 'leaderboard' ? '' : c.public ?? 0))))))),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'INTEGRATION HEALTH'),
      h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'PROVIDER'), h('th', {}, 'MODE'), h('th', {}, 'STATUS'), h('th', {}, 'DETAIL'))), h('tbody', {}, integ))),
      h('p', { style: 'margin-top:10px' }, btn('CHECK BEANS FEED NOW', (e) => act(e.target, () => api('/admin/integrations/beans_feed/check', { method: 'POST' }), (r) => r.ok ? 'Feed OK.' : 'Feed check failed — see detail.').then(route)))),
  );
};

// ══ PRODUCE ══
let player = null, current = null;          // current = { ep, draft, sequence, report, warnings, source, fromVersion }

R.produce = async (main, arg) => {
  const eps = (await api('/admin/episodes')).episodes;
  const id = Number(arg) || (eps.find((e) => e.status === 'draft') || eps[0])?.id;
  const head = h('div', { class: 'row', style: 'margin-bottom:14px' });
  const epSel = sel(eps.map((e) => [String(e.id), `EP ${e.number} — ${e.title} ${e.status === 'final' ? '(PUBLISHED R' + e.current_version + ')' : '(DRAFT)'}`]), String(id || ''), { 'aria-label': 'Episode' });
  epSel.onchange = () => { location.hash = 'produce/' + epSel.value; };
  const next = eps.length ? Math.max(...eps.map((e) => e.number)) + 1 : 1;
  const newForm = h('form', { class: 'drawer', hidden: true },
    h('h2', {}, 'NEW EPISODE'), h('p', { class: 'hint' }, 'Theme and timing carry over from the last episode, so nothing is rebuilt.'),
    h('div', { class: 'row' }, field('NUMBER', inp({ name: 'number', type: 'number', min: 1, value: next })), field('TITLE', inp({ name: 'title', required: true })),
      field('AIR DATE', inp({ name: 'published_on', type: 'date' })), field('EPISODE LINK', inp({ name: 'episode_url', type: 'url', placeholder: 'https://…' }))),
    h('p', { style: 'margin-top:12px' }, h('button', { class: 'btn sm gold', type: 'submit' }, 'CREATE EPISODE')));
  newForm.onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(newForm)); const r = await act(e.submitter, () => api('/admin/episodes', { method: 'POST', body: b }), 'Episode created.'); location.hash = 'produce/' + r.id; };
  head.append(h('div', {}, h('label', {}, 'EPISODE'), eps.length ? epSel : h('div', { class: 'hint' }, 'No episodes yet.')), h('div', { class: 'shrink' }, btn('+ NEW EPISODE', () => { newForm.hidden = !newForm.hidden; }, 'gold')));
  main.replaceChildren(h('h1', {}, 'PRODUCE CREDITS'), h('p', { class: 'lede' }, 'TEN STEPS. MOST OF THEM ARE ALREADY DONE FOR YOU.'), head, newForm);
  if (!id) { newForm.hidden = false; return; }

  const d = await api('/admin/episodes/' + id);
  const ep = d.episode;
  current = { ep, draft: structuredClone(ep.draft || {}), detail: d };
  current.draft.timing = current.draft.timing || {};
  const o = await api('/admin/overview');
  const steps = h('ol', { class: 'steps', 'aria-label': 'Workflow' });
  const box = (title, ...kids) => h('div', { class: 'card' }, h('h2', {}, title), ...kids);

  // 1-3: details + supporters
  const det = h('form', {},
    h('div', { class: 'row' }, field('TITLE', inp({ name: 'title', value: ep.title })), field('SEASON', inp({ name: 'season', type: 'number', min: 1, value: ep.season }))),
    h('div', { class: 'row' }, field('AIR DATE', inp({ name: 'published_on', type: 'date', value: ep.published_on || '' })), field('EPISODE LINK', inp({ name: 'episode_url', type: 'url', value: ep.episode_url || '' }))),
    h('p', { style: 'margin-top:10px' }, h('button', { class: 'btn sm', type: 'submit' }, 'SAVE DETAILS')));
  det.onsubmit = (e) => { e.preventDefault(); act(e.submitter, () => api('/admin/episodes/' + id, { method: 'PUT', body: Object.fromEntries(new FormData(det)) }), 'Saved.').then(() => route()); };
  const supporters = h('div', {},
    h('dl', { class: 'kv' }, h('dt', {}, 'PUBLIC PEOPLE'), h('dd', {}, o.publicContributors), h('dt', {}, 'REQUESTS WAITING'), h('dd', {}, o.pendingSubmissions ? h('a', { href: '#requests' }, `${o.pendingSubmissions} to review ▸`) : '0 ✓'),
      h('dt', {}, 'SELF-REPORTED 𝕏 SUBS'), h('dd', {}, o.unverifiedSupporters ? h('a', { href: '#people' }, `${o.unverifiedSupporters} to confirm ▸`) : '0 ✓'),
      h('dt', {}, 'BEANS FEED'), h('dd', {}, o.beans ? `as of ${o.beans.asof}` : pill('UNREACHABLE', 'err'))),
    h('p', { class: 'hint', style: 'margin-top:8px' }, '𝕏 subscribers can’t be synced automatically (no official API). Add new ones in ', h('a', { href: '#people' }, 'Contributors'), ' or ', h('a', { href: '#import' }, 'Import'), '.'));

  // 5: snapshot
  const snap = d.snapshot;
  const topN = inp({ type: 'number', min: 1, max: 20, value: current.draft.topN || '', placeholder: 'default', style: 'width:90px' });
  const reason = inp({ placeholder: 'Reason (required once published)' });
  const snapBox = box('ARCADE SNAPSHOT',
    snap ? h('div', {}, h('p', {}, pill('FROZEN', 'ok'), ` Feed as of ${snap.feed_asof} · taken ${new Date(snap.taken_at).toLocaleString()} by ${snap.taken_by}`),
      h('table', { class: 'admin' }, h('tbody', {}, snap.entries.slice(0, 8).map((e) => h('tr', {}, h('td', {}, e.pos), h('td', {}, e.display_name, e.excluded ? pill('EXCLUDED', 'err') : null), h('td', { style: 'text-align:right;color:var(--gold)' }, e.beans))))))
      : h('p', { class: 'notice warn' }, 'Not frozen yet — the preview uses LIVE rankings. Finalising freezes one automatically.'),
    h('div', { class: 'row', style: 'margin-top:10px' }, field('TOP N', topN), ep.status === 'final' ? field('CORRECTION REASON', reason) : h('span'),
      h('div', { class: 'shrink' }, btn(snap ? 'RE-FREEZE' : 'FREEZE SNAPSHOT', async (e) => {
        if (topN.value) { current.draft.topN = Number(topN.value); await saveDraft(true); }
        await act(e.target, () => api(`/admin/episodes/${id}/snapshot`, { method: 'POST', body: { reason: reason.value } }), ep.status === 'final' ? 'Snapshot corrected; new revision issued.' : 'Snapshot frozen.');
        route();
      }, 'gold'))),
    d.snapshots.length > 1 ? h('details', {}, h('summary', { class: 'hint' }, `${d.snapshots.length} snapshots on file`), h('ul', {}, d.snapshots.map((s) => h('li', { class: 'hint' }, `#${s.id} · ${s.feed_asof} · ${s.taken_by}${s.supersedes ? ' · supersedes #' + s.supersedes : ''}${s.reason ? ' · ' + s.reason : ''}`)))) : null);

  // 6: collaborators
  const pk = await picker();
  const role = inp({ placeholder: 'Writer, Editor, Pixel art…' });
  const collab = box('EPISODE COLLABORATORS',
    h('p', { class: 'hint' }, 'Real work on THIS episode. Always credited (if they consented), never rotated out.'),
    d.contributions.length ? h('div', {}, d.contributions.map((c) => h('span', { class: 'who' }, `${c.display_name} — ${c.role}`, h('button', { type: 'button', 'aria-label': 'Remove', onclick: (e) => act(e.target, () => api('/admin/contributions/' + c.id, { method: 'DELETE' }), 'Removed.').then(route) }, '✕')))) : h('p', { class: 'hint' }, 'None yet.'),
    h('div', { class: 'row', style: 'margin-top:8px' }, field('PERSON', pk.el), field('ROLE', role),
      h('div', { class: 'shrink' }, btn('ADD', (e) => {
        if (!pk.id()) return toast('Pick someone from the list (add new people in Contributors).', true);
        act(e.target, () => api('/admin/contributions', { method: 'POST', body: { contributor_id: pk.id(), episode_id: id, role: role.value, category_key: 'human_resources' } }), 'Credited.').then(route);
      }))));

  // 4/7: report
  const reportEl = h('div', { class: 'report' }, h('div', { class: 'empty loading' }, 'RUNNING THE FAIR RECOGNITION ENGINE'));
  const warnEl = h('ul', { class: 'warns' });

  // 8: preview
  const cv = h('canvas', { role: 'img', 'aria-label': 'Credits preview' });
  const playB = btn('▶ PLAY', () => player.toggle());
  const scrub = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Scrub' });
  const timeL = h('span', { class: 'hint' }, '00:00.0');
  const timebar = h('div', { class: 'timebar' });
  const segL = h('span', { class: 'hint' });
  player?.pause();
  player = new CreditsPlayer(cv, {
    onTime: (t, loc) => { if (!current.sequence) return; timeL.textContent = `${fmtTime(t)} / ${fmtTime(current.sequence.duration)}`; scrub.value = String(Math.round(t / current.sequence.duration * 1000)); segL.textContent = `${loc.seg.title || loc.seg.id} · page ${loc.pi + 1}/${loc.seg.pages.length}`; },
    onState: (p) => { playB.textContent = p ? '❚❚ PAUSE' : '▶ PLAY'; },
  });
  scrub.oninput = () => current.sequence && player.seek(scrub.value / 1000 * current.sequence.duration);
  const mute = chk('Sound', true); mute.input.onchange = () => player.setMuted(!mute.input.checked);
  const settings = (await api('/admin/settings'));
  const T = () => current.draft.timing;
  const themeSel = sel(settings.themes.map((t) => [t.id, t.name]), T().theme || ep.theme);
  const cardSel = sel(settings.endCards.map((c) => [c.id, c.name]), T().endCard || settings.settings.timing.endCard);
  const ovSel = sel([['archive', 'Overflow → “+N in the archive”'], ['extend', 'Overflow → lengthen segment']], T().overflow || settings.settings.timing.overflow);
  const emSel = sel([['skip', 'Empty categories: skip'], ['card', 'Empty categories: show a card']], T().emptyCategories || settings.settings.timing.emptyCategories);
  const fpsSel = sel([['24', '24 fps'], ['30', '30 fps'], ['60', '60 fps']], String(T().fps || settings.settings.timing.fps));
  const audioC = chk('Soundtrack in exports', T().audio ?? settings.settings.timing.audio);
  const noticeSel = sel([['auto', 'Notices: seeded from the Humor Engine'], ['off', 'Notices: none'], ['custom', 'Notices: my picks (below)']], Array.isArray(T().notices) ? 'custom' : (T().notices || 'auto'));
  const noticeTxt = h('textarea', { placeholder: 'One notice per line', rows: 3 }, Array.isArray(T().notices) ? T().notices.join('\n') : '');
  const segTable = h('tbody');
  const onChange = () => {
    Object.assign(T(), { theme: themeSel.value, endCard: cardSel.value, overflow: ovSel.value, emptyCategories: emSel.value, fps: Number(fpsSel.value), audio: audioC.input.checked,
      notices: noticeSel.value === 'custom' ? noticeTxt.value.split('\n').map((s) => s.trim()).filter(Boolean) : noticeSel.value });
    refresh();
  };
  for (const c of [themeSel, cardSel, ovSel, emSel, fpsSel, audioC.input, noticeSel]) c.onchange = onChange;
  noticeTxt.onchange = onChange;
  const preview = box('PREVIEW', h('div', { class: 'stage' }, cv, timebar, h('div', { class: 'transport' }, playB, scrub, timeL, mute.el)), h('p', { class: 'hint', style: 'margin-top:6px' }, segL),
    h('div', { class: 'row', style: 'margin-top:10px' }, field('THEME', themeSel), field('END CARD', cardSel), field('FRAME RATE', fpsSel)),
    h('div', { class: 'row' }, field('NAMES', ovSel), field('EMPTY', emSel), field('NOTICES', noticeSel)), noticeTxt, audioC.el,
    h('h3', {}, 'SEGMENTS'), h('div', { class: 'scroll' }, h('table', { class: 'admin segs' }, h('thead', {}, h('tr', {}, h('th', {}, 'ON'), h('th', {}, 'SEGMENT'), h('th', {}, 'SECONDS'), h('th', {}, 'PAGES'), h('th', {}, 'ORDER'))), segTable)),
    h('p', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'shrink' }, btn('↻ REGENERATE (NEW SHUFFLE)', () => { current.draft.seed = Math.random().toString(36).slice(2, 10); refresh(); })),
      h('span', { class: 'shrink' }, btn('SAVE DRAFT', (e) => act(e.target, () => saveDraft(), 'Draft saved.'), 'gold'))));

  // 9: export
  const prog = h('span', { class: 'hint' });
  const exportBox = box('EXPORT',
    h('p', { class: 'hint' }, 'Exports use the sequence on screen. For the archive version, publish first; for frame-exact MP4, use the render command.'),
    h('div', { class: 'row' },
      h('span', { class: 'shrink' }, btn('PNG CARDS (.ZIP)', (e) => act(e.target, async () => download(await exportCards(current.sequence, { onProgress: (p) => { prog.textContent = `cards ${Math.round(p * 100)}%`; } }), slugFor(current.sequence) + '_cards.zip'), 'Cards exported.'))),
      h('span', { class: 'shrink' }, btn('TRANSPARENT CARDS (.ZIP)', (e) => act(e.target, async () => download(await exportCards(current.sequence, { transparent: true, onProgress: (p) => { prog.textContent = `alpha cards ${Math.round(p * 100)}%`; } }), slugFor(current.sequence) + '_cards_alpha.zip'), 'Transparent cards exported.'))),
      h('span', { class: 'shrink' }, btn('RECORD VIDEO (REAL TIME)', (e) => act(e.target, async () => {
        player.pause();
        const r = await recordRealtime(current.sequence, { onProgress: (p) => { prog.textContent = `recording ${Math.round(p * 100)}% — keep this tab visible`; } });
        download(r.blob, slugFor(current.sequence) + (r.type.includes('mp4') ? '.mp4' : '.webm'));
        return r;
      }, (r) => `Recorded ${r.type.split(';')[0]}.`))),
      h('span', { class: 'shrink' }, btn('SEQUENCE.JSON', () => download(sequenceBlob(current.sequence), slugFor(current.sequence) + '_sequence.json')))),
    prog, h('p', { class: 'hint', style: 'margin-top:8px' }, `This browser records: ${pickRecorderType() || 'nothing (no MediaRecorder)'}`),
    h('h3', {}, 'FRAME-EXACT RENDER (MP4 · PNG · PRORES 4444 ALPHA)'),
    h('pre', { class: 'cmd' }, `cd stoopid-toolkit/credits-render\nnpm install\nnode render.mjs --episode ${ep.number} --formats mp4,cards,alpha-cards,prores\n# or, for an unpublished draft: --sequence path/to/${slugFor({ episode: ep, theme: T().theme || ep.theme })}_sequence.json`));

  // 10: publish
  const corr = inp({ placeholder: 'What changed? (shown in the public revision history)' });
  const publish = box(ep.status === 'final' ? 'PUBLISHED — CORRECTIONS' : 'PUBLISH',
    ep.status === 'final'
      ? h('div', {}, h('p', {}, pill('LIVE IN THE ARCHIVE', 'ok'), ' ', ext(`../episodes/?ep=${ep.number}`, 'View public page ▸')),
        h('p', { class: 'hint' }, 'Published credits are immutable. A correction saves your current draft as a new revision and keeps the old one on record.'),
        h('div', { class: 'row' }, field('REASON', corr), h('div', { class: 'shrink' }, btn('ISSUE CORRECTION', async (e) => {
          if (!corr.value.trim()) return toast('A reason is required.', true);
          await saveDraft(true);
          await act(e.target, () => api(`/admin/episodes/${id}/finalize`, { method: 'POST', body: { reason: corr.value } }), (r) => `Revision ${r.revision} published.`); route();
        }, 'gold'))))
      : h('div', {}, h('p', { class: 'hint' }, 'Freezes the leaderboard (if not frozen), locks this exact sequence as revision 1, records who appeared (for fair rotation), and publishes to the archive.'),
        btn('FINALISE & PUBLISH', async (e) => {
          if (!confirm(`Publish the credits for EP ${ep.number}? This creates a permanent public record.`)) return;
          await saveDraft(true);
          await act(e.target, () => api(`/admin/episodes/${id}/finalize`, { method: 'POST', body: {} }), 'Published. END TRANSMISSION. AS IS.'); route();
        }, 'gold')),
    d.versions.length ? h('div', {}, h('h3', {}, 'REVISIONS'), h('table', { class: 'admin' }, h('tbody', {}, d.versions.map((v) => h('tr', {},
      h('td', {}, 'R' + v.revision), h('td', {}, v.reason), h('td', { class: 'hint' }, `${new Date(v.created_at).toLocaleString()} · ${v.created_by}`),
      h('td', {}, btn('LOAD IN PLAYER', async () => { const r = await api('/admin/versions/' + v.id); current.sequence = r.version.sequence; current.fromVersion = v.revision; player.load(current.sequence); drawTimebar(); toast(`Showing published R${v.revision}.`); }))))))) : null);

  main.append(steps, h('div', { class: 'cols' }, box('EPISODE DETAILS', det), box('SUPPORTERS & INTEGRATIONS', supporters)),
    h('div', { class: 'cols', style: 'margin-top:16px' }, snapBox, collab),
    h('div', { style: 'margin-top:16px' }, preview),
    h('div', { class: 'cols', style: 'margin-top:16px' }, box('WHO’S IN, WHO’S NEXT', warnEl, reportEl), h('div', { class: 'stack' }, exportBox, publish)));

  function drawSteps() {
    const s = (label, done, todo) => h('li', { class: done ? 'done' : todo ? 'todo' : '' }, label);
    steps.replaceChildren(s('OPEN THE DEPARTMENT', true), s('SELECT EPISODE', true), s('REVIEW SUPPORTERS', !o.pendingSubmissions, !!o.pendingSubmissions),
      s('PREVIEW ELIGIBLE', !!current.report), s('FREEZE ARCADE', !!ep.snapshot_id, !ep.snapshot_id), s('CHOOSE COLLABORATORS', d.contributions.length > 0),
      s('REVIEW CONSENT & RULES', !!current.report && !(current.warnings || []).length, (current.warnings || []).length > 0), s('PREVIEW CREDITS', !!current.sequence),
      s('EXPORT ASSETS', false), s('PUBLISH', ep.status === 'final', ep.status !== 'final'));
  }

  function drawTimebar() {
    const seq = current.sequence;
    const colors = ['#00FFC6', '#FFB347', '#8A2BE2', '#FF40CD', '#4aa8ff', '#CC5500', '#F2EEE6'];
    timebar.replaceChildren(...seq.segments.map((s, i) => h('span', { style: `flex:${s.duration};background:${colors[i % colors.length]}`, title: `${s.title || s.id} — ${s.duration}s`,
      onclick: () => { const st = seq.segments.slice(0, i).reduce((a, x) => a + x.duration, 0); player.seek(st + 0.01); } }, s.title || s.id)));
  }

  function drawSegments() {
    const all = [['ident', 'END OF TRANSMISSION (ident)'], ...d.categories.filter((c) => c.enabled).map((c) => ['cat:' + c.key, c.name]), ['final', 'FINAL TRANSMISSION']];
    const order = T().order && T().order.length ? T().order : all.map((x) => x[0]);
    const ordered = all.slice().sort((a, b) => (order.indexOf(a[0]) + 1 || 999) - (order.indexOf(b[0]) + 1 || 999));
    const seqSeg = (sid) => current.sequence?.segments.find((s) => s.id === sid);
    segTable.replaceChildren(...ordered.map(([sid, label], i) => {
      const on = chk('', !(T().disabled || []).includes(sid), { 'aria-label': 'Include ' + label });
      on.input.onchange = () => { const s = new Set(T().disabled || []); on.input.checked ? s.delete(sid) : s.add(sid); T().disabled = [...s]; refresh(); };
      const cat = d.categories.find((c) => 'cat:' + c.key === sid);
      const dur = inp({ type: 'number', min: 1, max: 60, step: 0.5, value: T().durations?.[sid] ?? (sid === 'ident' ? settings.settings.timing.identSeconds : sid === 'final' ? settings.settings.timing.finalSeconds : cat?.segment_seconds), 'aria-label': 'Seconds for ' + label });
      dur.onchange = () => { T().durations = { ...(T().durations || {}), [sid]: Number(dur.value) }; refresh(); };
      const move = (dir) => { const ids = ordered.map((x) => x[0]); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; T().order = ids; refresh(); };
      const ss = seqSeg(sid);
      return h('tr', {}, h('td', {}, on.input), h('td', {}, label), h('td', {}, dur), h('td', { class: 'hint' }, ss ? `${ss.pages.length} · ${ss.pages.reduce((a, p) => a + p.items.length, 0)} names` : (on.input.checked ? 'empty' : 'off')),
        h('td', {}, btn('▲', () => move(-1), 'ghost'), btn('▼', () => move(1), 'ghost')));
    }));
  }

  function drawReport() {
    const draft = current.draft;
    const toggle = (list, pid, on) => { const s = new Set(draft[list] || []); on ? s.add(pid) : s.delete(pid); draft[list] = [...s]; };
    warnEl.replaceChildren(...(current.warnings || []).map((w) => h('li', {}, w)));
    reportEl.replaceChildren(h('p', { class: 'hint' }, `Leaderboard source: ${current.source}. Click ✕ to leave someone out of THIS episode, ＋ to bring a deferred person forward.`),
      ...current.report.map((s) => h('div', { class: 'sec' },
        h('b', {}, s.name), ' ', pill(`${s.included.length} IN`, 'ok'), s.deferred.length ? pill(`${s.deferred.length} NEXT TIME`) : null, s.excluded.length ? pill(`${s.excluded.length} EXCLUDED`, 'warn') : null, s.anonymousCount ? pill(`+${s.anonymousCount} ANON`, 'gold') : null,
        h('div', {}, s.included.map((p) => h('span', { class: 'who' + (p.featured ? ' feat' : '') }, s.kind === 'leaderboard' ? `#${p.rank} ${p.name} · ${p.beans}` : p.name + (p.role ? ` — ${p.role}` : ''), p.verification === 'self_reported' ? pill('SELF', '') : null,
          p.id && s.kind !== 'leaderboard' ? h('button', { type: 'button', title: 'Leave out of this episode', onclick: () => { toggle('exclude', p.id, true); toggle('include', p.id, false); refresh(); } }, '✕') : null))),
        s.deferred.length ? h('div', {}, s.deferred.map((p) => h('span', { class: 'who def', title: p.reason }, p.name, p.id && s.kind !== 'leaderboard' ? h('button', { type: 'button', title: 'Include this episode', onclick: () => { toggle('include', p.id, true); refresh(); } }, '＋') : null))) : null,
        s.excluded.length ? h('details', {}, h('summary', { class: 'hint' }, 'Excluded & why'), h('ul', {}, s.excluded.map((p) => h('li', { class: 'hint' }, `${p.name} — ${p.reason}`, p.id && /producer/.test(p.reason) ? btn('UNDO', () => { toggle('exclude', p.id, false); refresh(); }, 'ghost') : null)))) : null,
        s.note ? h('div', { class: 'hint' }, s.note) : null)));
  }

  let busy = 0;
  async function refresh() {
    const my = ++busy;
    try {
      const r = await api(`/admin/episodes/${id}/preview`, { method: 'POST', body: { draft: current.draft } });
      if (my !== busy) return;
      Object.assign(current, { sequence: r.sequence, report: r.report, warnings: r.warnings, source: r.leaderboardSource, fromVersion: null });
      player.load(r.sequence, { keepTime: true }); if (player.t === 0) player.seek(Math.min(r.sequence.duration, 2.5));
      drawTimebar(); drawSegments(); drawReport(); drawSteps();
    } catch (e) { reportEl.replaceChildren(h('div', { class: 'notice err' }, 'Preview failed: ' + e.message)); }
  }
  async function saveDraft(quiet) {
    await api('/admin/episodes/' + id, { method: 'PUT', body: { draft: current.draft, theme: current.draft.timing.theme || ep.theme } });
    if (!quiet) refresh();
  }
  d.categories = (await api('/admin/categories')).categories;
  drawSteps(); drawSegments();
  await refresh();
};

// ══ CONTRIBUTORS ══
R.people = async (main, arg) => {
  const cats = (await api('/admin/categories')).categories;
  const q = inp({ placeholder: 'Search name or handle', type: 'search' });
  const cf = sel([['', 'All categories'], ...cats.map((c) => [c.key, c.name])], '');
  const vf = sel([['', 'Any visibility'], ['public', 'Public'], ['anonymous', 'Anonymous'], ['private', 'Private']], '');
  const tbody = h('tbody');
  const drawer = h('div');
  async function load() {
    const p = new URLSearchParams({ q: q.value, category: cf.value, visibility: vf.value });
    const rows = (await api('/admin/contributors?' + p)).contributors;
    tbody.replaceChildren(...(rows.length ? rows.map((r) => h('tr', { class: 'click', tabindex: 0, onclick: () => { location.hash = 'people/' + r.id; }, onkeydown: (e) => e.key === 'Enter' && (location.hash = 'people/' + r.id) },
      h('td', {}, '#' + r.id), h('td', {}, r.display_name, r.is_sample ? pill('SAMPLE', 'warn') : null),
      h('td', {}, pill(r.visibility.toUpperCase(), VIS_PILL[r.visibility]), r.consent_public ? null : pill('NO CONSENT', 'err')),
      h('td', {}, r.categories.map((c) => pill(c.key.replace(/_/g, ' ').toUpperCase() + (c.status === 'former' ? ' (FORMER)' : ''), c.verification === 'self_reported' ? 'warn' : c.featured ? 'gold' : ''))),
      h('td', { class: 'hint' }, r.accounts.map((a) => `${a.provider}:${a.handle}`).join(' ')))) : [h('tr', {}, h('td', { colspan: 5, class: 'hint' }, 'Nobody on file matches.'))]));
  }
  for (const c of [cf, vf]) c.onchange = load;
  let t; q.oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  main.replaceChildren(h('h1', {}, 'CONTRIBUTORS'), h('p', { class: 'lede' }, 'ONE PERSON, ONE RECORD. MEMBERSHIP IS NOT THE SAME AS BEING SHOWN.'),
    drawer, h('div', { class: 'row', style: 'margin-bottom:12px' }, field('SEARCH', q), field('CATEGORY', cf), field('VISIBILITY', vf),
      h('div', { class: 'shrink' }, btn('+ ADD PERSON', () => { location.hash = 'people/new'; }, 'gold')),
      h('div', { class: 'shrink' }, btn('EXPORT CSV', async (e) => act(e.target, async () => download(await (await api('/admin/export?format=csv', { raw: true })).blob(), 'credits-contributors.csv'))))),
    h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'ID'), h('th', {}, 'NAME'), h('th', {}, 'VISIBILITY'), h('th', {}, 'CATEGORIES'), h('th', {}, 'ACCOUNTS'))), tbody)));
  await load();
  if (arg) await personEditor(drawer, arg === 'new' ? null : Number(arg), cats);
};

async function personEditor(target, id, cats) {
  const d = id ? await api('/admin/contributors/' + id) : { contributor: { visibility: 'private', consent_public: 0, consent_link: 0, link_approved: 0 }, accounts: [], memberships: [], contributions: [], consents: [], appearances: [], submissions: [], mergedFrom: [] };
  const c = d.contributor;
  const f = {
    display_name: inp({ value: c.display_name || '', maxlength: 80 }),
    visibility: sel([['public', 'Public — named'], ['anonymous', 'Anonymous — counted, never named'], ['private', 'Private — not shown anywhere']], c.visibility),
    consent_public: chk('They agreed to public recognition', c.consent_public), consent_link: chk('They agreed to have their profile linked', c.consent_link),
    link_url: inp({ type: 'url', value: c.link_url || '', placeholder: 'https://…' }), link_approved: chk('Link reviewed & approved', c.link_approved),
    bio: h('textarea', { rows: 2, maxlength: 400 }, c.bio || ''), avatar_url: inp({ type: 'url', value: c.avatar_url || '', placeholder: 'https:// (only if licensed)' }),
    private_note: h('textarea', { rows: 2, maxlength: 1000 }, c.private_note || ''), consent_note: inp({ placeholder: 'How consent was given (e.g. “DM 2026-10-18”)' }),
  };
  const body = () => ({ display_name: f.display_name.value, visibility: f.visibility.value, consent_public: f.consent_public.input.checked, consent_link: f.consent_link.input.checked,
    link_url: f.link_url.value, link_approved: f.link_approved.input.checked, bio: f.bio.value, avatar_url: f.avatar_url.value, private_note: f.private_note.value, consent_note: f.consent_note.value });
  const close = h('a', { href: '#people', class: 'hint' }, 'CLOSE ✕');
  const form = h('form', {},
    h('div', { class: 'row' }, field('DISPLAY NAME', f.display_name), field('VISIBILITY', f.visibility)),
    f.consent_public.el, f.consent_link.el, field('CONSENT NOTE (KEPT IN HISTORY)', f.consent_note),
    h('div', { class: 'row' }, field('PUBLIC LINK', f.link_url), h('div', {}, h('label', {}, ' '), f.link_approved.el)),
    h('div', { class: 'row' }, field('PUBLIC BIO', f.bio), field('PRIVATE NOTE (NEVER PUBLIC)', f.private_note)), field('AVATAR URL', f.avatar_url),
    h('p', { style: 'margin-top:12px' }, h('button', { class: 'btn sm gold', type: 'submit' }, id ? 'SAVE' : 'CREATE')));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (id) { await act(e.submitter, () => api('/admin/contributors/' + id, { method: 'PUT', body: body() }), 'Saved.'); peopleCache = null; route(); }
    else { const r = await act(e.submitter, () => api('/admin/contributors', { method: 'POST', body: body() }), 'Created.'); peopleCache = null; location.hash = 'people/' + r.id; }
  };
  const kids = [h('div', { class: 'row' }, h('h2', {}, id ? `#${id} ${c.display_name}` : 'NEW PERSON'), h('span', { class: 'shrink' }, close)), form];
  if (id) {
    // memberships
    const memRows = cats.filter((k) => k.kind !== 'leaderboard').map((k) => {
      const m = d.memberships.find((x) => x.category_key === k.key);
      const on = chk(k.name, m && m.status === 'active');
      const ver = sel([['manual', 'Manual'], ['verified', 'Verified'], ['self_reported', 'Self-reported']], m?.verification || 'manual');
      const feat = chk('Featured', m?.featured); feat.el.classList.add('nowrap');
      const label = inp({ value: m?.label || '', placeholder: k.kind === 'creators' ? 'Kind of work' : 'Label' });
      const reason = inp({ value: m?.reason || '', placeholder: k.kind === 'creators' ? 'Why Devin supports them (public)' : 'Public reason (optional)' });
      const save = btn('SAVE', (e) => act(e.target, () => (on.input.checked || m)
        ? api(`/admin/contributors/${id}/memberships/${k.key}`, { method: 'PUT', body: { status: on.input.checked ? 'active' : 'former', verification: ver.value, featured: feat.input.checked, label: label.value, reason: reason.value, sort_order: m?.sort_order || 0 } })
        : Promise.resolve(), 'Membership saved.'));
      const rm = m ? btn('REMOVE', (e) => act(e.target, () => api(`/admin/contributors/${id}/memberships/${k.key}`, { method: 'DELETE' }), 'Removed.').then(route), 'ghost') : null;
      return h('tr', {}, h('td', {}, on.el, m?.status === 'former' ? pill('FORMER') : null), h('td', {}, ver), h('td', {}, feat.el), h('td', {}, label), h('td', {}, reason), h('td', {}, save, rm));
    });
    // accounts
    const ap = sel([['x', '𝕏'], ['youtube', 'YouTube'], ['web', 'Web'], ['other', 'Other']], 'x'), ah = inp({ placeholder: '@handle' }), av = sel([['manual', 'Manual'], ['verified', 'Verified'], ['self_reported', 'Self-reported']], 'manual');
    // merge
    const mp = await picker('Merge INTO… (the record that stays)');
    kids.push(
      h('h3', {}, 'CATEGORIES'), h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'MEMBER OF'), h('th', {}, 'VERIFICATION'), h('th', {}, ''), h('th', {}, 'LABEL'), h('th', {}, 'PUBLIC REASON'), h('th', {}, ''))), h('tbody', {}, memRows))),
      h('h3', {}, 'ACCOUNTS'), h('div', {}, d.accounts.map((a) => h('span', { class: 'who' }, `${a.provider}: ${a.handle}`, pill(a.verification.toUpperCase(), a.verification === 'verified' ? 'ok' : a.verification === 'self_reported' ? 'warn' : ''),
        h('button', { type: 'button', 'aria-label': 'Remove account', onclick: (e) => act(e.target, () => api('/admin/accounts/' + a.id, { method: 'DELETE' }), 'Removed.').then(route) }, '✕')))),
      h('div', { class: 'row', style: 'margin-top:6px' }, field('PLATFORM', ap), field('HANDLE', ah), field('VERIFICATION', av),
        h('div', { class: 'shrink' }, btn('ADD ACCOUNT', (e) => act(e.target, () => api(`/admin/contributors/${id}/accounts`, { method: 'POST', body: { provider: ap.value, handle: ah.value, verification: av.value } }), 'Account added.').then(route)))),
      h('p', { class: 'hint' }, 'An 𝕏 handle here links this person to their Beans on the arcade leaderboard.'),
      h('h3', {}, 'CONTRIBUTIONS'), d.contributions.length ? h('ul', {}, d.contributions.map((x) => h('li', { class: 'hint' }, `${x.role}${x.episode_number ? ' · EP ' + x.episode_number : ' · general'}${x.description ? ' · ' + x.description : ''} `,
        btn('✕', (e) => act(e.target, () => api('/admin/contributions/' + x.id, { method: 'DELETE' }), 'Removed.').then(route), 'ghost')))) : h('p', { class: 'hint' }, 'None. Add episode work from Produce Credits.'),
      h('h3', {}, 'APPEARANCES'), h('p', { class: 'hint' }, d.appearances.length ? d.appearances.map((a) => `EP ${a.episode_number} (${a.category_key})`).join(', ') : 'Not credited in a published episode yet.'),
      h('h3', {}, 'CONSENT HISTORY'), h('ul', {}, d.consents.map((x) => h('li', { class: 'hint' }, `${x.recorded_at.slice(0, 16).replace('T', ' ')} · ${x.visibility}, public=${x.consent_public}, link=${x.consent_link} · ${x.source} · ${x.recorded_by}${x.note ? ' · ' + x.note : ''}`))),
      d.mergedFrom.length ? h('p', { class: 'hint' }, 'Merged in: ', d.mergedFrom.map((m) => `#${m.id} ${m.display_name}`).join(', ')) : null,
      h('h3', {}, 'IDENTITY & PRIVACY'),
      h('div', { class: 'row' }, field('MERGE THIS RECORD INTO', mp.el), h('div', { class: 'shrink' }, btn('MERGE', async (e) => {
        if (!mp.id()) return toast('Pick the record to keep.', true);
        if (!confirm(`Merge #${id} into #${mp.id()}? Accounts, memberships and contributions move; this record is retired.`)) return;
        await act(e.target, () => api(`/admin/contributors/${id}/merge`, { method: 'POST', body: { into: mp.id() } }), 'Merged.'); peopleCache = null; location.hash = 'people/' + mp.id();
      }))),
      h('p', { class: 'row', style: 'margin-top:10px' },
        h('span', { class: 'shrink' }, btn('EXPORT THIS PERSON’S DATA', async (e) => act(e.target, async () => download(await (await api(`/admin/contributors/${id}/export`, { raw: true })).blob(), `contributor-${id}.json`)))),
        h('span', { class: 'shrink' }, btn('ERASE (PRIVACY REQUEST)', async (e) => {
          const typed = prompt(`Erasure removes this person's personal data permanently and redacts them from every public page and archive.\nType ERASE to confirm.`);
          if (typed !== 'ERASE') return;
          await act(e.target, () => api('/admin/contributors/' + id, { method: 'DELETE' }), 'Erased.'); peopleCache = null; location.hash = 'people';
        }, 'red'))));
  }
  target.replaceChildren(h('div', { class: 'drawer' }, ...kids));
  target.scrollIntoView({ block: 'start' });
}

// ══ CREATORS ══
R.creators = async (main) => {
  const rows = (await api('/admin/contributors?category=mutual_enablers')).contributors;
  const details = await Promise.all(rows.map((r) => api('/admin/contributors/' + r.id)));
  const name = inp({ placeholder: 'Creator name' }), handle = inp({ placeholder: '@handle on 𝕏' }), work = inp({ placeholder: 'pixel art, essays, music…' }),
    why = inp({ placeholder: 'Why Devin supports their work (public)' }), link = inp({ type: 'url', placeholder: 'https:// their site (optional)' }), ok = chk('OK to feature publicly (they’re a public creator; listing is appreciation, not endorsement)', true);
  const add = h('form', { class: 'drawer' }, h('h2', {}, 'ADD A CREATOR'),
    h('div', { class: 'row' }, field('NAME', name), field('𝕏 HANDLE', handle), field('KIND OF WORK', work)), h('div', { class: 'row' }, field('WHY', why), field('LINK', link)), ok.el,
    h('p', { style: 'margin-top:10px' }, h('button', { class: 'btn sm gold', type: 'submit' }, 'ADD CREATOR')));
  add.onsubmit = async (e) => {
    e.preventDefault();
    await act(e.submitter, () => api('/admin/contributors', { method: 'POST', body: { display_name: name.value, visibility: ok.input.checked ? 'public' : 'private', consent_public: ok.input.checked, consent_link: !!link.value, link_url: link.value, link_approved: !!link.value,
      consent_note: 'Public creator listed in directory by admin', accounts: handle.value ? [{ provider: 'x', handle: handle.value }] : [], memberships: [{ category_key: 'mutual_enablers', label: work.value, reason: why.value }] } }), 'Creator added.');
    peopleCache = null; route();
  };
  const trs = details.map(({ contributor: c, memberships, accounts }) => {
    const m = memberships.find((x) => x.category_key === 'mutual_enablers');
    const feat = chk('', m.featured, { 'aria-label': 'Featured' }), ord = inp({ type: 'number', value: m.sort_order, style: 'width:64px' }), lab = inp({ value: m.label || '' }), rsn = inp({ value: m.reason || '' });
    const x = accounts.find((a) => a.provider === 'x');
    return h('tr', {}, h('td', {}, h('a', { href: '#people/' + c.id }, c.display_name), h('div', { class: 'hint' }, x ? '@' + x.handle : 'no 𝕏 handle'), pill(c.visibility.toUpperCase(), VIS_PILL[c.visibility]),
      c.link_url ? pill(c.link_approved ? 'LINK OK' : 'LINK PENDING', c.link_approved ? 'ok' : 'warn') : null),
      h('td', {}, feat.input), h('td', {}, ord), h('td', {}, lab), h('td', {}, rsn),
      h('td', {}, btn('SAVE', (e) => act(e.target, () => api(`/admin/contributors/${c.id}/memberships/mutual_enablers`, { method: 'PUT', body: { status: m.status, verification: m.verification, featured: feat.input.checked, sort_order: ord.value, label: lab.value, reason: rsn.value } }), 'Saved.')),
        c.link_url && !c.link_approved ? btn('APPROVE LINK', (e) => act(e.target, () => api('/admin/contributors/' + c.id, { method: 'PUT', body: { link_approved: true } }), 'Link approved.').then(route)) : null));
  });
  main.replaceChildren(h('h1', {}, 'CREATORS'), h('p', { class: 'lede' }, 'MUTUAL ENABLERS · CURATED BY HAND (𝕏 DOES NOT EXPOSE WHO YOU SUBSCRIBE TO)'), add,
    h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'CREATOR'), h('th', {}, 'FEATURED'), h('th', {}, 'ORDER'), h('th', {}, 'WORK'), h('th', {}, 'WHY'), h('th', {}, ''))),
      h('tbody', {}, trs.length ? trs : h('tr', {}, h('td', { colspan: 6, class: 'hint' }, 'No creators yet.'))))),
    h('p', { class: 'hint', style: 'margin-top:10px' }, 'Spotlight status: add a spotlight for a creator in ', h('a', { href: '#recognition' }, 'Spotlight & Fame'), '.'));
};

// ══ ARCADE ══
R.arcade = async (main) => {
  const b = await api('/admin/beans');
  const rules = new Map(b.rules.map((r) => [r.handle, r]));
  const rule = (handle, status) => async (e) => {
    const reason = status === 'excluded' ? prompt('Reason (kept in the audit log):', 'name not suitable for broadcast') : 'reviewed';
    if (reason === null) return;
    await act(e.target, () => api('/admin/beans/rules/' + encodeURIComponent(handle), { method: 'PUT', body: { status, reason } }), 'Rule saved.'); route();
  };
  const period = (label, p) => h('div', { class: 'card' }, h('h2', {}, label), p.available
    ? h('table', { class: 'admin' }, h('tbody', {}, p.leaders.map((l) => h('tr', {}, h('td', {}, l.rank), h('td', {}, l.display), h('td', { style: 'text-align:right;color:var(--gold)' }, '+' + l.beans)))))
    : h('p', { class: 'hint' }, `${p.reason}${p.collectingSince ? ' Collecting since ' + p.collectingSince + '.' : ''}`));
  main.replaceChildren(h('h1', {}, 'ARCADE'), h('p', { class: 'lede' }, 'READ-ONLY WINDOW ON THE REAL BEANS ECONOMY. THIS DEPARTMENT NEVER TOUCHES A BEAN.'),
    h('div', { class: 'cols' },
      h('div', { class: 'card' }, h('h2', {}, 'LIVE LEADERBOARD'), b.live
        ? h('div', {}, h('p', { class: 'hint' }, `Feed as of ${b.live.asof} (updated ${b.live.updated || '?'}) · ${b.live.players} players · ${b.live.totalBeans ?? '?'} Beans`),
          h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'POS'), h('th', {}, 'PLAYER'), h('th', {}, 'BEANS'), h('th', {}, 'STATUS'), h('th', {}, ''))),
            h('tbody', {}, b.live.entries.map((e) => h('tr', {}, h('td', {}, e.pos), h('td', {}, e.display, e.contributorId ? h('a', { href: '#people/' + e.contributorId, class: 'hint' }, ` #${e.contributorId}`) : null),
              h('td', { style: 'color:var(--gold)' }, e.beans), h('td', {}, e.excluded ? pill(e.flagged ? 'FLAGGED' : 'EXCLUDED', 'err') : pill('OK', 'ok'), h('div', { class: 'hint' }, e.exclusionReason || '')),
              h('td', {}, e.excluded ? btn('APPROVE', rule(e.handle, 'approved')) : btn('EXCLUDE', rule(e.handle, 'excluded'), 'red'),
                rules.has(e.handle) ? btn('CLEAR RULE', async (ev) => { await act(ev.target, () => api('/admin/beans/rules/' + e.handle, { method: 'DELETE' }), 'Cleared.'); route(); }, 'ghost') : null)))))))
        : h('div', { class: 'notice err' }, 'Feed unreachable: ', b.integration?.last_error || 'unknown error')),
      h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h2', {}, 'DAILY HISTORY'), h('p', { class: 'hint' }, b.history.n ? `${b.history.n} daily copies, ${b.history.first} → ${b.history.last}.` : 'No copies yet.', ' A daily job records the feed; weekly/monthly views only use these real copies.'),
          h('p', { class: 'row' }, h('span', { class: 'shrink' }, btn('RECORD NOW', (e) => act(e.target, () => api('/admin/beans/record', { method: 'POST' }), (r) => r.added ? `Recorded ${r.asof}.` : `${r.asof} was already on file.`).then(route))),
            h('span', { class: 'shrink' }, btn('IMPORT FEED GIT HISTORY', (e) => act(e.target, () => api('/admin/beans/backfill', { method: 'POST' }), (r) => `Checked ${r.commits} commits, added ${r.added}.${r.errors.length ? ' Errors: ' + r.errors.length : ''}`).then(route))))),
        period('WEEKLY LEADERS', b.week), period('MONTHLY LEADERS', b.month))),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'SNAPSHOT HISTORY'), h('div', { class: 'scroll' }, h('table', { class: 'admin' },
      h('thead', {}, h('tr', {}, h('th', {}, 'ID'), h('th', {}, 'EP'), h('th', {}, 'FEED AS OF'), h('th', {}, 'TOP N'), h('th', {}, 'BY'), h('th', {}, 'NOTES'))),
      h('tbody', {}, b.snapshots.map((s) => h('tr', {}, h('td', {}, '#' + s.id), h('td', {}, s.episode ?? '—'), h('td', {}, s.feed_asof), h('td', {}, s.top_n), h('td', { class: 'hint' }, `${s.taken_by} · ${s.taken_at.slice(0, 16).replace('T', ' ')}`),
        h('td', { class: 'hint' }, s.supersedes ? `supersedes #${s.supersedes}. ` : '', s.reason || ''))))))),
    h('p', { class: 'hint', style: 'margin-top:10px' }, 'Tie rule: equal Beans share the best position (T-03, T-03…). The feed’s own order decides who fits in the top N; the rest are noted as “+N more tied”.'));
};

// ══ REQUESTS ══
R.requests = async (main, arg) => {
  const status = arg || 'pending';
  const subs = (await api('/admin/submissions?status=' + status)).submissions;
  const cats = (await api('/admin/categories')).categories;
  const MAP = { x_supporter: 'financially_irresponsible', youtube_witness: 'voluntary_witnesses', emotional_support: 'emotional_support' };
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ['pending', 'approved', 'rejected', 'withdrawn', 'all'].map((s) => h('button', { role: 'tab', 'aria-selected': String(s === status), onclick: () => { location.hash = 'requests/' + s; } }, s.toUpperCase())));
  const cards = subs.map((s) => {
    const cat = sel([['', '— no category (e.g. arcade: Beans link via handle) —'], ...cats.filter((c) => c.kind !== 'leaderboard').map((c) => [c.key, c.name])], MAP[s.contribution] ?? '');
    const ver = sel([['self_reported', 'Self-reported'], ['manual', 'Confirmed by me'], ['verified', 'Verified']], 'self_reported');
    const attach = s.possibleMatch ? chk(`Same person as #${s.possibleMatch.id} ${s.possibleMatch.display_name} — attach instead of creating`, true) : null;
    const link = s.profile_url ? chk('Link reviewed & approved', false) : null;
    return h('div', { class: 'card', style: 'margin-bottom:12px' },
      h('div', { class: 'row' }, h('div', {}, h('b', { style: 'font-size:17px' }, s.display_name), ' ', pill(s.kind.toUpperCase()), pill(s.status.toUpperCase(), s.status === 'pending' ? 'gold' : s.status === 'approved' ? 'ok' : 'err')),
        h('div', { class: 'shrink hint' }, `${s.ref} · ${s.created_at.slice(0, 16).replace('T', ' ')}`)),
      h('dl', { class: 'kv', style: 'margin-top:8px' }, h('dt', {}, 'CONTRIBUTION'), h('dd', {}, s.contribution.replace(/_/g, ' ')),
        h('dt', {}, 'ACCOUNT'), h('dd', {}, s.handle ? `${s.platform || '?'}: ${s.handle}` : '—'), h('dt', {}, 'LINK'), h('dd', {}, s.profile_url ? ext(s.profile_url, s.profile_url) : '—'),
        h('dt', {}, 'PERMISSIONS'), h('dd', {}, s.consent_public ? pill('NAME PUBLIC', 'ok') : pill('ANONYMOUS', 'gold'), s.consent_link ? pill('LINK OK', 'ok') : pill('NO LINK')),
        h('dt', {}, 'NOTE'), h('dd', {}, s.note || '—')),
      s.status === 'pending' ? h('div', {}, h('div', { class: 'row', style: 'margin-top:8px' }, field('CATEGORY', cat), field('VERIFICATION', ver)), attach?.el, link?.el,
        h('p', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'shrink' }, btn('APPROVE', (e) => act(e.target, () => api(`/admin/submissions/${s.id}/approve`, { method: 'POST',
          body: { category_key: cat.value, verification: ver.value, contributor_id: attach?.input.checked ? s.possibleMatch.id : null, approve_link: !!link?.input.checked } }), 'Approved. Welcome to the department.').then(() => { peopleCache = null; route(); }), 'gold')),
          h('span', { class: 'shrink' }, btn('REJECT', (e) => { const r = prompt('Reason (private):', 'spam'); if (r !== null) act(e.target, () => api(`/admin/submissions/${s.id}/reject`, { method: 'POST', body: { reason: r } }), 'Rejected.').then(route); }, 'red')))) : null);
  });
  main.replaceChildren(h('h1', {}, 'REQUESTS'), h('p', { class: 'lede' }, 'NOTHING FROM /credits/join IS PUBLISHED UNTIL IT IS APPROVED HERE.'), tabs, ...(cards.length ? cards : [h('div', { class: 'empty' }, 'NO REQUESTS IN THIS DRAWER.')]));
};

// ══ SPOTLIGHT & FAME ══
R.recognition = async (main) => {
  const sp = (await api('/admin/spotlights')).rows, fame = (await api('/admin/fame')).rows;
  const p1 = await picker(), p2 = await picker('Contributor (optional)');
  const s = { headline: inp({ maxlength: 120 }), body: h('textarea', { rows: 2, maxlength: 600 }), starts_on: inp({ type: 'date' }), ends_on: inp({ type: 'date' }) };
  const f = { honoree: inp({ placeholder: 'Or a name / moment' }), title: inp({ maxlength: 120 }), description: h('textarea', { rows: 2 }), season: inp({ type: 'number', min: 1, value: 1 }), achieved_on: inp({ type: 'date' }) };
  const spForm = h('form', {}, h('div', { class: 'row' }, field('WHO', p1.el), field('HEADLINE', s.headline)), field('STORY', s.body), h('div', { class: 'row' }, field('FROM', s.starts_on), field('UNTIL', s.ends_on)),
    h('p', { style: 'margin-top:10px' }, h('button', { class: 'btn sm gold', type: 'submit' }, 'ADD SPOTLIGHT')));
  spForm.onsubmit = (e) => { e.preventDefault(); act(e.submitter, () => api('/admin/spotlights', { method: 'POST', body: { contributor_id: p1.id(), headline: s.headline.value, body: s.body.value, starts_on: s.starts_on.value, ends_on: s.ends_on.value, active: true } }), 'Spotlight added.').then(route); };
  const fForm = h('form', {}, h('div', { class: 'row' }, field('CONTRIBUTOR', p2.el), field('HONOREE', f.honoree)), h('div', { class: 'row' }, field('TITLE', f.title), field('SEASON', f.season), field('DATE', f.achieved_on)), field('DESCRIPTION', f.description),
    h('p', { style: 'margin-top:10px' }, h('button', { class: 'btn sm gold', type: 'submit' }, 'INDUCT')));
  fForm.onsubmit = (e) => { e.preventDefault(); act(e.submitter, () => api('/admin/fame', { method: 'POST', body: { contributor_id: p2.id(), honoree: f.honoree.value, title: f.title.value, description: f.description.value, season: f.season.value, achieved_on: f.achieved_on.value, visible: true } }), 'Inducted.').then(route); };
  const toggleRow = (table, r, key) => btn(r[key] ? 'HIDE' : 'SHOW', (e) => act(e.target, () => api(`/admin/${table}/${r.id}`, { method: 'PUT', body: { [key]: !r[key] } })).then(route), 'ghost');
  const del = (table, r) => btn('DELETE', (e) => confirm('Delete?') && act(e.target, () => api(`/admin/${table}/${r.id}`, { method: 'DELETE' }), 'Deleted.').then(route), 'red');
  main.replaceChildren(h('h1', {}, 'SPOTLIGHT & FAME'), h('p', { class: 'lede' }, 'SPOTLIGHTS ROTATE WEEKLY AMONG ACTIVE ENTRIES. THE HALL OF FAME IS FOREVER (OR UNTIL YOU HIDE IT).'),
    h('div', { class: 'cols' },
      h('div', { class: 'card' }, h('h2', {}, 'COMMUNITY SPOTLIGHT'), spForm, h('table', { class: 'admin', style: 'margin-top:12px' }, h('tbody', {}, sp.map((r) => h('tr', {},
        h('td', {}, r.contributor_name, h('div', { class: 'hint' }, r.headline)), h('td', { class: 'hint' }, `${r.starts_on || '…'} → ${r.ends_on || '…'}`), h('td', {}, r.active ? pill('ACTIVE', 'ok') : pill('OFF')), h('td', {}, toggleRow('spotlights', r, 'active'), del('spotlights', r))))))),
      h('div', { class: 'card' }, h('h2', {}, 'HALL OF FAME'), fForm, h('table', { class: 'admin', style: 'margin-top:12px' }, h('tbody', {}, fame.map((r) => h('tr', {},
        h('td', {}, h('b', {}, r.title), h('div', { class: 'hint' }, r.contributor_name || r.honoree)), h('td', { class: 'hint' }, `S${r.season ?? '–'} ${r.achieved_on || ''}`), h('td', {}, r.visible ? pill('VISIBLE', 'ok') : pill('HIDDEN')), h('td', {}, toggleRow('fame', r, 'visible'), del('fame', r)))))))));
};

// ══ HUMOR ENGINE ══
R.jokes = async (main) => {
  const rows = (await api('/admin/jokes')).rows;
  const text = inp({ maxlength: 90, placeholder: 'AFFECTIONATE. NEVER ABOUT A NAMED PERSON.' }), themes = inp({ value: '*', placeholder: '* or terminal,midnight,beans' });
  const add = h('form', { class: 'row' }, field('NEW NOTICE', text), field('THEMES', themes), h('div', { class: 'shrink' }, h('button', { class: 'btn sm gold', type: 'submit' }, 'ADD')));
  add.onsubmit = (e) => { e.preventDefault(); act(e.submitter, () => api('/admin/jokes', { method: 'POST', body: { text: text.value, themes: themes.value, enabled: true } }), 'Filed.').then(route); };
  main.replaceChildren(h('h1', {}, 'STOOPID HUMOR ENGINE'), h('p', { class: 'lede' }, 'BROADCAST NOTICES FOR THE FOOTER OF EACH CREDITS PAGE. PICKED BY A SAVED SEED, OR BY HAND PER EPISODE IN PRODUCE.'), add,
    h('table', { class: 'admin', style: 'margin-top:14px' }, h('tbody', {}, rows.map((r) => {
      const th = inp({ value: r.themes, style: 'max-width:200px' });
      return h('tr', {}, h('td', {}, r.text), h('td', {}, th), h('td', {}, r.enabled ? pill('ON', 'ok') : pill('OFF')),
        h('td', {}, btn('SAVE', (e) => act(e.target, () => api('/admin/jokes/' + r.id, { method: 'PUT', body: { themes: th.value } }), 'Saved.')),
          btn(r.enabled ? 'DISABLE' : 'ENABLE', (e) => act(e.target, () => api('/admin/jokes/' + r.id, { method: 'PUT', body: { enabled: !r.enabled } })).then(route), 'ghost'),
          btn('DELETE', (e) => confirm('Delete this joke?') && act(e.target, () => api('/admin/jokes/' + r.id, { method: 'DELETE' }), 'Deleted.').then(route), 'red')));
    }))));
};

// ══ IMPORT ══
R.import = async (main) => {
  const cats = (await api('/admin/categories')).categories.filter((c) => c.kind !== 'leaderboard');
  const jobs = (await api('/admin/imports')).jobs;
  const file = h('input', { type: 'file', accept: '.csv,text/csv', id: 'f' + ++uid });
  const text = h('textarea', { rows: 6, placeholder: 'Or paste CSV here. First row = headers.' });
  const cat = sel(cats.map((c) => [c.key, c.name]), 'financially_irresponsible');
  const prov = sel([['x', '𝕏 handles'], ['youtube', 'YouTube handles']], 'x');
  const ver = sel([['manual', 'Manual (from my own records)'], ['verified', 'Verified (official export)'], ['self_reported', 'Self-reported']], 'manual');
  const vis = sel([['private', 'Private until consent is recorded (safe default)'], ['anonymous', 'Anonymous (counted, not named)'], ['public', 'Public — ONLY if these people agreed to be named']], 'private');
  const mapBox = h('div'), out = h('div');
  let csv = '', name = '', mapping = {};
  file.onchange = async () => { const f = file.files[0]; if (!f) return; if (f.size > 2_000_000) return toast('That file is over 2 MB; split it.', true); csv = await f.text(); name = f.name; text.value = ''; drawMap(); };
  text.oninput = () => { csv = text.value; name = 'pasted'; drawMap(); };
  function drawMap() {
    let headers = [];
    try { headers = parseCsv(csv).headers; } catch (e) { return mapBox.replaceChildren(h('div', { class: 'notice err' }, e.message)); }
    mapping = guessMapping(headers);
    const opts = [['', '— none —'], ...headers.map((x) => [x, x])];
    mapBox.replaceChildren(h('h3', {}, 'COLUMN MAPPING'), h('div', { class: 'row' }, ...['display_name', 'handle', 'profile_url', 'status', 'since', 'visibility', 'note'].map((k) => {
      const s = sel(opts, mapping[k]); s.onchange = () => { mapping[k] = s.value; }; return field(k.replace('_', ' ').toUpperCase(), s);
    })));
  }
  const run = (dry) => async (e) => {
    if (!csv.trim()) return toast('Choose a file or paste CSV first.', true);
    if (!dry && vis.value === 'public' && !confirm('Mark new people PUBLIC? Only do this if every person in this file agreed to be named.')) return;
    const r = await act(e.target, () => api('/admin/import', { method: 'POST', body: { csv, filename: name, mapping, category_key: cat.value, provider: prov.value, verification: ver.value, default_visibility: vis.value, dry_run: dry } }), dry ? 'Dry run complete — nothing saved.' : 'Imported.');
    out.replaceChildren(h('div', { class: 'notice ' + (dry ? '' : 'ok') }, `${dry ? 'WOULD' : 'DID'}: create ${r.create} · update ${r.update} · skip ${r.skip} (of ${r.rows} rows)`),
      r.errors.length ? h('ul', { class: 'warns' }, r.errors.slice(0, 50).map((x) => h('li', {}, `line ${x.line}: ${x.error}`))) : null,
      h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'LINE'), h('th', {}, 'ACTION'), h('th', {}, 'NAME'), h('th', {}, 'HANDLE'), h('th', {}, 'STATUS'), h('th', {}, 'VISIBILITY'))),
        h('tbody', {}, r.preview.map((p) => h('tr', {}, h('td', {}, p.line), h('td', {}, pill(p.action.toUpperCase(), p.action === 'create' ? 'ok' : 'gold'), p.existing ? ` #${p.existing}` : ''), h('td', {}, p.name), h('td', {}, p.handle || ''), h('td', {}, p.status), h('td', {}, p.visibility)))))));
    if (!dry) peopleCache = null;
  };
  main.replaceChildren(h('h1', {}, 'IMPORT'), h('p', { class: 'lede' }, 'CSV FROM YOUR 𝕏 SUBSCRIBER LIST, A SPREADSHEET, ANYTHING. ALWAYS DRY-RUN FIRST.'),
    h('div', { class: 'card' }, field('CSV FILE', file), text, h('div', { class: 'row' }, field('INTO CATEGORY', cat), field('HANDLES ARE', prov), field('VERIFICATION', ver), field('NEW PEOPLE ARE', vis)),
      mapBox, h('p', { class: 'row', style: 'margin-top:12px' }, h('span', { class: 'shrink' }, btn('DRY RUN', run(true))), h('span', { class: 'shrink' }, btn('IMPORT FOR REAL', run(false), 'gold'))),
      h('p', { class: 'hint' }, 'Existing people are matched by handle (or exact name) and only get their membership updated. Rows with a status like “cancelled” become former members. Payment amounts and emails are ignored — never put them in.')),
    h('div', { style: 'margin-top:14px' }, out),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'PAST IMPORTS'), h('table', { class: 'admin' }, h('tbody', {}, jobs.map((j) => h('tr', {}, h('td', {}, `#${j.id}`), h('td', {}, j.filename || ''), h('td', {}, j.category_key), h('td', { class: 'hint' }, `+${j.created} ~${j.updated} skip ${j.skipped}`), h('td', { class: 'hint' }, `${j.created_by} · ${j.created_at.slice(0, 16).replace('T', ' ')}`)))))));
};

// ══ SETTINGS ══
R.settings = async (main) => {
  const { settings: s, themes, endCards } = await api('/admin/settings');
  const cats = (await api('/admin/categories')).categories;
  const integ = await api('/admin/integrations');
  const catRows = cats.map((c) => {
    const f = { name: inp({ value: c.name }), tagline: inp({ value: c.tagline }), enabled: chk('', c.enabled), sort_order: inp({ type: 'number', value: c.sort_order, style: 'width:64px' }),
      cap: inp({ type: 'number', value: c.cap, style: 'width:64px' }), segment_seconds: inp({ type: 'number', step: 0.5, value: c.segment_seconds, style: 'width:64px' }), public_section: chk('', c.public_section) };
    return h('tr', {}, h('td', {}, f.name, h('div', { class: 'hint' }, `${c.key} · ${c.kind}`)), h('td', {}, f.tagline), h('td', {}, f.enabled.input), h('td', {}, f.public_section.input), h('td', {}, f.sort_order), h('td', {}, f.cap), h('td', {}, f.segment_seconds),
      h('td', {}, btn('SAVE', (e) => act(e.target, () => api('/admin/categories/' + c.key, { method: 'PUT', body: { name: f.name.value, tagline: f.tagline.value, enabled: f.enabled.input.checked, public_section: f.public_section.input.checked, sort_order: f.sort_order.value, cap: f.cap.value, segment_seconds: f.segment_seconds.value } }), 'Category saved.'))));
  });
  const nk = inp({ placeholder: 'key, e.g. pet_department' }), nn = inp({ placeholder: 'NAME ON SCREEN' }), nkind = sel([['curated', 'Curated (hand-picked)'], ['rotating', 'Rotating (fair rotation)'], ['episode', 'Episode-specific']], 'curated');
  const t = s.timing;
  const g = {
    theme: sel(themes.map((x) => [x.id, x.name]), t.theme), fps: sel([['24', '24'], ['30', '30'], ['60', '60']], String(t.fps)), endCard: sel(endCards.map((x) => [x.id, x.name]), t.endCard),
    identSeconds: inp({ type: 'number', value: t.identSeconds }), finalSeconds: inp({ type: 'number', value: t.finalSeconds }), minPageSeconds: inp({ type: 'number', step: 0.5, value: t.minPageSeconds }),
    overflow: sel([['archive', 'Point to the archive'], ['extend', 'Lengthen segment']], t.overflow), emptyCategories: sel([['skip', 'Skip'], ['card', 'Show a card']], t.emptyCategories),
    audio: chk('Soundtrack on by default', t.audio), archiveUrl: inp({ value: t.archiveUrl }),
    top: inp({ type: 'number', min: 1, max: 20, value: s.leaderboard_top_n }), dedupe: chk('One rotating credit per person per episode (dedupe)', s.dedupe),
    shown: inp({ type: 'number', value: s.hall_supporters_shown }), auto: chk('Auto-approve leaderboard names that pass the filter', s.beans_auto_approve),
    block: h('textarea', { rows: 3 }, s.name_blocklist.join(', ')), joinOpen: chk('Accept recognition requests at /credits/join', s.join_open), archive: chk('Public archive visible', s.archive_public),
    title: inp({ value: s.episode_title_format }), formats: inp({ value: s.export_formats.join(',') }),
    links: Object.fromEntries(['youtube', 'x', 'arcade', 'episodes'].map((k) => [k, inp({ type: 'url', value: s.links[k] || '' })])),
  };
  const save = (e) => act(e.target, () => api('/admin/settings', { method: 'PUT', body: {
    timing: { theme: g.theme.value, fps: Number(g.fps.value), endCard: g.endCard.value, identSeconds: Number(g.identSeconds.value), finalSeconds: Number(g.finalSeconds.value), minPageSeconds: Number(g.minPageSeconds.value),
      overflow: g.overflow.value, emptyCategories: g.emptyCategories.value, audio: g.audio.input.checked, archiveUrl: g.archiveUrl.value },
    leaderboard_top_n: Number(g.top.value), dedupe: g.dedupe.input.checked, hall_supporters_shown: Number(g.shown.value), beans_auto_approve: g.auto.input.checked,
    name_blocklist: g.block.value, join_open: g.joinOpen.input.checked, archive_public: g.archive.input.checked, episode_title_format: g.title.value,
    export_formats: g.formats.value.split(',').map((x) => x.trim()), links: Object.fromEntries(Object.entries(g.links).map(([k, v]) => [k, v.value])) } }), 'Settings saved.');
  main.replaceChildren(h('h1', {}, 'SETTINGS'), h('p', { class: 'lede' }, 'DEFAULTS FOR EVERY NEW EPISODE. EACH EPISODE CAN STILL OVERRIDE THEM IN PRODUCE.'),
    h('div', { class: 'card' }, h('h2', {}, 'CATEGORIES'), h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'NAME'), h('th', {}, 'TAGLINE'), h('th', {}, 'ON'), h('th', {}, 'PUBLIC'), h('th', {}, 'ORDER'), h('th', {}, 'CAP'), h('th', {}, 'SECONDS'), h('th', {}, ''))), h('tbody', {}, catRows))),
      h('div', { class: 'row', style: 'margin-top:10px' }, field('NEW CATEGORY KEY', nk), field('NAME', nn), field('KIND', nkind),
        h('div', { class: 'shrink' }, btn('ADD CATEGORY', (e) => act(e.target, () => api('/admin/categories/' + encodeURIComponent(nk.value), { method: 'PUT', body: { name: nn.value, kind: nkind.value } }), 'Category added.').then(route))))),
    h('div', { class: 'cols', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', {}, 'CREDITS DEFAULTS'), h('div', { class: 'row' }, field('THEME', g.theme), field('FPS', g.fps), field('END CARD', g.endCard)),
        h('div', { class: 'row' }, field('IDENT S', g.identSeconds), field('FINAL S', g.finalSeconds), field('MIN PAGE S', g.minPageSeconds)),
        h('div', { class: 'row' }, field('TOO MANY NAMES', g.overflow), field('EMPTY CATEGORY', g.emptyCategories)), field('ARCHIVE URL ON SCREEN', g.archiveUrl), g.audio.el,
        field('EPISODE NAMING', g.title, 'Tokens: {number}, {title}'), field('DEFAULT EXPORT FORMATS', g.formats, 'mp4, cards, alpha-cards, prores, webm-alpha')),
      h('div', { class: 'card' }, h('h2', {}, 'RECOGNITION RULES'), field('ARCADE TOP N', g.top), g.dedupe.el, field('SUPPORTERS SHOWN ON THE HALL', g.shown), g.auto.el, field('NAME FILTER (COMMA-SEPARATED)', g.block, 'Flagged names are held for review, not published.'),
        g.joinOpen.el, g.archive.el, h('h3', {}, 'PUBLIC LINKS'), ...Object.entries(g.links).map(([k, v]) => field(k.toUpperCase(), v)))),
    h('p', { style: 'margin-top:14px' }, h('button', { class: 'btn gold', type: 'button', onclick: save }, 'SAVE SETTINGS')),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'INTEGRATIONS'), h('ul', {}, Object.entries(integ.capabilities).map(([k, v]) => h('li', { class: 'hint', style: 'margin:4px 0 4px 16px' }, h('b', {}, k), ' — ', v))),
      h('p', { class: 'hint' }, 'Secrets (ADMIN_TOKEN, IP_SALT) live only in Cloudflare. See docs/credits-integrations.md to change them.')),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'BACKUP'), h('p', { class: 'row' },
      h('span', { class: 'shrink' }, btn('FULL BACKUP (JSON)', async (e) => act(e.target, async () => download(await (await api('/admin/export', { raw: true })).blob(), `credits-backup-${new Date().toISOString().slice(0, 10)}.json`)))),
      h('span', { class: 'shrink' }, btn('CONTRIBUTORS (CSV)', async (e) => act(e.target, async () => download(await (await api('/admin/export?format=csv', { raw: true })).blob(), 'credits-contributors.csv')))))));
};

// ══ AUDIT ══
R.audit = async (main) => {
  const rows = (await api('/admin/audit')).entries;
  main.replaceChildren(h('h1', {}, 'AUDIT LOG'), h('p', { class: 'lede' }, 'EVERY CHANGE, WHO MADE IT, AND WHEN. THE LAST 300 ENTRIES.'),
    h('div', { class: 'scroll' }, h('table', { class: 'admin' }, h('thead', {}, h('tr', {}, h('th', {}, 'WHEN'), h('th', {}, 'WHO'), h('th', {}, 'ACTION'), h('th', {}, 'WHAT'), h('th', {}, 'DETAIL'))),
      h('tbody', {}, rows.map((r) => h('tr', {}, h('td', { class: 'hint' }, r.at.slice(0, 19).replace('T', ' ')), h('td', {}, r.actor), h('td', {}, pill(r.action.toUpperCase())), h('td', {}, `${r.entity}${r.entity_id ? ' ' + r.entity_id : ''}`), h('td', { class: 'hint' }, r.detail || '')))))));
};
