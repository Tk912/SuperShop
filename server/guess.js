// ניחוש קטגוריה ומשקל משלוח למוצרים שמגיעים מספקים חיים (Google לא מחזיר משקל).
// המשקל משמש לחישוב שילוח צד ג', ולכן מסומן כ"משוער" בממשק.
import { normalize } from './search/normalize.js';

const RULES = [
  ['phones', ['iphone', 'galaxy', 'pixel', 'smartphone', 'phone', 'אייפון', 'גלקסי', 'סמארטפון', 'טלפון', 'פלאפון']],
  ['audio', ['airpods', 'headphone', 'earbuds', 'speaker', 'soundbar', 'אוזניות', 'רמקול', 'מקרן קול']],
  ['gaming', ['playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'console', 'controller', 'פלייסטיישן', 'קונסולה', 'שלט']],
  ['wearables', ['watch', 'garmin', 'fitbit', 'שעון']],
  ['tablets', ['ipad', 'tablet', 'kindle', 'טאבלט', 'קינדל']],
  ['computers', ['laptop', 'macbook', 'notebook', 'monitor', 'ssd', 'mouse', 'keyboard', 'מחשב', 'מסך', 'עכבר', 'מקלדת', 'כונן']],
  ['tv', ['tv', 'oled', 'qled', 'טלוויזיה']],
  ['appliances', ['vacuum', 'dyson', 'fryer', 'blender', 'coffee', 'espresso', 'שואב', 'סיר', 'בלנדר', 'מכונת קפה', 'מקרר', 'מייבש']],
  ['health', ['vitamin', 'supplement', 'protein', 'ויטמין', 'תוסף', 'חלבון']],
  ['furniture', ['chair', 'desk', 'sofa', 'כיסא', 'שולחן', 'ספה']],
];

// משקל משלוח טיפוסי (ק"ג) ומידות אריזה (ס"מ) לפי קטגוריה
const TYPICAL = {
  phones: [0.5, [18, 10, 6]], audio: [0.8, [25, 20, 9]], gaming: [2.5, [40, 30, 12]], wearables: [0.4, [14, 10, 8]],
  tablets: [0.9, [30, 22, 5]], computers: [1.5, [36, 25, 8]], tv: [18, [140, 85, 15]], appliances: [6, [50, 35, 35]],
  health: [0.3, [12, 7, 7]], furniture: [18, [70, 65, 35]], other: [1.5, [30, 25, 15]],
};

export function guessCategory(title) {
  const t = normalize(title);
  for (const [cat, words] of RULES) if (words.some((w) => t.includes(normalize(w)))) return cat;
  return 'other';
}

export function typicalShipping(category) {
  const [weightKg, dims] = TYPICAL[category] ?? TYPICAL.other;
  return { weightKg, dims };
}
