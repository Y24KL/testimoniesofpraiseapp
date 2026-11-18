// Unit tests for editorial rules (Daily discovery) and community report rules.
// Run: node --experimental-strip-types tests/editorial.test.mjs   (npm run test:editorial)
import assert from 'node:assert/strict';
const E = await import('../src/editorial/rules.ts');
const C = await import('../src/community/rules.ts');
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`  ✔ ${name}`); };

const wednesdayRadio = { weekday: 'wednesday', localTime: '13:00', utcOffsetMinutes: 60, timeZoneLabel: 'GMT+1', title: 'LoveWorld Radio', confirmed: true };

ok('a Wednesday 1 PM GMT+1 programme is 12:00 UTC, on the next Wednesday', () => {
  // Tuesday 17 November 2026, 10:00 UTC.
  const tue = Date.UTC(2026, 10, 17, 10, 0);
  const next = E.nextBroadcast([wednesdayRadio], tue);
  assert.equal(new Date(next.atUtcMs).toISOString(), '2026-11-18T12:00:00.000Z');
  assert.equal(next.entry.title, 'LoveWorld Radio');
});

ok('once a broadcast has started, the next one is the following week', () => {
  const after = Date.UTC(2026, 10, 18, 12, 30);
  assert.equal(new Date(E.nextBroadcast([wednesdayRadio], after).atUtcMs).toISOString(), '2026-11-25T12:00:00.000Z');
});

ok('unconfirmed or missing schedules show nothing', () => {
  assert.equal(E.nextBroadcast([{ ...wednesdayRadio, confirmed: false }], Date.UTC(2026, 10, 17)), null);
  assert.equal(E.nextBroadcast([], Date.UTC(2026, 10, 17)), null);
});

ok('a broadcast more than a week away is not shown', () => {
  const sat = Date.UTC(2026, 10, 14, 23, 0);
  const far = { ...wednesdayRadio, weekday: 'sunday', localTime: '08:00' };
  assert.notEqual(E.nextBroadcast([far], sat), null, 'a Sunday within 7 days is found');
  assert.equal(E.nextBroadcast([{ ...wednesdayRadio, localTime: '13:00' }], Date.UTC(2026, 10, 18, 11, 59)).atUtcMs, Date.UTC(2026, 10, 18, 12, 0));
});

ok('the inspiration rotates by day and is empty when the list is empty', () => {
  const list = [{ text: 'A', source: '' }, { text: 'B', source: '' }];
  assert.equal(E.pickInspiration(list, Date.UTC(2026, 10, 18)).text, E.pickInspiration(list, Date.UTC(2026, 10, 18, 23)).text, 'same day, same line');
  assert.notEqual(E.pickInspiration(list, Date.UTC(2026, 10, 18)).text, E.pickInspiration(list, Date.UTC(2026, 10, 19)).text, 'next day, next line');
  assert.equal(E.pickInspiration([], Date.UTC(2026, 10, 18)), null, 'nothing is invented');
});

ok('the stored editorial document is sanitised: bad entries are dropped, text is cleaned and bounded', () => {
  const e = E.sanitizeEditorial({
    inspirations: ['  Be\u0007 encouraged  ', { text: 'x'.repeat(400), source: 'Ps 23' }, { text: '' }, 42],
    radioSchedule: [
      wednesdayRadio,
      { ...wednesdayRadio, weekday: 'funday' },
      { ...wednesdayRadio, localTime: '25:00' },
      { ...wednesdayRadio, utcOffsetMinutes: 9000 },
    ],
    featuredIds: { testimony: 't1', lyrical: 'a/b', article: 'x', user: 'u1' },
    highlightChoirIds: ['c1', 'c1', 'bad id!', 'c2'],
  });
  assert.deepEqual(e.inspirations.map((i) => i.text.length > 0), [true, true]);
  assert.equal(e.inspirations[0].text, 'Be encouraged');
  assert.equal(e.inspirations[1].text.length, E.EDITORIAL_LIMITS.inspirationChars);
  assert.equal(e.radioSchedule.length, 1);
  assert.deepEqual(e.featuredIds, { testimony: 't1', article: 'x' });
  assert.deepEqual(e.highlightChoirIds, ['c1', 'c2']);
});

ok('a missing document gives an empty editorial, which shows nothing', () => {
  assert.deepEqual(E.sanitizeEditorial(null), { inspirations: [], radioSchedule: [], featuredIds: {}, highlightChoirIds: [] });
});

ok('an unconfirmed schedule entry is stored, but not shown', () => {
  const e = E.sanitizeEditorial({ radioSchedule: [{ ...wednesdayRadio, confirmed: 'yes' }] });
  assert.equal(e.radioSchedule[0].confirmed, false, 'only a true boolean confirms');
  assert.equal(E.nextBroadcast(e.radioSchedule, Date.UTC(2026, 10, 17)), null);
});

ok('a report is one per person per item, with a canonical key', () => {
  assert.equal(C.reportKey('alice', 'choir', 'c1'), 'alice_choir_c1');
  assert.equal(C.reportKey('alice', 'choir', 'c/1'), null);
  assert.equal(C.reportKey('alice', 'user', 'c1'), null);
  assert.equal(C.reportKey('', 'choir', 'c1'), null);
});

ok('report reasons are fixed, and notes are optional and bounded', () => {
  assert.equal(C.isReportReason('spam'), true);
  assert.equal(C.isReportReason('boring'), false);
  assert.equal(C.cleanNote('   '), null);
  assert.equal(C.cleanNote(' Please check\u0007 this '), 'Please check this');
  assert.equal(C.cleanNote('x'.repeat(400)).length, 300);
});

console.log(`editorial and community rules: ${n} tests passed`);
