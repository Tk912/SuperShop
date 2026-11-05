// חברות שילוח צד ג' (Package forwarders) – לחנויות שלא שולחות ישירות לישראל.
// תמחור: baseUsd + perKgUsd * משקל_מחויב (המשקל המחויב = max(משקל אמיתי, משקל נפחי)).
// handlingUsd = עמלת טיפול/קליטה. regions = מאילו מחסנים זמין (US/EU/UK/CN).
// ⚠️ מחירי דוגמה – יש לעדכן מול מחירוני החברות.
export const forwarders = [
  { id: 'zipy', name: 'Zipy', regions: ['US', 'EU', 'UK', 'CN'], baseUsd: 9, perKgUsd: 11, handlingUsd: 0,
    days: '8-14', note: 'חברה ישראלית, כולל טיפול במכס ותשלום מסים מראש', includesCustomsHandling: true },
  { id: 'myus', name: 'MyUS', regions: ['US'], baseUsd: 20, perKgUsd: 9.5, handlingUsd: 5, days: '5-9',
    note: 'מנוי Premium מוריד עלויות', includesCustomsHandling: false },
  { id: 'shipito', name: 'Shipito', regions: ['US'], baseUsd: 14, perKgUsd: 10, handlingUsd: 2, days: '7-12',
    note: 'איחוד חבילות חינם', includesCustomsHandling: false },
  { id: 'buyandship', name: 'Buyandship', regions: ['US', 'UK', 'EU'], baseUsd: 4, perKgUsd: 13, handlingUsd: 0,
    days: '10-18', note: 'משלוח ימי/אווירי משולב, מתאים לחבילות קלות', includesCustomsHandling: true },
];

export const storeRegion = {
  amazon_us: 'US', amazon_de: 'EU', aliexpress: 'CN', ebay: 'US', bestbuy: 'US',
  bhphoto: 'US', walmart: 'US', iherb: 'US',
};
