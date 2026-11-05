// קופונים לפי חנות. currency: מטבע הערך הקבוע (עבור type: fixed).
// categories: אם מוגדר, הקופון חל רק על הקטגוריות האלה.
// ⚠️ קודי דוגמה. בייצור ייטען מפיד קופונים (שותפים/אפיליאייט) עם אימות תקופתי.
export const coupons = [
  { storeId: 'ksp', code: 'KSP50', type: 'fixed', value: 50, currency: 'ILS', minSpend: 500, expires: '2026-12-31', verified: true },
  { storeId: 'ivory', code: 'IVORY5', type: 'percent', value: 5, maxDiscount: 250, categories: ['audio', 'wearables'], expires: '2026-11-30', verified: true },
  { storeId: 'lastprice', code: 'LP100', type: 'fixed', value: 100, currency: 'ILS', minSpend: 1500, expires: '2026-12-15', verified: false },
  { storeId: 'aliexpress', code: 'AE11SALE', type: 'fixed', value: 15, currency: 'USD', minSpend: 109, expires: '2026-11-12', verified: true, note: 'מבצע 11.11' },
  { storeId: 'aliexpress', code: 'AENEW8', type: 'fixed', value: 8, currency: 'USD', minSpend: 60, expires: '2026-12-31', verified: false, note: 'משתמשים חדשים' },
  { storeId: 'ebay', code: 'EBAYTECH10', type: 'percent', value: 10, maxDiscount: 100, currency: 'USD', categories: ['phones', 'computers', 'gaming'], expires: '2026-11-20', verified: true },
  { storeId: 'iherb', code: 'WELCOME20', type: 'percent', value: 20, maxDiscount: 30, currency: 'USD', expires: '2026-12-31', verified: true, note: 'הזמנה ראשונה' },
  { storeId: 'bhphoto', code: 'BHFALL', type: 'fixed', value: 20, currency: 'USD', minSpend: 300, expires: '2026-11-30', verified: false },
];
