// מרכז ההטבות: כל ההטבות על מוצרים מכל המועדונים, במקום אחד.
//
// מקורות:
//  • שיתוף מחברים: חבר שמחבר את החשבון שלו במועדון ומייבא הטבות, משתף אותן (חנות + הנחה בלבד) עם כולם.
//  • המאגר המנוהל (deals.json): הטבות מאומתות של מועדונים וקופונים.
// כל הטבה עוברת סינון "מוצרים פיזיים בלבד" (hubClassify.js) – אטרקציות, מסעדות, נופש ושירותים לא נכנסים.
//
// פרטיות: מהטבה משותפת נשמרים רק כותרת, טקסט קצר, הנחה, קישור ותמונה. מהקישורים מוסרים פרמטרים
// (עלולים להכיל מזהה משתמש), וטקסט שנראה כמו מידע אישי (ת״ז, טלפון, אימייל) נדחה.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doc } from './storage.js';
import { CATEGORIES, classify, discountOf } from './hubClassify.js';
import { getClubs, getCoupons, isLiveDeal } from './deals.js';
import { stores } from './data/stores.js';

const FILE = process.env.HUB_FILE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'hub.json');
const MAX_ITEMS = 5000;
const STALE_DAYS = 45; // הטבה שאף חבר לא ראה 45 יום – יורדת מהמרכז
const store = doc('hub', () => ({ items: [] }), FILE);
const H = () => { store.value.items ??= []; return store.value; };

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f‎‏]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const day = (d = new Date()) => d.toISOString().slice(0, 10);

const PERSONAL = [
  /\b\d{9}\b/, // ת״ז
  /\b0\d{1,2}-?\d{7}\b/, // טלפון
  /[\w.+-]+@[\w-]+\.[\w.]+/, // אימייל
  /(שלום|היי|ברוך הבא|ברוכה הבאה)\s+[֐-׿]+/, // ברכה אישית עם שם
  /\b(?:\d[ -]?){12,19}\b/, // מספר כרטיס
];
const looksPersonal = (s) => PERSONAL.some((r) => r.test(s));

/** קישור https בלי פרמטרים ובלי # (עלולים להכיל טוקן או מזהה משתמש). */
export function safeUrl(u) {
  try {
    const url = new URL(String(u ?? ''));
    if (url.protocol !== 'https:') return null;
    return `${url.origin}${url.pathname}`.slice(0, 400);
  } catch { return null; }
}

/** בודק ומנקה פריט ששותף. מחזיר null אם הוא לא עומד בכללים. */
export function prepareShared(clubId, raw) {
  const title = clean(raw?.title, 80);
  const text = clean(raw?.text, 300);
  if (text.length < 6 && title.length < 6) return { rejected: 'empty' };
  if (looksPersonal(`${title} ${text}`)) return { rejected: 'personal' };
  const c = classify({ title, text });
  if (!c.ok) return { rejected: c.reason };
  const d = discountOf(`${title} ${text}`);
  const store = c.brand ?? title;
  const key = sha(`${clubId}|${store}|${d.label}|${text.toLowerCase().slice(0, 120)}`);
  return {
    item: {
      id: `sh-${key}`, kind: 'shared', clubId, store, title, text, category: c.category, region: c.region,
      discount: d.label, percent: d.percent, minSpend: d.minSpend,
      link: safeUrl(raw?.link), image: safeUrl(raw?.image),
    },
  };
}

/**
 * שיתוף הטבות מחשבון מועדון. מחזיר כמה נוספו/עודכנו וכמה נדחו (ולמה).
 * reporter = מזהה אנונימי (גיבוב IP) – לספירת "כמה חברים ראו את ההטבה", לא נשמר כמו שהוא.
 */
export function shareDeals(clubId, items, reporter = 'anon') {
  if (!getClubs().some((c) => c.id === clubId)) throw Object.assign(new Error('unknown club'), { status: 404 });
  if (!Array.isArray(items)) throw Object.assign(new Error('items must be an array'), { status: 400 });
  const db = H();
  const byId = new Map(db.items.map((i) => [i.id, i]));
  const rep = sha(`${reporter}|hub`);
  const now = new Date().toISOString();
  // outcomes: תוצאה לכל פריט, באותו סדר – כדי שהאפליקציה תראה למשתמש מה נכנס למרכז ומה לא (ולמה)
  const result = { added: 0, updated: 0, rejected: {}, outcomes: [] };
  for (const raw of items.slice(0, 300)) {
    const { item, rejected } = prepareShared(clubId, raw);
    if (rejected) { result.rejected[rejected] = (result.rejected[rejected] ?? 0) + 1; result.outcomes.push({ ok: false, reason: rejected }); continue; }
    result.outcomes.push({ ok: true, category: item.category, store: item.store });
    const prev = byId.get(item.id);
    if (prev) {
      if (prev.hidden) continue;
      prev.lastSeen = now;
      if (!prev.reporters.includes(rep)) prev.reporters = [...prev.reporters, rep].slice(-50);
      prev.link ??= item.link; prev.image ??= item.image;
      result.updated++;
    } else {
      const fresh = { ...item, firstSeen: now, lastSeen: now, reporters: [rep] };
      db.items.unshift(fresh);
      byId.set(fresh.id, fresh);
      result.added++;
    }
  }
  const cutoff = Date.now() - STALE_DAYS * 864e5;
  db.items = db.items.filter((i) => i.hidden || new Date(i.lastSeen).getTime() >= cutoff).slice(0, MAX_ITEMS);
  store.save();
  return result;
}

