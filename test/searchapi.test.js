// בדיקות לספק SearchApi.io – על תשובות אמיתיות שהוקלטו (6.11.2026), בלי רשת.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mashve-sa-'));
process.env.SEARCHAPI_FIXTURE_DIR = path.join(here, 'fixtures', 'searchapi');
process.env.SERPAPI_KEY = 'unused'; // כשיש SearchApi, SerpAPI לא אמור לפעול
process.env.CACHE_DIR = path.join(tmp, 'cache');
process.env.LEARNED_FILE = path.join(tmp, 'learned.json');
process.env.HISTORY_FILE = path.join(tmp, 'history.json');
process.env.FX_OFFLINE = '1';

let base;
before(async () => {
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
});
const get = (p) => fetch(base + p).then((r) => r.json());

test('רק SearchApi פעיל כשמוגדרים שניהם', async () => {
  const { activeProviders } = await import('../server/providers/index.js');
  assert.deepEqual(activeProviders().map((p) => p.id), ['searchapi']);
});

test('חיפוש אמיתי: מחירים בשקלים, חנויות ישראליות, תמונות', async () => {
  const r = await get('/api/search?q=' + encodeURIComponent('Sony WH-1000XM6'));
  const live = r.results.filter((p) => p.id.startsWith('sa:'));
  assert.equal(live.length, 8);
  assert.ok(live.every((p) => p.fromCurrency === 'ILS' && p.fromPrice > 500));
  assert.ok(live.every((p) => p.image.startsWith('https://')));
  assert.ok(live.some((p) => p.fromStore === 'KSP'));
});

test('דף מוצר אמיתי: KSP, באג וסופר-פארם עם דמי משלוח מהחנות', async () => {
  await get('/api/search?q=' + encodeURIComponent('Sony WH-1000XM6'));
  const r = await get('/api/products/sa:12827020246278533726/offers');
  const by = Object.fromEntries(r.offers.map((o) => [o.domain || o.storeName, o]));
  assert.equal(r.offers.length, 3);
  assert.ok(r.offers.every((o) => o.storeType === 'local'));
  // KSP: ‏1,163 + דמי משלוח 28 (מ-Google, לא ברירת המחדל של KSP)
  assert.equal(by['ksp.co.il'].totalIls, 1191);
  // באג: "משלוח חינם"
  assert.equal(by['bug.co.il'].totalIls, 1199);
  assert.equal(by['shop.super-pharm.co.il'].totalIls, 1203);
  assert.ok(r.offers.every((o) => !o.url.includes('google.com')));
  assert.equal(r.offers[0].domain, 'ksp.co.il'); // הזול ביותר עד הבית
});

test('מוצר קטלוג נמצא דרך חיפוש ומקבל הצעות אמיתיות', async () => {
  const r = await get('/api/products/sony-wh1000xm6/offers');
  assert.equal(r.mode, 'live');
  assert.ok(r.offers.length >= 3);
  assert.ok(r.offers.every((o) => o.source === 'searchapi'));
});

test('שיוך חנויות לפי שמות אמיתיים מ-Google', async () => {
  const { resolveStore } = await import('../server/storeRegistry.js');
  assert.equal(resolveStore({ name: 'IVORY - אייבורי', currency: 'ILS' }).id, 'ivory');
  assert.equal(resolveStore({ name: 'Amazon.com - Seller', url: 'https://www.amazon.com/dp/x', currency: 'USD' }).id, 'amazon_us');
  assert.equal(resolveStore({ name: 'Desertcart.ae', url: 'https://www.desertcart.ae/p/1', currency: 'ILS' }).type, 'intl');
  assert.equal(resolveStore({ name: 'Terminal X', url: 'https://www.terminalx.com/x', currency: 'ILS' }).type, 'local');
});

test('תיאור המשלוח לקוח מהחנות, ומשלוח לא ידוע לא מוצג כחינם', async () => {
  const { shippingLabel } = await import('../server/providers/serpapi.js');
  assert.equal(shippingLabel(['במלאי אונליין', 'דמי המשלוח: ‏28 ‏₪']), 'דמי המשלוח: 28 ₪');
  const r = await get('/api/products/sa:12827020246278533726/offers');
  const ksp = r.offers.find((o) => o.domain === 'ksp.co.il');
  assert.equal(ksp.best.name, 'דמי המשלוח: 28 ₪');
  assert.equal(ksp.best.shippingUnknown, false);
  const { resolveStore } = await import('../server/storeRegistry.js');
  const s = resolveStore({ name: 'חנות בלי מידע', currency: 'ILS' });
  assert.equal(s.shipping.direct[0].unknown, true);
});

test('חנות אד-הוק משוחזרת מפרטי ההצעה (למשל אחרי הפעלה מחדש עם מטמון)', async () => {
  const { toOffer } = await import('../server/providers/searchapi.js');
  const o = toOffer({ merchant: { name: 'HOT Store' }, link: 'https://hotstore.hotmobile.co.il/p', price: '‏2,174 ‏₪', extracted_price: 2174, details: ['משלוח חינם'] });
  assert.deepEqual(o.storeHint, { name: 'HOT Store', url: 'https://hotstore.hotmobile.co.il/p', currency: 'ILS' });
  assert.equal(o.directShipping[0].name, 'משלוח חינם');
});
