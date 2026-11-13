// מסווג הטבות: האם ההטבה היא על מוצרים פיזיים (אופנה, נעליים, חשמל, בית...) – ובאיזו קטגוריה.
//
// מרכז ההטבות מציג רק הטבות על מוצרים. אטרקציות, מסעדות, נופש, הופעות, שירותים, ביטוח וכו' – נדחים.
// סדר ההחלטה:
//   1. רשת מוכרת (פוקס, קסטרו, KSP, אמזון...) → הקטגוריה שלה. זה הסימן החזק ביותר.
//   2. מילה שמעידה על שירות/חוויה (מלון, מסעדה, הופעה...) → נדחה.
//   3. מילה שמעידה על מוצר (בגדים, נעליים, מקרר...) → הקטגוריה שלה.
//   4. אחרת – לא ידוע, ולא מוצג (עדיף לפספס הטבה מאשר להציג כרטיס לפארק מים).
// בעברית מחפשים כתת-מחרוזת (כדי לתפוס תחיליות כמו "בפוקס", "לנעליים"); באנגלית – מילה שלמה.

export const CATEGORIES = {
  fashion: 'אופנה וביגוד',
  shoes: 'נעליים',
  sports: 'ספורט',
  kids: 'ילדים ותינוקות',
  home: 'בית ועיצוב',
  electronics: 'חשמל ואלקטרוניקה',
  beauty: 'טיפוח ובישום',
  accessories: 'תכשיטים, שעונים ותיקים',
  optics: 'אופטיקה',
  books: 'ספרים וצעצועים',
  grocery: 'מזון וסופר',
  general: 'קניות כלליות',
};

