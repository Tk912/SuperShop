// לב ההשוואה: כל ההצעות למוצר, מחושבות עד הבית. משמש גם את ה-API וגם את בדיקת התראות המחיר.
import { collectOffers, isLive } from './providers/index.js';
import { getStore, resolveStore } from './storeRegistry.js';
import { evaluateOffer, missedClubSavings } from './pricing/landedCost.js';
import { refreshRates } from './pricing/fx.js';
import { recordPrice } from './priceHistory.js';
import { dealFilter as makeDealFilter, hasLiveDeals } from './deals.js';

export const dataMode = () => (isLive() && process.env.FORCE_DEMO !== '1' ? 'live' : 'demo');
// על מחירים אמיתיים חלות רק הנחות מאומתות ובתוקף (SAMPLE_DEALS=1 מפעיל גם את הדוגמאות – להדגמה בלבד).
export const currentFilter = () => makeDealFilter({ live: dataMode() === 'live', includeSamples: process.env.SAMPLE_DEALS === '1' });
/** האם יש בכלל הנחות פעילות – כדי שהאפליקציה תדע אם להציג את בחירת המועדונים. */
export const dealsEnabled = () => dataMode() === 'demo' || process.env.SAMPLE_DEALS === '1' || hasLiveDeals();

// חנות לפי מזהה; חנות אד-הוק שנשכחה (הפעלה מחדש + הצעות מהמטמון) משוחזרת מפרטי ההצעה
const storeFor = (offer) => getStore(offer.storeId) ?? (offer.storeHint ? resolveStore(offer.storeHint) : undefined);

/**
 * @returns {{ offers, errors, rates, fxSource, best }} – offers ממוינות (במלאי קודם, ואז לפי מחיר);
 *   best = ההצעה הזולה שבמלאי לפי מחיר בסיס, בלי הנחות אישיות (זהה לכל המשתמשים – להיסטוריה ולהתראות).
 */
export async function compareProduct(product, userClubIds = []) {
  const { rates, source: fxSource } = await refreshRates();
  const { offers, errors } = await collectOffers(product);
  const deals = dealsEnabled();
  const dealFilter = currentFilter();

  const evaluated = offers
    .map((offer) => {
      const store = storeFor(offer);
      if (!store) return null;
      const ev = evaluateOffer({ offer, product, store, rates, userClubIds, deals, dealFilter });
      ev.missedClubs = deals ? missedClubSavings({ offer, product, store, rates, userClubIds, dealFilter }) : [];
      ev.title = offer.title;
      ev.inStock = offer.inStock !== false;
      ev.details = offer.details ?? [];
      return ev;
    })
    .filter((e) => e && e.totalIls != null)
    .sort((a, b) => (b.inStock - a.inStock) || (a.totalIls - b.totalIls));

  const best = offers
    .filter((o) => o.inStock !== false && storeFor(o))
    .map((offer) => evaluateOffer({ offer, product, store: storeFor(offer), rates, userClubIds: [], deals, dealFilter }))
    .filter((e) => e.totalIls != null)
    .sort((a, b) => a.totalIls - b.totalIls)[0] ?? null;

  if (dataMode() === 'live' && best) recordPrice(product.id, best.totalIls, best.storeName);
  return { offers: evaluated, errors, rates, fxSource, best };
}
