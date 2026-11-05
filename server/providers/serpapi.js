// Google Shopping דרך SerpAPI – הכיסוי הרחב ביותר לחנויות ישראליות ובינלאומיות.
// הפעלה: SERPAPI_KEY=... (https://serpapi.com). gl=il מחזיר מחירים לישראל.
import { resolveStore } from '../storeRegistry.js';

const CUR = { '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP' };

export const serpapiProvider = {
  id: 'serpapi',
  name: 'Google Shopping',
  enabled: () => !!process.env.SERPAPI_KEY,

  async offersFor(product, { fetchImpl = fetch } = {}) {
    return this.search(product.name, { fetchImpl });
  },

  async search(query, { fetchImpl = fetch } = {}) {
    const u = new URL('https://serpapi.com/search.json');
    u.search = new URLSearchParams({ engine: 'google_shopping', q: query, gl: 'il', hl: 'iw', api_key: process.env.SERPAPI_KEY });
    const res = await fetchImpl(u, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`serpapi ${res.status}`);
    const json = await res.json();
    return (json.shopping_results ?? [])
      .filter((r) => r.extracted_price)
      .map((r) => {
        const currency = CUR[(r.price ?? '').trim()[0]] ?? 'ILS';
        const store = resolveStore({ name: r.source, url: r.product_link ?? r.link, currency });
        return { storeId: store.id, price: r.extracted_price, currency, url: r.product_link ?? r.link,
          title: r.title, thumbnail: r.thumbnail, source: 'serpapi' };
      });
  },
};
