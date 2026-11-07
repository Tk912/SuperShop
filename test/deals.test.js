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

test('חיבור למועדונים: רשימה, סנכרון הטבות מאומתות בלבד, שליחת הטבה לבדיקה', async () => {
  // מאמתים הטבה אחת של פיס פלוס
  const d = await getDeals();
  d.clubs.find((c) => c.id === 'pais-plus').rules.push({ id: 'pais-ksp-test', storeId: 'ksp', type: 'percent', value: 4,
    status: 'verified', source: 'https://www.pais.co.il/benefit-example', expires: null });
  d.clubs.find((c) => c.id === 'pais-plus').rules.push({ id: 'pais-bug-pending', storeId: 'bug', type: 'percent', value: 9,
    status: 'pending', source: null, expires: null });
  assert.equal((await putDeals(d)).status, 200);

  const list = await fetch(base + '/api/clubs').then((r) => r.json());
  const pais = list.clubs.find((c) => c.id === 'pais-plus');
  assert.equal(pais.benefitsCount, 1); // הממתינה לא נספרת
  assert.deepEqual(pais.stores, ['KSP']);
  assert.ok(pais.sources.length >= 1 && pais.eligibility);

  const sync = await fetch(base + '/api/clubs/pais-plus/benefits').then((r) => r.json());
  assert.equal(sync.benefits.length, 1);
  assert.deepEqual({ store: sync.benefits[0].storeName, label: sync.benefits[0].label, status: sync.benefits[0].status },
    { store: 'KSP', label: '4% הנחה', status: 'verified' });
  assert.match(sync.benefits[0].verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await fetch(base + '/api/clubs/no-such/benefits')).status, 404);

  // שליחת הטבה: נשמרת כהצעה לבדיקה, לא חלה על מחירים
  const send = (body) => fetch(base + '/api/clubs/police-funds/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ store: '', discount: '10%' })).status, 400);
  assert.equal((await send({ store: 'Ivory', discount: '7%', link: 'http://insecure' })).status, 400);
  const ok = await send({ store: 'Ivory', discount: '7% על אוזניות', link: 'https://example.org/benefit', note: 'ראיתי באתר המועדון' }).then((r) => r.json());
  assert.ok(ok.ok);
  const after = await getDeals();
  assert.equal(after.suggestions[0].clubId, 'police-funds');
  assert.equal(after.suggestions[0].store, 'Ivory');
  assert.equal((await fetch(base + '/api/clubs').then((r) => r.json())).clubs.find((c) => c.id === 'police-funds').benefitsCount, 0);

  // מגבלה יומית: 5 הצעות למשתמש
  for (let i = 0; i < 4; i++) await send({ store: `S${i}`, discount: '1%' });
  assert.equal((await send({ store: 'S9', discount: '1%' })).status, 429);

  // מנהל מוחק הצעה; שמירת ההנחות לא מוחקת הצעות אחרות
  const del = await fetch(`${base}/api/admin/suggestions/${ok.id}`, { method: 'DELETE', headers: H }).then((r) => r.json());
  assert.equal(del.removed, 1);
  const d2 = await getDeals();
  assert.equal((await putDeals(d2)).status, 200);
  assert.equal((await getDeals()).suggestions.length, 4);
});

test('הטבות מהחשבון במועדון (personal) חלות על המחיר, עם מינימום קנייה, גם כשההנחות הכלליות כבויות', async () => {
  const id = 'sa:12827020246278533726'; // KSP ₪1,163 + ₪28 משלוח
  const before = await fetch(`${base}/api/products/${id}/offers`).then((r) => r.json());
  const kspBase = before.offers.find((o) => o.domain === 'ksp.co.il');
  const r = await fetch(`${base}/api/products/${id}/offers?personal=behatzdaa.ksp.8,pais-plus.bug.5.5000,fake.ksp.9,behatzdaa.nowhere.5,behatzdaa.ksp.90`).then((x) => x.json());
  const ksp = r.offers.find((o) => o.domain === 'ksp.co.il');
  const applied = ksp.discounts.applied[0];
  assert.equal(applied.status, 'account');
  assert.equal(applied.name, 'בהצדעה (מהחשבון שלך)');
  assert.equal(applied.amountIls, Math.round(1163 * 0.08 * 100) / 100);
  assert.ok(ksp.totalIls < kspBase.totalIls);
  // באג: מינימום 5000 – לא חל על ₪1,199
  assert.equal(r.offers.find((o) => o.domain === 'bug.co.il').discounts.totalIls, 0);
});

test('parsePersonal מסנן מועדון/חנות לא קיימים ואחוזים לא סבירים', async () => {
  const { parsePersonal } = await import('../server/app.js');
  assert.deepEqual(parsePersonal('behatzdaa.ksp.8,fake.ksp.9,behatzdaa.nowhere.5,behatzdaa.ksp.90,pais-plus.bug.5.500'), [
    { clubId: 'behatzdaa', clubName: 'בהצדעה', storeId: 'ksp', percent: 8, minSpend: null },
    { clubId: 'pais-plus', clubName: 'פיס פלוס – מנויי מפעל הפיס', storeId: 'bug', percent: 5, minSpend: 500 },
  ]);
});

test('מטא: חנויות עם שמות חלופיים, ומועדונים עם כתובת חיבור', async () => {
  const meta = await fetch(base + '/api/meta').then((r) => r.json());
  assert.ok(meta.stores.find((s) => s.id === 'ivory').aliases.includes('אייבורי'));
  const clubs = await fetch(base + '/api/clubs').then((r) => r.json());
  assert.equal(clubs.clubs.find((c) => c.id === 'behatzdaa').connect.loginUrl, 'https://www.behatsdaa.org.il/');
});
