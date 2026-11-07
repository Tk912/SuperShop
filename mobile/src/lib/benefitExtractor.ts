// קריאת הטבות מעמוד באתר מועדון (רץ בתוך ה-WebView, אחרי שהמשתמש התחבר בעצמו).
//
// אין לנו גישה למבנה של אתרי המועדונים, ולכן זה זיהוי כללי של "כרטיסי הטבה":
//  • כרטיס = רכיב קצר יחסית (8–350 תווים) שיש בו סימן להנחה: אחוז, ₪, 1+1, מתנה, חינם.
//  • מכל רכיב כזה עולים במבנה העמוד עד הרמה שעוד לא כוללת הנחה של כרטיס שכן – זה הכרטיס.
//  • מכל כרטיס: כותרת (כותרת/מודגש/alt של תמונה), טקסט, קישור ותמונה.
//  • עמוד עם שדה סיסמה = עדיין לא מחוברים.
// הסקריפט גולל לתחתית כמה פעמים לפני הקריאה, כדי לטעון הטבות שנטענות בגלילה.
//
// הוא חייב להיות מחרוזת: ב-Hermes אין גישה לקוד המקור של פונקציות. הבדיקות קוראות את הקטע שבין BEGIN ל-END.
export const EXTRACT_BENEFITS_JS = String.raw`/*BEGIN-EXTRACTOR*/
(async function () {
  var send = function (msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.__supershopResult = msg;
  };
  try {
    if (document.querySelector('input[type=password]')) { send({ type: 'benefits', needsLogin: true, url: location.href, items: [] }); return; }
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    for (var i = 0; i < 6; i++) { window.scrollTo(0, document.body.scrollHeight); await sleep(600); }
    window.scrollTo(0, 0);

    var STRONG = /(\d{1,2}(?:\.\d)?\s?%|₪\s?\d+|\d+(?:[.,]\d+)?\s?₪|\d+\s?ש"?ח|1\s?\+\s?1|מתנה|חינם|free)/i;
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, HEAD: 1, svg: 1, SVG: 1, BUTTON: 1, INPUT: 1, SELECT: 1, OPTION: 1, NAV: 1, FOOTER: 1, HEADER: 1 };
    var textOf = function (el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); };

    var all = Array.prototype.slice.call(document.body.querySelectorAll('*'));
    var cands = all.filter(function (el) {
      if (SKIP[el.tagName] || el.closest('nav,footer,header')) return false;
      var t = textOf(el);
      return t.length >= 8 && t.length <= 350 && STRONG.test(t);
    });
    // עלים = מועמדים שאין בתוכם מועמד אחר (למשל <p>הנחה של 20%…</p>)
    var leaves = cands.filter(function (el) { return !cands.some(function (o) { return o !== el && el.contains(o); }); });
    var count = function (node) { return leaves.filter(function (l) { return node.contains(l); }).length; };
    // מכל עלה עולים למעלה כל עוד ההורה לא מכיל עלה של כרטיס אחר, והטקסט עדיין קצר – זה הכרטיס
    var cards = [];
    leaves.forEach(function (leaf) {
      var node = leaf;
      while (node.parentElement && node.parentElement !== document.body) {
        var parent = node.parentElement;
        if (count(parent) > count(node) || textOf(parent).length > 350) break;
        node = parent;
      }
      if (cards.indexOf(node) < 0) cards.push(node);
    });
    var abs = function (u) { try { return new URL(u, location.href).href; } catch (e) { return null; } };
    var seen = new Set();
    var items = [];
    cards.forEach(function (el) {
      var text = textOf(el).slice(0, 300);
      if (seen.has(text)) return; seen.add(text);
      var h = el.querySelector('h1,h2,h3,h4,h5,h6,strong,b,[class*=title],[class*=Title],[class*=name],[class*=Name]');
      var img = el.querySelector('img');
      var title = (h && textOf(h)) || (img && img.alt) || text.split(/[.\n|·•–-]/)[0];
      var a = el.closest('a') || el.querySelector('a[href]');
      var link = a && a.getAttribute('href') && !/^(javascript:|#)/.test(a.getAttribute('href')) ? abs(a.getAttribute('href')) : null;
      items.push({ title: title.slice(0, 80), text: text, link: link, image: img ? abs(img.currentSrc || img.src) : null });
    });
    send({ type: 'benefits', needsLogin: false, url: location.href, title: document.title, items: items.slice(0, 300) });
  } catch (e) {
    send({ type: 'benefits', error: String(e && e.message || e), url: location.href, items: [] });
  }
})();
true;
/*END-EXTRACTOR*/`;

export type ExtractedBenefit = { title: string; text: string; link: string | null; image: string | null };
export type ExtractResult = { type: 'benefits'; needsLogin?: boolean; error?: string; url: string; title?: string; items: ExtractedBenefit[] };

export type StoreAlias = { id: string; name: string; aliases: string[] };
export type ClubBenefitItem = ExtractedBenefit & { id: string; storeId: string | null; percent: number | null; minSpend: number | null; page: string };

const norm = (s: string) => s.toLowerCase().replace(/[׳'"״`]/g, '').replace(/\s+/g, ' ');

/** מזהה אם ההטבה היא בחנות שבהשוואה, ואת אחוז ההנחה (אם יש בדיוק אחוז אחד ברור). */
export function enrich(b: ExtractedBenefit, page: string, stores: StoreAlias[]): ClubBenefitItem {
  const hay = ` ${norm(`${b.title} ${b.text}`)} `;
  const store = stores.find((s) => [s.name, ...s.aliases].some((a) => {
    const n = norm(a);
    return n.length >= 2 && (/^[a-z0-9 .]+$/.test(n) ? new RegExp(`(^|[^a-z0-9])${n.replace(/[.]/g, '\\.')}([^a-z0-9]|$)`).test(hay) : hay.includes(n));
  }));
  // אחוז שמוחל אוטומטית על המחיר – רק כשהוא חד-משמעי: אחוז אחד, ובלי "עד" לפניו (ב"עד 20%" או "10%–20%" לא מנחשים)
  const all = `${b.title} ${b.text}`;
  const pcts = [...new Set([...all.matchAll(/(\d{1,2}(?:\.\d)?)\s?%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 50))];
  const upTo = /עד\s?-?\s?\d{1,2}(?:\.\d)?\s?%|up to \d/i.test(all);
  const percent = pcts.length === 1 && !upTo ? pcts[0] : null;
  // מינימום קנייה: "בקנייה מעל 500 ש"ח" / "מעל ₪300"
  const min = all.match(/מעל\s?₪?\s?(\d{2,5})(?:\s?(?:₪|ש"?ח))?/);
  const id = `${page}|${b.title}|${b.text}`.slice(0, 400);
  return { ...b, id, page, storeId: store?.id ?? null, percent, minSpend: min ? Number(min[1]) : null };
}
