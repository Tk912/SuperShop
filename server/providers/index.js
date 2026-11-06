// מאחד את כל הספקים הפעילים, עם טיפול בכשלים (ספק שנפל לא מפיל את החיפוש).
// כשיש ספק חי פעיל, מחירי הדוגמה כבויים – כדי לא לערבב מחירים אמיתיים עם מומצאים (FORCE_DEMO=1 מחזיר אותם).
import { demoProvider } from './demo.js';
import { serpapiProvider } from './serpapi.js';
import { searchapiProvider } from './searchapi.js';
import { ebayProvider } from './ebay.js';
import { marketplacesProvider, enabledMarketplaces } from './marketplaces.js';
import { toIls, getRates } from '../pricing/fx.js';

// SearchApi ו-SerpAPI מחזירים את אותם נתוני Google Shopping – פועל רק אחד מהם (SearchApi עדיף, אם הוגדר).
// גם eBay: אם הוא נבדק דרך אתרי המסחר (SearchApi), ה-API הישיר של eBay לא רץ בנוסף.
export const liveProviders = [searchapiProvider, serpapiProvider, ebayProvider, marketplacesProvider];
const isDuplicate = (p) => (p === serpapiProvider && searchapiProvider.enabled())
  || (p === ebayProvider && marketplacesProvider.enabled() && enabledMarketplaces().includes('ebay'));

export function activeProviders() {
  const live = liveProviders.filter((p) => p.enabled() && !isDuplicate(p));
  if (live.length && process.env.FORCE_DEMO !== '1') return live;
  return demoProvider.enabled() ? [demoProvider, ...live] : live;
}

export const isLive = () => liveProviders.some((p) => p.enabled());

/**
 * שני שלבים: קודם החנויות (Google Shopping וכו'), ואז אתרי המסחר (phase 2) – עם המחיר הזול שנמצא
 * כמחיר ייחוס, כדי לסנן אצלם מחירים חשודים ומוצרים לא נכונים.
 */
export async function collectOffers(product) {
  const providers = activeProviders();
  const offers = [];
  const errors = [];
  const run = async (list, context) => {
    const results = await Promise.allSettled(list.map((p) => p.offersFor(product, context)));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') offers.push(...r.value);
      else errors.push({ provider: list[i].id, error: String(r.reason?.message ?? r.reason) });
    });
  };
  await run(providers.filter((p) => p.phase !== 2));
  const second = providers.filter((p) => p.phase === 2);
  if (second.length) {
    const { rates } = getRates();
    const prices = offers.filter((o) => o.inStock !== false && o.price > 0).map((o) => toIls(o.price, o.currency ?? 'ILS', rates));
    await run(second, { referenceIls: prices.length ? Math.min(...prices) : null, rates });
  }
  return { offers, errors };
}

/** חיפוש מוצרים בספקים חיים שתומכים בכך (כרגע Google Shopping). */
export async function searchLiveProducts(query) {
  const providers = liveProviders.filter((p) => p.enabled() && !isDuplicate(p) && p.searchProducts);
  const results = await Promise.allSettled(providers.map((p) => p.searchProducts(query)));
  const products = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') products.push(...r.value);
    else errors.push({ provider: providers[i].id, error: String(r.reason?.message ?? r.reason) });
  });
  return { products, errors };
}
