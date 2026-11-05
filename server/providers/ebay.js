// eBay Browse API – מחירים חיים + עלות משלוח אמיתית לישראל.
// הפעלה: EBAY_CLIENT_ID + EBAY_CLIENT_SECRET (https://developer.ebay.com).
let token = { value: null, exp: 0 };

async function getToken(fetchImpl) {
  if (token.value && Date.now() < token.exp) return token.value;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const res = await fetchImpl('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!res.ok) throw new Error(`ebay oauth ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return token.value;
}

export const ebayProvider = {
  id: 'ebay',
  name: 'eBay API',
  enabled: () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),

  async offersFor(product, { fetchImpl = fetch } = {}) {
    const t = await getToken(fetchImpl);
    const u = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    u.search = new URLSearchParams({ q: product.name, limit: '10', filter: 'buyingOptions:{FIXED_PRICE},conditions:{NEW}' });
    const res = await fetchImpl(u, {
      headers: { Authorization: `Bearer ${t}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DIL' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ebay search ${res.status}`);
    const json = await res.json();
    return (json.itemSummaries ?? []).slice(0, 3).map((it) => {
      const ship = it.shippingOptions?.[0]?.shippingCost;
      return {
        storeId: 'ebay', price: Number(it.price.value), currency: it.price.currency, url: it.itemWebUrl,
        title: it.title, thumbnail: it.image?.imageUrl, source: 'ebay-api',
        // אם eBay לא מחזיר משלוח לישראל – לא דורסים, והמנוע יציע שילוח צד ג'
        directShipping: ship ? [{ name: 'eBay – משלוח לישראל', cost: Number(ship.value), days: '8-20' }] : undefined,
      };
    });
  },
};
