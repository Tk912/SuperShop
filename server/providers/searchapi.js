// Google Shopping דרך SearchApi.io – מחירים אמיתיים מחנויות בישראל ובעולם (gl=il).
//
// שני שלבים (לפי תשובות אמיתיות שנבדקו ב-6.11.2026):
//  1. engine=google_shopping → shopping_results: כותרת, תמונה, מחיר, seller, product_token.
//  2. engine=google_product + product_token → offers: חנות (merchant.name), קישור ישיר, מחיר, דמי משלוח, מלאי.
//
// הפעלה: SEARCHAPI_KEY=<מפתח>. המפתח נשלח בכותרת Authorization: Bearer (נתמך רשמית).
// מצב הקלטה: SEARCHAPI_FIXTURE_DIR=<תיקייה> – קורא תשובות שמורות במקום לפנות לרשת.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cached } from '../cache.js';
import { resolveStore } from '../storeRegistry.js';
import { guessCategory, typicalShipping } from '../guess.js';
import { currencyOf, shippingLabel } from './serpapi.js';

const SEARCH_TTL = 12 * 60 * 60 * 1000;
const OFFERS_TTL = 6 * 60 * 60 * 1000;
const isGoogleLink = (u) => /^https?:\/\/(www\.)?google\./.test(u ?? '');

async function apiFetch(params, { fetchImpl = fetch } = {}) {
  const fixtures = process.env.SEARCHAPI_FIXTURE_DIR;
  if (fixtures) return JSON.parse(fs.readFileSync(path.join(fixtures, `${params.engine}.json`), 'utf8'));
  const u = new URL('https://www.searchapi.io/api/v1/search');
  u.search = new URLSearchParams(params);
  const res = await fetchImpl(u, {
    headers: { Authorization: `Bearer ${process.env.SEARCHAPI_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`searchapi: ${json.error ?? res.status}`);
  return json;
}

const idFor = (r) => 'sa:' + (r.product_id ?? r.prds ?? crypto.createHash('sha1').update(r.title).digest('hex').slice(0, 16));

export function toProduct(r) {
  const category = guessCategory(r.title);
  return {
    id: idFor(r), name: r.title, brand: r.title.match(/[A-Za-z][\w&'-]+/)?.[0] ?? r.title.split(/\s+/)[0], category,
    ...typicalShipping(category), weightEstimated: true,
    image: r.thumbnail, productToken: r.product_token, rating: r.rating, reviews: r.reviews, source: 'searchapi',
    fromPrice: r.extracted_price, fromCurrency: currencyOf(r.price), fromStore: r.seller,
    // ההצעה של תוצאת החיפוש עצמה – גיבוי אם דף המוצר לא מחזיר הצעות
    seedOffer: { seller: r.seller, price: r.extracted_price, currency: currencyOf(r.price) },
  };
}

/** הצעה מ-google_product → פורמט ההצעה של מנוע העלות. */
export function toOffer(o) {
  const currency = currencyOf(o.price);
  const name = o.merchant?.name ?? o.seller ?? o.source;
  const store = resolveStore({ name, url: isGoogleLink(o.link) ? undefined : o.link, currency });
  const details = (o.details ?? []).join(' ');
  const freeShip = /משלוח חינם|free delivery|free shipping/i.test(details);
  const shipCost = o.extracted_delivery_price ?? (freeShip ? 0 : undefined);
  return {
    storeId: store.id, storeHint: { name, url: isGoogleLink(o.link) ? undefined : o.link, currency },
    price: o.extracted_price, currency, url: o.link, title: o.title, source: 'searchapi',
    inStock: !/אזל|לא במלאי|out of stock/i.test(details), details: o.details ?? [], tag: o.tag,
    ...(shipCost != null ? { directShipping: [{ name: shippingLabel(o.details), cost: shipCost, days: '?' }] } : {}),
  };
}

export const searchapiProvider = {
  id: 'searchapi',
  name: 'Google Shopping',
  live: true,
  enabled: () => !!(process.env.SEARCHAPI_KEY || process.env.SEARCHAPI_FIXTURE_DIR),

  async searchProducts(query, opts) {
    const q = query.trim().toLowerCase();
    return cached(`sa:shop:${q}`, SEARCH_TTL, async () => {
      const json = await apiFetch({ engine: 'google_shopping', q, gl: 'il', hl: 'iw', location: 'Israel' }, opts);
      const seen = new Set();
      return (json.shopping_results ?? [])
        .filter((r) => r.title && r.extracted_price != null && r.product_token)
        .map(toProduct)
        .filter((p) => !seen.has(p.id) && seen.add(p.id));
    });
  },

  async offersFor(product, opts) {
    // מוצר קטלוג (בלי token) → מחפשים אותו, ומעדיפים תוצאה עם כמה מוכרים (product_id)
    let target = product;
    if (!product.productToken) {
      const found = await this.searchProducts(product.name, opts);
      target = found.find((p) => p.id.startsWith('sa:') && /^\d+$/.test(p.id.slice(3)) && p.productToken) ?? found[0];
      if (!target) return [];
    }
    return cached(`sa:offers:v2:${target.id}`, OFFERS_TTL, async () => {
      const json = await apiFetch({ engine: 'google_product', product_token: target.productToken, gl: 'il', hl: 'iw' }, opts);
      const offers = (json.offers ?? []).filter((o) => o.extracted_price != null && o.link).map(toOffer);
      if (offers.length || !target.seedOffer) return offers;
      // אין הצעות בדף המוצר – מציגים לפחות את המוכר מתוצאת החיפוש
      const s = target.seedOffer;
      const store = resolveStore({ name: s.seller, currency: s.currency });
      return [{ storeId: store.id, storeHint: { name: s.seller, currency: s.currency }, price: s.price, currency: s.currency, url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(target.name)}`,
        title: target.name, source: 'searchapi', inStock: true, details: [] }];
    });
  },
};
