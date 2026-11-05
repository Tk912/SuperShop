// רישום חנויות: חנויות מוכרות + חנויות "אד-הוק" שמגיעות מספקים חיים (למשל Google Shopping).
import { stores, storeById } from './data/stores.js';
import { storeRegion } from './data/forwarders.js';

const adhoc = new Map();

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export function getStore(id) {
  return storeById[id] ?? adhoc.get(id);
}

/** ממפה שם/כתובת חנות לחנות מוכרת, או יוצר חנות אד-הוק עם ברירות מחדל. */
export function resolveStore({ name, url, currency }) {
  const host = hostOf(url);
  const known = stores.find((s) => (host && host.endsWith(s.domain)) || s.name.toLowerCase() === String(name).toLowerCase());
  if (known) return known;
  const id = `x:${host ?? name}`;
  if (!adhoc.has(id)) {
    const intl = currency !== 'ILS' || (host && !host.endsWith('.il'));
    const s = {
      id, name: name ?? host, domain: host ?? '', currency, type: intl ? 'intl' : 'local', adhoc: true,
      shipping: { direct: intl ? null : [{ name: 'משלוח לפי האתר (לא ידוע)', cost: 0, days: '?' }] },
    };
    adhoc.set(id, s);
    if (intl) storeRegion[id] = 'US'; // הנחה סבירה לשילוח צד ג'
  }
  return adhoc.get(id);
}
