// מטמון לתשובות של ספקים חיים – חוסך בקשות (ובמכסה החודשית של ספק המחירים).
// שתי שכבות: זיכרון (מהיר) + אחסון קבוע (קבצים מקומית, Firestore בענן) שנשמר גם אחרי הפעלה מחדש.
import { kvGet, kvSet } from './storage.js';

const mem = new Map();
const inflight = new Map();

export async function cacheGet(key, ttlMs) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const stored = await kvGet(key);
    if (stored && Date.now() - stored.at < ttlMs) { mem.set(key, stored); return stored.value; }
  } catch { /* אין במטמון / האחסון לא זמין – ממשיכים לספק */ }
  return undefined;
}

export function cacheSet(key, value) {
  const entry = { at: Date.now(), value };
  mem.set(key, entry);
  kvSet(key, entry);
}

/** מחזיר מהמטמון, או מריץ את fn פעם אחת בלבד גם אם יש כמה בקשות מקבילות לאותו מפתח. */
export async function cached(key, ttlMs, fn) {
  const v = await cacheGet(key, ttlMs);
  if (v !== undefined) return v;
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().then((value) => { cacheSet(key, value); return value; }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
