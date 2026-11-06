// אתרי מסחר בינלאומיים: Amazon, eBay, Walmart (דרך SearchApi.io).
//
// בניגוד ל-Google Shopping, כאן מחפשים לפי שם המוצר ומקבלים רשימה רועשת: דורות קודמים, מחודשים,
// אביזרים ומחירים חשודים. לכן כל תוצאה עוברת התאמה קפדנית:
//   1. אותו דגם: כל מילות הדגם מהשם (כולל מספרים) מופיעות בכותרת.
//   2. חדש בלבד: בלי Renewed/Refurbished/Restored/Open Box/Used.
//   3. לא אביזר: בלי "for AirPods", case, cover, tips...
//   4. מחיר סביר ביחס למחיר בחנויות בישראל (Google Shopping): לא זול מדי (חשד לזיוף) ולא יקר מדי.
// מכל אתר נלקחת ההצעה הזולה ביותר שעברה (מחיר + משלוח).
//
// MARKETPLACES=amazon,ebay,walmart (ברירת מחדל) קובע אילו אתרים נבדקים; MARKETPLACES=none מכבה.
// כל אתר = בקשה אחת ל-SearchApi לכל דף מוצר (נשמרת במטמון 6 שעות).
import { cached } from '../cache.js';
import { apiFetch } from './searchapi.js';
import { currencyOf } from './serpapi.js';
import { normalize } from '../search/normalize.js';
import { toIls, getRates } from '../pricing/fx.js';

const TTL = 6 * 60 * 60 * 1000;
const PRICE_BAND = [0.55, 2.0]; // ביחס למחיר הזול בישראל

// מילים כלליות שלא מזהות דגם
const GENERIC = new Set(`wireless bluetooth earbuds earphones headphones headset noise cancelling canceling cancellation active anc
  with and the in on of new sealed original genuine official edition generation gen version model case charging usb c type
  black white silver gray grey blue red green pink gold space midnight starlight graphite titanium natural
  smartphone phone laptop console tablet watch smart unlocked international dual sim gb tb inch`.split(/\s+/));
const BAD_CONDITION = /\b(renewed|refurbished|refurb|restored|open[\s-]?box|pre[\s-]?owned|used|for parts|damaged|battery issue|replica|copy)\b/i;
const ACCESSORY = /\b(case|cover|skin|protector|tips|foam|strap|band|charger|cable|adapter|replacement|compatible|holder|mount|sticker|decal|dust plug)\b/i;
const BRANDS = new Set(['apple', 'samsung', 'sony', 'nintendo', 'dyson', 'logitech', 'garmin', 'amazon', 'google', 'xiaomi', 'lenovo', 'asus', 'dell', 'hp', 'bose', 'jbl', 'lg', 'philips', 'ninja', 'microsoft']);

const ord = (t) => t.replace(/^(\d+)(st|nd|rd|th)$/, '$1'); // 3rd → 3
const latinTokens = (s) => normalize(s).split(' ').filter((t) => /^[a-z0-9]+$/.test(t)).map(ord);

/** מילות הדגם המזהות: מספרים ומילים לטיניות שאינן כלליות. המותג נשמר בנפרד (לא חובה בכותרת). */
export function modelTokens(name) {
  const toks = latinTokens(name.replace(/[-_/]/g, ' ')).filter((t) => !GENERIC.has(t));
  const brand = toks.find((t) => BRANDS.has(t)) ?? null;
  return { brand, required: [...new Set(toks.filter((t) => t !== brand))] };
}

/** שאילתת חיפוש באנגלית מתוך שם המוצר (שמות מ-Google בעברית כוללים את הדגם באותיות לטיניות). */
export function englishQuery(name) {
  const { brand, required } = modelTokens(name);
  if (!required.length) return null; // אין דגם מזוהה באנגלית – לא מחפשים
  return [brand, ...required].filter(Boolean).join(' ');
}

/** האם כותרת התוצאה היא אותו מוצר, חדש, ולא אביזר. */
export function sameProduct(title, { brand, required }, condition = '') {
  if (BAD_CONDITION.test(title) || BAD_CONDITION.test(condition)) return false;
  const t = ` ${normalize(title)} `;
  if (required[0] && t.includes(` for ${required[0]}`)) return false; // "Case for AirPods"
  // מילת אביזר לפני שם המוצר = האביזר הוא המוצר ("Foam Tips for…", "Silicone Case AirPods…");
  // אחרי השם היא חלק מהמארז ("AirPods Pro 3 with MagSafe Case")
  const acc = title.search(ACCESSORY);
  const first = required[0] ? normalize(title).indexOf(required[0]) : -1;
  if (acc >= 0 && (first < 0 || normalize(title.slice(0, acc)).length < first)) return false;
  const words = new Set(latinTokens(title));
  const compact = latinTokens(title.replace(/[-_/]/g, '')).join('');
  return required.every((r) => (/^\d{1,2}$/.test(r) ? words.has(r) : words.has(r) || compact.includes(r)));
}

