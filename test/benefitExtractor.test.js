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
