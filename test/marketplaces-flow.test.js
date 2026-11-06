// מסלול מלא: אתרי המסחר → מנוע העלות עד הבית (על תשובות אמיתיות מוקלטות).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SEARCHAPI_FIXTURE_DIR = path.join(here, 'fixtures', 'searchapi');
process.env.CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'supershop-mk-'));
process.env.FX_OFFLINE = '1';
const rates = { ILS: 1, USD: 3.7, EUR: 4.0, GBP: 4.7, CNY: 0.51 };

test('AirPods Pro 3: eBay ו-Walmart נמצאים, Amazon לא; Walmart מקבל שילוח צד ג\'', async () => {
  const { marketplacesProvider } = await import('../server/providers/marketplaces.js');
  const { evaluateOffer } = await import('../server/pricing/landedCost.js');
  const { storeById } = await import('../server/data/stores.js');
  const product = { id: 'airpods-pro-3', name: 'Apple AirPods Pro 3', category: 'audio', weightKg: 0.25, dims: [12, 12, 5] };

  const offers = await marketplacesProvider.offersFor(product, { referenceIls: 717, rates });
  assert.deepEqual(offers.map((o) => o.storeId).sort(), ['ebay', 'walmart']);

  const ev = Object.fromEntries(offers.map((o) => [o.storeId,
    evaluateOffer({ offer: o, product, store: storeById[o.storeId], rates, deals: false })]));
  // eBay: מסלול ישיר עם דמי המשלוח לישראל מהמודעה ($22.38), לצד שילוח צד ג' – ונבחר הזול; מעל $75 → מע"מ
  const direct = ev.ebay.routes.find((r) => r.kind === 'direct');
  assert.equal(direct.shippingIls, Math.round(22.38 * 3.7 * 100) / 100);
  assert.ok(ev.ebay.routes.some((r) => r.kind === 'forwarder'));
  assert.equal(ev.ebay.totalIls, Math.min(...ev.ebay.routes.map((r) => r.totalIls)));
  assert.ok(ev.ebay.best.taxes.vatIls > 0);
  // Walmart לא שולחת לישראל → רק שילוח צד ג'
  assert.ok(ev.walmart.routes.every((r) => r.kind === 'forwarder'));
  assert.ok(ev.walmart.totalIls > 261 * 3.7);
});

test('MARKETPLACES קובע אילו אתרים נבדקים; none מכבה', async () => {
  const { enabledMarketplaces } = await import('../server/providers/marketplaces.js');
  process.env.MARKETPLACES = 'ebay';
  assert.deepEqual(enabledMarketplaces(), ['ebay']);
  process.env.MARKETPLACES = 'none';
  assert.deepEqual(enabledMarketplaces(), []);
  delete process.env.MARKETPLACES;
  assert.deepEqual(enabledMarketplaces(), ['amazon', 'ebay', 'walmart']);
});
