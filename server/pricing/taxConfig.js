// כללי מיסוי ליבוא אישי לישראל – ניתנים לשינוי (הרגולציה משתנה מעת לעת).
// ערך לחישוב = מחיר המוצר + דמי משלוח (ערך CIF), בדולרים.
// ⚠️ מדובר בהערכה בלבד – לא ייעוץ מס. יש לאמת מול אתר רשות המסים.
export const taxConfig = {
  vatRate: Number(process.env.IL_VAT_RATE ?? 0.18),
  vatExemptUpToUsd: Number(process.env.IL_VAT_EXEMPT_USD ?? 75),
  customsExemptUpToUsd: Number(process.env.IL_CUSTOMS_EXEMPT_USD ?? 500),
  // מכס + מס קנייה משוערים לפי קטגוריה (מעל סף הפטור מהמכס)
  categoryDuty: {
    phones: 0, computers: 0, tablets: 0, audio: 0, gaming: 0, wearables: 0,
    appliances: 0.12, health: 0, default: 0.12,
  },
  // עמלת שחרור/טיפול של דואר ישראל/חברת שליחויות כשיש מס לתשלום
  clearanceFeeIls: 25,
};
