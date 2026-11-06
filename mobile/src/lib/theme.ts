import { useColorScheme } from 'react-native';

const light = {
  bg: '#f6f7fb', card: '#ffffff', ink: '#0f172a', muted: '#64748b', line: '#e2e8f0',
  brand: '#c2410c', brandSoft: '#fff7ed', good: '#059669', goodSoft: '#ecfdf5', warn: '#b45309', warnSoft: '#fffbeb',
  intl: '#0369a1', intlSoft: '#e0f2fe',
};
const dark: typeof light = {
  bg: '#0b1020', card: '#131a2e', ink: '#e5e7eb', muted: '#94a3b8', line: '#243049',
  brand: '#fb923c', brandSoft: '#431407', good: '#34d399', goodSoft: '#052e22', warn: '#fbbf24', warnSoft: '#3a2a05',
  intl: '#38bdf8', intlSoft: '#082f49',
};
export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);

// סימן כיוון מימין לשמאל: שורה שמתחילה באנגלית (למשל שם מותג) לא תהפוך את סדר החלקים
export const RLM = '\u200f';

export const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');
export const money = (n: number, cur: string) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'ILS' ? 0 : 2 }).format(n);

const CATS: Record<string, string> = { phones: 'סמארטפונים', audio: 'אודיו', gaming: 'גיימינג', computers: 'מחשבים',
  appliances: 'מוצרי חשמל', wearables: 'שעונים חכמים', tablets: 'טאבלטים וקוראים', health: 'בריאות' };
export const catName = (c: string) => CATS[c] ?? c;