/** הסתרה ידנית (ניהול) – למשל הטבה שהסיווג פספס. נשארת ברשימה כדי ששיתוף חוזר לא יחזיר אותה. */
export function hideShared(id, hidden = true) {
  const it = H().items.find((i) => i.id === id);
  if (!it) throw Object.assign(new Error('not found'), { status: 404 });
  it.hidden = hidden;
  store.save();
  return it;
}

export const sharedItems = () => H().items;

// הטבות מהמאגר המנוהל: כללי מועדונים וקופונים, לפי המסנן הנוכחי (במחירים אמיתיים – מאומתות בלבד)
function curatedItems(filter) {
  const storeOf = (id) => stores.find((s) => s.id === id);
  const out = [];
  for (const club of getClubs()) {
    for (const r of club.rules.filter(filter)) {
      const s = storeOf(r.storeId);
      if (!s) continue;
      const c = classify({ title: s.name, text: [s.name, ...(s.aliases ?? [])].join(' ') });
      out.push({
        id: r.id, kind: 'curated', clubId: club.id, store: s.name, title: s.name,
        text: [r.note, r.minSpend ? `בקנייה מעל ₪${r.minSpend}` : null, r.stackableWithCoupon ? 'משתלב עם קופון' : null].filter(Boolean).join(' · '),
        category: c.ok ? c.category : 'electronics', region: s.type === 'intl' ? 'intl' : 'il',
        discount: r.type === 'percent' ? `${r.value}%` : `₪${r.value}`, percent: r.type === 'percent' ? r.value : null,
        minSpend: r.minSpend ?? null, link: r.source ?? (s.domain ? `https://${s.domain}` : null), image: null,
        status: r.status, expires: r.expires ?? null, verifiedAt: r.verifiedAt ?? null,
      });
    }
  }
  for (const cp of getCoupons().filter(filter)) {
    const s = storeOf(cp.storeId);
    if (!s) continue;
    out.push({
      id: cp.id, kind: 'coupon', clubId: null, store: s.name, title: `קופון ${cp.code}`,
      text: [cp.note, cp.minSpend ? `בקנייה מעל ₪${cp.minSpend}` : null].filter(Boolean).join(' · '),
      category: classify({ title: s.name }).category ?? 'general', region: s.type === 'intl' ? 'intl' : 'il',
      discount: cp.type === 'percent' ? `${cp.value}%` : `₪${cp.value}`, percent: cp.type === 'percent' ? cp.value : null,
      minSpend: cp.minSpend ?? null, code: cp.code, link: cp.source ?? `https://${s.domain}`, image: null,
      status: cp.status, expires: cp.expires ?? null, verifiedAt: cp.verifiedAt ?? null,
    });
  }
  return out;
}

/**
 * הפיד של מרכז ההטבות.
 * @param q { clubs?: string[], category?, region?: 'il'|'intl', q?: string, limit?, offset? }
 */
export function hubFeed({ clubs = [], category, region, q, limit = 50, offset = 0 } = {}, filter = isLiveDeal) {
  const clubNames = new Map(getClubs().map((c) => [c.id, c.name]));
  const shared = H().items.filter((i) => !i.hidden).map(({ reporters, hidden: _h, ...i }) => ({ ...i, seenBy: reporters.length }));
  let all = [...curatedItems(filter), ...shared];
  const facets = (list) => ({
    categories: Object.entries(CATEGORIES).map(([id, name]) => ({ id, name, count: list.filter((i) => i.category === id).length })).filter((c) => c.count),
    clubs: [...clubNames].map(([id, name]) => ({ id, name, count: list.filter((i) => i.clubId === id).length })).filter((c) => c.count),
    regions: { il: list.filter((i) => i.region === 'il').length, intl: list.filter((i) => i.region === 'intl').length },
  });
  const facetBase = all;
  if (clubs.length) all = all.filter((i) => !i.clubId || clubs.includes(i.clubId));
  if (category) all = all.filter((i) => i.category === category);
  if (region) all = all.filter((i) => i.region === region);
  const term = clean(q, 60).toLowerCase();
  if (term) all = all.filter((i) => `${i.store} ${i.title} ${i.text}`.toLowerCase().includes(term));
  // הכי שימושי קודם: אחוז הנחה גבוה, הטבות שיותר חברים ראו, ואז הכי עדכני
  all.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || (b.seenBy ?? 1) - (a.seenBy ?? 1) || String(b.lastSeen ?? '').localeCompare(String(a.lastSeen ?? '')));
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const o = Math.max(Number(offset) || 0, 0);
  return {
    total: all.length,
    items: all.slice(o, o + n).map((i) => ({ ...i, clubName: i.clubId ? clubNames.get(i.clubId) ?? i.clubId : null })),
    ...facets(facetBase),
    updatedAt: day(),
  };
}
