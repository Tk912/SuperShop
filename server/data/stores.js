// חנויות נתמכות. type: local = ישראלית, intl = בינלאומית.
// shipping.direct: משלוח ישיר לישראל (אם קיים). אם אין – החישוב יעבור דרך שילוח צד ג'.
// הערכים כאן הם נתוני דוגמה ויש לעדכן אותם מול האתרים בפועל.
export const stores = [
  // ---------- ישראל ----------
  { id: 'ksp', name: 'KSP', type: 'local', currency: 'ILS', domain: 'ksp.co.il',
    shipping: { direct: [{ name: 'משלוח עד הבית', cost: 29, freeAbove: 299, days: '2-4' }, { name: 'איסוף עצמי', cost: 0, days: '1' }] } },
  { id: 'ivory', name: 'Ivory', type: 'local', currency: 'ILS', domain: 'ivory.co.il',
    shipping: { direct: [{ name: 'שליח', cost: 35, freeAbove: 500, days: '2-5' }, { name: 'איסוף מסניף', cost: 0, days: '1-2' }] } },
  { id: 'bug', name: 'באג', type: 'local', currency: 'ILS', domain: 'bug.co.il',
    shipping: { direct: [{ name: 'שליח', cost: 39, freeAbove: 400, days: '2-4' }, { name: 'איסוף מסניף', cost: 0, days: '1' }] } },
  { id: 'lastprice', name: 'LastPrice', type: 'local', currency: 'ILS', domain: 'lastprice.co.il',
    shipping: { direct: [{ name: 'שליח', cost: 29.9, freeAbove: 249, days: '3-5' }] } },
  { id: 'shufersal', name: 'שופרסל אונליין', type: 'local', currency: 'ILS', domain: 'shufersal.co.il',
    shipping: { direct: [{ name: 'משלוח', cost: 29.9, freeAbove: 600, days: '1-3' }] } },
  { id: 'idigital', name: 'iDigital', type: 'local', currency: 'ILS', domain: 'idigital.co.il',
    shipping: { direct: [{ name: 'שליח', cost: 0, days: '1-3' }] } },

  // ---------- בינלאומי ----------
  { id: 'amazon_us', name: 'Amazon.com', type: 'intl', currency: 'USD', domain: 'amazon.com',
    shipping: { direct: [{ name: 'AmazonGlobal Standard', cost: 0, freeAbove: 49, costBelowFree: 12.99, days: '7-14' },
                         { name: 'AmazonGlobal Express', cost: 29.99, days: '4-7' }],
                directExcludedCategories: ['appliances', 'large'] } },
  { id: 'amazon_de', name: 'Amazon.de', type: 'intl', currency: 'EUR', domain: 'amazon.de',
    shipping: { direct: [{ name: 'Standardversand Israel', cost: 9.99, days: '6-12' }] } },
  { id: 'aliexpress', name: 'AliExpress', type: 'intl', currency: 'USD', domain: 'aliexpress.com',
    shipping: { direct: [{ name: 'AliExpress Standard', cost: 0, days: '10-20' }, { name: 'AliExpress Premium', cost: 6.5, days: '7-12' }] } },
  { id: 'ebay', name: 'eBay', type: 'intl', currency: 'USD', domain: 'ebay.com',
    shipping: { direct: [{ name: 'eBay International Shipping', cost: 24, days: '8-16' }] } },
  { id: 'bestbuy', name: 'Best Buy', type: 'intl', currency: 'USD', domain: 'bestbuy.com',
    shipping: { direct: null } }, // לא שולחים לישראל → שילוח צד ג'
  { id: 'bhphoto', name: 'B&H Photo', type: 'intl', currency: 'USD', domain: 'bhphotovideo.com',
    shipping: { direct: [{ name: 'International Economy', cost: 35, days: '7-12' }] } },
  { id: 'walmart', name: 'Walmart', type: 'intl', currency: 'USD', domain: 'walmart.com',
    shipping: { direct: null } },
  { id: 'iherb', name: 'iHerb', type: 'intl', currency: 'USD', domain: 'iherb.com',
    shipping: { direct: [{ name: 'Standard', cost: 0, freeAbove: 45, costBelowFree: 6, days: '6-10' }] } },
];

export const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));
