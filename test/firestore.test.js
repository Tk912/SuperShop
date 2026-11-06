// בדיקות למצב Firestore – מול מימוש מדומה בזיכרון עם אותו API (collection/doc/get/set/batch).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'supershop-fs-'));
process.env.SEARCHAPI_FIXTURE_DIR = path.join(here, 'fixtures', 'searchapi');
process.env.FX_OFFLINE = '1';
process.env.ADMIN_TOKEN = 'secret';
// אם משהו עדיין כותב לקבצים במצב Firestore – הבדיקה תתפוס את זה
for (const k of ['CACHE_DIR', 'LEARNED_FILE', 'HISTORY_FILE', 'WATCHES_FILE', 'DEALS_FILE']) process.env[k] = path.join(tmp, k);

function fakeFirestore() {
  const data = new Map(); // "collection/id" → object
  const docRef = (col, id) => ({
    path: `${col}/${id}`,
    async get() { const v = data.get(`${col}/${id}`); return { exists: v !== undefined, data: () => structuredClone(v) }; },
    async set(v) { data.set(`${col}/${id}`, structuredClone(v)); },
  });
  return {
    data,
    writes: 0,
    collection(col) { return { doc: (id) => docRef(col, id) }; },
    batch() {
      const ops = [];
      const self = this;
      return { set: (ref, v) => ops.push([ref, v]), async commit() { for (const [r, v] of ops) await r.set(v); self.writes++; } };
    },
  };
}

const db = fakeFirestore();
let base;
let storage;
before(async () => {
  storage = await import('../server/storage.js');
  const { createApp } = await import('../server/app.js'); // רושם את כל המסמכים
  assert.equal(await storage.initStorage({ db }), 'firestore');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
});
const H = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };

test('בהפעלה ראשונה ההנחות נטענות מהזרע שבקוד', async () => {
  const d = await fetch(base + '/api/admin/deals', { headers: H }).then((r) => r.json());
  assert.ok(d.clubs.some((c) => c.id === 'pais-plus'));
});

test('חיפוש, מעקב והיסטוריה נשמרים ב-Firestore לפני שהתשובה חוזרת', async () => {
  await fetch(base + '/api/search?q=' + encodeURIComponent('Sony WH-1000XM6'));
  assert.ok(JSON.parse(db.data.get('state/learned-products').json).length >= 8);
  assert.ok([...db.data.keys()].some((k) => k.startsWith('cache/'))); // מטמון התשובות

  await fetch(base + '/api/products/sa:12827020246278533726/offers');
  const hist = JSON.parse(db.data.get('state/price-history').json);
  assert.equal(hist['sa:12827020246278533726'][0].p, 1191);

  const token = 'ExponentPushToken[ffffffffffffffffffffff]';
  const r = await fetch(base + '/api/watches', { method: 'PUT', headers: H, body: JSON.stringify({ pushToken: token, productId: 'sa:12827020246278533726', targetIls: 1100 }) });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(db.data.get('state/watches').json)[0].targetIls, 1100);
});

test('שמירת הנחות מהניהול נכתבת ל-Firestore', async () => {
  const d = await fetch(base + '/api/admin/deals', { headers: H }).then((r) => r.json());
  const rule = d.clubs.find((c) => c.id === 'behatzdaa').rules[0];
  Object.assign(rule, { status: 'verified', source: 'https://example.org/benefit' });
  assert.equal((await fetch(base + '/api/admin/deals', { method: 'PUT', headers: H, body: JSON.stringify(d) })).status, 200);
  const saved = JSON.parse(db.data.get('state/deals').json);
  assert.equal(saved.clubs.find((c) => c.id === 'behatzdaa').rules[0].status, 'verified');
});

test('"הפעלה מחדש": הנתונים נטענים בחזרה מ-Firestore', async () => {
  const back = storage.firestoreBackend(db);
  const watches = await back.loadDocAsync({ name: 'watches' });
  assert.equal(watches.length, 1);
  const deals = await back.loadDocAsync({ name: 'deals' });
  assert.equal(deals.clubs.find((c) => c.id === 'behatzdaa').rules[0].status, 'verified');
});

test('מסמך גדול מתפצל לכמה חלקים ומתחבר בחזרה בשלמותו', async () => {
  const back = storage.firestoreBackend(db);
  const big = { items: Array.from({ length: 4000 }, (_, i) => ({ id: i, name: `מוצר מספר ${i} עם שם ארוך בעברית`.repeat(4) })) };
  await back.writeDoc({ name: 'big', value: big });
  assert.ok(db.data.get('state/big').parts > 1);
  assert.deepEqual(await back.loadDocAsync({ name: 'big' }), big);
});

test('במצב Firestore לא נכתב שום קובץ מקומי', () => {
  assert.deepEqual(fs.readdirSync(tmp), []);
});
