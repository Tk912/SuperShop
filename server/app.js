import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from './data/catalog.js';
import { getProduct, allProducts, learnProducts } from './productStore.js';
import { clubs } from './data/clubs.js';
import { forwarders } from './data/forwarders.js';
import { searchCatalog } from './search/catalogSearch.js';
import { productSvg } from './images.js';
import { collectOffers, activeProviders, searchLiveProducts, isLive } from './providers/index.js';
import { getStore } from './storeRegistry.js';
import { evaluateOffer, missedClubSavings } from './pricing/landedCost.js';
import { getRates, refreshRates } from './pricing/fx.js';
import { taxConfig } from './pricing/taxConfig.js';
import { recordPrice, getHistory } from './priceHistory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const productView = (p) => ({
  id: p.id, name: p.name, brand: p.brand, category: p.category, weightKg: p.weightKg,
  weightEstimated: !!p.weightEstimated, image: p.image ?? `/img/${p.id}.svg`, live: p.source === 'serpapi',
  fromPrice: p.fromPrice, fromCurrency: p.fromCurrency, fromStore: p.fromStore, rating: p.rating, reviews: p.reviews,
});
const dataMode = () => (isLive() && process.env.FORCE_DEMO !== '1' ? 'live' : 'demo');
// נתוני המועדונים והקופונים עדיין לדוגמה: מופעלים רק במצב דמו, כדי לא להוריד קופון מומצא ממחיר אמיתי.
const dealsEnabled = () => dataMode() === 'demo' || process.env.SAMPLE_DEALS === '1';

export function createApp() {
  const app = express();
  // CORS – לאפליקציית המובייל (Expo web / dev) שרצה על פורט אחר
  app.use('/api', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/img/:id.svg', (req, res) => {
    const p = getProduct(req.params.id);
    if (!p?.color) return res.status(404).end(); // רק למוצרי הדמו יש תמונה מצוירת
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(productSvg(p));
  });

  // השלמה אוטומטית – מהירה, מהמאגר המקומי בלבד (קטלוג + מוצרים שנלמדו מחיפושים), בלי לבזבז בקשות API
  app.get('/api/suggest', (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100);
    res.json({ q, suggestions: q.trim() ? searchCatalog(q, 8, allProducts()).map(productView) : [] });
  });

  // תוצאות חיפוש מלאות: המאגר המקומי + חיפוש חי ב-Google Shopping (אם מחובר). התוצאות החיות נשמרות במאגר.
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100).trim();
    if (!q) return res.json({ q, results: [], mode: dataMode(), errors: [] });
    const local = searchCatalog(q, 30, allProducts());
    let live = { products: [], errors: [] };
    if (isLive() && q.length >= 2) {
      live = await searchLiveProducts(q);
      learnProducts(live.products);
    }
    const seen = new Set();
    const results = [...local, ...live.products].filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 40);
    res.json({ q, results: results.map(productView), mode: dataMode(), errors: live.errors });
  });

  // השוואת מחירים למוצר: כל ההצעות, ממוינות לפי עלות סופית עד הבית
  app.get('/api/products/:id/offers', async (req, res) => {
    const product = getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'not found' });
    const userClubIds = String(req.query.clubs ?? '').split(',').filter(Boolean);
    const { rates, source: fxSource } = await refreshRates();
    const { offers, errors } = await collectOffers(product);

    const evaluated = offers
      .map((offer) => {
        const store = getStore(offer.storeId);
        if (!store) return null;
        const deals = dealsEnabled();
        const ev = evaluateOffer({ offer, product, store, rates, userClubIds, deals });
        ev.missedClubs = deals ? missedClubSavings({ offer, product, store, rates, userClubIds }) : [];
        ev.title = offer.title;
        ev.inStock = offer.inStock !== false;
        ev.details = offer.details ?? [];
        return ev;
      })
      .filter((e) => e && e.totalIls != null)
      .sort((a, b) => (b.inStock - a.inStock) || (a.totalIls - b.totalIls)); // מה שבמלאי קודם, ואז לפי מחיר

    // ההיסטוריה נרשמת לפי מחיר בסיס (בלי הנחות מועדון אישיות) – כדי שתהיה זהה לכל המשתמשים
    if (dataMode() === 'live') {
      const base = offers
        .filter((o) => o.inStock !== false && getStore(o.storeId))
        .map((offer) => evaluateOffer({ offer, product, store: getStore(offer.storeId), rates, userClubIds: [] }))
        .filter((e) => e.totalIls != null)
        .sort((a, b) => a.totalIls - b.totalIls)[0];
      if (base) recordPrice(product.id, base.totalIls, base.storeName);
    }

    res.json({
      product: productView(product), offers: evaluated, errors, mode: dataMode(), deals: dealsEnabled(), history: getHistory(product.id),
      fx: { rates, source: fxSource }, tax: taxConfig,
    });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      clubs: clubs.map(({ id, name, description }) => ({ id, name, description })),
      forwarders, providers: activeProviders().map(({ id, name }) => ({ id, name })), mode: dataMode(), deals: dealsEnabled(),
      popular: products.slice(0, 10).map(productView), fx: getRates(),
    });
  });

  return app;
}
