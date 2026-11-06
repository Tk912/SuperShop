// אתרי מסחר (Amazon / eBay / Walmart): התאמת מוצר וסינון – על תשובות אמיתיות לחיפוש "AirPods Pro 3".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelTokens, englishQuery, sameProduct, pickBest } from '../server/providers/marketplaces.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'searchapi', `${n}.json`), 'utf8')).organic_results;
const rates = { ILS: 1, USD: 3.7, EUR: 4.0, GBP: 4.7, CNY: 0.51 };
const AIRPODS = 'אוזניות Apple AirPods Pro 3';
const tokens = modelTokens(AIRPODS);
const REF = 717; // המחיר הזול בישראל (אייבורי, Google Shopping)
const GOOD = { name: 'good-seller', reviews: 500, positive_feedback_percent: 99.5 };

test('שאילתה באנגלית ומילות דגם מתוך שם בעברית', () => {
  assert.equal(englishQuery(AIRPODS), 'apple airpods pro 3');
  assert.deepEqual(tokens, { brand: 'apple', required: ['airpods', 'pro', '3'] });
  assert.equal(englishQuery('אוזניות אלחוטיות Sony WH-1000XM6 עם ביטול רעשים'), 'sony wh 1000xm6');
  assert.equal(englishQuery('שואב אבק אלחוטי'), null); // בלי דגם באנגלית – לא מחפשים
});

test('התאמת דגם: דור קודם, מחודש ואביזר נפסלים', () => {
  assert.ok(sameProduct('Apple AirPods Pro 3 Wireless Earbuds White', tokens));
  assert.ok(sameProduct('AirPods Pro (3rd Generation) with MagSafe Case', tokens)); // 3rd → 3, בלי מותג
  assert.ok(!sameProduct('AirPods Pro (2nd Gen) Wireless Earbuds', tokens));
  assert.ok(!sameProduct('Apple Airpods 3rd Gen (2025) Brand New', tokens)); // חסר Pro
  assert.ok(!sameProduct('AirPods (3rd Generation) (Renewed)', tokens));
  assert.ok(!sameProduct('Foam Ear Tips for AirPods Pro 3', tokens));
  assert.ok(!sameProduct('Apple AirPods Pro 3', tokens, 'Restored: Like New'));
  const sony = modelTokens('Sony WH-1000XM6');
  assert.ok(sameProduct('Sony WH1000XM6 Wireless Headphones', sony)); // בלי מקף
  assert.ok(!sameProduct('Sony WH-1000XM5 Wireless Headphones', sony));
});

test('Amazon: אין התאמה אמיתית בתוצאות (דורות קודמים/מחודשים/אביזרים)', () => {
  assert.equal(pickBest(fixture('amazon_search'), 'amazon', tokens, REF, rates), null);
});

test('eBay: מוכרים בלי היסטוריה, מחירים חשודים ומשומשים מסוננים; נבחרת הזולה כולל משלוח', () => {
  const o = pickBest(fixture('ebay_search'), 'ebay', tokens, REF, rates);
  assert.equal(o.storeId, 'ebay');
  // $173.89 (3 ביקורות, 0%) ו-$144.99 (0 ביקורות) נפסלים; נשארים $179 (67, 100%) ו-$193.07 (120, 100%)
  assert.equal(o.price, 179);
  assert.equal(o.currency, 'USD');
  assert.equal(o.directShipping[0].cost, 22.38);
  assert.ok(o.details.some((d) => d.includes('100% חיובי')));
  assert.ok(o.url.startsWith('https://www.ebay.com/itm/'));
});

test('Walmart: רק החדש ($261); מחודש/Open Box/משומש נפסלים; בלי משלוח ישיר', () => {
  const o = pickBest(fixture('walmart_search'), 'walmart', tokens, REF, rates);
  assert.equal(o.price, 261);
  assert.equal(o.title, 'Apple AirPods Pro 3');
  assert.equal(o.directShipping, undefined);
});

test('בלי מחיר ייחוס – עדיין מסננים לפי דגם ומצב', () => {
  const o = pickBest(fixture('ebay_search'), 'ebay', tokens, null, rates);
  assert.ok(o && /pro 3|pro 3rd/i.test(o.title));
});

test('אביזר מזוהה לפי המיקום: לפני שם המוצר – אביזר; אחריו – חלק מהמארז', () => {
  assert.ok(sameProduct('Apple AirPods Pro 3 with MagSafe Charging Case', tokens));
  assert.ok(!sameProduct('Silicone Case Cover AirPods Pro 3', tokens));
  assert.ok(!sameProduct('Case for AirPods Pro 3', tokens));
});

test('משלוח לא ידוע לא נחשב חינם בבחירת הזולה', () => {
  const rs = [
    { title: 'Apple AirPods Pro 3', link: 'https://x/1', price: '$170.00', extracted_price: 170, seller: GOOD }, // משלוח לא ידוע
    { title: 'Apple AirPods Pro 3', link: 'https://x/2', price: '$150.00', extracted_price: 150, extracted_shipping: 25, seller: GOOD },
  ];
  assert.equal(pickBest(rs, 'ebay', tokens, REF, rates).price, 150); // 150+25 < 170+25
});

test('eBay: מוכר בלי מספיק ביקורות או עם דירוג נמוך נפסל', () => {
  const base = { title: 'Apple AirPods Pro 3', link: 'https://x/1', price: '$190.00', extracted_price: 190, extracted_shipping: 20 };
  assert.equal(pickBest([{ ...base, seller: { name: 'new', reviews: 3, positive_feedback_percent: 100 } }], 'ebay', tokens, REF, rates), null);
  assert.equal(pickBest([{ ...base, seller: { name: 'meh', reviews: 900, positive_feedback_percent: 94 } }], 'ebay', tokens, REF, rates), null);
  assert.ok(pickBest([{ ...base, seller: GOOD }], 'ebay', tokens, REF, rates));
});
