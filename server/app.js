import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, productById } from './data/catalog.js';
import { clubs } from './data/clubs.js';
import { forwarders } from './data/forwarders.js';
import { searchCatalog } from './search/catalogSearch.js';
import { productSvg } from './images.js';
import { collectOffers, activeProviders } from './providers/index.js';
import { getStore } from './storeRegistry.js';
import { evaluateOffer, missedClubSavings } from './pricing/landedCost.js';
import { getRates, refreshRates } from './pricing/fx.js';
import { taxConfig } from './pricing/taxConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const productView = (p) => ({
  id: p.id, name: p.name, brand: p.brand, category: p.category, weightKg: p.weightKg,
  image: `/img/${p.id}.svg`,
});

export function createApp() {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/img/:id.svg', (req, res) => {
    const p = productById[req.params.id];
    if (!p) return res.status(404).end();
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(productSvg(p));
  });

  // השלמה אוטומטית – מהירה, מהקטלוג המקומי בלבד
  app.get('/api/suggest', (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100);
    res.json({ q, suggestions: q.trim() ? searchCatalog(q, 8).map(productView) : [] });
  });

  // תוצאות חיפוש מלאות
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100);
    res.json({ q, results: searchCatalog(q, 30).map(productView) });
  });

  // השוואת מחירים למוצר: כל ההצעות, ממוינות לפי עלות סופית עד הבית
  app.get('/api/products/:id/offers', async (req, res) => {
    const product = productById[req.params.id];
    if (!product) return res.status(404).json({ error: 'not found' });
    const userClubIds = String(req.query.clubs ?? '').split(',').filter(Boolean);
    const { rates, source: fxSource } = await refreshRates();
    const { offers, errors } = await collectOffers(product);

    const evaluated = offers
      .map((offer) => {
        const store = getStore(offer.storeId);
        if (!store) return null;
        const ev = evaluateOffer({ offer, product, store, rates, userClubIds });
        ev.missedClubs = missedClubSavings({ offer, product, store, rates, userClubIds });
        ev.title = offer.title;
        return ev;
      })
      .filter((e) => e && e.totalIls != null)
      .sort((a, b) => a.totalIls - b.totalIls);

    res.json({
      product: productView(product), offers: evaluated, errors,
      fx: { rates, source: fxSource }, tax: taxConfig,
    });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      clubs: clubs.map(({ id, name, description }) => ({ id, name, description })),
      forwarders, providers: activeProviders().map(({ id, name }) => ({ id, name })),
      popular: products.slice(0, 10).map(productView), fx: getRates(),
    });
  });

  return app;
}
