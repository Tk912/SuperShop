// מאחד את כל הספקים הפעילים, עם טיפול בכשלים (ספק שנפל לא מפיל את החיפוש).
// כשיש ספק חי פעיל, מחירי הדוגמה כבויים – כדי לא לערבב מחירים אמיתיים עם מומצאים (FORCE_DEMO=1 מחזיר אותם).
import { demoProvider } from './demo.js';
import { serpapiProvider } from './serpapi.js';
import { ebayProvider } from './ebay.js';

export const liveProviders = [serpapiProvider, ebayProvider];

export function activeProviders() {
  const live = liveProviders.filter((p) => p.enabled());
  if (live.length && process.env.FORCE_DEMO !== '1') return live;
  return demoProvider.enabled() ? [demoProvider, ...live] : live;
}

export const isLive = () => liveProviders.some((p) => p.enabled());

export async function collectOffers(product) {
  const providers = activeProviders();
  const results = await Promise.allSettled(providers.map((p) => p.offersFor(product)));
  const offers = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') offers.push(...r.value);
    else errors.push({ provider: providers[i].id, error: String(r.reason?.message ?? r.reason) });
  });
  return { offers, errors };
}

/** חיפוש מוצרים בספקים חיים שתומכים בכך (כרגע Google Shopping). */
export async function searchLiveProducts(query) {
  const providers = liveProviders.filter((p) => p.enabled() && p.searchProducts);
  const results = await Promise.allSettled(providers.map((p) => p.searchProducts(query)));
  const products = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') products.push(...r.value);
    else errors.push({ provider: providers[i].id, error: String(r.reason?.message ?? r.reason) });
  });
  return { products, errors };
}
