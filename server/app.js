import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from './data/catalog.js';
import { getProduct, allProducts, learnProducts } from './productStore.js';
import { getClubs, getDeals, saveDeals, reportDeal } from './deals.js';
import { stores } from './data/stores.js';
import { forwarders } from './data/forwarders.js';
import { searchCatalog } from './search/catalogSearch.js';
import { productSvg } from './images.js';
import { activeProviders, searchLiveProducts, isLive } from './providers/index.js';
import { compareProduct, dataMode, dealsEnabled } from './compare.js';
import { getRates } from './pricing/fx.js';
import { taxConfig } from './pricing/taxConfig.js';
import { getHistory } from './priceHistory.js';
import { listWatches, upsertWatch, removeWatch, checkWatches, isPushToken } from './alerts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const productView = (p) => ({
  id: p.id, name: p.name, brand: p.brand, category: p.category, weightKg: p.weightKg,
  weightEstimated: !!p.weightEstimated, image: p.image ?? `/img/${p.id}.svg`, live: p.source === 'serpapi',
  fromPrice: p.fromPrice, fromCurrency: p.fromCurrency, fromStore: p.fromStore, rating: p.rating, reviews: p.reviews,
});


export function createApp() {
  const app = express();
  // CORS – לאפליקציית המובייל (Expo web / dev) שרצה על פורט אחר
  app.use('/api', (req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,POST',
      'Access-Control-Allow-Headers': 'Content-Type' });
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use('/api', express.json({ limit: '200kb' }));
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
    const { offers: evaluated, errors, rates, fxSource } = await compareProduct(product, userClubIds);

    res.json({
      product: productView(product), offers: evaluated, errors, mode: dataMode(), deals: dealsEnabled(), history: getHistory(product.id),
      fx: { rates, source: fxSource }, tax: taxConfig,
    });
  });

  // ---- התראות מחיר. ה-push token של המכשיר משמש גם כמזהה הרשימה שלו ----
  const wrap = (fn) => async (req, res) => {
    try { res.json(await fn(req)); } catch (e) { res.status(e.status ?? 500).json({ error: e.message }); }
  };
  const tokenOf = (req) => {
    const t = req.body?.pushToken ?? req.query.pushToken;
    if (!isPushToken(t)) throw Object.assign(new Error('invalid push token'), { status: 400 });
    return t;
  };
  app.get('/api/watches', wrap(async (req) => ({ watches: listWatches(tokenOf(req)) })));
  app.put('/api/watches', wrap(async (req) => ({ watch: upsertWatch({ ...req.body, pushToken: tokenOf(req) }) })));
  app.delete('/api/watches', wrap(async (req) => ({ removed: removeWatch(tokenOf(req), req.query.productId) })));

  // ---- ניהול (רק כשמוגדר ADMIN_TOKEN; אחרת הנתיבים לא קיימים) ----
  const admin = (fn) => wrap(async (req) => {
    const ok = process.env.ADMIN_TOKEN && req.get('authorization') === `Bearer ${process.env.ADMIN_TOKEN}`;
    if (!ok) throw Object.assign(new Error('not found'), { status: 404 });
    return fn(req);
  });
  // הפעלת בדיקת התראות מבחוץ (למשל cron של שירות האירוח)
  app.post('/api/admin/check-alerts', admin(() => checkWatches()));
  // מאגר ההנחות: קריאה ושמירה מלאה (דף הניהול: /admin.html)
  app.get('/api/admin/deals', admin(() => ({ ...getDeals(), stores: stores.map(({ id, name, type }) => ({ id, name, type })) })));
  app.put('/api/admin/deals', admin((req) => saveDeals(req.body)));

  // משתמש מדווח שהנחה/קופון לא עבדו – מופיע בדף הניהול כדי לבדוק מחדש
  const reported = new Set(); // דיווח אחד ליום לכל כתובת IP והנחה
  app.post('/api/deals/:id/report', wrap(async (req) => {
    const key = `${req.ip}|${req.params.id}|${new Date().toISOString().slice(0, 10)}`;
    if (reported.has(key)) return { ok: true, duplicate: true };
    const n = reportDeal(req.params.id);
    reported.add(key);
    if (reported.size > 50000) reported.clear();
    return { ok: true, reports: n };
  }));

  app.get('/api/meta', (_req, res) => {
    res.json({
      clubs: getClubs().map(({ id, name, description }) => ({ id, name, description })),
      forwarders, providers: activeProviders().map(({ id, name }) => ({ id, name })), mode: dataMode(), deals: dealsEnabled(),
      popular: products.slice(0, 10).map(productView), fx: getRates(),
    });
  });

  return app;
}
