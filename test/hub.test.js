// בדיקות למרכז ההטבות: סינון "מוצרים פיזיים בלבד", פרטיות בשיתוף, ופיד עם מסננים.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'supershop-hub-'));
process.env.HUB_FILE = path.join(tmp, 'hub.json');
process.env.DEALS_FILE = path.join(tmp, 'deals.json');
process.env.CACHE_DIR = path.join(tmp, 'cache');
process.env.FX_OFFLINE = '1';
process.env.ADMIN_TOKEN = 'secret';

let base;
let C;
before(async () => {
  C = await import('../server/hubClassify.js');
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
});

test('סיווג: רשתות אופנה, נעליים וחשמל – כן; אטרקציות, מסעדות ונופש – לא', () => {
  const yes = [
    ['20% הנחה בפוקס', 'fashion'], ['פוקס הום 15% על כל החנות', 'home'], ['Castro 25% off', 'fashion'],
    ['10% בקרוקס', 'shoes'], ['8% הנחה ב-KSP על מוצרי חשמל', 'electronics'], ['זוג נעליים שני ב-50%', 'shoes'],
    ['15% על מצעים ומגבות', 'home'], ['קופון 10$ באמזון', 'general'], ['ג׳ינס סקיני ב-30% הנחה', 'fashion'],
  ];
  for (const [title, cat] of yes) {
    const r = C.classify({ title });
    assert.equal(r.ok, true, title);
    assert.equal(r.category, cat, title);
  }
  const no = ['30% הנחה בפארק המים', 'לילה במלון באילת ב-20% הנחה', '1+1 על ארוחות במסעדה', 'כרטיסים להופעה ב-₪99',
    'הנחה לסדנת קרמיקה', '25% על עיסוי בספא', 'כרטיס לקולנוע ב-₪25', 'הטבה מיוחדת לחברי המועדון'];
  for (const title of no) assert.equal(C.classify({ title }).ok, false, title);
});

test('אזור: אתרים בחו״ל מסומנים intl', () => {
  assert.equal(C.classify({ title: '10% ב-AliExpress' }).region, 'intl');
  assert.equal(C.classify({ title: 'SHEIN 15% הנחה' }).region, 'intl');
  assert.equal(C.classify({ title: '20% בפוקס' }).region, 'il');
});

test('ההנחה: אחוז אחד ברור, "עד", 1+1, שקלים, מינימום', () => {
  assert.deepEqual(C.discountOf('20% הנחה בקנייה מעל 300 ש"ח'), { minSpend: 300, percent: 20, label: '20%' });
  assert.equal(C.discountOf('עד 40% הנחה').label, 'עד 40%');
  assert.equal(C.discountOf('עד 40% הנחה').percent, null);
  assert.equal(C.discountOf('1+1 על כל החנות').label, '1+1');
  assert.equal(C.discountOf('₪50 הנחה').label, '₪50');
});

const share = (clubId, items) => fetch(base + '/api/hub/share', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubId, items }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test('שיתוף: רק מוצרים נכנסים, מידע אישי נדחה, קישורים בלי פרמטרים', async () => {
  const r = await share('behatzdaa', [
    { title: 'פוקס', text: '20% הנחה בפוקס על כל הקולקציה', link: 'https://www.behatsdaa.org.il/benefit/1?token=abc&user=123#x', image: 'https://cdn.example.com/fox.png?sig=1' },
    { title: 'קרוקס', text: '15% הנחה בקרוקס', link: 'http://insecure.example.com/x' },
    { title: 'מלון דן', text: '20% הנחה על לילה במלון' },
    { title: 'שלום ישראל', text: 'שלום ישראל, 20% בקסטרו ת"ז 123456789' },
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.added, 2);
  assert.equal(r.body.rejected.service, 1);
  assert.equal(r.body.rejected.personal, 1);

  const feed = await fetch(base + '/api/hub').then((x) => x.json());
  const fox = feed.items.find((i) => i.store === 'פוקס');
  assert.ok(fox);
  assert.equal(fox.link, 'https://www.behatsdaa.org.il/benefit/1');
  assert.equal(fox.image, 'https://cdn.example.com/fox.png');
  assert.equal(fox.discount, '20%');
  assert.equal(fox.clubName, 'בהצדעה');
  assert.equal(feed.items.find((i) => i.store === 'קרוקס').link, null);
  assert.ok(!feed.items.some((i) => /מלון/.test(i.text)));
  assert.ok(!JSON.stringify(feed).includes('reporters'));
});

test('שיתוף חוזר של אותה הטבה לא יוצר כפילות', async () => {
  const r = await share('behatzdaa', [{ title: 'פוקס', text: '20% הנחה בפוקס על כל הקולקציה' }]);
  assert.equal(r.body.added, 0);
  assert.equal(r.body.updated, 1);
  const feed = await fetch(base + '/api/hub?q=' + encodeURIComponent('פוקס')).then((x) => x.json());
  assert.equal(feed.items.filter((i) => i.kind === 'shared').length, 1);
});

test('פיד: מסננים לפי מועדון, קטגוריה ואזור', async () => {
  await share('pais-plus', [{ title: 'AliExpress', text: '10% הנחה ב-AliExpress' }]);
  const intl = await fetch(base + '/api/hub?region=intl').then((x) => x.json());
  assert.ok(intl.items.length >= 1);
  assert.ok(intl.items.every((i) => i.region === 'intl'));
  const shoes = await fetch(base + '/api/hub?category=shoes').then((x) => x.json());
  assert.ok(shoes.items.every((i) => i.category === 'shoes'));
  assert.ok(shoes.categories.some((c) => c.id === 'fashion'));
  const pais = await fetch(base + '/api/hub?clubs=pais-plus').then((x) => x.json());
  assert.ok(pais.items.every((i) => !i.clubId || i.clubId === 'pais-plus'));
  assert.ok(pais.items.some((i) => i.store === 'AliExpress'));
});

test('שיתוף למועדון לא קיים – 404; ניהול יכול להסתיר', async () => {
  assert.equal((await share('nope', [])).status, 404);
  const feed = await fetch(base + '/api/hub?q=' + encodeURIComponent('קרוקס')).then((x) => x.json());
  const id = feed.items[0].id;
  const H = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/api/admin/hub/${id}`, { method: 'PUT', headers: H, body: '{}' })).status, 200);
  const after = await fetch(base + '/api/hub?q=' + encodeURIComponent('קרוקס')).then((x) => x.json());
  assert.equal(after.items.length, 0);
});
