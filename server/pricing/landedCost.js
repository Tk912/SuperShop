// מנוע "עלות סופית עד הבית": הנחות מועדון + קופונים + משלוח (ישיר / צד ג') + מסים.
import { clubs } from '../data/clubs.js';
import { coupons as allCoupons } from '../data/coupons.js';
import { forwarders, storeRegion } from '../data/forwarders.js';
import { taxConfig } from './taxConfig.js';
import { toIls, fromIls } from './fx.js';

const round2 = (n) => Math.round(n * 100) / 100;

// ---------- הנחות ----------

export function applicableClubRules(store, product, priceIls, userClubIds) {
  const out = [];
  for (const club of clubs) {
    if (!userClubIds.includes(club.id)) continue;
    for (const rule of club.rules) {
      if (rule.storeId !== store.id && rule.storeId !== '*') continue;
      if (rule.categories && !rule.categories.includes(product.category)) continue;
      if (rule.minSpend && priceIls < rule.minSpend) continue;
      let amount = rule.type === 'percent' ? (priceIls * rule.value) / 100 : rule.value;
      if (rule.cap) amount = Math.min(amount, rule.cap);
      out.push({ kind: 'club', clubId: club.id, name: club.name, label: describe(rule, 'ILS'),
        amountIls: round2(Math.min(amount, priceIls)), stackable: !!rule.stackableWithCoupon, note: rule.note });
    }
  }
  return out;
}

export function applicableCoupons(store, product, price, rates, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const out = [];
  for (const c of allCoupons) {
    if (c.storeId !== store.id) continue;
    if (c.expires && c.expires < today) continue;
    if (c.categories && !c.categories.includes(product.category)) continue;
    const cur = c.currency ?? store.currency;
    const priceInCur = fromIls(toIls(price, store.currency, rates), cur, rates);
    if (c.minSpend && priceInCur < c.minSpend) continue;
    let amount = c.type === 'percent' ? (priceInCur * c.value) / 100 : c.value;
    if (c.maxDiscount) amount = Math.min(amount, c.maxDiscount);
    out.push({ kind: 'coupon', code: c.code, label: describe(c, cur), verified: c.verified, expires: c.expires,
      note: c.note, amountIls: round2(Math.min(toIls(amount, cur, rates), toIls(price, store.currency, rates))) });
  }
  return out;
}

function describe(r, cur) {
  const sym = { ILS: '₪', USD: '$', EUR: '€' }[cur] ?? cur;
  if (r.type === 'percent') return `${r.value}%` + (r.cap || r.maxDiscount ? ` (עד ${sym}${r.cap ?? r.maxDiscount})` : '');
  return `${sym}${r.value}` + (r.minSpend ? ` בקנייה מעל ${sym}${r.minSpend}` : '');
}

/** בוחר את שילוב ההנחות המשתלם ביותר: מועדון בלבד, קופון בלבד, או מועדון+קופון אם ניתן לשלב. */
export function bestDiscount(clubOpts, couponOpts, priceIls) {
  const candidates = [{ items: [], total: 0 }];
  for (const c of clubOpts) candidates.push({ items: [c], total: c.amountIls });
  for (const k of couponOpts) candidates.push({ items: [k], total: k.amountIls });
  for (const c of clubOpts.filter((x) => x.stackable))
    for (const k of couponOpts) candidates.push({ items: [c, k], total: c.amountIls + k.amountIls });
  const best = candidates.reduce((a, b) => (b.total > a.total ? b : a));
  return { applied: best.items, totalIls: round2(Math.min(best.total, priceIls)) };
}

// ---------- משלוח ----------

function directShippingCost(opt, priceInStoreCur) {
  if (opt.freeAbove != null && priceInStoreCur >= opt.freeAbove) return 0;
  return opt.costBelowFree ?? opt.cost;
}

export function chargeableWeightKg(product) {
  const [l, w, h] = product.dims ?? [0, 0, 0];
  const volumetric = (l * w * h) / 5000;
  const raw = Math.max(product.weightKg ?? 1, volumetric);
  return Math.ceil(raw * 2) / 2; // עיגול לחצי ק"ג כלפי מעלה
}

// ---------- מסים ----------

