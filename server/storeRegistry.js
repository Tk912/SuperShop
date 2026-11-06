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

// חנויות ישראליות עם דומיין שאינו .il (אחרת היו מזוהות כבינלאומיות ומקבלות מע"מ יבוא בטעות)
const IL_DOMAINS = ['terminalx.com', 'factory54.com', 'hamashbir365.com', 'adikastyle.com', 'zap.co.il'];
const TLD_REGION = { uk: 'UK', de: 'EU', fr: 'EU', it: 'EU', es: 'EU', nl: 'EU', cn: 'CN', hk: 'CN' };

const words = (x) => String(x ?? '').toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(Boolean);

/** ממפה שם/כתובת חנות לחנות מוכרת, או יוצר חנות אד-הוק עם ברירות מחדל. */
export function resolveStore({ name, url, currency }) {
  const host = hostOf(url);
  const nameWords = words(name);
  const known = stores.find((s) => (host && (host === s.domain || host.endsWith('.' + s.domain)))
    || (!host && (String(name).toLowerCase() === s.name.toLowerCase() || nameWords.includes(s.name.toLowerCase())))
    || (!host && nameWords.includes(s.domain)));
  if (known) return known;
  const id = `x:${host ?? String(name).toLowerCase()}`;
  if (!adhoc.has(id)) {
    const israeliHost = host && (host.endsWith('.il') || IL_DOMAINS.some((d) => host === d || host.endsWith('.' + d)));
    const hebrewName = /[\u0590-\u05FF]/.test(name ?? '');
    const local = israeliHost || (!host && (hebrewName || currency === 'ILS')) || (host && hebrewName && currency === 'ILS');
    const s = {
      id, name: name ?? host, domain: host ?? '', currency, type: local ? 'local' : 'intl', adhoc: true,
      shipping: { direct: local ? [{ name: 'משלוח לפי האתר', cost: 0, days: '?', unknown: true }] : null },
    };
    adhoc.set(id, s);
    if (!local) storeRegion[id] = TLD_REGION[host?.split('.').pop()] ?? 'US'; // ניחוש מחסן לשילוח צד ג'
  }
  return adhoc.get(id);
}
