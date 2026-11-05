# משווה – השוואת מחירים עד הבית

השוואת מחירים בין חנויות בישראל ובחו"ל. העלות הסופית כוללת הנחות מועדון, קופונים, משלוח (ישיר או שילוח צד ג'), מע"מ ומכס.

```bash
npm install
npm start        # http://localhost:3000
npm test
```

## מבנה
| נתיב | תפקיד |
|---|---|
| `server/data/` | חנויות, מועדונים (בהצדעה, חבר…), קופונים, חברות שילוח, קטלוג – **נתוני דוגמה** |
| `server/pricing/landedCost.js` | מנוע העלות הסופית: בחירת שילוב ההנחות הטוב ביותר, כל מסלולי המשלוח, מסים |
| `server/pricing/taxConfig.js` | מע"מ 18%, פטור עד $75, מכס מעל $500 – ניתן לשינוי דרך משתני סביבה |
| `server/search/` | השלמה אוטומטית: עברית/אנגלית, קידומת, שגיאות כתיב, אותיות סופיות |
| `server/providers/` | ספקי מחירים: `demo` (תמיד), `serpapi` (Google Shopping), `ebay` (Browse API) |

## חיבור נתונים חיים
| משתנה | ספק |
|---|---|
| `SERPAPI_KEY` | Google Shopping לישראל (gl=il): הכיסוי הרחב ביותר, כולל תמונות |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | eBay עם עלות משלוח אמיתית לישראל |
| `DISABLE_DEMO=1` | כיבוי מחירי הדוגמה |

ספק חדש = מודול עם `enabled()` ו-`offersFor(product)` שנרשם ב-`server/providers/index.js`.
