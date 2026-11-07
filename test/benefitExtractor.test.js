// קריאת הטבות מעמודי מועדון (הסקריפט שרץ ב-WebView), בדפדפן אמיתי על עמודי דוגמה.
// דורש Playwright (קיים בסביבת הפיתוח); אם אינו מותקן – הבדיקה מדולגת.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'mobile', 'src', 'lib', 'benefitExtractor.ts'), 'utf8');
const SCRIPT = src.slice(src.indexOf('/*BEGIN-EXTRACTOR*/'), src.indexOf('/*END-EXTRACTOR*/'));
let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* אין Playwright */ }

async function extract(file) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('.html')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(here, 'fixtures', 'club-pages', path.basename(u.pathname))) });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`https://club.example/${file}`);
  if (file.includes('frame')) await page.waitForTimeout(500); // טעינת המסגרת
  await page.evaluate(SCRIPT);
  await page.waitForFunction(() => window.__supershopResult, null, { timeout: 15000 });
  const r = await page.evaluate(() => window.__supershopResult);
  await browser.close();
  return r;
}

test('רשת כרטיסים: כל כרטיס עם הנחה הוא הטבה אחת, עם כותרת, קישור ותמונה', { skip: !chromium }, async () => {
  const r = await extract('grid.html');
  assert.equal(r.needsLogin, false);
  const titles = r.items.map((i) => i.title);
  assert.deepEqual(titles.sort(), ['KSP', 'אייבורי', 'מקדונלדס', 'סינמה סיטי', 'פוקס'].sort());
  const fox = r.items.find((i) => i.title === 'פוקס');
  assert.match(fox.text, /20%/);
  assert.equal(fox.link, 'https://club.example/benefit/fox');
  assert.equal(fox.image, 'https://club.example/img/fox.png');
  assert.equal(r.items.find((i) => i.title === 'אייבורי').link, 'https://www.ivory.co.il/x');
  // לא נקלטו: התפריט ("מבצעי 50%"), הכותרת התחתונה, כרטיס בלי הנחה, והרשת כולה ככרטיס אחד
  assert.ok(!r.items.some((i) => /ראשי|זכויות|תיאור בלי/.test(i.text)));
});

test('רשימה פשוטה: כל פריט הוא הטבה', { skip: !chromium }, async () => {
  const r = await extract('list.html');
  assert.equal(r.items.length, 3);
  assert.deepEqual(r.items.map((i) => i.title), ['באג', 'שופרסל אונליין', 'מלון בים המלח']);
});

test('עמוד כניסה (שדה סיסמה) = עדיין לא מחוברים', { skip: !chromium }, async () => {
  const r = await extract('login.html');
  assert.equal(r.needsLogin, true);
  assert.equal(r.items.length, 0);
});

test('מחובר, וטופס כניסה מוסתר נשאר בעמוד – לא נחשב "לא מחובר"', { skip: !chromium }, async () => {
  const r = await extract('logged-in-hidden-login.html');
  assert.equal(r.needsLogin, false);
  assert.equal(r.diag.hiddenPassword, 1);
  assert.deepEqual(r.items.map((i) => i.title), ['פוקס', 'KSP']);
});

test('הטבות בתוך מסגרת (iframe) מאותו אתר נקראות', { skip: !chromium }, async () => {
  const r = await extract('with-frame.html');
  assert.equal(r.diag.sameOriginFrames, 1);
  assert.deepEqual(r.items.map((i) => i.title), ['באג', 'שופרסל אונליין', 'מלון בים המלח']);
});

test('עמוד גדול (כ-18 אלף רכיבים, 600 הטבות) נקרא תוך פחות משתי שניות', { skip: !chromium }, async () => {
  const wrap = (h, d) => '<div>'.repeat(d) + h + '</div>'.repeat(d);
  let cards = '';
  for (let i = 0; i < 600; i++) cards += wrap(`<div class="card"><h3>מותג ${i}</h3><p>הנחה של ${5 + (i % 30)}% על המוצרים</p></div>`, 6);
  let noise = ''; for (let i = 0; i < 3000; i++) noise += wrap(`<span>פריט ${i}</span>`, 3);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html dir="rtl"><body>${wrap(`<section>${cards}</section><aside>${noise}</aside>`, 12)}</body></html>`);
  const t0 = Date.now();
  await page.evaluate(SCRIPT);
  await page.waitForFunction(() => window.__supershopResult, null, { timeout: 15000 });
  const r = await page.evaluate(() => window.__supershopResult);
  await browser.close();
  assert.ok(Date.now() - t0 < 2000, `took ${Date.now() - t0}ms`);
  assert.equal(r.items.length, 300); // תקרה
  assert.equal(r.diag.stage, 'done');
});

test('פרוטוקול מול האפליקציה: ping, הודעות התקדמות ואז התוצאה – דרך ReactNativeWebView.postMessage', { skip: !chromium }, async () => {
  const PING = src.match(/export const PING_JS = `([^`]+)`/)[1];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(fs.readFileSync(path.join(here, 'fixtures', 'club-pages', 'grid.html'), 'utf8'));
  await page.evaluate(() => { window.__msgs = []; window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) }; });
  await page.evaluate(PING);
  await page.evaluate(SCRIPT);
  await page.waitForFunction(() => window.__msgs.some((m) => m.type === 'benefits'), null, { timeout: 15000 });
  const msgs = await page.evaluate(() => window.__msgs);
  await browser.close();
  assert.deepEqual(msgs.map((m) => m.type === 'progress' ? m.stage : m.type), ['ping', 'started', 'scrolling', 'scanning', 'benefits']);
  const result = msgs.at(-1);
  assert.equal(result.items.length, 5);
  assert.equal(result.diag.stage, 'done');
  assert.equal(typeof result.ms, 'number');
});