// רשתות ואתרים. region: intl = אתר בחו״ל. הסדר חשוב: "פוקס הום" לפני "פוקס".
export const BRANDS = [
  // בית
  { name: 'פוקס הום', cat: 'home', keys: ['פוקס הום', 'fox home'] },
  { name: 'גולף אנד קו', cat: 'home', keys: ['גולף אנד קו', 'golf&co', 'golf & co', 'golf and co'] },
  { name: 'איקאה', cat: 'home', keys: ['איקאה', 'ikea'] },
  { name: 'הום סנטר', cat: 'home', keys: ['הום סנטר', 'home center'] },
  { name: 'ACE', cat: 'home', keys: ['ace', 'אייס'] },
  { name: 'נעמן', cat: 'home', keys: ['נעמן', 'naaman'] },
  { name: 'כיתן', cat: 'home', keys: ['כיתן', 'kitan'] },
  { name: 'ורדינון', cat: 'home', keys: ['ורדינון', 'vardinon'] },
  { name: 'ביתילי', cat: 'home', keys: ['ביתילי', 'bitili'] },
  { name: 'עמינח', cat: 'home', keys: ['עמינח', 'aminach'] },
  { name: 'הוליווד', cat: 'home', keys: ['הוליווד ריהוט'] },
  // אופנה
  { name: 'פוקס', cat: 'fashion', keys: ['פוקס', 'fox'] },
  { name: 'קסטרו', cat: 'fashion', keys: ['קסטרו', 'castro'] },
  { name: 'גולף', cat: 'fashion', keys: ['גולף', 'golf'] },
  { name: 'רנואר', cat: 'fashion', keys: ['רנואר', 'renuar'] },
  { name: 'הודיס', cat: 'fashion', keys: ['הודיס', 'hoodies'] },
  { name: 'טרמינל X', cat: 'fashion', keys: ['טרמינל x', 'טרמינל איקס', 'terminal x', 'terminalx'] },
  { name: 'זארה', cat: 'fashion', keys: ['זארה', 'zara'] },
  { name: 'H&M', cat: 'fashion', keys: ['h&m', 'אייץ אנד אם', "אייץ' אנד אם"] },
  { name: 'מנגו', cat: 'fashion', keys: ['מנגו', 'mango'] },
  { name: 'ברשקה', cat: 'fashion', keys: ['ברשקה', 'bershka'] },
  { name: 'פול אנד בר', cat: 'fashion', keys: ['פול אנד בר', 'pull&bear', 'pull and bear'] },
  { name: 'סטרדיווריוס', cat: 'fashion', keys: ['סטרדיווריוס', 'stradivarius'] },
  { name: 'אמריקן איגל', cat: 'fashion', keys: ['אמריקן איגל', 'american eagle'] },
  { name: 'GAP', cat: 'fashion', keys: ['גאפ', 'gap'] },
  { name: 'דלתא', cat: 'fashion', keys: ['דלתא', 'delta'] },
  { name: 'תמנון', cat: 'fashion', keys: ['תמנון', 'tamnoon'] },
  { name: 'אורבניקה', cat: 'fashion', keys: ['אורבניקה', 'urbanica'] },
  { name: 'טוונטי פור סבן', cat: 'fashion', keys: ['טוונטי פור סבן', 'twentyfourseven', '24/7'] },
  { name: 'הוניגמן', cat: 'fashion', keys: ['הוניגמן', 'honigman'] },
  { name: 'קום איל פו', cat: 'fashion', keys: ['קום איל פו', 'comme il faut'] },
  { name: 'לוי׳ס', cat: 'fashion', keys: ['ליוויס', "לוי'ס", 'levis', "levi's"] },
  { name: 'טומי הילפיגר', cat: 'fashion', keys: ['טומי הילפיגר', 'tommy hilfiger'] },
  { name: 'לקוסט', cat: 'fashion', keys: ['לקוסט', 'lacoste'] },
  { name: 'נאוטיקה', cat: 'fashion', keys: ['נאוטיקה', 'nautica'] },
  { name: 'אינטימה', cat: 'fashion', keys: ['אינטימה', 'intima'] },
  { name: 'מקס מארה', cat: 'fashion', keys: ['max mara'] },
  { name: 'יוניקלו', cat: 'fashion', keys: ['יוניקלו', 'uniqlo'] },
  // נעליים
  { name: 'אלדו', cat: 'shoes', keys: ['אלדו', 'aldo'] },
  { name: 'קרוקס', cat: 'shoes', keys: ['קרוקס', 'crocs'] },
  { name: 'סקצ׳רס', cat: 'shoes', keys: ['סקצרס', "סקצ'רס", 'skechers'] },
  { name: 'נאות', cat: 'shoes', keys: ['טבע נאות', 'naot'] },
  { name: 'גלי', cat: 'shoes', keys: ['נעלי גלי', 'gali'] },
  { name: 'סטיב מאדן', cat: 'shoes', keys: ['סטיב מאדן', 'steve madden'] },
  { name: 'טימברלנד', cat: 'shoes', keys: ['טימברלנד', 'timberland'] },
  { name: 'ד״ר מרטנס', cat: 'shoes', keys: ['דר מרטנס', 'dr martens', 'dr. martens'] },
  { name: 'בירקנשטוק', cat: 'shoes', keys: ['בירקנשטוק', 'birkenstock'] },
  { name: 'שו מרקט', cat: 'shoes', keys: ['שו מרקט', 'shoe market'] },
  // ספורט
  { name: 'אדידס', cat: 'sports', keys: ['אדידס', 'adidas'] },
  { name: 'נייקי', cat: 'sports', keys: ['נייקי', 'nike'] },
  { name: 'פומה', cat: 'sports', keys: ['פומה', 'puma'] },
  { name: 'אנדר ארמור', cat: 'sports', keys: ['אנדר ארמור', 'under armour'] },
  { name: 'ריבוק', cat: 'sports', keys: ['ריבוק', 'reebok'] },
  { name: 'ניו באלאנס', cat: 'sports', keys: ['ניו באלאנס', 'new balance'] },
  { name: 'אסיקס', cat: 'sports', keys: ['אסיקס', 'asics'] },
  { name: 'מגה ספורט', cat: 'sports', keys: ['מגה ספורט', 'mega sport'] },
  { name: 'דקטלון', cat: 'sports', keys: ['דקטלון', 'decathlon'] },
  { name: 'The North Face', cat: 'sports', keys: ['נורת פייס', 'north face'] },
  { name: 'קולומביה', cat: 'sports', keys: ['קולומביה', 'columbia'] },
  // ילדים
  { name: 'שילב', cat: 'kids', keys: ['שילב', 'shilav'] },
  { name: 'טויס אר אס', cat: 'kids', keys: ['טויס אר אס', 'toys r us', 'toysrus'] },
  { name: 'כפר השעשועים', cat: 'kids', keys: ['כפר השעשועים'] },
  { name: 'מוצצים', cat: 'kids', keys: ['מוצצים'] },
  // חשמל ואלקטרוניקה
  { name: 'KSP', cat: 'electronics', keys: ['ksp', 'קיי אס פי'] },
  { name: 'באג', cat: 'electronics', keys: ['באג', 'bug'] },
  { name: 'Ivory', cat: 'electronics', keys: ['אייבורי', 'איבורי', 'ivory'] },
  { name: 'מחסני חשמל', cat: 'electronics', keys: ['מחסני חשמל'] },
  { name: 'שקם אלקטריק', cat: 'electronics', keys: ['שקם אלקטריק', 'שקם'] },
  { name: 'אלקטרה', cat: 'electronics', keys: ['אלקטרה', 'electra'] },
  { name: 'iDigital', cat: 'electronics', keys: ['idigital', 'איי דיגיטל'] },
  { name: 'LastPrice', cat: 'electronics', keys: ['lastprice', 'לאסט פרייס'] },
  { name: 'סמסונג', cat: 'electronics', keys: ['סמסונג', 'samsung'] },
  { name: 'דייסון', cat: 'electronics', keys: ['דייסון', 'dyson'] },
  { name: 'ניקון', cat: 'electronics', keys: ['ניקון', 'nikon'] },
  { name: 'ביג אלקטריק', cat: 'electronics', keys: ['ביג אלקטריק'] },
  // טיפוח
  { name: 'סופר-פארם', cat: 'beauty', keys: ['סופר פארם', 'סופר-פארם', 'super-pharm', 'superpharm', 'super pharm'] },
  { name: 'ניו-פארם', cat: 'beauty', keys: ['ניו פארם', 'ניו-פארם', 'new pharm'] },
  { name: 'לאוקסיטן', cat: 'beauty', keys: ['לאוקסיטן', "l'occitane", 'loccitane'] },
  { name: 'MAC', cat: 'beauty', keys: ['mac cosmetics', 'מאק קוסמטיקס'] },
  { name: 'סבון של פעם', cat: 'beauty', keys: ['סבון של פעם'] },
  { name: 'Bath & Body Works', cat: 'beauty', keys: ['bath & body works', 'bath and body works'] },
  { name: 'Sabon', cat: 'beauty', keys: ['sabon', 'סבון'] },
  // תכשיטים / תיקים
  { name: 'פנדורה', cat: 'accessories', keys: ['פנדורה', 'pandora'] },
  { name: 'סברובסקי', cat: 'accessories', keys: ['סברובסקי', 'swarovski'] },
  { name: 'מגנוליה', cat: 'accessories', keys: ['מגנוליה', 'magnolia'] },
  { name: 'סמסונייט', cat: 'accessories', keys: ['סמסונייט', 'samsonite'] },
  { name: 'מיכל נגרין', cat: 'accessories', keys: ['מיכל נגרין', 'michal negrin'] },
  // אופטיקה
  { name: 'אופטיקנה', cat: 'optics', keys: ['אופטיקנה', 'opticana'] },
  { name: 'אופטיקה הלפרין', cat: 'optics', keys: ['הלפרין', 'halperin'] },
  { name: 'אופטיקה ערוצי', cat: 'optics', keys: ['אופטיקה ערוצי'] },
  // ספרים
  { name: 'סטימצקי', cat: 'books', keys: ['סטימצקי', 'steimatzky'] },
  { name: 'צומת ספרים', cat: 'books', keys: ['צומת ספרים'] },
  // סופר
  { name: 'שופרסל', cat: 'grocery', keys: ['שופרסל', 'shufersal'] },
  { name: 'רמי לוי', cat: 'grocery', keys: ['רמי לוי', 'rami levy'] },
  { name: 'ויקטורי', cat: 'grocery', keys: ['ויקטורי', 'victory'] },
  { name: 'יוחננוף', cat: 'grocery', keys: ['יוחננוף'] },
  { name: 'אושר עד', cat: 'grocery', keys: ['אושר עד'] },
  { name: 'חצי חינם', cat: 'grocery', keys: ['חצי חינם'] },
  { name: 'טיב טעם', cat: 'grocery', keys: ['טיב טעם'] },
  // אתרים בחו״ל
  { name: 'Amazon', cat: 'general', region: 'intl', keys: ['אמזון', 'amazon'] },
  { name: 'AliExpress', cat: 'general', region: 'intl', keys: ['עלי אקספרס', 'עליאקספרס', 'אלי אקספרס', 'aliexpress'] },
  { name: 'eBay', cat: 'general', region: 'intl', keys: ['איביי', 'ebay'] },
  { name: 'SHEIN', cat: 'fashion', region: 'intl', keys: ['שיין', 'shein'] },
  { name: 'ASOS', cat: 'fashion', region: 'intl', keys: ['asos'] },
  { name: 'NEXT', cat: 'fashion', region: 'intl', keys: ['נקסט'] },
  { name: 'iHerb', cat: 'beauty', region: 'intl', keys: ['אייהרב', 'איי הרב', 'iherb'] },
  { name: 'Temu', cat: 'general', region: 'intl', keys: ['טמו', 'temu'] },
  { name: 'Walmart', cat: 'general', region: 'intl', keys: ['וולמארט', 'walmart'] },
  { name: 'Carter\'s', cat: 'kids', region: 'intl', keys: ["carter's", 'carters', 'קרטרס'] },
];

