// תמונת קטלוג חלופית (SVG) למוצרי הדמו. ספקים חיים מחזירים תמונות אמיתיות (thumbnail).
const ICONS = {
  phones: '<rect x="70" y="35" width="60" height="110" rx="10" fill="none" stroke="#fff" stroke-width="6"/><circle cx="100" cy="132" r="4" fill="#fff"/>',
  audio: '<path d="M55 115v-20a45 45 0 0 1 90 0v20" fill="none" stroke="#fff" stroke-width="7"/><rect x="45" y="105" width="22" height="35" rx="6" fill="#fff"/><rect x="133" y="105" width="22" height="35" rx="6" fill="#fff"/>',
  gaming: '<rect x="45" y="70" width="110" height="55" rx="25" fill="none" stroke="#fff" stroke-width="6"/><path d="M70 97h20M80 87v20" stroke="#fff" stroke-width="6"/><circle cx="125" cy="92" r="5" fill="#fff"/><circle cx="135" cy="104" r="5" fill="#fff"/>',
  computers: '<rect x="55" y="50" width="90" height="60" rx="5" fill="none" stroke="#fff" stroke-width="6"/><path d="M40 125h120" stroke="#fff" stroke-width="7" stroke-linecap="round"/>',
  appliances: '<rect x="65" y="40" width="70" height="100" rx="12" fill="none" stroke="#fff" stroke-width="6"/><circle cx="100" cy="95" r="22" fill="none" stroke="#fff" stroke-width="6"/>',
  wearables: '<rect x="72" y="65" width="56" height="60" rx="14" fill="none" stroke="#fff" stroke-width="6"/><path d="M82 65V40h36v25M82 125v25h36v-25" fill="none" stroke="#fff" stroke-width="5"/>',
  tablets: '<rect x="60" y="40" width="80" height="105" rx="8" fill="none" stroke="#fff" stroke-width="6"/><path d="M75 65h50M75 80h50M75 95h35" stroke="#fff" stroke-width="4"/>',
  health: '<rect x="70" y="55" width="60" height="85" rx="10" fill="none" stroke="#fff" stroke-width="6"/><rect x="65" y="40" width="70" height="18" rx="4" fill="#fff"/><path d="M100 80v35M83 97h34" stroke="#fff" stroke-width="7"/>',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function productSvg(p) {
  const icon = ICONS[p.category] ?? ICONS.computers;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
<rect width="200" height="200" rx="18" fill="url(#g)"/>${icon}
<text x="100" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#fff">${esc(p.brand)}</text>
</svg>`;
}
