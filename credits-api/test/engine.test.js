// Unit tests for the shared engine (credits/engine): selection rules, sequence building, text safety, CSV.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCredits } from '../../credits/engine/selection.js';
import { buildSequence, timeline, locate, THEME_META, creditedPeople } from '../../credits/engine/sequence.js';
import { cleanText, fitName, normalizeHandle, safeUrl, graphemes } from '../../credits/engine/util.js';
import { parseCsv, csvEscape } from '../../credits/engine/csv.js';
import { crc32, zip } from '../../credits/engine/zip.js';
import { CATEGORIES, SAMPLE_PEOPLE, SAMPLE_CONTRIBUTIONS, FEED_2026_10_16, leaderboardFromFeed } from './fixtures.js';

const run = (extra = {}) => selectCredits({ episode: { number: 23 }, categories: CATEGORIES, people: SAMPLE_PEOPLE,
  contributions: SAMPLE_CONTRIBUTIONS(23), leaderboard: leaderboardFromFeed(FEED_2026_10_16), seed: 'ep23', ...extra });

test('selection is deterministic for a seed', () => {
  assert.deepEqual(run(), run());
});

test('top-5 Beans: real positions, shared tie ranks, tie overflow noted', () => {
  const lb = run().sections.find((s) => s.key === 'bean_counters');
  assert.deepEqual(lb.items.map((i) => [i.name, i.pos, i.rank, i.beans]), [
    ['@cowfartcop', 1, 1, 10], ['@dudec36362', 2, 2, 7], ['@hapacovfefe', 3, 3, 5], ['@readyf4any', 4, 3, 5], ['@nightguardian34', 5, 3, 5]]);
  assert.equal(lb.note, '+2 MORE TIED AT 5 BEANS');
});

test('configurable leaderboard size', () => {
  const lb = leaderboardFromFeed(FEED_2026_10_16, 3);
  assert.equal(run({ leaderboard: lb }).sections.find((s) => s.key === 'bean_counters').items.length, 3);
});

test('paid supporters cannot monopolise: per-category cap defers the rest', () => {
  const cats = CATEGORIES.map((c) => (c.key === 'financially_irresponsible' ? { ...c, cap: 2 } : c));
  const s = run({ categories: cats }).sections.find((x) => x.key === 'financially_irresponsible');
  assert.equal(s.items.length, 2);
  assert.ok(s.deferred.length >= 3);
});

test('never-shown people are chosen before recently shown ones', () => {
  const cats = CATEGORIES.map((c) => (c.key === 'financially_irresponsible' ? { ...c, cap: 4 } : c));
  const s = run({ categories: cats }).sections.find((x) => x.key === 'financially_irresponsible');
  assert.ok(!s.items.some((i) => i.name === 'SAMPLE Bo Static'), 'Bo was shown in EP 22');
  assert.match(s.deferred.find((d) => d.name === 'SAMPLE Bo Static').reason, /EP 22/);
});

test('producer include/exclude overrides', () => {
  const s = run({ overrides: { exclude: [1], include: [] } }).sections.find((x) => x.key === 'financially_irresponsible');
  assert.ok(!s.items.some((i) => i.id === 1));
  assert.match(s.excluded.find((e) => e.id === 1).reason, /producer/);
});

test('long names are shortened on screen, never shrunk; full name kept for the archive', () => {
  const { sequence, warnings } = buildSequence(run(), { number: 23, title: 'T' }, { theme: 'terminal' }, { categories: CATEGORIES });
  const long = sequence.segments.flatMap((s) => s.pages.flatMap((p) => p.items)).find((i) => /Wolfe/.test(i.name));
  assert.ok(graphemes(long.name).length <= THEME_META.terminal.maxNameChars);
  assert.match(long.fullName, /Third Of His Name/);
  assert.ok(warnings.some((w) => /shortened/.test(w)));
  assert.ok(creditedPeople(sequence).some((p) => /Third Of His Name/.test(p.name)));
});

test('pagination: overflow points to the archive instead of shrinking', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ id: 1000 + i, name: `Supporter ${i}`, visibility: 'public', consentPublic: 1, handles: {},
    memberships: [{ category: 'financially_irresponsible', status: 'active', since: '2026-01-01' }], lastShown: null, timesShown: 0 }));
  const cats = CATEGORIES.map((c) => (c.key === 'financially_irresponsible' ? { ...c, cap: 60 } : c));
  const sel = selectCredits({ episode: { number: 1 }, categories: cats, people: many, seed: 's' });
  const a = buildSequence(sel, { number: 1, title: 'T' }, { theme: 'terminal' }, { categories: cats });
  const seg = a.sequence.segments.find((s) => s.id === 'cat:financially_irresponsible');
  assert.equal(seg.pages.length, 3);                          // 9s / 3s min page time
  assert.ok(seg.pages.every((p) => p.items.length <= THEME_META.terminal.namesPerPage));
  assert.match(seg.pages[2].items.at(-1).name, /\+ 31 MORE IN THE ARCHIVE/);
  const b = buildSequence(sel, { number: 1, title: 'T' }, { theme: 'terminal', overflow: 'extend' }, { categories: cats });
  const segB = b.sequence.segments.find((s) => s.id === 'cat:financially_irresponsible');
  assert.equal(segB.pages.length, 6); assert.equal(segB.duration, 18);
});

