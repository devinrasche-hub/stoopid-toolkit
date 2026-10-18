// End-to-end tests of the Credits API against the real migration (node:sqlite D1 shim).
// Numbers in test names refer to the "REQUIRED TESTS" list in the project brief.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { world, addPerson, TOKEN } from './helpers.js';
import { FEED_2026_10_16 } from './fixtures.js';

let w;
beforeEach(() => { w = world(FEED_2026_10_16); });
afterEach(() => w.restore());

async function episode(number = 23, title = 'TEST EPISODE') {
  const r = await w.call('POST', '/admin/episodes', { number, title });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.id;
}
const flat = (seq) => seq.segments.flatMap((s) => s.pages.flatMap((p) => p.items.map((i) => ({ ...i, seg: s.id }))));

describe('9. authorisation', () => {
  test('admin routes refuse missing and wrong tokens', async () => {
    assert.equal((await w.call('GET', '/admin/overview', undefined, { token: null })).status, 401);
    assert.equal((await w.call('GET', '/admin/overview', undefined, { token: 'wrong-token-wrong-token-wrong-token-xx' })).status, 401);
    assert.equal((await w.call('POST', '/admin/contributors', { display_name: 'X' }, { token: null })).status, 401);
    assert.equal((await w.call('GET', '/admin/overview')).status, 200);
  });
  test('admin is closed when no secret is configured', async () => {
    w.env.ADMIN_TOKEN = 'short';
    assert.equal((await w.call('GET', '/admin/overview')).status, 503);
  });
  test('repeated failures are rate limited', async () => {
    let last;
    for (let i = 0; i < 22; i++) last = await w.call('GET', '/admin/me', undefined, { token: 'nope' });
    assert.equal(last.status, 429);
  });
  test('admin rejects disallowed browser origins even with the token', async () => {
    assert.equal((await w.call('GET', '/admin/me', undefined, { origin: 'https://evil.example' })).status, 403);
  });
});

describe('5/6. identity', () => {
  test('one contributor can belong to several categories', async () => {
    const id = await addPerson(w, { display_name: 'Multi Hat', accounts: [{ provider: 'x', handle: '@MultiHat' }],
      memberships: [{ category_key: 'financially_irresponsible' }, { category_key: 'voluntary_witnesses', verification: 'self_reported' }, { category_key: 'emotional_support' }] });
    const r = await w.call('GET', `/admin/contributors/${id}`);
    assert.deepEqual(r.data.memberships.map((m) => m.category_key).sort(), ['emotional_support', 'financially_irresponsible', 'voluntary_witnesses']);
    assert.equal(r.data.accounts[0].handle, 'multihat');
  });
  test('the same 𝕏 handle cannot become two people', async () => {
    await addPerson(w, { display_name: 'First', accounts: [{ provider: 'x', handle: 'dupe' }] });
    const r = await w.call('POST', '/admin/contributors', { display_name: 'Second', accounts: [{ provider: 'x', handle: '@DUPE' }] });
    assert.equal(r.status, 409);
    assert.ok(r.data.existing);
  });
  test('merge moves accounts and memberships; no duplicate credits afterwards', async () => {
    const a = await addPerson(w, { display_name: 'Dupe A', accounts: [{ provider: 'x', handle: 'dupea' }], memberships: [{ category_key: 'financially_irresponsible' }] });
    const b = await addPerson(w, { display_name: 'Dupe B', accounts: [{ provider: 'youtube', handle: 'dupeb' }], memberships: [{ category_key: 'financially_irresponsible' }, { category_key: 'voluntary_witnesses' }] });
    assert.equal((await w.call('POST', `/admin/contributors/${a}/merge`, { into: b })).status, 200);
    const d = (await w.call('GET', `/admin/contributors/${b}`)).data;
    assert.deepEqual(d.accounts.map((x) => x.provider).sort(), ['x', 'youtube']);
    const ep = await episode();
    const seq = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data.sequence;
    const names = flat(seq).filter((i) => i.id != null).map((i) => i.id);
    assert.equal(names.filter((x) => x === b).length, 1, 'merged person appears exactly once');
    assert.ok(!names.includes(a));
  });
  test('dedupe: a person credited for episode work is not repeated in a rotating section', async () => {
    const id = await addPerson(w, { display_name: 'Busy Bee', memberships: [{ category_key: 'financially_irresponsible' }] });
    const ep = await episode();
    await w.call('POST', '/admin/contributions', { contributor_id: id, episode_id: ep, role: 'Editor' });
    const r = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data;
    assert.equal(flat(r.sequence).filter((i) => i.id === id).length, 1);
    const fin = r.report.find((s) => s.key === 'financially_irresponsible');
    assert.match(fin.excluded.find((x) => x.id === id).reason, /already credited/);
  });
});