// שירותים וחוויות – לא מוצרים
const NOT_PRODUCT = [
  'מלון', 'מלונות', 'צימר', 'נופש', 'חופשה', 'חופשות', 'טיסה', 'טיסות', 'אטרקצי', 'פארק', 'לונה פארק', 'ספא', 'עיסוי', 'מסאז',
  'מסעד', 'ארוחת', 'ארוחה', 'בית קפה', 'בתי קפה', 'פיצה', 'המבורגר', 'בורגר', 'סושי', 'שווארמה', 'גלידה', 'בר יין',
  'קולנוע', 'סרט', 'הופעה', 'הופעות', 'הצגה', 'הצגות', 'מופע', 'תיאטרון', 'מוזיאון', 'קונצרט', 'פסטיבל', 'כרטיסים ל', 'כרטיסי כניסה',
  'סדנה', 'סדנת', 'סדנאות', 'קורס', 'חוג', 'לימודי', 'ביטוח', 'משכנתא', 'הלוואה', 'חדר כושר', 'מכון כושר', 'סטודיו',
  'השכרת רכב', 'ליסינג', 'חניה', 'חנייה', 'דלק', 'טיפולי', 'רופא', 'שיניים', 'ייעוץ', 'אסקייפ', 'פיינטבול', 'קארטינג',
  'גן חיות', 'ספארי', 'בריכה', 'פארק מים', 'אתר סקי', 'חופשת סקי', 'שייט', 'קייטנה', 'קייטנות', 'מספרה', 'קוסמטיקאית', 'הסרת שיער', 'מניקור',
  'הובלה', 'הובלות', 'שיפוץ', 'צילום', 'אירוע', 'אירועים', 'חתונה', 'ציוד לאירוע', 'סיור', 'סיורים', 'טיול', 'טיולים',
  'חבילת גלישה', 'סלולר', 'אינטרנט ביתי', 'טלוויזיה בכבלים', 'סטרימינג', 'מנוי חודשי', 'אפליקציית', 'הימור',
  'ארומה', 'קפה גרג', 'לנדוור', 'מקדונלד', 'דומינו', 'קופיקס', 'בי בי בי', 'bbb',
];
const NOT_PRODUCT_EN = ['hotel', 'spa', 'restaurant', 'flight', 'flights', 'cinema', 'movie', 'concert', 'show', 'tickets', 'insurance',
  'course', 'workshop', 'vacation', 'resort', 'attraction', 'escape room', 'car rental', 'parking', 'fuel'];

