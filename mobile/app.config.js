// הגדרות דינמיות מעל app.json.
// google-services.json (Firebase / FCM ל-Android) לא נשמר במאגר: הוא מאוחסן ב-EAS כמשתנה סביבה מסוג קובץ
// בשם GOOGLE_SERVICES_JSON, ו-EAS מעביר בזמן הבנייה את הנתיב אליו. מקומית אפשר לשים קובץ בשם הזה בתיקייה.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const fromEas = process.env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = fromEas ?? (fs.existsSync(local) ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
