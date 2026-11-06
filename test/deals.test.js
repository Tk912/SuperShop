// בדיקות למאגר ההנחות: רק הנחות מאומתות ובתוקף חלות על מחירים אמיתיים; ניהול, תקינות ודיווחים.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mashve-deals-'));
process.env.SEARCHAPI_FIXTURE_DIR = path.join(here, 'fixtures', 'searchapi');
process.env.DEALS_FILE = path.join(tmp, 'deals.json');
process.env.CACHE_DIR = path.join(tmp, 'cache');
process.env.LEARNED_FILE = path.join(tmp, 'learned.json');
process.env.HISTORY_FILE = path.join(tmp, 'history.json');
process.env.FX_OFFLINE = '1';
process.env.ADMIN_TOKEN = 'secret';

let base;
before(async () => {
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
  await fetch(base + '/api/search?q=' + encodeURIComponent('Sony WH-1000XM6')); // לומד את המוצרים האמיתיים
});
const H = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };
const getDeals = () => fetch(base + '/api/admin/deals', { headers: H }).then((r) => r.json());
const putDeals = (d) => fetch(base + '/api/admin/deals', { method: 'PUT', headers: H, body: JSON.stringify({ clubs: d.clubs, coupons: d.coupons }) });
const offers = (clubs = '') => fetch(`${base}/api/products/sa:12827020246278533726/offers?clubs=${clubs}`).then((r) => r.json());
const ksp = (r) => r.offers.find((o) => o.domain === 'ksp.co.il');

test('בלי סיסמה – אין גישה לניהול', async () => {
  assert.equal((await fetch(base + '/api/admin/deals')).status, 404);
  assert.equal((await fetch(base + '/api/admin/deals', { headers: { Authorization: 'Bearer wrong' } })).status, 404);
});

test('הנחת מועדון לדוגמה לא חלה על מחיר אמיתי; אחרי אימות – חלה, עם מקור ותאריך', async () => {
  assert.equal(ksp(await offers('behatzdaa')).discounts.totalIls, 0);
  const d = await getDeals();
  const rule = d.clubs.find((c) => c.id === 'behatzdaa').rules.find((r) => r.storeId === 'ksp');
  rule.status = 'verified';
  assert.equal((await putDeals(d)).status, 400); // מאומת בלי מקור – נדחה
  rule.source = 'https://www.behatzdaa.org.il/example-benefit';
  const saved = await putDeals(d);
  assert.equal(saved.status, 200);

  const r = await offers('behatzdaa');
  const k = ksp(r);
  assert.equal(r.deals, true);
  assert.equal(k.discounts.applied[0].clubId, 'behatzdaa');
  assert.equal(k.discounts.applied[0].status, 'verified');
  assert.equal(k.discounts.applied[0].source, 'https://www.behatzdaa.org.il/example-benefit');
  assert.match(k.discounts.applied[0].verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(k.discounts.totalIls, Math.round(1163 * 0.05 * 100) / 100);
  // משתמש שאינו חבר – לא מקבל, אבל רואה שחברי בהצדעה חוסכים
  const other = ksp(await offers(''));
  assert.equal(other.discounts.totalIls, 0);
  assert.ok(other.missedClubs.some((m) => m.clubId === 'behatzdaa'));
  // הקובץ נשמר בדיסק
  assert.equal(JSON.parse(fs.readFileSync(process.env.DEALS_FILE, 'utf8')).clubs.find((c) => c.id === 'behatzdaa').rules[0].status, 'verified');
});

test('הנחה מאומתת שפג תוקפה לא חלה', async () => {
  const d = await getDeals();
  d.clubs.find((c) => c.id === 'behatzdaa').rules.find((r) => r.storeId === 'ksp').expires = '2020-01-01';
  assert.equal((await putDeals(d)).status, 200);
  assert.equal(ksp(await offers('behatzdaa')).discounts.totalIls, 0);
});

test('בדיקות תקינות: ערכים שליליים, אחוז מוגזם, id כפול', async () => {
  const d = await getDeals();
  d.coupons[0].value = -5;
  d.coupons[1].type = 'percent'; d.coupons[1].value = 95;
  d.coupons[2].id = d.coupons[3].id;
  const r = await putDeals(d);
  assert.equal(r.status, 400);
  const { error } = await r.json();
  assert.match(error, /חיובי/); assert.match(error, /90%/); assert.match(error, /כפול/);
});

test('דיווח "לא עבד": נספר פעם אחת ליום לכל משתמש, ואימות מחדש מאפס', async () => {
  const id = 'ksp-ksp50';
  const rep = () => fetch(`${base}/api/deals/${id}/report`, { method: 'POST' }).then((r) => r.json());
  assert.equal((await rep()).reports, 1);
  assert.equal((await rep()).duplicate, true);
  assert.equal((await getDeals()).reports[id], 1);
  assert.equal((await fetch(`${base}/api/deals/no-such/report`, { method: 'POST' })).status, 404);
  const d = await getDeals();
  const c = d.coupons.find((x) => x.id === id);
  c.status = 'verified'; c.source = 'https://ksp.co.il/example';
  await putDeals(d);
  assert.equal((await getDeals()).reports[id], undefined);
});

test('שלושת המקורות קיימים עם זכאות וקישורים, ומופיעים ראשונים באפליקציה', async () => {
  const d = await getDeals();
  for (const id of ['behatzdaa', 'pais-plus', 'police-funds']) {
    const c = d.clubs.find((x) => x.id === id);
    assert.ok(c, id);
    assert.ok(c.eligibility && c.sources.length >= 1 && c.sources.every((s) => s.url.startsWith('https://')));
  }
  const meta = await fetch(base + '/api/meta').then((r) => r.json());
  assert.deepEqual(meta.clubs.slice(0, 3).map((c) => c.id), ['behatzdaa', 'pais-plus', 'police-funds']);
  assert.ok(meta.clubs[1].eligibility.includes('מנויי הפיס'));
  // קישור מקור לא מאובטח נדחה
  d.clubs[1].sources[0].url = 'http://insecure.example';
  assert.equal((await putDeals(d)).status, 400);
});
