// Google Shopping דרך SerpAPI – מחירים אמיתיים מחנויות בישראל ובעולם (gl=il).
//
// שני שלבים, לפי מבנה התשובות המתועד של SerpAPI:
//  1. engine=google_shopping → רשימת מוצרים (כותרת, תמונה, page token). המוצרים נשמרים במאגר "נלמד".
//  2. engine=google_immersive_product → כל החנויות שמוכרות את המוצר: מחיר, משלוח וקישור ישיר.
// כל תשובה נשמרת במטמון דיסק, כדי לא לבזבז את המכסה החודשית.
//
// הפעלה: SERPAPI_KEY=<מפתח>. ל-SerpAPI המפתח עובר כפרמטר api_key בכתובת (אין תמיכה בכותרת).
// מצב הקלטה: SERPAPI_FIXTURE_DIR=<תיקייה> – קורא תשובות שמורות במקום לפנות לרשת (לבדיקות ולדמו).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cached } from '../cache.js';
import { resolveStore } from '../storeRegistry.js';
import { guessCategory, typicalShipping } from '../guess.js';

const SEARCH_TTL = 12 * 60 * 60 * 1000;
const OFFERS_TTL = 6 * 60 * 60 * 1000;

const SYMBOLS = [['₪', 'ILS'], ['ש"ח', 'ILS'], ['ש״ח', 'ILS'], ['ILS', 'ILS'], ['US$', 'USD'], ['$', 'USD'], ['€', 'EUR'], ['£', 'GBP']];

/** מזהה מטבע ממחרוזת מחיר כמו "₪1,449", "1,449.00 ₪" או "$2,199.99". */
export function currencyOf(priceStr, fallback = 'ILS') {
  const s = String(priceStr ?? '');
  for (const [sym, cur] of SYMBOLS) if (s.includes(sym)) return cur;
  return fallback;
}

async function serpFetch(params, { fetchImpl = fetch } = {}) {
  const fixtures = process.env.SERPAPI_FIXTURE_DIR;
  if (fixtures) {
    const file = path.join(fixtures, `${params.engine}.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const u = new URL('https://serpapi.com/search.json');
  u.search = new URLSearchParams({ ...params, api_key: process.env.SERPAPI_KEY });
  const res = await fetchImpl(u, { signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`serpapi: ${json.error ?? res.status}`);
  return json;
}

const idFor = (r) => 'g:' + (r.product_id ?? crypto.createHash('sha1').update(r.title).digest('hex').slice(0, 16));

/** ממיר תוצאת google_shopping למוצר במאגר. */
export function toProduct(r) {
  const category = guessCategory(r.title);
  return {
    id: idFor(r), name: r.title, brand: r.title.split(/\s+/)[0], category,
    ...typicalShipping(category), weightEstimated: true,
    image: r.thumbnail ?? r.serpapi_thumbnail, pageToken: r.immersive_product_page_token,
    rating: r.rating, reviews: r.reviews, source: 'serpapi',
    fromPrice: r.extracted_price, fromCurrency: currencyOf(r.price), fromStore: r.source,
  };
}

/** ממיר חנות מ-google_immersive_product להצעה שמנוע העלות יודע לחשב. */
export function toOffer(s) {
  const currency = currencyOf(s.price);
  const store = resolveStore({ name: s.name, url: s.link, currency });
  const details = (s.details_and_offers ?? []).join(' ');
  const freeShip = /free delivery|free shipping|משלוח חינם/i.test(details);
  const shipCost = s.shipping_extracted ?? (freeShip ? 0 : undefined);
  return {
    storeId: store.id, price: s.extracted_price, currency, url: s.link, title: s.title, source: 'serpapi',
    inStock: !/out of stock|אזל/i.test(details), details: s.details_and_offers ?? [],
    ...(shipCost != null ? { directShipping: [{ name: 'משלוח (לפי החנות)', cost: shipCost, days: '?' }] } : {}),
  };
}

export const serpapiProvider = {
  id: 'serpapi',
  name: 'Google Shopping',
  live: true,
  enabled: () => !!(process.env.SERPAPI_KEY || process.env.SERPAPI_FIXTURE_DIR),

  /** חיפוש מוצרים חי. מחזיר מוצרים (לא הצעות). */
  async searchProducts(query, opts) {
    const q = query.trim().toLowerCase();
    return cached(`serp:shop:${q}`, SEARCH_TTL, async () => {
      const json = await serpFetch({ engine: 'google_shopping', q, gl: 'il', hl: 'iw', location: 'Israel' }, opts);
      const seen = new Set();
      return (json.shopping_results ?? [])
        .filter((r) => r.title && r.extracted_price != null)
        .map(toProduct)
        .filter((p) => !seen.has(p.id) && seen.add(p.id));
    });
  },

  /** כל החנויות שמוכרות מוצר. למוצר בלי page token (מוצר קטלוג) – מחפשים אותו קודם. */
  async offersFor(product, opts) {
    let token = product.pageToken;
    if (!token) {
      const found = await this.searchProducts(product.name, opts);
      token = found.find((p) => p.pageToken)?.pageToken;
      if (!token) return [];
    }
    return cached(`serp:offers:${token}`, OFFERS_TTL, async () => {
      const json = await serpFetch({ engine: 'google_immersive_product', page_token: token, gl: 'il', hl: 'iw' }, opts);
      return (json.product_results?.stores ?? []).filter((s) => s.extracted_price != null && s.link).map(toOffer);
    });
  },
};
