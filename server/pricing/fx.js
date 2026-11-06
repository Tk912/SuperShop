// שערי חליפין ל-ILS. מנסה למשוך שער חי (open.er-api.com, ללא מפתח) ונופל לשערים קבועים.
const FALLBACK = { ILS: 1, USD: 3.7, EUR: 4.0, GBP: 4.7, CNY: 0.51 };
const TTL_MS = 6 * 60 * 60 * 1000;

let cache = { rates: { ...FALLBACK }, source: 'fallback', fetchedAt: 0 };

export async function refreshRates(fetchImpl = globalThis.fetch) {
  if (process.env.FX_OFFLINE === '1') return cache;
  if (Date.now() - cache.fetchedAt < TTL_MS && cache.source === 'live') return cache;
  try {
    const res = await fetchImpl('https://open.er-api.com/v6/latest/ILS', { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    if (json?.result !== 'success') throw new Error('bad fx response');
    const rates = { ILS: 1 };
    for (const cur of Object.keys(FALLBACK)) if (json.rates[cur]) rates[cur] = 1 / json.rates[cur];
    cache = { rates, source: 'live', fetchedAt: Date.now() };
  } catch {
    cache = { ...cache, fetchedAt: Date.now() }; // לא לנסות שוב בכל בקשה
  }
  return cache;
}

export function getRates() {
  return cache;
}

export function toIls(amount, currency, rates = cache.rates) {
  const r = rates[currency];
  if (r == null) throw new Error(`Unknown currency ${currency}`);
  return amount * r;
}

export function fromIls(amountIls, currency, rates = cache.rates) {
  return amountIls / rates[currency];
}