const PRODUCT_WORDS = {
  fashion: ['בגדים', 'ביגוד', 'אופנה', 'חולצ', 'מכנס', 'שמלה', 'שמלות', 'ג׳ינס', "ג'ינס", 'ג׳קט', "ג'קט", 'מעיל', 'הלבשה', 'בגד ים', 'בגדי ים', 'פיג׳מ', 'גרביים', 'הלבשה תחתונה'],
  shoes: ['נעל', 'סנדל', 'כפכפ', 'מגפיים'],
  sports: ['ציוד ספורט', 'ביגוד ספורט', 'אופני', 'קורקינט', 'ציוד קמפינג', 'אוהל', 'הליכון'],
  kids: ['תינוק', 'עגלת', 'עגלות', 'צעצוע', 'משחקים לילדים', 'בגדי ילדים', 'מושב בטיחות'],
  home: ['ריהוט', 'רהיט', 'מצעים', 'מגבות', 'כלי בית', 'כלי מטבח', 'סירים', 'מזרן', 'מזרנים', 'ספה', 'ספות', 'שטיח', 'עיצוב הבית', 'כלי עבודה', 'גינון', 'תאורה', 'מנורות'],
  electronics: ['מוצרי חשמל', 'חשמל', 'מחשב', 'סמארטפון', 'טלפון נייד', 'מקרר', 'מכונת כביסה', 'טלוויזי', 'אוזניות', 'מצלמ', 'קונסול', 'שואב', 'מזגן', 'מייבש', 'מדיח', 'תנור', 'גאדג׳ט', "גאדג'ט", 'טאבלט', 'שעון חכם'],
  beauty: ['טיפוח', 'בישום', 'בושם', 'בשמים', 'קוסמטיקה', 'איפור', 'קרם', 'שמפו'],
  accessories: ['תכשיט', 'שעונים', 'שעון יד', 'תיקי גב', 'תיקי יד', 'תיק גב', 'תיק יד', 'מזוודה', 'מזוודות', 'ארנק', 'משקפי שמש'],
  optics: ['משקפיים', 'משקפי ראייה', 'עדשות מגע', 'אופטיקה'],
  books: ['ספרים', 'ספרי קריאה', 'צעצועים', 'משחקי קופסה', 'לגו', 'lego'],
  grocery: ['סופרמרקט', 'מצרכים', 'מוצרי מזון', 'תווי קנייה בסופר'],
  // רשת שלא ברשימה, אבל ההטבה מדברת בשפה של קנייה (שירותים נבדקים קודם, ולכן לא נכנסים מכאן)
  general: ['רשתות שיווק', 'כל בו', 'קניות אונליין', 'משלוח חינם', 'בקנייה', 'בקניה', 'ברכישת', 'ברכישה', 'קולקציה', 'קולקציית',
    'פריטים', 'כל המוצרים', 'מוצרי הרשת', 'בחנויות הרשת', 'בסניפי הרשת', 'באתר הרשת', 'באתר האינטרנט של', 'אונליין', 'קוד קופון',
    'תו קנייה', 'תווי קנייה', 'גיפט קארד', 'כרטיס מתנה', 'שובר קנייה', 'שוברי קנייה', 'עודפים', 'סוף עונה', 'סייל'],
};
const PRODUCT_EN = {
  fashion: ['clothing', 'apparel', 'fashion', 'jeans', 'dress', 'jacket'],
  shoes: ['shoes', 'sneakers', 'boots', 'sandals'],
  electronics: ['electronics', 'laptop', 'headphones', 'tv', 'appliances'],
  home: ['furniture', 'bedding', 'kitchenware', 'home decor'],
  beauty: ['beauty', 'cosmetics', 'perfume', 'skincare'],
  kids: ['toys', 'baby'],
};

