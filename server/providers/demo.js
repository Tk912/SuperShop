// ספק דמו – מחזיר את מחירי הדוגמה שבקטלוג. תמיד פעיל.
import { storeById } from '../data/stores.js';

export const demoProvider = {
  id: 'demo',
  name: 'נתוני דוגמה',
  enabled: () => process.env.DISABLE_DEMO !== '1',
  async offersFor(product) {
    return (product.offers ?? []).map(([storeId, price]) => ({
      storeId, price, currency: storeById[storeId].currency, source: 'demo',
      url: `https://${storeById[storeId].domain}/search?q=${encodeURIComponent(product.name)}`,
    }));
  },
};
