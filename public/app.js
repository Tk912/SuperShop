const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ils = (n) => '₪' + Math.round(n).toLocaleString('he-IL');
const money = (n, cur) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'ILS' ? 0 : 2 }).format(n);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let meta = null;
let myClubs = store.get('myClubs', []);
let lastProductId = null;

// ---------------- מועדונים ----------------
function renderClubs() {
  $('#clubs').innerHTML = meta.clubs.map((c) =>
    `<button class="chip" data-club="${c.id}" aria-pressed="${myClubs.includes(c.id)}" title="${esc(c.description)}">${esc(c.name)}</button>`).join('');
}
$('#clubs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-club]');
  if (!b) return;
  const id = b.dataset.club;
  myClubs = myClubs.includes(id) ? myClubs.filter((x) => x !== id) : [...myClubs, id];
  store.set('myClubs', myClubs);
  renderClubs();
  if (lastProductId) showProduct(lastProductId); // חישוב מחדש עם המועדונים החדשים
});

// ---------------- השלמה אוטומטית ----------------
const input = $('#q');
const list = $('#suggestions');
let sugg = [];
let active = -1;
let debounce;
let reqSeq = 0;

function highlight(text, q) {
  const words = q.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return esc(text);
  const re = new RegExp(`(${words.join('|')})`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

function renderSuggestions(q) {
  if (!sugg.length) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  list.innerHTML = sugg.map((p, i) => `
    <li role="option" id="opt-${i}" data-id="${p.id}" aria-selected="${i === active}">
      <img src="${p.image}" alt="" loading="lazy" />
      <div><div class="s-name">${highlight(p.name, q)}</div><div class="s-sub">${esc(p.brand)} · ${esc(catName(p.category))}</div></div>
    </li>`).join('');
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-activedescendant', active >= 0 ? `opt-${active}` : '');
}

input.addEventListener('input', () => {
  clearTimeout(debounce);
  const q = input.value;
  debounce = setTimeout(async () => {
    const seq = ++reqSeq;
    if (!q.trim()) { sugg = []; renderSuggestions(q); return; }
    const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`).then((x) => x.json());
    if (seq !== reqSeq) return; // תשובה ישנה
    sugg = r.suggestions; active = -1;
    renderSuggestions(q);
  }, 120);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && sugg.length) { e.preventDefault(); active = (active + 1) % sugg.length; renderSuggestions(input.value); }
  else if (e.key === 'ArrowUp' && sugg.length) { e.preventDefault(); active = (active - 1 + sugg.length) % sugg.length; renderSuggestions(input.value); }
  else if (e.key === 'Escape') { sugg = []; renderSuggestions(''); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (active >= 0) go(`p=${sugg[active].id}`);
    else if (input.value.trim()) go(`q=${encodeURIComponent(input.value.trim())}`);
  }
});
list.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) { e.preventDefault(); go(`p=${li.dataset.id}`); }
});
input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 100));
input.addEventListener('focus', () => { if (sugg.length) list.hidden = false; });

function go(hash) {
  sugg = []; renderSuggestions('');
  location.hash = hash;
}

// ---------------- תצוגות ----------------
const CATS = { phones: 'סמארטפונים', audio: 'אודיו', gaming: 'גיימינג', computers: 'מחשבים', appliances: 'מוצרי חשמל',
  wearables: 'שעונים חכמים', tablets: 'טאבלטים וקוראים', health: 'בריאות' };
const catName = (c) => CATS[c] ?? c;

function tile(p) {
  return `<a class="tile" href="#p=${p.id}"><img src="${p.image}" alt="" loading="lazy" /><div>${esc(p.name)}</div></a>`;
}

function showHome() {
  lastProductId = null;
  $('#main').innerHTML = `<section class="hero">
    <h1>המחיר האמיתי, עד הדלת</h1>
    <p>משווים חנויות בישראל ובחו"ל, כולל הנחות מועדון, קופונים, משלוח, מע"מ ומכס, וגם שילוח צד ג' כשהחנות לא שולחת לארץ.</p>
    <div class="popular">${meta.popular.map(tile).join('')}</div></section>`;
}

async function showSearch(q) {
  lastProductId = null;
  input.value = q;
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((x) => x.json());
  $('#main').innerHTML = r.results.length
    ? `<h2>תוצאות עבור "${esc(q)}"</h2><div class="popular">${r.results.map(tile).join('')}</div>`
    : `<h2>לא נמצאו תוצאות עבור "${esc(q)}"</h2><p class="muted">נסו ניסוח אחר, בעברית או באנגלית.</p>`;
}

let filter = 'all';

async function showProduct(id) {
  lastProductId = id;
  $('#main').innerHTML = '<p class="muted">מחשב מחירים עד הבית…</p>';
  const r = await fetch(`/api/products/${encodeURIComponent(id)}/offers?clubs=${myClubs.join(',')}`).then((x) => x.json());
  if (r.error) { $('#main').innerHTML = '<h2>המוצר לא נמצא</h2>'; return; }
  input.value = r.product.name;
  const best = r.offers[0];
  const bestLocal = r.offers.find((o) => o.storeType === 'local');
  const bestIntl = r.offers.find((o) => o.storeType === 'intl');
  const saving = bestLocal && bestIntl ? Math.abs(bestLocal.totalIls - bestIntl.totalIls) : 0;

  $('#main').innerHTML = `
    <div class="product-head">
      <img src="${r.product.image}" alt="${esc(r.product.name)}" />
      <div><h1>${esc(r.product.name)}</h1>
        <div class="meta">${esc(r.product.brand)} · ${esc(catName(r.product.category))} · משקל משלוח ~${r.product.weightKg} ק"ג · ${r.offers.length} הצעות</div></div>
    </div>
    ${best ? `<div class="best">
      <div>הכי משתלם עד הבית: <b>${esc(best.storeName)}</b> · ${esc(best.best.name)}</div>
      <div class="big">${ils(best.totalIls)}</div>
      ${bestLocal && bestIntl ? `<div class="muted">הכי זול בארץ ${ils(bestLocal.totalIls)} · הכי זול מחו"ל ${ils(bestIntl.totalIls)}
        (${bestIntl.totalIls < bestLocal.totalIls ? 'חו"ל' : 'בארץ'} זול ב-${ils(saving)})</div>` : ''}
    </div>` : ''}
    ${r.errors.length ? `<p class="hint">חלק מהספקים לא הגיבו: ${r.errors.map((e) => esc(e.provider)).join(', ')}</p>` : ''}
    <div class="tabs" role="tablist">
      ${[['all', 'הכל'], ['local', 'ישראל'], ['intl', 'חו"ל']].map(([k, l]) =>
        `<button role="tab" data-f="${k}" aria-selected="${filter === k}">${l}</button>`).join('')}
    </div>
    <div id="offers"></div>`;

  const renderOffers = () => {
    const list = r.offers.filter((o) => filter === 'all' || o.storeType === filter);
    $('#offers').innerHTML = list.map((o, i) => offerCard(o, o === best)).join('') || '<p class="muted">אין הצעות בסינון זה.</p>';
  };
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x.dataset.f === filter));
    renderOffers();
  });
  renderOffers();
  $('#fxinfo').textContent = ` · שער דולר: ₪${r.fx.rates.USD.toFixed(3)} (${r.fx.source === 'live' ? 'עדכני' : 'קבוע'})`;
}

function offerCard(o, isBest) {
  const b = o.best;
  const disc = o.discounts.applied.map((d) => d.kind === 'club'
    ? `<span class="club">✔ ${esc(d.name)}: ${esc(d.label)} (−${ils(d.amountIls)})</span>`
    : `<span class="club">✔ קופון <span class="code">${esc(d.code)}</span> ${esc(d.label)} (−${ils(d.amountIls)})
        <button class="chip copy" data-code="${esc(d.code)}" title="העתקה">העתק</button>${d.verified ? '' : ' <span class="badge warn">לא מאומת</span>'}</span>`).join('');
  const otherCoupons = o.discounts.availableCoupons.filter((c) => !o.discounts.applied.some((a) => a.code === c.code));
  const taxes = b.taxes;
  const taxLine = o.storeType === 'local' ? 'כולל מע"מ'
    : taxes.exempt ? `פטור ממסים (ערך $${taxes.valueUsd})`
    : `מסים: ${ils(taxes.totalIls)}` + (taxes.dutyIls ? ` (כולל מכס ${ils(taxes.dutyIls)})` : '');

  return `<article class="offer ${isBest ? 'top1' : ''}">
    <div class="offer-row">
      <div>
        <div class="store">${esc(o.storeName)}<span class="badge ${o.storeType}">${o.storeType === 'local' ? 'ישראל' : 'חו"ל'}</span>
          ${o.storeType === 'intl' && !o.shipsDirectToIL ? '<span class="badge warn">אין משלוח לארץ</span>' : ''}</div>
        <div class="muted">${esc(o.domain)}${o.source !== 'demo' ? ` · ${esc(o.source)}` : ''}</div>
      </div>
      <div class="price-orig">${money(o.price, o.currency)}${o.currency !== 'ILS' ? `<div class="muted">≈ ${ils(o.priceIls)}</div>` : ''}</div>
      <div class="disc">
        ${disc || '<span class="muted">אין הנחה זמינה עבורך</span>'}
        <span class="muted">🚚 ${esc(b.name)}: ${b.shippingIls ? ils(b.shippingIls) : 'חינם'} · ${esc(b.days)} ימים · ${taxLine}</span>
      </div>
      <div class="total"><div class="amt">${ils(o.totalIls)}</div><div class="muted">סה"כ עד הבית</div>
        <a href="${esc(o.url)}" target="_blank" rel="noopener nofollow">לאתר ←</a></div>
    </div>
    ${o.missedClubs.length ? `<div class="hint">💡 ${o.missedClubs.map((m) => `חברי <b>${esc(m.name)}</b> חוסכים כאן ${ils(m.amountIls)}`).join(' · ')}</div>` : ''}
    ${otherCoupons.length ? `<div class="muted" style="margin-top:6px">קופונים נוספים: ${otherCoupons.map((c) => `<span class="code">${esc(c.code)}</span> ${esc(c.label)}`).join(' · ')}</div>` : ''}
    <details><summary>כל אפשרויות המשלוח (${o.routes.length})</summary>
      <div class="table-wrap"><table>
        <thead><tr><th>מסלול</th><th>משלוח</th><th>מע"מ</th><th>מכס</th><th>עמלות</th><th>זמן</th><th>סה"כ</th></tr></thead>
        <tbody>${o.routes.map((rt, i) => `<tr class="${i === 0 ? 'best-route' : ''}">
          <td>${esc(rt.name)}${rt.note ? `<div class="muted">${esc(rt.note)}${rt.chargeableKg ? ` · משקל מחויב ${rt.chargeableKg} ק"ג` : ''}</div>` : ''}</td>
          <td>${rt.shippingIls ? ils(rt.shippingIls) : 'חינם'}</td><td>${ils(rt.taxes.vatIls)}</td><td>${ils(rt.taxes.dutyIls)}</td>
          <td>${ils(rt.taxes.feeIls)}</td><td>${esc(rt.days)}</td><td>${ils(rt.totalIls)}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </article>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('.copy');
  if (!b) return;
  navigator.clipboard?.writeText(b.dataset.code).then(() => { b.textContent = 'הועתק ✓'; });
});

// ---------------- ניתוב ----------------
function route() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('p')) showProduct(h.get('p'));
  else if (h.get('q')) showSearch(h.get('q'));
  else showHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

(async () => {
  meta = await fetch('/api/meta').then((x) => x.json());
  renderClubs();
  route();
})();
