// בדיקות להתראות מחיר: מתי שולחים, בלי הצפה, ניקוי מכשירים שהסירו את האפליקציה, ו-API.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mashve-alerts-'));
process.env.WATCHES_FILE = path.join(tmp, 'watches.json');
process.env.CACHE_DIR = path.join(tmp, 'cache');
process.env.HISTORY_FILE = path.join(tmp, 'history.json');
process.env.FX_OFFLINE = '1';
process.env.ADMIN_TOKEN = 'test-admin';

const A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
let alerts;
let base;
before(async () => {
  alerts = await import('../server/alerts.js');
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
});

test('decideAlert: מחיר יעד, ירידה של 3%, ובלי לדווח פעמיים על אותו מחיר', () => {
  const { decideAlert } = alerts;
  assert.equal(decideAlert({ targetIls: 1000, lastNotifiedIls: null }, 1050), null);
  assert.equal(decideAlert({ targetIls: 1000, lastNotifiedIls: null }, 990).kind, 'target');
  assert.equal(decideAlert({ targetIls: 1000, lastNotifiedIls: 990 }, 990), null); // כבר דווח
  assert.equal(decideAlert({ targetIls: 1000, lastNotifiedIls: 990 }, 950).kind, 'target'); // ירד עוד
  assert.equal(decideAlert({ targetIls: null, baselineIls: 1000, lastNotifiedIls: null }, 985), null); // 1.5% – לא מספיק
  assert.deepEqual(decideAlert({ targetIls: null, baselineIls: 1000, lastNotifiedIls: null }, 960), { kind: 'drop', diff: 40 });
  assert.equal(decideAlert({ targetIls: 1000 }, null), null);
});

test('בדיקה: מוצר אחד נבדק פעם אחת גם כשכמה מכשירים עוקבים, ונשלחות התראות מתאימות', async () => {
  alerts.upsertWatch({ pushToken: A, productId: 'sony-wh1000xm6', targetIls: 1500 });
  alerts.upsertWatch({ pushToken: B, productId: 'sony-wh1000xm6', baselineIls: 2000 });
  let compares = 0;
  const compare = async () => { compares++; return { best: { totalIls: 1449, storeName: 'LastPrice' } }; };
  const sent = [];
  const send = async (msgs) => { sent.push(...msgs); return msgs.map((m) => (m.to === B ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })); };

  const s = await alerts.checkWatches({ compare, send });
  assert.equal(compares, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent.find((m) => m.to === A).title, '🎯 הגיע למחיר היעד!');
  assert.match(sent.find((m) => m.to === A).body, /₪1,449 עד הבית ב-LastPrice/);
  assert.equal(sent[0].data.productId, 'sony-wh1000xm6');
  assert.equal(s.sent, 1);
  assert.equal(s.removed, 1); // B הסיר את האפליקציה → נמחק
  assert.equal(alerts.listWatches(B).length, 0);

  // ריצה שנייה באותו מחיר – בלי התראה חוזרת
  sent.length = 0;
  await alerts.checkWatches({ compare, send });
  assert.equal(sent.length, 0);
});

test('API: הוספה, עדכון, רשימה ומחיקה של מעקב; טוקן לא תקין נדחה', async () => {
  const put = (body) => fetch(base + '/api/watches', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const C = 'ExponentPushToken[cccccccccccccccccccccc]';
  assert.equal((await put({ pushToken: 'nope', productId: 'switch2' })).status, 400);
  assert.equal((await put({ pushToken: C, productId: 'no-such-product' })).status, 404);
  assert.equal((await put({ pushToken: C, productId: 'switch2', baselineIls: 2190 })).status, 200);
  await put({ pushToken: C, productId: 'switch2', targetIls: 1999 });
  const list = await fetch(`${base}/api/watches?pushToken=${encodeURIComponent(C)}`).then((r) => r.json());
  assert.equal(list.watches.length, 1);
  assert.equal(list.watches[0].targetIls, 1999);
  assert.equal(list.watches[0].baselineIls, 2190); // נשמר מהקריאה הקודמת
  const del = await fetch(`${base}/api/watches?pushToken=${encodeURIComponent(C)}&productId=switch2`, { method: 'DELETE' }).then((r) => r.json());
  assert.equal(del.removed, 1);
});

test('הפעלה ידנית של בדיקת ההתראות דורשת ADMIN_TOKEN', async () => {
  const no = await fetch(base + '/api/admin/check-alerts', { method: 'POST' });
  assert.equal(no.status, 404);
  const ok = await fetch(base + '/api/admin/check-alerts', { method: 'POST', headers: { Authorization: 'Bearer test-admin' } });
  assert.equal(ok.status, 200);
  assert.equal(typeof (await ok.json()).products, 'number');
});
