// בדיקות למסלול הנתונים החיים (Google Shopping דרך SerpAPI) – על תשובות מוקלטות, בלי רשת.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mashve-'));
process.env.SERPAPI_FIXTURE_DIR = path.join(here, 'fixtures', 'serpapi');
process.env.CACHE_DIR = path.join(tmp, 'cache');
process.env.LEARNED_FILE = path.join(tmp, 'learned.json');
process.env.HISTORY_FILE = path.join(tmp, 'history.json');
process.env.FX_OFFLINE = '1';

let app;
let server;
let base;
before(async () => {
  const { createApp } = await import('../server/app.js');
  app = createApp();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  server.unref();
});
const get = (p) => fetch(base + p).then((r) => r.json());

test('זיהוי מטבע ממחרוזות מחיר בפורמטים שונים', async () => {
  const { currencyOf } = await import('../server/providers/serpapi.js');
  assert.equal(currencyOf('‏1,549.00 ‏₪'), 'ILS');
  assert.equal(currencyOf('$398.00'), 'USD');
  assert.equal(currencyOf('€379'), 'EUR');
  assert.equal(currencyOf('1,499 ש"ח'), 'ILS');
});

test('חיפוש חי מחזיר מוצרים עם תמונה, ומדלג על תוצאה בלי מחיר', async () => {
  const r = await get('/api/search?q=' + encodeURIComponent('sony xm6'));
  assert.equal(r.mode, 'live');
  const live = r.results.filter((p) => p.live);
  assert.equal(live.length, 3);
  assert.ok(live.every((p) => p.image.startsWith('https://')));
  assert.ok(!r.results.some((p) => p.name.includes('should be skipped')));
  assert.equal(live[0].category, 'audio');
  assert.equal(live[0].weightEstimated, true);
});

test('מוצרים שנלמדו מחיפוש מופיעים בהשלמה האוטומטית בלי בקשת API נוספת', async () => {
  await get('/api/search?q=' + encodeURIComponent('sony xm6'));
  const r = await get('/api/suggest?q=' + encodeURIComponent('WH-1000XM5'));
  assert.ok(r.suggestions.some((p) => p.id === 'g:3333333333333333333'));
});

test('דף מוצר חי: כל החנויות, משלוח ידוע, ושילוח צד ג\' לחנות שלא שולחת לארץ', async () => {
  await get('/api/search?q=' + encodeURIComponent('sony xm6'));
  const r = await get('/api/products/g:1111111111111111111/offers');
  assert.equal(r.mode, 'live');
  const by = Object.fromEntries(r.offers.map((o) => [o.storeName, o]));
  assert.ok(by.KSP && by['Amazon.com'] && by['Best Buy']);
  assert.equal(by.KSP.storeType, 'local');
  assert.equal(by.KSP.best.shippingIls, 0); // "משלוח חינם"
  // Amazon: Google החזיר משלוח $18.5 → מסלול ישיר עם העלות הזו
  const amazonDirect = by['Amazon.com'].routes.find((rt) => rt.kind === 'direct');
  assert.equal(amazonDirect.shippingIls, Math.round(18.5 * 3.7 * 100) / 100);
  // Best Buy לא שולחת לישראל → רק שילוח צד ג'
  assert.ok(by['Best Buy'].routes.every((rt) => rt.kind === 'forwarder'));
  // חנות לא מוכרת עם כתובת .co.il → מזוהה כישראלית
  const unknown = r.offers.find((o) => o.domain === 'gadget-plus-example.co.il');
  assert.equal(unknown.storeType, 'local');
  // חנות בלי קישור מסוננת
  assert.ok(!r.offers.some((o) => o.storeName.includes('Broken')));
  // ממוין לפי עלות סופית
  const inStock = r.offers.filter((o) => o.inStock);
  for (let i = 1; i < inStock.length; i++) assert.ok(inStock[i - 1].totalIls <= inStock[i].totalIls);
  assert.equal(r.offers.at(-1).inStock, false); // אזל מהמלאי – בסוף
});

test('במצב חי אין מחירי דוגמה מעורבבים', async () => {
  const r = await get('/api/products/sony-wh1000xm6/offers'); // מוצר קטלוג → מחפש אותו ב-Google
  assert.ok(r.offers.length > 0);
  assert.ok(r.offers.every((o) => o.source === 'serpapi'));
});

test('היסטוריית מחירים נרשמת במצב חי ומוחזרת עם ההשוואה', async () => {
  const r1 = await get('/api/products/g:1111111111111111111/offers?clubs=behatzdaa');
  const r2 = await get('/api/products/g:1111111111111111111/offers');
  assert.equal(r2.history.points.length, 1); // נקודה אחת ליום
  assert.ok(r2.history.lowest.p > 0);
  // ההיסטוריה לפי מחיר בסיס – לא מושפעת מהמועדון של המשתמש
  assert.equal(r1.history.lowest?.p ?? r2.history.lowest.p, r2.history.lowest.p);
});

test('יום חדש מוסיף נקודה, ומחיר זול יותר באותו יום מחליף', async () => {
  const { recordPrice, getHistory } = await import('../server/priceHistory.js');
  const d1 = new Date('2026-11-01T10:00:00Z');
  const d2 = new Date('2026-11-02T10:00:00Z');
  recordPrice('t1', 500, 'A', d1);
  recordPrice('t1', 480, 'B', d1);
  recordPrice('t1', 490, 'A', d1);
  recordPrice('t1', 470, 'C', d2);
  const h = getHistory('t1', 30, d2);
  assert.deepEqual(h.points.map((x) => x.p), [480, 470]);
  assert.equal(h.lowest.s, 'C');
});

test('במצב חי, הנחות וקופונים לדוגמה לא יורדים ממחיר אמיתי', async () => {
  await get('/api/search?q=' + encodeURIComponent('sony xm6'));
  const r = await get('/api/products/g:1111111111111111111/offers?clubs=behatzdaa,hever');
  assert.equal(r.deals, false);
  const ksp = r.offers.find((o) => o.storeName === 'KSP');
  assert.equal(ksp.discounts.totalIls, 0);
  assert.equal(ksp.totalIls, 1549); // מחיר החנות + משלוח חינם, בלי KSP50 המומצא
  assert.deepEqual(ksp.missedClubs, []);
});
