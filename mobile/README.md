# משווה – אפליקציית מובייל (iOS + Android)

אפליקציית Expo (React Native) שמתחברת לשרת שבתיקייה הראשית (`../server`). כל חישובי המחיר, ההנחות, המשלוח והמסים נעשים בשרת.

## הרצה
```bash
# טרמינל 1 – השרת (מתיקיית השורש)
npm start
# טרמינל 2 – האפליקציה
cd mobile && npm install && npx expo start
```
סורקים את קוד ה-QR באפליקציית Expo Go בטלפון. הטלפון והמחשב צריכים להיות באותה רשת.
האפליקציה פונה אוטומטית לשרת שבפורט 3000 על המחשב שמריץ את Expo. אפשר גם לקבוע כתובת אחרת:
```bash
EXPO_PUBLIC_API_URL=https://api.example.com npx expo start
```

## מה יש באפליקציה
- חיפוש עם השלמה אוטומטית ותמונות, ושורה בסוף הרשימה לחיפוש בכל החנויות
- השוואה עד הבית: משלוח ישיר או שילוח צד ג', מע״מ, מכס, ותג "אזל מהמלאי"
- **מעקב מחיר:** שמירה למועדפים עם המחיר באותו רגע, מחיר יעד, וסימון ירידות מחיר. הכול נשמר במכשיר
- **היסטוריית מחירים:** המחיר הכי נמוך שנראה ב-90 הימים האחרונים
- **סריקת ברקוד** (EAN/UPC) במצלמה, שמובילה ישר להשוואה. במכשיר אמיתי בלבד
- מיתוג: לוגו SuperShop. אייקון ל-iOS ול-Android (כולל אייקון מונוכרומטי) ומסך פתיחה. המקור: `assets/brand/supershop-logo-original.jpg`

## מבנה
- `src/app/`: מסכים (Expo Router). דף הבית, תוצאות חיפוש, `product/[id]` להשוואה, ו-`clubs` לבחירת מועדונים.
- `src/components/`: תיבת חיפוש עם השלמה אוטומטית, כרטיס הצעה, רשת מוצרים, שבבי מועדונים.
- `src/lib/`: לקוח API, ערכת צבעים (בהיר/כהה), שמירת המועדונים במכשיר (AsyncStorage).
- כיווניות RTL נכפית דרך התוסף `expo-localization` (`forcesRTL`) בקובץ `app.json`.

## חיבור לפרויקט supershop ב-Expo
האפליקציה מוגדרת עם `slug: "supershop"`, ויש לה `eas.json` עם שלושה פרופילי בנייה:
- `development`: בניית פיתוח עם expo-dev-client.
- `preview`: קובץ APK להתקנה ישירה, ו-iOS בהפצה פנימית.
- `production`: לחנויות.

החלק היחיד שחסר הוא הקישור לפרויקט שלכם ב-Expo. במחשב שלכם, מתיקיית `mobile`:

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init
```
`eas init` שואלת איזה חשבון הוא הבעלים ומקשרת לפרויקט supershop. היא מוסיפה ל-`app.json` את `owner` ואת `extra.eas.projectId`, ו-`projectId` הוא מה שנדרש להתראות push.

כתובת השרת לכל סביבה:
```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://<כתובת-השרת> --environment preview --environment production --visibility plaintext
```

בנייה ראשונה לבדיקה, APK ל-Android שמתקינים ישירות בטלפון:
```bash
npx eas-cli@latest build --profile preview --platform android
```
ל-iPhone צריך חשבון Apple Developer (99$ לשנה): `--platform ios`.

> התראות push לא עובדות ב-Expo Go. צריך בנייה (`preview` או `development`) ומכשיר אמיתי. ב-Android צריך גם להגדיר FCM: `npx eas-cli@latest credentials`.

## בנייה לחנויות
```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```
דרוש חשבון Expo, וגם חשבון מפתח של Apple ($99 לשנה) ושל Google Play ($25 חד-פעמי).
