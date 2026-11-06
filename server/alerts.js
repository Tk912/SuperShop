// התראות מחיר: רשימת מעקב לכל מכשיר + בדיקה תקופתית + שליחת push דרך שירות ההתראות של Expo.
//
// מתי נשלחת התראה (לכל מוצר במעקב):
//  • יש מחיר יעד, והמחיר הזול עד הבית ירד אליו או מתחתיו.
//  • אין מחיר יעד, והמחיר ירד לפחות DROP_PCT מהמחיר בזמן השמירה.
//  ובשני המקרים – רק אם המחיר נמוך מזה שכבר דווח (בלי הצפה של התראות על אותו מחיר).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProduct } from './productStore.js';
import { compareProduct } from './compare.js';

const FILE = process.env.WATCHES_FILE
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'watches.json');
const DROP_PCT = Number(process.env.ALERT_DROP_PCT ?? 3) / 100;
const PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_WATCHES_PER_DEVICE = 100;

let watches = [];
try { watches = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* אין עדיין */ }
const persist = () => {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(watches)); } catch { /* זיכרון בלבד */ }
};

export const isPushToken = (t) => /^Expo(nent)?PushToken\[[\w-]+\]$/.test(String(t ?? ''));

export function listWatches(pushToken) {
  return watches.filter((w) => w.pushToken === pushToken);
}

export function upsertWatch({ pushToken, productId, targetIls, baselineIls }) {
  if (!isPushToken(pushToken)) throw Object.assign(new Error('invalid push token'), { status: 400 });
  const product = getProduct(productId);
  if (!product) throw Object.assign(new Error('unknown product'), { status: 404 });
  let w = watches.find((x) => x.pushToken === pushToken && x.productId === productId);
  if (!w) {
    if (listWatches(pushToken).length >= MAX_WATCHES_PER_DEVICE) throw Object.assign(new Error('too many watches'), { status: 429 });
    w = { pushToken, productId, createdAt: Date.now(), lastNotifiedIls: null };
    watches.push(w);
  }
  Object.assign(w, {
    productName: product.name,
    targetIls: Number(targetIls) > 0 ? Number(targetIls) : null,
    baselineIls: Number(baselineIls) > 0 ? Number(baselineIls) : (w.baselineIls ?? null),
  });
  persist();
  return w;
}

export function removeWatch(pushToken, productId) {
  const before = watches.length;
  watches = watches.filter((w) => !(w.pushToken === pushToken && (productId == null || w.productId === productId)));
  persist();
  return before - watches.length;
}

/** האם לשלוח התראה, ואיזו. פונקציה טהורה – נבדקת בנפרד. */
export function decideAlert(w, bestIls) {
  if (bestIls == null) return null;
  const floor = w.lastNotifiedIls ?? Infinity; // מדווחים רק על מחיר חדש ונמוך יותר
  if (bestIls >= floor) return null;
  if (w.targetIls != null) return bestIls <= w.targetIls ? { kind: 'target' } : null;
  if (w.baselineIls != null && bestIls <= w.baselineIls * (1 - DROP_PCT)) return { kind: 'drop', diff: w.baselineIls - bestIls };
  return null;
}

const ils = (n) => '₪' + Math.round(n).toLocaleString('he-IL');

export function alertMessage(w, best, decision) {
  const title = decision.kind === 'target' ? '🎯 הגיע למחיר היעד!' : `▼ המחיר ירד ב-${ils(decision.diff)}`;
  return {
    to: w.pushToken, sound: 'default', title,
    body: `${w.productName}: ${ils(best.totalIls)} עד הבית ב-${best.storeName}`,
    data: { productId: w.productId, url: `supershop://product/${encodeURIComponent(w.productId)}` },
  };
}

export async function sendPush(messages, { fetchImpl = fetch } = {}) {
  const tickets = [];
  for (let i = 0; i < messages.length; i += 100) { // מגבלת Expo: עד 100 הודעות לבקשה
    const res = await fetchImpl(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(messages.slice(i, i + 100)),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`expo push ${res.status}`);
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

/**
 * בודק את כל המוצרים במעקב (פעם אחת לכל מוצר, גם אם עוקבים אחריו כמה מכשירים) ושולח התראות.
 * @returns סיכום הריצה
 */
export async function checkWatches({ compare = compareProduct, send = sendPush } = {}) {
  const byProduct = Map.groupBy(watches, (w) => w.productId);
  const summary = { products: byProduct.size, sent: 0, removed: 0, errors: [] };
  const messages = [];
  const pending = [];

  for (const [productId, list] of byProduct) {
    const product = getProduct(productId);
    if (!product) continue;
    try {
      const { best } = await compare(product);
      for (const w of list) {
        const decision = decideAlert(w, best?.totalIls);
        if (decision) { messages.push(alertMessage(w, best, decision)); pending.push([w, best.totalIls]); }
      }
    } catch (e) {
      summary.errors.push({ productId, error: String(e.message ?? e) });
    }
  }

  if (messages.length) {
    const tickets = await send(messages);
    tickets.forEach((t, i) => {
      const [w, price] = pending[i];
      if (t.status === 'ok') { w.lastNotifiedIls = price; summary.sent++; }
      else if (t.details?.error === 'DeviceNotRegistered') { removeWatch(w.pushToken); summary.removed++; } // האפליקציה הוסרה
      else summary.errors.push({ productId: w.productId, error: t.message ?? 'push failed' });
    });
    persist();
  }
  return summary;
}

/** בדיקה תקופתית בתוך השרת. כבוי כברירת מחדל: ALERTS_INTERVAL_HOURS=6 מפעיל. */
export function startAlertScheduler() {
  const hours = Number(process.env.ALERTS_INTERVAL_HOURS ?? 0);
  if (!hours) return null;
  const run = () => checkWatches().then((s) => console.log('[alerts]', JSON.stringify(s))).catch((e) => console.error('[alerts]', e));
  const t = setInterval(run, hours * 3600 * 1000);
  t.unref?.();
  return t;
}