test('segment order, toggles and durations are configurable', () => {
  const { sequence } = buildSequence(run(), { number: 23, title: 'T' }, { order: ['ident', 'cat:bean_counters', 'cat:financially_irresponsible'], disabled: ['cat:emotional_support'], durations: { final: 9 } }, { categories: CATEGORIES });
  assert.deepEqual(sequence.segments.slice(0, 3).map((s) => s.id), ['ident', 'cat:bean_counters', 'cat:financially_irresponsible']);
  assert.ok(!sequence.segments.some((s) => s.id === 'cat:emotional_support'));
  assert.equal(sequence.segments.at(-1).duration, 9);
});

test('default template timings match the brief', () => {
  const { sequence } = buildSequence(run(), { number: 23, title: 'T' }, {}, { categories: CATEGORIES });
  const d = Object.fromEntries(sequence.segments.map((s) => [s.id, s.duration]));
  assert.equal(d.ident, 4); assert.equal(d['cat:financially_irresponsible'], 9); assert.equal(d['cat:mutual_enablers'], 8);
  assert.equal(d['cat:bean_counters'], 8); assert.equal(d.final, 7);
  assert.equal(sequence.segments.at(-1).endCard.card, 'END TRANSMISSION. AS IS.');
  assert.deepEqual(sequence.segments.at(-1).endCard.lines.map((l) => l.text).slice(0, 2), ['THANK YOU FOR GIVING US SOMETHING YOU CAN NEVER GET BACK.', 'YOUR TIME.']);
});

test('jokes: seeded, theme-filtered, never about named people', () => {
  const jokes = [{ text: 'BEANS ONLY', themes: 'beans', enabled: 1 }, { text: 'EVERYWHERE', themes: '*', enabled: 1 }, { text: 'OFF', themes: '*', enabled: 0 }];
  const a = buildSequence(run(), { number: 23, title: 'T' }, { theme: 'terminal' }, { categories: CATEGORIES, jokes, seed: 'x' }).sequence;
  const notices = new Set(a.segments.map((s) => s.notice).filter(Boolean));
  assert.deepEqual([...notices], ['EVERYWHERE']);
  const picked = buildSequence(run(), { number: 23, title: 'T' }, { notices: ['MANUAL PICK'] }, { categories: CATEGORIES, jokes }).sequence;
  assert.ok(picked.segments.some((s) => s.notice === 'MANUAL PICK'));
});

test('timeline covers every moment exactly once', () => {
  const { sequence } = buildSequence(run(), { number: 23, title: 'T' }, {}, { categories: CATEGORIES });
  const tl = timeline(sequence);
  assert.equal(tl[0].start, 0);
  for (let i = 1; i < tl.length; i++) assert.ok(Math.abs(tl[i].start - tl[i - 1].end) < 1e-9);
  assert.ok(Math.abs(tl.at(-1).end - sequence.duration) < 1e-9);
  assert.equal(locate(sequence, 0).seg.id, 'ident');
  assert.equal(locate(sequence, sequence.duration + 5).seg.id, 'final');
});

test('text safety: bidi, zero-width, emoji, international names, handles, URLs', () => {
  assert.equal(cleanText('  A‮b​c  d '), 'Abc d');
  assert.equal(graphemes('👨‍👩‍👧 Bean').length, 6);
  assert.deepEqual(fitName('小豆小豆小豆', 4), ['小豆小…', true]);
  assert.equal(normalizeHandle('https://x.com/Foo_Bar?s=20'), 'foo_bar');
  assert.equal(normalizeHandle('@Foo'), 'foo');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('http://example.com'), null);
  assert.equal(safeUrl('https://user:pw@example.com'), null);
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
});

test('CSV: quotes, CRLF, BOM, embedded newlines, formula escaping', () => {
  const r = parseCsv('﻿name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\nPlain,\r\n');
  assert.deepEqual(r.headers, ['name', 'note']);
  assert.equal(r.records[0].name, 'Smith, Jo');
  assert.equal(r.records[0].note, 'said "hi"\nthen left');
  assert.equal(r.records.length, 2);
  assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvEscape('+1'), "'+1");
});

test('zip writer produces a valid archive', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const z = zip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(z.buffer).getUint32(z.length - 22, true), 0x06054b50);
});
