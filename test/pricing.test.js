import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOffer, importTaxes, bestDiscount, chargeableWeightKg } from '../server/pricing/landedCost.js';
import { storeById } from '../server/data/stores.js';
import { productById } from '../server/data/catalog.js';

const rates = { ILS: 1, USD: 3.7, EUR: 4.0, GBP: 4.7, CNY: 0.51 };
const now = new Date('2026-11-05');

test('מתחת ל-$75 – פטור ממע"מ', () => {
  const t = importTaxes(60 * 3.7, 0, 'audio', rates);
  assert.equal(t.exempt, true);
  assert.equal(t.totalIls, 0);
});

test('בין $75 ל-$500 – מע"מ 18% בלבד + עמלת שחרור', () => {
  const t = importTaxes(200 * 3.7, 0, 'audio', rates);
  assert.equal(t.dutyIls, 0);
  assert.equal(t.vatIls, Math.round(740 * 0.18 * 100) / 100);
  assert.equal(t.feeIls, 25);
});

test('מעל $500 – מכס לפי קטגוריה ואז מע"מ על הסכום כולל המכס', () => {
  const t = importTaxes(600 * 3.7, 0, 'appliances', rates);
  const cif = 600 * 3.7;
  assert.equal(t.dutyIls, Math.round(cif * 0.12 * 100) / 100);
  assert.equal(t.vatIls, Math.round((cif + cif * 0.12) * 0.18 * 100) / 100);
});

test('Best Buy לא שולחת לארץ → רק מסלולי שילוח צד ג\'', () => {
  const ev = evaluateOffer({ offer: { storeId: 'bestbuy', price: 249 }, product: productById['airpods-pro-3'],
    store: storeById.bestbuy, rates, now });
  assert.equal(ev.shipsDirectToIL, false);
  assert.ok(ev.routes.length > 0);
  assert.ok(ev.routes.every((r) => r.kind === 'forwarder'));
});

test('Amazon לא שולחת מוצרי חשמל גדולים ישירות → שילוח צד ג\'', () => {
  const ev = evaluateOffer({ offer: { storeId: 'amazon_us', price: 649 }, product: productById['dyson-v15'],
    store: storeById.amazon_us, rates, now });
  assert.equal(ev.shipsDirectToIL, false);
});

test('הנחת "בהצדעה" חלה רק אם המשתמש חבר', () => {
  const args = { offer: { storeId: 'ksp', price: 1690 }, product: productById['sony-wh1000xm6'], store: storeById.ksp, rates, now };
  const without = evaluateOffer({ ...args, userClubIds: [] });
  const withClub = evaluateOffer({ ...args, userClubIds: ['behatzdaa'] });
  assert.ok(withClub.totalIls < without.totalIls);
  assert.ok(withClub.discounts.applied.some((d) => d.clubId === 'behatzdaa'));
});

test('בוחרים בין מועדון לקופון כשאי אפשר לשלב, ומשלבים כשאפשר', () => {
  const club = { kind: 'club', amountIls: 80, stackable: false };
  const coupon = { kind: 'coupon', amountIls: 50 };
  assert.equal(bestDiscount([club], [coupon], 1000).totalIls, 80);
  assert.equal(bestDiscount([{ ...club, stackable: true }], [coupon], 1000).totalIls, 130);
});

test('קופון שפג תוקפו לא מוצע', () => {
  const ev = evaluateOffer({ offer: { storeId: 'aliexpress', price: 120 }, product: productById['mx-master-3s'],
    store: storeById.aliexpress, rates, now: new Date('2026-11-20') });
  assert.ok(!ev.discounts.availableCoupons.some((c) => c.code === 'AE11SALE'));
});

test('משקל נפחי גובר על משקל אמיתי לקופסה גדולה', () => {
  const kg = chargeableWeightKg(productById['ninja-af500']); // 48*42*38/5000 ≈ 15.3
  assert.equal(kg, 15.5);
});