describe('7. consent & privacy', () => {
  test('private and unconsented people never reach public output', async () => {
    await addPerson(w, { display_name: 'Public Pam', memberships: [{ category_key: 'financially_irresponsible' }] });
    await addPerson(w, { display_name: 'Private Pete', visibility: 'private', memberships: [{ category_key: 'financially_irresponsible' }] });
    await addPerson(w, { display_name: 'Unconsented Una', consent_public: false, memberships: [{ category_key: 'financially_irresponsible' }] });
    await addPerson(w, { display_name: 'Anon Andy', visibility: 'anonymous', memberships: [{ category_key: 'financially_irresponsible' }] });
    await addPerson(w, { display_name: 'Creator Private', visibility: 'private', memberships: [{ category_key: 'mutual_enablers' }] });
    const hall = await w.call('GET', '/public/hall', undefined, { token: null, origin: null });
    const text = JSON.stringify(hall.data);
    assert.ok(text.includes('Public Pam'));
    for (const n of ['Private Pete', 'Unconsented Una', 'Anon Andy', 'Creator Private']) assert.ok(!text.includes(n), n);
    assert.equal(hall.data.anonymousCount, 1);
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    const pub = JSON.stringify((await w.call('GET', '/public/episodes/23', undefined, { token: null })).data);
    assert.ok(pub.includes('Public Pam'));
    for (const n of ['Private Pete', 'Unconsented Una', 'Anon Andy']) assert.ok(!pub.includes(n), n);
    assert.ok(pub.includes('+ 1 ANONYMOUS'));
  });
  test('links are published only with link consent AND admin approval, https only', async () => {
    await addPerson(w, { display_name: 'Linky', link_url: 'https://example.com/me', consent_link: true, link_approved: false, memberships: [{ category_key: 'financially_irresponsible' }] });
    let hall = (await w.call('GET', '/public/hall', undefined, { token: null })).data;
    assert.equal(hall.supporters.find((s) => s.name === 'Linky').link, null);
    const r = await w.call('POST', '/admin/contributors', { display_name: 'Bad Link', link_url: 'javascript:alert(1)' });
    assert.equal(r.status, 422);
  });
  test('public responses never contain private fields', async () => {
    await addPerson(w, { display_name: 'Note Holder', private_note: 'SECRET-NOTE-123', memberships: [{ category_key: 'financially_irresponsible' }, { category_key: 'mutual_enablers', private_note: 'SECRET-MEMBER-456' }] });
    await w.call('POST', '/public/join', { display_name: 'Joiner', contribution: 'youtube_witness', consent_public: true, age_ok: true, elapsed_ms: 5000 }, { token: null });
    for (const path of ['/public/hall', '/public/creators', '/public/hall-of-fame', '/public/episodes', '/public/beans']) {
      const t = JSON.stringify((await w.call('GET', path, undefined, { token: null })).data);
      for (const bad of ['SECRET-NOTE-123', 'SECRET-MEMBER-456', 'key_hash', 'iph', 'private_note', 'Joiner']) assert.ok(!t.includes(bad), `${path} leaked ${bad}`);
    }
  });
});