const norm = (s) => ` ${String(s ?? '').toLowerCase().replace(/[׳'"״`]/g, "'").replace(/[‎‏]/g, '').replace(/\s+/g, ' ')} `;
const plain = (k) => k.toLowerCase().replace(/[׳'"״`]/g, "'");
const isLatin = (k) => /^[a-z0-9 .&/'-]+$/.test(k);
const escape = (k) => k.replace(/[.*+?^${}()|[\]\\/&]/g, '\\$&');
const latinWord = (k) => new RegExp(`(^|[^a-z0-9])${escape(k)}($|[^a-z0-9])`);
const has = (hay, k) => {
  const p = plain(k);
  return isLatin(p) ? latinWord(p).test(hay) : hay.includes(p);
};

/** הרשת/האתר שבהטבה (הראשון לפי סדר הרשימה). */
export function detectBrand(text) {
  const hay = norm(text);
  return BRANDS.find((b) => b.keys.some((k) => has(hay, k))) ?? null;
}

/**
 * @returns {{ ok: boolean, category: string|null, brand: string|null, region: 'il'|'intl', reason: string }}
 */
export function classify({ title = '', text = '' }) {
  const all = `${title} ${text}`;
  const hay = norm(all);
  const brand = detectBrand(all);
  const region = brand?.region === 'intl' ? 'intl' : 'il';
  if (brand) return { ok: true, category: brand.cat, brand: brand.name, region, reason: 'brand' };
  if (NOT_PRODUCT.some((k) => has(hay, k)) || NOT_PRODUCT_EN.some((k) => has(hay, k))) {
    return { ok: false, category: null, brand: null, region, reason: 'service' };
  }
  for (const [cat, words] of Object.entries(PRODUCT_WORDS)) {
    if (words.some((k) => has(hay, k)) || (PRODUCT_EN[cat] ?? []).some((k) => has(hay, k))) {
      return { ok: true, category: cat, brand: null, region, reason: 'keyword' };
    }
  }
  return { ok: false, category: null, brand: null, region, reason: 'unknown' };
}

/** ההנחה כטקסט קצר לכרטיס: "20%", "עד 30%", "1+1", "₪50". percent רק כשהוא חד-משמעי. */
export function discountOf(s) {
  const t = String(s ?? '');
  const pcts = [...new Set([...t.matchAll(/(\d{1,2}(?:\.\d)?)\s?%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 90))];
  const upTo = /עד\s?-?\s?\d{1,2}(?:\.\d)?\s?%|up to \d/i.test(t);
  const minSpend = t.match(/מעל\s?₪?\s?(\d{2,5})/);
  const base = { minSpend: minSpend ? Number(minSpend[1]) : null };
  if (pcts.length === 1 && !upTo) return { ...base, percent: pcts[0], label: `${pcts[0]}%` };
  if (pcts.length) return { ...base, percent: null, label: `עד ${Math.max(...pcts)}%`, upTo: Math.max(...pcts) };
  if (/1\s?\+\s?1/.test(t)) return { ...base, percent: null, label: '1+1' };
  const ils = t.match(/₪\s?(\d{1,5})|(\d{1,5})\s?(?:₪|ש"?ח)/);
  if (ils) return { ...base, percent: null, label: `₪${ils[1] ?? ils[2]}` };
  if (/מתנה/.test(t)) return { ...base, percent: null, label: 'מתנה' };
  return { ...base, percent: null, label: 'הטבה' };
}