export function importTaxes(itemIls, shippingIls, category, rates, { prepaidHandling = false } = {}) {
  const valueUsd = fromIls(itemIls + shippingIls, 'USD', rates);
  const cifIls = itemIls + shippingIls;
  let dutyIls = 0;
  let vatIls = 0;
  if (valueUsd > taxConfig.customsExemptUpToUsd) {
    const rate = taxConfig.categoryDuty[category] ?? taxConfig.categoryDuty.default;
    dutyIls = cifIls * rate;
  }
  if (valueUsd > taxConfig.vatExemptUpToUsd) vatIls = (cifIls + dutyIls) * taxConfig.vatRate;
  const feeIls = (vatIls > 0 || dutyIls > 0) && !prepaidHandling ? taxConfig.clearanceFeeIls : 0;
  return { valueUsd: round2(valueUsd), dutyIls: round2(dutyIls), vatIls: round2(vatIls), feeIls,
    totalIls: round2(dutyIls + vatIls + feeIls), exempt: vatIls === 0 && dutyIls === 0 };
}

// ---------- חישוב מלא להצעה ----------

/**
 * @param offer {storeId, price, currency?, url?}
 * @returns אובייקט עם כל מסלולי המשלוח, ההנחות והעלות הסופית הזולה ביותר.
 */
// deals=false מכבה הנחות מועדון וקופונים (למשל כשנתוני ההנחות הם לדוגמה והמחירים אמיתיים)
export function evaluateOffer({ offer, product, store, rates, userClubIds = [], now = new Date(), deals = true }) {
  const currency = offer.currency ?? store.currency;
  const priceIls = toIls(offer.price, currency, rates);

  const clubOpts = deals ? applicableClubRules(store, product, priceIls, userClubIds) : [];
  const couponOpts = deals ? applicableCoupons(store, product, offer.price, rates, now) : [];
  const discount = bestDiscount(clubOpts, couponOpts, priceIls);
  const itemIls = priceIls - discount.totalIls;
  const itemInStoreCur = fromIls(itemIls, currency, rates);

  const routes = [];
  const direct = offer.directShipping ?? store.shipping?.direct; // ספק חי יכול לדרוס עלויות משלוח
  const directBlocked = store.shipping?.directExcludedCategories?.includes(product.category);

  if (direct && !directBlocked) {
    for (const opt of direct) {
      const shipIls = toIls(directShippingCost(opt, itemInStoreCur), currency, rates);
      const taxes = store.type === 'intl'
        ? importTaxes(itemIls, shipIls, product.category, rates)
        : { totalIls: 0, exempt: true, vatIls: 0, dutyIls: 0, feeIls: 0 };
      routes.push({ kind: 'direct', name: opt.name, days: opt.days, shippingIls: round2(shipIls), taxes,
        totalIls: round2(itemIls + shipIls + taxes.totalIls) });
    }
  }

  if (store.type === 'intl') {
    const region = storeRegion[store.id];
    const kg = chargeableWeightKg(product);
    for (const f of forwarders.filter((x) => x.regions.includes(region))) {
      const shipUsd = f.baseUsd + f.perKgUsd * kg + f.handlingUsd;
      const shipIls = toIls(shipUsd, 'USD', rates);
      const taxes = importTaxes(itemIls, shipIls, product.category, rates, { prepaidHandling: f.includesCustomsHandling });
      routes.push({ kind: 'forwarder', forwarderId: f.id, name: `${f.name} (שילוח צד ג')`, days: f.days, note: f.note,
        chargeableKg: kg, shippingIls: round2(shipIls), taxes, totalIls: round2(itemIls + shipIls + taxes.totalIls) });
    }
  }

  routes.sort((a, b) => a.totalIls - b.totalIls);
  return {
    storeId: store.id, storeName: store.name, storeType: store.type, domain: store.domain, url: offer.url ?? `https://${store.domain}`,
    source: offer.source ?? 'demo', currency, price: offer.price, priceIls: round2(priceIls),
    shipsDirectToIL: !!direct && !directBlocked,
    discounts: { applied: discount.applied, totalIls: discount.totalIls, availableClubs: clubOpts, availableCoupons: couponOpts },
    routes, best: routes[0] ?? null, totalIls: routes[0]?.totalIls ?? null,
  };
}

/** רשימת מועדונים שהמשתמש אינו חבר בהם אבל היו מוזילים את המחיר – "כדאי להצטרף". */
export function missedClubSavings({ offer, product, store, rates, userClubIds }) {
  const priceIls = toIls(offer.price, offer.currency ?? store.currency, rates);
  const others = clubs.map((c) => c.id).filter((id) => !userClubIds.includes(id));
  return applicableClubRules(store, product, priceIls, others);
}
