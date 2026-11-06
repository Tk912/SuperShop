// חיפוש והשלמה אוטומטית: התאמת קידומת, תת-מחרוזת ושגיאות כתיב קלות.
// עובד על כל רשימת מוצרים (דמו + נלמדים); האינדקס של כל מוצר נבנה פעם אחת ונשמר.
import { products as demoProducts } from '../data/catalog.js';
import { normalize, tokens, levenshtein } from './normalize.js';

const indexCache = new WeakMap();

function entryFor(p) {
  let e = indexCache.get(p);
  if (!e) {
    const fields = [p.name, p.brand, ...(p.aliases ?? [])].filter(Boolean);
    e = { product: p, words: [...new Set(fields.flatMap(tokens))], haystack: fields.map(normalize).join(' | ') };
    indexCache.set(p, e);
  }
  return e;
}

function tokenScore(qt, entry, isLast) {
  let best = 0;
  for (const w of entry.words) {
    if (w === qt) best = Math.max(best, 10);
    else if (w.startsWith(qt)) best = Math.max(best, isLast ? 8 : 5); // הטוקן האחרון עדיין בהקלדה
    else if (qt.length >= 3 && w.includes(qt)) best = Math.max(best, 4);
    else if (qt.length >= 4 && levenshtein(qt, w.slice(0, qt.length + 1), 1) <= 1) best = Math.max(best, 3);
  }
  return best;
}

export function scoreProduct(query, entry) {
  const qts = tokens(query);
  if (!qts.length) return 0;
  let total = 0;
  for (let i = 0; i < qts.length; i++) {
    const s = tokenScore(qts[i], entry, i === qts.length - 1);
    if (s === 0) return 0; // כל מילה בשאילתה חייבת להתאים
    total += s;
  }
  if (entry.haystack.includes(normalize(query))) total += 5; // ביטוי שלם
  if (entry.product.aliases?.length) total += 1; // מוצר קטלוג מתויג – עדיפות קלה
  return total;
}

export function searchCatalog(query, limit = 8, list = demoProducts) {
  return list
    .map((p) => ({ product: p, score: scoreProduct(query, entryFor(p)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.product);
}