const ENGINES = {
  amazon: {
    store: 'amazon_us',
    params: (q) => ({ engine: 'amazon_search', q, amazon_domain: 'amazon.com', delivery_country: 'il' }),
    map: (r) => ({ price: r.extracted_price, currency: currencyOf(r.price, 'USD') }),
  },
  ebay: {
    store: 'ebay',
    params: (q) => ({ engine: 'ebay_search', q, ebay_domain: 'ebay.com', delivery_country: 'IL' }),
    map: (r) => ({
      price: r.extracted_price, currency: currencyOf(r.price, 'USD'), condition: r.condition,
      ...(r.extracted_shipping != null ? { directShipping: [{ name: 'משלוח לישראל (eBay)', cost: r.extracted_shipping, days: '?' }] }
        : /free/i.test(r.shipping ?? '') ? { directShipping: [{ name: 'משלוח חינם לישראל (eBay)', cost: 0, days: '?' }] } : {}),
    }),
  },
  walmart: {
    store: 'walmart', // לא שולחת לישראל → המנוע יחשב שילוח צד ג'
    params: (q) => ({ engine: 'walmart_search', q }),
    map: (r) => ({ price: r.extracted_price, currency: currencyOf(r.price, 'USD'), condition: r.condition, inStock: !r.is_out_of_stock }),
  },
};

export const enabledMarketplaces = () => {
  const v = (process.env.MARKETPLACES ?? 'amazon,ebay,walmart').toLowerCase();
  return v === 'none' ? [] : v.split(',').map((s) => s.trim()).filter((k) => ENGINES[k]);
};

/** בוחר מתוך תוצאות אתר אחד את ההצעה הזולה שמתאימה למוצר ולטווח המחיר. */
export function pickBest(results, key, tokens, referenceIls, rates = getRates().rates) {
  const eng = ENGINES[key];
  const candidates = [];
  for (const r of results ?? []) {
    if (r.extracted_price == null || !r.link || !r.title) continue;
    const m = eng.map(r);
    if (!sameProduct(r.title, tokens, m.condition ?? '')) continue;
    if (m.inStock === false) continue;
    const priceIls = toIls(m.price, m.currency, rates);
    if (referenceIls && (priceIls < referenceIls * PRICE_BAND[0] || priceIls > referenceIls * PRICE_BAND[1])) continue;
    const shipIls = m.directShipping ? toIls(m.directShipping[0].cost, m.currency, rates) : null;
    candidates.push({ r, m, priceIls, shipIls });
  }
  // משלוח לא ידוע אינו משלוח חינם: מניחים את המשלוח היקר ביותר שנראה באותן תוצאות
  const knownShip = candidates.map((c) => c.shipIls).filter((x) => x != null);
  const assumed = knownShip.length ? Math.max(...knownShip) : 0;
  for (const c of candidates) c.rank = c.priceIls + (c.shipIls ?? assumed);
  candidates.sort((a, b) => a.rank - b.rank);
  const best = candidates[0];
  if (!best) return null;
  const { r, m } = best;
  return {
    storeId: eng.store, price: m.price, currency: m.currency, url: r.link, title: r.title, source: key,
    inStock: true, details: [m.condition].filter(Boolean), ...(m.directShipping ? { directShipping: m.directShipping } : {}),
  };
}

export const marketplacesProvider = {
  id: 'marketplaces',
  name: 'Amazon / eBay / Walmart',
  live: true,
  phase: 2, // רץ אחרי Google Shopping, כדי לקבל מחיר ייחוס מהחנויות בישראל
  enabled: () => !!(process.env.SEARCHAPI_KEY || process.env.SEARCHAPI_FIXTURE_DIR) && enabledMarketplaces().length > 0,

  /** @param context.referenceIls המחיר הזול בחנויות שכבר נמצאו (לסינון מחירים חשודים) */
  async offersFor(product, { referenceIls, rates } = {}) {
    const q = englishQuery(product.name);
    if (!q) return [];
    const tokens = modelTokens(product.name);
    const results = await Promise.allSettled(enabledMarketplaces().map((key) =>
      cached(`mk:${key}:${q.toLowerCase()}`, TTL, () => apiFetch(ENGINES[key].params(q)).then((j) => j.organic_results ?? []))
        .then((rs) => pickBest(rs, key, tokens, referenceIls, rates))));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length && failed.length) throw failed[0].reason; // כולם נכשלו – מדווחים
    return results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  },
};
