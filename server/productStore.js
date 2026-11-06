// מאגר מוצרים: קטלוג הדוגמה + מוצרים "נלמדים" שהגיעו מחיפושים חיים.
// כל חיפוש חי מוסיף מוצרים למאגר, כך שההשלמה האוטומטית משתפרת בלי לבזבז בקשות API.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products as demoProducts } from './data/catalog.js';
import { doc } from './storage.js';

const FILE = process.env.LEARNED_FILE
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'learned-products.json');
const MAX_LEARNED = 5000;

const store = doc('learned-products', () => [], FILE);
const learned = new Map();
const rebuild = (arr) => { learned.clear(); for (const p of arr ?? []) learned.set(p.id, p); };
rebuild(store.value);
store.onLoad = rebuild; // במצב Firestore הנתונים נטענים אחרי ההפעלה

function persist() {
  store.value = [...learned.values()];
  store.save();
}

const demoById = new Map(demoProducts.map((p) => [p.id, p]));

export function getProduct(id) {
  return demoById.get(id) ?? learned.get(id);
}

/** מוצרי הדמו מוצגים רק כשהם פעילים; מוצרים נלמדים תמיד. */
export function allProducts({ includeDemo = true } = {}) {
  return includeDemo ? [...demoProducts, ...learned.values()] : [...learned.values()];
}

export function learnProducts(items) {
  for (const p of items) {
    const prev = learned.get(p.id);
    learned.set(p.id, { ...prev, ...p, learnedAt: Date.now() });
  }
  while (learned.size > MAX_LEARNED) learned.delete(learned.keys().next().value); // הוותיקים ביותר יוצאים
  persist();
}
