// מטמון דיסק פשוט לתשובות של ספקים חיים – חוסך בקשות (ובמכסה החודשית של SerpAPI).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = process.env.CACHE_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');
const mem = new Map();
const inflight = new Map();

const fileFor = (key) => path.join(DIR, crypto.createHash('sha1').update(key).digest('hex') + '.json');

export function cacheGet(key, ttlMs) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const { at, value } = JSON.parse(fs.readFileSync(fileFor(key), 'utf8'));
    if (Date.now() - at < ttlMs) { mem.set(key, { at, value }); return value; }
  } catch { /* אין במטמון */ }
  return undefined;
}

export function cacheSet(key, value) {
  const entry = { at: Date.now(), value };
  mem.set(key, entry);
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(fileFor(key), JSON.stringify(entry)); } catch { /* מטמון זיכרון בלבד */ }
}

/** מחזיר מהמטמון, או מריץ את fn פעם אחת בלבד גם אם יש כמה בקשות מקבילות לאותו מפתח. */
export async function cached(key, ttlMs, fn) {
  const v = cacheGet(key, ttlMs);
  if (v !== undefined) return v;
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().then((value) => { cacheSet(key, value); return value; }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
