// מאחד את כל הספקים הפעילים, עם timeout, cache וטיפול בכשלים (ספק שנפל לא מפיל את החיפוש).
import { demoProvider } from './demo.js';
import { serpapiProvider } from './serpapi.js';
import { ebayProvider } from './ebay.js';

export const allProviders = [demoProvider, serpapiProvider, ebayProvider];
const cache = new Map();
const TTL = 15 * 60 * 1000;

export function activeProviders() {
  return allProviders.filter((p) => p.enabled());
}

export async function collectOffers(product) {
  const key = product.id;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const results = await Promise.allSettled(activeProviders().map((p) => p.offersFor(product)));
  const offers = [];
  const errors = [];
  results.forEach((r, i) => {
    const p = activeProviders()[i];
    if (r.status === 'fulfilled') offers.push(...r.value);
    else errors.push({ provider: p.id, error: String(r.reason?.message ?? r.reason) });
  });
  const value = { offers, errors };
  if (!errors.length) cache.set(key, { at: Date.now(), value });
  return value;
}
