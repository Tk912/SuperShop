# פריסת השרת ל-Firebase / Google Cloud

השרת רץ ב-**Cloud Run** בפרויקט `supershop-17b37`.
- **אחסון:** מסד הנתונים **Firestore**.
- **התראות מחיר:** **Cloud Scheduler** מפעיל את הבדיקה כל 6 שעות.

הפריסה נעשית אוטומטית מ-GitHub בכל עדכון של `main` (`.github/workflows/deploy-server.yml`).

## הגדרה חד-פעמית (כ-10 דקות)

### 1. חשבון שירות לפריסה
ב-[Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=supershop-17b37):
1. **Create service account**. שם: `github-deployer`.
2. תפקידים (Roles):
   - **Editor**
   - **Cloud Run Admin**: מאפשר לפתוח את השרת לגישה ציבורית.
   - **Service Account User**
3. נכנסים לחשבון שנוצר: **Keys → Add key → Create new key → JSON**. הקובץ יורד למחשב.

> את המפתח שומרים רק ב-GitHub Secrets, לא בקוד ולא בצ'אט. אחרי שמוסיפים אותו לסודות של GitHub, מוחקים את הקובץ מהמחשב.

### 2. סודות ב-GitHub
ב-[Settings → Secrets and variables → Actions](https://github.com/Tk912/SuperShop/settings/secrets/actions) → **New repository secret**:

| שם | ערך |
|---|---|
| `GCP_SA_KEY` | כל התוכן של קובץ ה-JSON מהשלב הקודם |
| `SEARCHAPI_KEY` | המפתח מ-searchapi.io |
| `ADMIN_TOKEN` | סיסמה ארוכה שתמציאו (לדף הניהול `/admin.html`) |

### 3. פריסה
עדכון ל-`main` מפעיל את הפריסה אוטומטית. אפשר גם להפעיל ידנית: **Actions → Deploy server → Run workflow**.
בסיום, כתובת השרת מופיעה בסיכום של הריצה. היא נראית בערך כך: `https://supershop-api-xxxxx.me-west1.run.app`.

### 4. חיבור האפליקציה לשרת
את הכתובת מגדירים ב-EAS לסביבות הבנייה, ואז בונים מחדש:
```bash
cd mobile
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://<הכתובת> --environment preview --environment production --visibility plaintext
npx eas-cli@latest build --profile preview --platform android
```

## מה כדאי לדעת
- **עלות:** תוכנית Blaze. בשימוש נמוך ההוצאה בדרך כלל בתוך המכסה החינמית. כדאי להגדיר [התראת תקציב](https://console.cloud.google.com/billing/budgets).
- **מופע אחד:** השרת רץ עם `max-instances=1`. הנתונים נשמרים כמסמכים שלמים, ושני מופעים במקביל עלולים לדרוס זה את זה. כשיהיו הרבה משתמשים, צריך לעבור למסמך נפרד לכל רשומה.
- **הרשאות ל-Firestore:** השרת ניגש ל-Firestore עם חשבון השירות שמוגדר כברירת מחדל ב-Cloud Run, ובפרויקטים רגילים יש לו הרשאה. אם בלוגים מופיעה השגיאה `PERMISSION_DENIED`, מוסיפים לחשבון `…-compute@developer.gserviceaccount.com` את התפקיד **Cloud Datastore User**.
- **כשיהיו הרבה משתמשים:** מומלץ להעביר את `SEARCHAPI_KEY` ו-`ADMIN_TOKEN` ל-Secret Manager במקום משתני סביבה.