describe('2/3/4. Beans', () => {
  test('ranks and totals match the feed exactly, with ties shared', async () => {
    const r = (await w.call('GET', '/public/beans', undefined, { token: null })).data;
    assert.equal(r.available, true);
    for (const row of FEED_2026_10_16.top) {
      const l = r.leaders.find((x) => x.name === row.h);
      assert.equal(l.beans, row.life, `${row.h} beans`);
      assert.equal(l.pos, row.pos, `${row.h} pos`);
    }
    assert.deepEqual(r.leaders.filter((l) => l.beans === 5).map((l) => l.rank), [3, 3, 3, 3, 3]);
    assert.equal(r.leaders[0].rank, 1);
  });
  test('the credits system never writes Beans anywhere', async () => {
    const before = JSON.stringify(w.state.feed);
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/snapshot`, {});
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    assert.equal(JSON.stringify(w.state.feed), before);
    const snap = (await w.call('GET', `/admin/episodes/${ep}`)).data.snapshot;
    for (const row of FEED_2026_10_16.top) assert.equal(snap.entries.find((e) => '@' + e.handle === row.h).beans, row.life);
  });
  test('episode snapshots stay frozen after the live board changes', async () => {
    const ep23 = await episode(23);
    await w.call('POST', `/admin/episodes/${ep23}/finalize`, {});
    // the leaderboard moves on
    w.state.feed = structuredClone(FEED_2026_10_16);
    w.state.feed.asof = '2026-10-23';
    w.state.feed.top[7].life = 99; w.state.feed.top[7].pos = 1;
    w.state.feed.top[0].pos = 2;
    const ep24 = await episode(24, 'NEXT');
    await w.call('POST', `/admin/episodes/${ep24}/finalize`, {});
    const a = (await w.call('GET', '/public/episodes/23', undefined, { token: null })).data.sections.find((s) => s.key === 'bean_counters');
    const b = (await w.call('GET', '/public/episodes/24', undefined, { token: null })).data.sections.find((s) => s.key === 'bean_counters');
    assert.equal(a.people[0].name, '@cowfartcop'); assert.equal(a.people[0].beans, 10); assert.equal(a.asof, '2026-10-16');
    assert.equal(b.people[0].name, '@orahonx'); assert.equal(b.people[0].beans, 99); assert.equal(b.asof, '2026-10-23');
  });
  test('moderation excludes a name without renumbering positions', async () => {
    await w.call('PUT', '/admin/beans/rules/dudec36362', { status: 'excluded', reason: 'test' });
    const ep = await episode();
    const lb = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data.report.find((s) => s.key === 'bean_counters');
    assert.ok(!lb.included.some((p) => p.name === '@dudec36362'));
    assert.deepEqual(lb.included.map((p) => p.rank), [1, 3, 3, 3, 3]);
  });
  test('a correction to a published snapshot supersedes it and issues a new revision', async () => {
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    assert.equal((await w.call('POST', `/admin/episodes/${ep}/snapshot`, {})).status, 422, 'needs a reason once published');
    await w.call('PUT', '/admin/beans/rules/cowfartcop', { status: 'excluded', reason: 'name review' });
    const r = await w.call('POST', `/admin/episodes/${ep}/snapshot`, { reason: 'removed a name after review' });
    assert.equal(r.data.revision, 2);
    const d = (await w.call('GET', `/admin/episodes/${ep}`)).data;
    assert.equal(d.snapshots.length, 2);
    assert.equal(d.snapshots[0].supersedes, d.snapshots[1].id);
    const pub = (await w.call('GET', '/public/episodes/23', undefined, { token: null })).data;
    assert.equal(pub.revisions.length, 2);
    const r1 = (await w.call('GET', '/public/episodes/23?rev=1', undefined, { token: null })).data;
    assert.ok(JSON.stringify(r1).includes('@cowfartcop'), 'original revision is preserved');
  });
  test('weekly/monthly views refuse to invent history', async () => {
    let r = (await w.call('GET', '/public/beans?period=week', undefined, { token: null })).data;
    assert.equal(r.available, false);
    await w.scheduled();
    r = (await w.call('GET', '/public/beans?period=week', undefined, { token: null })).data;
    assert.equal(r.available, false);
    assert.equal(r.collectingSince, '2026-10-16');
    w.state.feed = structuredClone(FEED_2026_10_16); w.state.feed.asof = '2026-10-23'; w.state.feed.top[1].life = 17;
    await w.scheduled();
    r = (await w.call('GET', '/public/beans?period=week', undefined, { token: null })).data;
    assert.equal(r.available, true);
    assert.deepEqual(r.leaders[0], { rank: 1, name: '@dudec36362', beans: 10 });
  });
});

describe('8/10/12. episodes, preview, archive', () => {
  test('admin creates and edits an episode; the preview reflects the saved draft', async () => {
    const p = await addPerson(w, { display_name: 'Writer Wren' });
    const ep = await episode();
    assert.equal((await w.call('PUT', `/admin/episodes/${ep}`, { title: 'RENAMED', draft: { timing: { theme: 'beans', durations: { 'cat:bean_counters': 10 } } } })).status, 200);
    await w.call('POST', '/admin/contributions', { contributor_id: p, episode_id: ep, role: 'Writer' });
    const r = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data;
    assert.equal(r.sequence.theme, 'beans');
    assert.equal(r.sequence.episode.title, 'RENAMED');
    assert.equal(r.sequence.segments.find((s) => s.id === 'cat:bean_counters').duration, 10);
    assert.ok(flat(r.sequence).some((i) => i.name === 'Writer Wren' && i.role === 'Writer'));
  });
  test('archive shows the finalised record, not later edits', async () => {
    const p = await addPerson(w, { display_name: 'Original Name', memberships: [{ category_key: 'financially_irresponsible' }] });
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    await w.call('PUT', `/admin/contributors/${p}`, { display_name: 'Changed Later' });
    await w.call('PUT', `/admin/episodes/${ep}`, { draft: { timing: { theme: 'midnight' } } });
    const pub = (await w.call('GET', '/public/episodes/23', undefined, { token: null })).data;
    assert.ok(JSON.stringify(pub).includes('Original Name'));
    assert.ok(!JSON.stringify(pub).includes('Changed Later'));
    assert.equal(pub.theme, 'terminal');
    assert.equal((await w.call('POST', `/admin/episodes/${ep}/finalize`, {})).status, 422, 'corrections need a reason');
    assert.equal((await w.call('POST', `/admin/episodes/${ep}/finalize`, { reason: 'name change' })).data.revision, 2);
    assert.ok(JSON.stringify((await w.call('GET', '/public/episodes/23', undefined, { token: null })).data).includes('Changed Later'));
  });
  test('archive search finds people and episodes; drafts stay unpublished', async () => {
    await addPerson(w, { display_name: 'Searchable Sam', memberships: [{ category_key: 'financially_irresponsible' }] });
    const ep = await episode();
    await episode(24, 'DRAFT ONLY');
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    const r = (await w.call('GET', '/public/episodes?q=searchable', undefined, { token: null })).data;
    assert.deepEqual(r.episodes.map((e) => e.number), [23]);
    assert.deepEqual(r.episodes[0].matches, ['Searchable Sam']);
    assert.equal((await w.call('GET', '/public/episodes/24', undefined, { token: null })).status, 404);
  });
  test('fair rotation: capped supporters rotate to the next episode', async () => {
    await w.call('PUT', '/admin/categories/financially_irresponsible', { cap: 2 });
    for (const n of ['A', 'B', 'C', 'D']) await addPerson(w, { display_name: `Sup ${n}`, memberships: [{ category_key: 'financially_irresponsible' }] });
    const e1 = await episode(1, 'ONE');
    await w.call('POST', `/admin/episodes/${e1}/finalize`, {});
    const first = (await w.call('GET', '/public/episodes/1', undefined, { token: null })).data.sections.find((s) => s.key === 'financially_irresponsible').people.map((p) => p.name);
    const e2 = await episode(2, 'TWO');
    const prev = (await w.call('POST', `/admin/episodes/${e2}/preview`, {})).data.report.find((s) => s.key === 'financially_irresponsible');
    const second = prev.included.map((p) => p.name);
    assert.equal(first.length, 2); assert.equal(second.length, 2);
    assert.equal(new Set([...first, ...second]).size, 4, 'nobody shown twice before everyone is shown once');
    assert.equal(prev.deferred.length, 2);
  });
  test('next episode reuses production settings', async () => {
    const e1 = await episode(1, 'ONE');
    await w.call('PUT', `/admin/episodes/${e1}`, { theme: 'midnight', draft: { timing: { theme: 'midnight', endCard: 'vicinity' } } });
    const e2 = await episode(2, 'TWO');
    const d = (await w.call('GET', `/admin/episodes/${e2}`)).data.episode;
    assert.equal(d.theme, 'midnight');
    assert.equal(d.draft.timing.endCard, 'vicinity');
  });
});

describe('13. opt-in, withdrawal, corrections', () => {
  test('join → review → credited → withdraw → redacted everywhere', async () => {
    const j = await w.call('POST', '/public/join', { display_name: 'Viewer Vee', contribution: 'youtube_witness', platform: 'youtube', handle: '@ViewerVee', consent_public: true, consent_link: false, age_ok: true, elapsed_ms: 4000 }, { token: null });
    assert.equal(j.status, 201);
    const { ref, key } = j.data;
    assert.ok(!JSON.stringify((await w.call('GET', '/public/hall', undefined, { token: null })).data).includes('Viewer Vee'), 'unreviewed submissions are not published');
    const subs = (await w.call('GET', '/admin/submissions')).data.submissions;
    assert.equal(subs.length, 1);
    const appr = await w.call('POST', `/admin/submissions/${subs[0].id}/approve`, {});
    assert.equal(appr.status, 200);
    const c = (await w.call('GET', `/admin/contributors/${appr.data.contributorId}`)).data;
    assert.equal(c.memberships[0].category_key, 'voluntary_witnesses');
    assert.equal(c.memberships[0].verification, 'self_reported');
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    assert.ok(JSON.stringify((await w.call('GET', '/public/episodes/23', undefined, { token: null })).data).includes('Viewer Vee'));
    assert.equal((await w.call('POST', '/public/withdraw', { ref, key: 'WRONGKEY' }, { token: null })).status, 404);
    assert.equal((await w.call('POST', '/public/withdraw', { ref, key }, { token: null })).status, 200);
    for (const path of ['/public/hall', '/public/episodes/23', '/public/episodes/23/sequence', '/public/episodes?q=viewer']) {
      assert.ok(!JSON.stringify((await w.call('GET', path, undefined, { token: null })).data).includes('Viewer Vee'), path);
    }
    const after = (await w.call('GET', `/admin/contributors/${appr.data.contributorId}`)).data;
    assert.equal(after.contributor.visibility, 'private');
    assert.equal(after.consents[0].source, 'withdrawal');
  });
  test('join validation, honeypot, speed check and rate limit', async () => {
    const base = { display_name: 'Ok', contribution: 'arcade', consent_public: true, age_ok: true, elapsed_ms: 5000 };
    assert.equal((await w.call('POST', '/public/join', { ...base, age_ok: false }, { token: null })).status, 422);
    assert.equal((await w.call('POST', '/public/join', { ...base, elapsed_ms: 200 }, { token: null })).status, 422);
    assert.equal((await w.call('POST', '/public/join', { ...base, profile_url: 'http://insecure.example' }, { token: null })).status, 422);
    assert.equal((await w.call('POST', '/public/join', { ...base, display_name: '‮​' }, { token: null })).status, 422);
    const hp = await w.call('POST', '/public/join', { ...base, website: 'spam.example' }, { token: null });
    assert.equal(hp.status, 200);
    assert.equal((await w.call('GET', '/admin/submissions?status=all')).data.submissions.length, 0, 'honeypot saves nothing');
    assert.equal((await w.call('POST', '/public/join', base, { token: null, origin: 'https://evil.example' })).status, 403);
    let last;
    for (let i = 0; i < 6; i++) last = await w.call('POST', '/public/join', { ...base, display_name: 'Rate ' + i }, { token: null });
    assert.equal(last.status, 429);
  });
  test('privacy erasure removes personal data but keeps archives consistent', async () => {
    const id = await addPerson(w, { display_name: 'Erase Me', private_note: 'x', accounts: [{ provider: 'x', handle: 'eraseme' }], memberships: [{ category_key: 'financially_irresponsible' }] });
    const ep = await episode();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    assert.equal((await w.call('DELETE', `/admin/contributors/${id}`)).status, 200);
    const d = (await w.call('GET', `/admin/contributors/${id}`)).data;
    assert.equal(d.contributor.display_name, '[erased]');
    assert.equal(d.accounts.length, 0);
    assert.ok(!JSON.stringify((await w.call('GET', '/public/episodes/23', undefined, { token: null })).data).includes('Erase Me'));
  });
});

describe('16/17. empty states & failing integrations', () => {
  test('an empty database still produces a valid sequence', async () => {
    const ep = await episode();
    const r = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data;
    assert.deepEqual(r.sequence.segments.map((s) => s.id), ['ident', 'cat:bean_counters', 'final']);
    const card = (await w.call('POST', `/admin/episodes/${ep}/preview`, { draft: { timing: { emptyCategories: 'card' } } })).data;
    assert.ok(card.sequence.segments.filter((s) => s.kind === 'empty').length >= 4);
  });
  test('empty leaderboard renders gracefully', async () => {
    w.state.feed = { ...FEED_2026_10_16, top: [], players: 0 };
    const ep = await episode();
    const r = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data;
    assert.ok(!r.sequence.segments.some((s) => s.id === 'cat:bean_counters'));
    assert.ok(r.warnings.some((x) => /nobody to show/.test(x)));
  });
  test('a broken Beans feed degrades safely and is reported', async () => {
    w.state.feedStatus = 500;
    const hall = await w.call('GET', '/public/hall', undefined, { token: null });
    assert.equal(hall.status, 200);
    assert.equal(hall.data.beans, null);
    const ep = await episode();
    const pv = (await w.call('POST', `/admin/episodes/${ep}/preview`, {})).data;
    assert.ok(pv.warnings.some((x) => /could not be read/.test(x)));
    const fin = await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    assert.equal(fin.status, 502, 'refuses to publish without a real snapshot');
    assert.equal((await w.call('GET', `/admin/episodes/${ep}`)).data.episode.status, 'draft');
    const integ = (await w.call('GET', '/admin/integrations')).data.integrations.find((i) => i.provider === 'beans_feed');
    assert.equal(integ.status, 'error'); assert.match(integ.last_error, /HTTP 500/);
    w.state.feedStatus = 200; w.state.feed = '{"not": "a feed"';
    assert.equal((await w.call('GET', '/public/beans', undefined, { token: null })).data.available, false);
    w.state.feed = { top: [{ h: '@ok', life: -5, pos: 1 }] };
    assert.equal((await w.call('GET', '/public/beans', undefined, { token: null })).data.available, false, 'invalid totals are rejected, not shown');
  });
});

describe('import', () => {
  test('CSV import: dry run, flexible mapping, duplicates, consent-safe defaults', async () => {
    await addPerson(w, { display_name: 'Existing', accounts: [{ provider: 'x', handle: 'existing' }] });
    const csv = 'Name,Username,Status,Public\r\n"Smith, Jo",@jo_smith,active,yes\r\nExisting Person,@existing,active,\r\n,@nameless,cancelled,\r\nDup,@jo_smith,active,\r\n=cmd,@formula,active,no\r\n';
    const dry = (await w.call('POST', '/admin/import', { csv, category_key: 'financially_irresponsible' })).data;
    assert.equal(dry.dryRun, true);
    assert.equal(dry.mapping.display_name, 'Name'); assert.equal(dry.mapping.handle, 'Username');
    assert.equal(dry.create, 3); assert.equal(dry.update, 1); assert.equal(dry.skip, 1);
    assert.equal((await w.call('GET', '/admin/contributors')).data.contributors.length, 1, 'dry run writes nothing');
    const real = (await w.call('POST', '/admin/import', { csv, category_key: 'financially_irresponsible', dry_run: false })).data;
    assert.equal(real.create, 3);
    const list = (await w.call('GET', '/admin/contributors')).data.contributors;
    const jo = list.find((c) => c.display_name === 'Smith, Jo');
    assert.equal(jo.visibility, 'public');
    assert.equal(list.find((c) => c.display_name === '@nameless').visibility, 'private', 'no consent column → private');
    assert.equal(list.find((c) => c.display_name === '@nameless').categories[0].status, 'former');
    const exp = await w.call('GET', '/admin/export?format=csv');
    assert.ok(exp.data.includes("'=cmd"), 'formula injection neutralised on export');
  });
});

describe('18. secrets', () => {
  test('the admin token never appears in any response', async () => {
    for (const p of ['/admin/overview', '/admin/settings', '/admin/integrations', '/admin/export']) {
      assert.ok(!JSON.stringify((await w.call('GET', p)).data).includes(TOKEN), p);
    }
  });
});

describe('settings', () => {
  test('episode naming convention applies to the public archive', async () => {
    const ep = await (async () => (await w.call('POST', '/admin/episodes', { number: 5, title: 'BEANS' })).data.id)();
    await w.call('POST', `/admin/episodes/${ep}/finalize`, {});
    await w.call('PUT', '/admin/settings', { episode_title_format: 'S{season}E{number}: {title}' });
    assert.equal((await w.call('GET', '/public/episodes', undefined, { token: null })).data.episodes[0].label, 'S1E5: BEANS');
    assert.equal((await w.call('GET', '/public/episodes/5', undefined, { token: null })).data.episode.label, 'S1E5: BEANS');
  });
  test('settings are validated server-side', async () => {
    const r = (await w.call('PUT', '/admin/settings', { timing: { theme: 'evil', fps: 999 }, leaderboard_top_n: 500, links: { x: 'javascript:alert(1)' }, nonsense: 1 })).data.settings;
    assert.equal(r.timing.theme, 'terminal'); assert.equal(r.timing.fps, 30); assert.equal(r.leaderboard_top_n, 20);
    assert.equal(r.links.x, 'https://x.com/STOOPIDshow');
    assert.ok(!('nonsense' in r));
  });
});

describe('Beans history backfill (real feed versions)', () => {
  test('imports every real historical version and never invents a week it does not have', async () => {
    const fs = await import('node:fs');
    const dir = new URL('./feed-history/', import.meta.url);
    const commits = fs.readFileSync(new URL('commits.txt', dir), 'utf8').trim().split('\n').map((l) => l.split(' '));
    w.state.routes.set('https://api.github.com/repos/STOOPIDshow/beans-feed/commits?path=beans-leaderboard.json&per_page=100',
      () => new Response(JSON.stringify(commits.map(([, sha]) => ({ sha })))));
    for (const [short, sha] of commits) {
      w.state.routes.set(`https://raw.githubusercontent.com/STOOPIDshow/beans-feed/${sha}/beans-leaderboard.json`, () => new Response(fs.readFileSync(new URL(`${short}.json`, dir))));
    }
    const r = (await w.call('POST', '/admin/beans/backfill')).data;
    assert.equal(r.commits, commits.length);
    assert.deepEqual(r.errors, []);
    const b = (await w.call('GET', '/admin/beans')).data;
    assert.equal(b.history.first, '2026-10-11'); assert.equal(b.history.last, '2026-10-16');
    assert.equal(b.history.n, 5, 'one row per distinct asof (two commits share 2026-10-11)');
    const week = (await w.call('GET', '/public/beans?period=week', undefined, { token: null })).data;
    assert.equal(week.available, false);
    assert.equal(week.collectingSince, '2026-10-11');
    assert.equal((await w.call('POST', '/admin/beans/backfill')).data.added, 0, 're-running adds nothing');
  });
});
