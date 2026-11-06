// מאגר ההנחות: מועדונים וקופונים, עם סטטוס אימות ומקור לכל הנחה.
//   status: 'sample' (לדוגמה) | 'pending' (ממתין לאימות) | 'verified' (מאומת)
// על מחירים אמיתיים חלות רק הנחות מאומתות שלא פג תוקפן. העריכה נעשית בדף הניהול (/admin.html).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doc, storageKind } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(here, 'data', 'deals.json');
const FILE = process.env.DEALS_FILE ?? SEED;
const STATUSES = ['sample', 'pending', 'verified'];

// בפעם הראשונה (אין עדיין נתונים באחסון) מתחילים מהזרע שבקוד
const store = doc('deals', () => JSON.parse(fs.readFileSync(SEED, 'utf8')), FILE);
const D = () => { store.value.reports ??= {}; return store.value; }; // id → מספר דיווחים "לא עבד" מאז האימות האחרון

// במצב קבצים לא דורסים את קובץ הזרע שבקוד, אלא אם ביקשו במפורש
const writable = () => storageKind() !== 'file' || FILE !== SEED || process.env.DEALS_WRITE_SEED === '1';
function persist() {
  if (writable()) store.save();
}

export const getClubs = () => D().clubs;
export const getCoupons = () => D().coupons;
export const getDeals = () => D();

const today = () => new Date().toISOString().slice(0, 10);
export const isLiveDeal = (d, now = today()) => d.status === 'verified' && (!d.expires || d.expires >= now);

/** אילו הנחות מותר להפעיל: הכול (דמו), או רק מאומתות ובתוקף (מחירים אמיתיים). */
export function dealFilter({ live, includeSamples = false }) {
  if (!live || includeSamples) return () => true;
  return (d) => isLiveDeal(d);
}

export const hasLiveDeals = () => D().clubs.some((c) => c.rules.some((r) => isLiveDeal(r))) || D().coupons.some((c) => isLiveDeal(c));

function validate(next) {
  const errors = [];
  const ids = new Set();
  const checkCommon = (d, where) => {
    if (!d.id) errors.push(`${where}: חסר id`);
    else if (ids.has(d.id)) errors.push(`${where}: id כפול ${d.id}`);
    ids.add(d.id);
    if (!STATUSES.includes(d.status)) errors.push(`${where}: סטטוס לא חוקי`);
    if (!['percent', 'fixed'].includes(d.type)) errors.push(`${where}: type חייב להיות percent או fixed`);
    if (!(Number(d.value) > 0)) errors.push(`${where}: ערך הנחה חייב להיות חיובי`);
    if (d.type === 'percent' && Number(d.value) > 90) errors.push(`${where}: הנחה של מעל 90%?`);
    if (d.status === 'verified' && !d.source) errors.push(`${where}: הנחה מאומתת חייבת מקור (קישור)`);
    if (d.expires && !/^\d{4}-\d{2}-\d{2}$/.test(d.expires)) errors.push(`${where}: תאריך תפוגה בפורמט YYYY-MM-DD`);
  };
  if (!Array.isArray(next?.clubs) || !Array.isArray(next?.coupons)) return ['מבנה לא תקין'];
  next.clubs.forEach((c) => {
    if (!c.id || !c.name) errors.push('מועדון בלי id או שם');
    (c.sources ?? []).forEach((s) => { if (!/^https:\/\//.test(s.url ?? '')) errors.push(`${c.name}: קישור מקור חייב להתחיל ב-https://`); });
    (c.rules ?? []).forEach((r, i) => checkCommon(r, `${c.name} #${i + 1}`));
  });
  next.coupons.forEach((c, i) => {
    checkCommon(c, `קופון ${c.code ?? i + 1}`);
    if (!c.code) errors.push(`קופון #${i + 1}: חסר קוד`);
  });
  return errors;
}

/** שומר את כל המאגר אחרי בדיקת תקינות. הנחה שאומתה עכשיו מקבלת תאריך אימות ומאפסת דיווחים. */
export function saveDeals(next) {
  const errors = validate(next);
  if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 400 });
  const db = D();
  const prev = new Map([...db.clubs.flatMap((c) => c.rules), ...db.coupons].map((d) => [d.id, d]));
  for (const d of [...next.clubs.flatMap((c) => c.rules), ...next.coupons]) {
    if (d.status === 'verified' && (prev.get(d.id)?.status !== 'verified' || !d.verifiedAt)) {
      d.verifiedAt = today();
      delete db.reports[d.id];
    }
  }
  store.value = { _note: db._note, clubs: next.clubs, coupons: next.coupons, reports: db.reports };
  persist();
  return store.value;
}

/** דיווח משתמש: "ההנחה/הקופון לא עבדו". נספר לפי id ומוצג בדף הניהול. */
export function reportDeal(id) {
  const db = D();
  const exists = [...db.clubs.flatMap((c) => c.rules), ...db.coupons].some((d) => d.id === id);
  if (!exists) throw Object.assign(new Error('unknown deal'), { status: 404 });
  db.reports[id] = (db.reports[id] ?? 0) + 1;
  persist();
  return db.reports[id];
}
