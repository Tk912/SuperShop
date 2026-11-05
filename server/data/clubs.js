// מועדוני הנחות. כל rule מגדיר הנחה בחנות מסוימת (או בכל החנויות עם storeId: '*').
// type: percent | fixed (בש"ח). cap = תקרת הנחה בש"ח. stackableWithCoupon = האם ניתן לשלב עם קופון.
// ⚠️ שיעורי ההנחה כאן הם נתוני דוגמה בלבד. ההסדרים בפועל משתנים ויש לסנכרן אותם מאתרי המועדונים.
export const clubs = [
  {
    id: 'behatzdaa', name: 'בהצדעה', description: 'מועדון ההטבות של משרתי צה"ל (סדיר, קבע ומילואים)',
    rules: [
      { storeId: 'ksp', type: 'percent', value: 5, stackableWithCoupon: false },
      { storeId: 'ivory', type: 'percent', value: 6, cap: 400, stackableWithCoupon: false },
      { storeId: 'bug', type: 'percent', value: 4, stackableWithCoupon: true },
      { storeId: 'shufersal', type: 'percent', value: 7, stackableWithCoupon: false },
    ],
  },
  {
    id: 'hever', name: 'חבר', description: 'מועדון הצרכנות של אנשי כוחות הביטחון',
    rules: [
      { storeId: 'ksp', type: 'percent', value: 4, stackableWithCoupon: false },
      { storeId: 'lastprice', type: 'percent', value: 8, cap: 300, stackableWithCoupon: false },
      { storeId: 'idigital', type: 'fixed', value: 150, minSpend: 2000, stackableWithCoupon: false },
    ],
  },
  {
    id: 'histadrut', name: 'הסתדרות – כוח לעובדים', description: 'מועדון חברי ההסתדרות',
    rules: [
      { storeId: 'bug', type: 'percent', value: 5, stackableWithCoupon: false },
      { storeId: 'shufersal', type: 'percent', value: 5, stackableWithCoupon: true },
    ],
  },
  {
    id: 'max', name: 'Max – הטבות כרטיס', description: 'הטבות לבעלי כרטיסי מקס',
    rules: [
      { storeId: 'aliexpress', type: 'percent', value: 8, cap: 150, stackableWithCoupon: true },
      { storeId: 'amazon_us', type: 'percent', value: 3, stackableWithCoupon: true, note: 'החזר כספי (cashback)' },
    ],
  },
  {
    id: 'isracard', name: 'ישראכרט – הטבות', description: 'הטבות לבעלי כרטיסי ישראכרט/אמריקן אקספרס',
    rules: [
      { storeId: 'ebay', type: 'percent', value: 5, cap: 200, stackableWithCoupon: true },
      { storeId: 'ivory', type: 'percent', value: 3, stackableWithCoupon: true },
    ],
  },
  {
    id: 'hitech', name: 'הייטקזון', description: 'מועדון עובדי ההייטק',
    rules: [
      { storeId: 'ivory', type: 'percent', value: 5, stackableWithCoupon: false },
      { storeId: 'lastprice', type: 'percent', value: 6, stackableWithCoupon: false },
    ],
  },
];

export const clubById = Object.fromEntries(clubs.map((c) => [c.id, c]));
