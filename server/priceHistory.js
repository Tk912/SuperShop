// היסטוריית מחירים: המחיר הסופי הנמוך ביותר (עד הבית) לכל מוצר, פעם ביום.
// נרשם בכל פעם שמישהו צופה בהשוואה – כך ההיסטוריה נבנית מעצמה. נתוני דוגמה לא נרשמים.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = process.env.HISTORY_FILE
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'price-history.json');
const MAX_DAYS = 365;

let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* אין עדיין היסטוריה */ }

let timer;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch { /* זיכרון בלבד */ }
  }, 200);
  timer.unref?.();
}

const day = (d = new Date()) => d.toISOString().slice(0, 10);

/** רושם את המחיר הזול של היום. אם כבר נרשם מחיר זול יותר היום – נשאר הזול. */
export function recordPrice(productId, totalIls, storeName, now = new Date()) {
  if (totalIls == null) return;
  const points = (db[productId] ??= []);
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
  const points = (db[productId] ?? []).filter((x) => x.d >= since);
  if (!points.length) return { points: [], lowest: null, highest: null, days };
  const lowest = points.reduce((a, b) => (b.p < a.p ? b : a));
  const highest = points.reduce((a, b) => (b.p > a.p ? b : a));
  return { points, lowest, highest, days };
}
