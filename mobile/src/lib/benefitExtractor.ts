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
  var t0 = Date.now();
  var diag = { stage: 'start', elements: 0, frames: 0, sameOriginFrames: 0, shadowRoots: 0, textHits: 0, cards: 0, hiddenPassword: 0 };
  var send = function (msg) {
    msg.diag = diag; msg.ms = Date.now() - t0;
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.__supershopResult = msg;
  };
  var progress = function (stage, extra) { diag.stage = stage; if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', stage: stage, extra: extra || null })); };
  try {
    progress('started');
    var visible = function (el) {
      if (!el || !el.getBoundingClientRect) return false;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      var cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    };
    // כל המסמכים: העמוד עצמו, מסגרות מאותו אתר, ושורשי shadow DOM פתוחים
    var roots = [document];
    var frames = Array.prototype.slice.call(document.querySelectorAll('iframe'));
    diag.frames = frames.length;
    frames.forEach(function (f) { try { if (f.contentDocument && f.contentDocument.body) { roots.push(f.contentDocument); diag.sameOriginFrames++; } } catch (e) {} });
    var all = [];
    roots.forEach(function (d) { all = all.concat(Array.prototype.slice.call(d.querySelectorAll('*'))); });
    all.forEach(function (el) { if (el.shadowRoot) { roots.push(el.shadowRoot); diag.shadowRoots++; } });
    diag.elements = all.length;

    // לא מחוברים = יש שדה סיסמה *גלוי* (טופס כניסה נסתר שנשאר בעמוד לא נחשב)
    var pw = [];
    roots.forEach(function (d) { pw = pw.concat(Array.prototype.slice.call(d.querySelectorAll('input[type=password]'))); });
    var visiblePw = pw.filter(visible);
    diag.hiddenPassword = pw.length - visiblePw.length;
    if (visiblePw.length) { send({ type: 'benefits', needsLogin: true, url: location.href, items: [] }); return; }

    progress('scrolling');
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var lastH = -1;
    for (var i = 0; i < 6; i++) {
      var h = document.body.scrollHeight;
      if (h === lastH) break; // אין עוד מה לטעון
      lastH = h; window.scrollTo(0, h); await sleep(500);
    }
    window.scrollTo(0, 0);

    progress('scanning');
    var STRONG = /(\d{1,2}(?:\.\d)?\s?%|₪\s?\d+|\d+(?:[.,]\d+)?\s?₪|\d+\s?ש"?ח|1\s?\+\s?1|מתנה|חינם|free)/i;
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, HEAD: 1, svg: 1, SVG: 1, BUTTON: 1, INPUT: 1, SELECT: 1, OPTION: 1, TEXTAREA: 1 };
    var len = new Map();
    var textLen = function (el) { if (!len.has(el)) len.set(el, (el.textContent || '').replace(/\s+/g, ' ').trim().length); return len.get(el); };
    var textOf = function (el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); };
    var parentOf = function (n) { return n.parentElement || (n.parentNode && n.parentNode.host) || null; };

    // מעבר אחד על צומתי הטקסט: הורה של טקסט עם סימן הנחה = "עלה"
    var leaves = [];
    var seenLeaf = new Set();
    roots.forEach(function (d) {
      var base = d.body || d;
      var w = (d.createTreeWalker ? d : document).createTreeWalker(base, NodeFilter.SHOW_TEXT);
      var n;
      while ((n = w.nextNode())) {
        if (!STRONG.test(n.nodeValue)) continue;
        var el = n.parentElement;
        // מעלים "20%" בתוך <span> לרמה שיש בה גם הקשר (לפחות 8 תווים)
        while (el && textLen(el) < 8 && parentOf(el)) el = parentOf(el);
        if (!el || SKIP[el.tagName] || seenLeaf.has(el)) continue;
        if (el.closest && el.closest('nav,footer,header,[role=navigation],[role=banner],[role=contentinfo]')) continue;
        if (textLen(el) > 350 || !visible(el)) continue;
        seenLeaf.add(el); leaves.push(el);
      }
    });
    diag.textHits = leaves.length;

    // כמה עלים יש בתוך כל רכיב (מחושב פעם אחת, מלמטה למעלה)
    var count = new Map();
    leaves.forEach(function (l) { for (var a = l; a; a = parentOf(a)) count.set(a, (count.get(a) || 0) + 1); });
    var cnt = function (el) { return count.get(el) || 0; };
    // מכל עלה עולים כל עוד ההורה לא מכיל עלה של כרטיס אחר, והטקסט עדיין קצר – זה הכרטיס
    var cards = [];
    var cardSet = new Set();
    leaves.forEach(function (leaf) {
      var node = leaf;
      for (;;) {
        var parent = parentOf(node);
        if (!parent || parent === document.body || parent === document.documentElement) break;
        if (cnt(parent) > cnt(node) || textLen(parent) > 350) break;
        node = parent;
      }
      if (!cardSet.has(node)) { cardSet.add(node); cards.push(node); }
    });
    diag.cards = cards.length;

    var abs = function (u) { try { return new URL(u, location.href).href; } catch (e) { return null; } };
    var seen = new Set();
    var items = [];
    cards.forEach(function (el) {
      var text = textOf(el).slice(0, 300);
      if (text.length < 8 || seen.has(text)) return; seen.add(text);
      var h = el.querySelector('h1,h2,h3,h4,h5,h6,strong,b,[class*=title],[class*=Title],[class*=name],[class*=Name]');
      var img = el.querySelector('img');
      var title = (h && textOf(h)) || (img && img.alt) || text.split(/[.\n|·•–-]/)[0];
      var a = (el.closest && el.closest('a')) || el.querySelector('a[href]');
      var href = a && a.getAttribute('href');
      var link = href && !/^(javascript:|#)/.test(href) ? abs(href) : null;
      items.push({ title: title.slice(0, 80), text: text, link: link, image: img ? abs(img.currentSrc || img.src) : null });
    });
    diag.stage = 'done';
    send({ type: 'benefits', needsLogin: false, url: location.href, title: document.title, items: items.slice(0, 300) });
  } catch (e) {
    send({ type: 'benefits', error: String(e && e.message || e), url: location.href, items: [] });
  }
})();
true;
/*END-EXTRACTOR*/`;

/** בדיקת חיבור לעמוד: אם ההודעה הזו לא חוזרת – אין תקשורת בין האפליקציה לעמוד. */
export const PING_JS = `(function(){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ping', url: location.href })); } catch (e) {} })(); true;`;

export type ExtractedBenefit = { title: string; text: string; link: string | null; image: string | null };
export type ExtractDiag = { stage: string; elements: number; frames: number; sameOriginFrames: number; shadowRoots: number; textHits: number; cards: number; hiddenPassword: number };
export type ExtractResult = { type: 'benefits'; needsLogin?: boolean; error?: string; url: string; title?: string; items: ExtractedBenefit[]; diag?: ExtractDiag; ms?: number };
export type ExtractMessage = ExtractResult | { type: 'progress'; stage: string } | { type: 'ping'; url: string };

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
