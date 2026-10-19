// Shared helpers for the public Credits pages. All dynamic text goes through text nodes — never innerHTML.

export const API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? `${location.protocol}//${location.hostname}:8787`
  : 'https://stoopid-credits.stoopidshow.workers.dev';
export const BEANS_FEED = 'https://raw.githubusercontent.com/STOOPIDshow/beans-feed/main/beans-leaderboard.json';
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** h('a', {href, class}, 'text', child…) — attributes set safely; strings become text nodes. */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'href' || k === 'src') { if (/^(https:|\/|\.|#|mailto:|\?)/.test(String(v))) el.setAttribute(k, v); }
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

/** External link to someone's work: new tab, no referrer, marked user-generated. */
export const ext = (href, text, cls) => h('a', { href, target: '_blank', rel: 'noopener noreferrer ugc nofollow', class: cls }, text);

export async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

export function offline(target, what = 'this department') {
  target.replaceChildren(h('div', { class: 'notice warn', role: 'status' },
    `THE CREDITS OFFICE IS TEMPORARILY CLOSED. ${what.toUpperCase()} WILL RETURN. NOBODY HAS BEEN UN-THANKED.`));
}

export function loading(target, label = 'RETRIEVING RECORDS') {
  target.replaceChildren(h('div', { class: 'empty loading', role: 'status' }, label));
}

const NAV = [
  ['hall', '../', 'THE HALL'], ['episodes', 'episodes/', 'EPISODE CREDITS'], ['creators', 'creators/', 'CREATOR DIRECTORY'],
  ['fame', 'hall-of-fame/', 'HALL OF FAME'], ['join', 'join/', 'GET CREDITED'],
];

/** Header + nav + legal footer, shared by every public page. `depth` = folders below /credits/. */
export function chrome(active, depth = 1) {
  const up = depth ? '../'.repeat(depth) : './';
  const top = h('div', { class: 'topbar' },
    h('span', { class: 'onair' }, h('i'), 'DEPT. OF UNNECESSARY APPRECIATION'),
    h('span', {}, 'STOOPIDTV · FORM CD-001 · ', h('span', { id: 'clock' }, '--:--:--')),
    h('a', { href: up + '../index.html' }, '◂ THE STOOPID STUDIO'));
  const nav = h('nav', { class: 'dept', 'aria-label': 'Credits Department' },
    NAV.map(([k, href, label]) => h('a', { href: k === 'hall' ? up : up + href, 'aria-current': k === active ? 'page' : null }, label)));
  document.getElementById('chrome').replaceChildren(top, nav);
  document.getElementById('legal').replaceChildren(
    h('p', {}, h('b', {}, 'LEGAL-ISH DISCLAIMER. '), 'Recognition here is voluntary, consent-based and can be withdrawn at any time at ', h('a', { href: up + 'join/#withdraw' }, 'GET CREDITED → WITHDRAW'), '. Listing a creator is appreciation, not a sponsorship, partnership or endorsement. Subscriptions marked self-reported have not been verified. Beans come from the STOOPIDTV arcade and are never awarded for paying.'),
    h('p', {}, h('a', { href: up + 'privacy/' }, 'PRIVACY'), ' · Nobody made this alone. Unfortunately, you’re all implicated. · END TRANSMISSION. AS IS.'));
  const clock = document.getElementById('clock');
  const tick = () => { clock.textContent = new Date().toTimeString().slice(0, 8); };
  tick(); if (!REDUCED) setInterval(tick, 1000);
}

export function fmtDate(d) {
  if (!d) return '';
  const t = Date.parse(d.length === 10 ? d + 'T12:00:00Z' : d);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
}

/** Read the public feed directly — fallback when the API is down. Same file stoopidtv.com/beans uses. */
export async function rawFeed() {
  const r = await fetch(BEANS_FEED, { cache: 'no-store' });
  if (!r.ok) throw new Error('feed unavailable');
  const f = await r.json();
  return { asof: f.asof, players: f.players, leaders: (f.top || []).filter((p) => Number.isInteger(p.life)).map((p) => {
    const tied = f.top.filter((o) => o.life === p.life);
    return { pos: p.pos, rank: Math.min(...tied.map((o) => o.pos)), tied: tied.length > 1, name: String(p.h), beans: p.life };
  }) };
}

export function beansTable(leaders, { limit = 10 } = {}) {
  if (!leaders || !leaders.length) return h('div', { class: 'empty' }, 'NO BEANS ON RECORD YET. THE BOARD IS OPEN.');
  return h('table', { class: 'term' },
    h('caption', { class: 'sr' }, 'Beans leaderboard'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'POS'), h('th', { scope: 'col' }, 'PLAYER'), h('th', { scope: 'col', style: 'text-align:right' }, 'BEANS'))),
    h('tbody', {}, leaders.slice(0, limit).map((l) => h('tr', { class: l.rank === 1 ? 'first' : '' },
      h('td', {}, (l.tied ? 'T-' : '') + String(l.rank).padStart(2, '0')),
      h('td', {}, l.name),
      h('td', { class: 'num' }, Number(l.beans).toLocaleString('en-US'), h('span', { class: 'beanico', 'aria-hidden': 'true' }))))));
}
