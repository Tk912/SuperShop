// נרמול טקסט לחיפוש: אותיות קטנות, הסרת ניקוד/גרש/סימנים, אותיות סופיות → רגילות.
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
    .replace(/[׳'"״`]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokens(s) {
  return normalize(s).split(' ').filter(Boolean);
}

export function levenshtein(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
