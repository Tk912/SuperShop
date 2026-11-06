// היסטוריית מחירים: המחיר הסופי הנמוך ביותר (עד הבית) לכל מוצר, פעם ביום.
// נרשם בכל פעם שמישהו צופה בהשוואה – כך ההיסטוריה נבנית מעצמה. נתוני דוגמה לא נרשמים.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doc } from './storage.js';

const FILE = process.env.HISTORY_FILE
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'price-history.json');
const MAX_DAYS = 365;

const store = doc('price-history', () => ({}), FILE);
const persist = () => store.save();

const day = (d = new Date()) => d.toISOString().slice(0, 10);

/** רושם את המחיר הזול של היום. אם כבר נרשם מחיר זול יותר היום – נשאר הזול. */
export function recordPrice(productId, totalIls, storeName, now = new Date()) {
  if (totalIls == null) return;
  const points = (store.value[productId] ??= []);
  const d = day(now);
  const last = points.at(-1);
  if (last?.d === d) {
    if (totalIls < last.p) Object.assign(last, { p: Math.round(totalIls), s: storeName });
  } else {
    points.push({ d, p: Math.round(totalIls), s: storeName });
    if (points.length > MAX_DAYS) points.splice(0, points.length - MAX_DAYS);
  }
  persist();
}

export function getHistory(productId, days = 90, now = new Date()) {
  const since = day(new Date(now.getTime() - days * 86400000));
  const points = (store.value[productId] ?? []).filter((x) => x.d >= since);
  if (!points.length) return { points: [], lowest: null, highest: null, days };
  const lowest = points.reduce((a, b) => (b.p < a.p ? b : a));
  const highest = points.reduce((a, b) => (b.p > a.p ? b : a));
  return { points, lowest, highest, days };
}
