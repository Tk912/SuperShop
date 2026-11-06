// שכבת אחסון: קבצים מקומיים (פיתוח ובדיקות) או Firestore (Cloud Run).
//
//   STORAGE=firestore  → Firestore (הפרויקט מזוהה אוטומטית ב-Cloud Run; FIRESTORE_DATABASE לבסיס נתונים לא-ברירת-מחדל)
//   אחרת               → קבצים, כמו קודם (משתני הסביבה *_FILE / CACHE_DIR קובעים את הנתיבים)
//
// שני סוגי נתונים:
//  • מסמכים שלמים (doc): קטלוג נלמד, היסטוריית מחירים, רשימות מעקב, הנחות. נטענים לזיכרון בהפעלה,
//    ונכתבים חזרה כשמשהו משתנה. ב-Firestore מסמך גדול מתפצל לכמה חלקים (מגבלת 1MB למסמך).
//  • מטמון מפתח-ערך (kv): תשובות של ספקי המחירים.
//
// ב-Cloud Run המעבד מואט אחרי שהתשובה נשלחה, ולכן הכתיבות ל-Firestore נאספות ונכתבות ב-flush()
// לפני שליחת התשובה (app.js עושה את זה אוטומטית).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');
const CHUNK_CHARS = 300_000; // עברית = 2 בתים לתו → חלק של כ-600KB, מתחת למגבלת 1MB
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

// ---------- מימוש קבצים ----------
function fileBackend() {
  return {
    kind: 'file',
    loadDoc(h) {
      try { return JSON.parse(fs.readFileSync(h.file, 'utf8')); } catch { return undefined; }
    },
    saveDocNow(h) { // בקבצים כותבים מיד – פשוט ועמיד
      try { fs.mkdirSync(path.dirname(h.file), { recursive: true }); fs.writeFileSync(h.file, JSON.stringify(h.value)); } catch { /* זיכרון בלבד */ }
    },
    async kvGet(key) {
      try { return JSON.parse(fs.readFileSync(path.join(process.env.CACHE_DIR ?? ROOT, sha1(key) + '.json'), 'utf8')); } catch { return undefined; }
    },
    async kvSet(key, entry) {
      const dir = process.env.CACHE_DIR ?? ROOT;
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, sha1(key) + '.json'), JSON.stringify(entry)); } catch { /* זיכרון בלבד */ }
    },
  };
}

// ---------- מימוש Firestore ----------
// db = מופע Firestore (או מימוש מדומה בבדיקות) שתומך ב-collection().doc().get()/set() וב-batch().
export function firestoreBackend(db) {
  const state = db.collection('state');
  const cache = db.collection('cache');
  return {
    kind: 'firestore',
    async loadDocAsync(h) {
      const head = await state.doc(h.name).get();
      if (!head.exists) return undefined;
      const { parts = 1, json } = head.data();
      let text = json;
      for (let i = 1; i < parts; i++) text += (await state.doc(`${h.name}~${i}`).get()).data().json;
      return JSON.parse(text);
    },
    async writeDoc(h) {
      const text = JSON.stringify(h.value);
      const parts = Math.max(1, Math.ceil(text.length / CHUNK_CHARS));
      const batch = db.batch(); // כל החלקים נכתבים יחד – אין מצב ביניים חצי-כתוב
      for (let i = 0; i < parts; i++) {
        const json = text.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
        batch.set(state.doc(i === 0 ? h.name : `${h.name}~${i}`), i === 0 ? { json, parts, updatedAt: Date.now() } : { json });
      }
      await batch.commit();
    },
    async kvGet(key) {
      const snap = await cache.doc(sha1(key)).get();
      return snap.exists ? { at: snap.data().at, value: JSON.parse(snap.data().json) } : undefined;
    },
    async kvSet(key, entry) {
      const json = JSON.stringify(entry.value);
      if (json.length > CHUNK_CHARS) return; // תשובה חריגה – נשארת במטמון הזיכרון בלבד
      await cache.doc(sha1(key)).set({ at: entry.at, json });
    },
  };
}

// ---------- ניהול ----------
let backend = fileBackend();
const handles = [];
const dirty = new Set();
const pendingKv = new Set();

/**
 * מסמך שלם בזיכרון. modules משתמשים ב-h.value, ואחרי שינוי קוראים h.save().
 * @param name   שם המסמך (ב-Firestore: state/<name>)
 * @param init   ערך התחלתי (פונקציה) כשאין עדיין נתונים
 * @param file   נתיב הקובץ במצב קבצים
 */
export function doc(name, init, file) {
  const h = { name, init, file, value: undefined, save: () => save(h) };
  if (backend.kind === 'file') h.value = backend.loadDoc(h) ?? init(); // טעינה מיידית במצב קבצים
  else h.value = init();
  handles.push(h);
  return h;
}

function save(h) {
  if (backend.kind === 'file') backend.saveDocNow(h);
  else dirty.add(h);
}

export const kvGet = (key) => backend.kvGet(key);
export function kvSet(key, entry) {
  const p = backend.kvSet(key, entry).catch((e) => console.error('[storage] kv', e.message)).finally(() => pendingKv.delete(p));
  pendingKv.add(p);
  return p;
}

/** כותב את כל מה שהשתנה. נקרא לפני שליחת תשובה. */
export async function flush() {
  const docs = [...dirty];
  dirty.clear();
  await Promise.all([
    ...docs.map((h) => backend.writeDoc(h).catch((e) => { dirty.add(h); console.error('[storage] write', h.name, e.message); })),
    ...pendingKv,
  ]);
}

/** בוחר מימוש וטוען את כל המסמכים. חובה לפני הפעלת השרת במצב Firestore. */
export async function initStorage({ db } = {}) {
  if (!db && process.env.STORAGE !== 'firestore') return backend.kind;
  if (!db) {
    const { Firestore } = await import('@google-cloud/firestore');
    db = new Firestore({ ...(process.env.FIRESTORE_DATABASE ? { databaseId: process.env.FIRESTORE_DATABASE } : {}), ignoreUndefinedProperties: true });
  }
  backend = firestoreBackend(db);
  for (const h of handles) {
    const loaded = await backend.loadDocAsync(h);
    h.value = loaded ?? h.init();
    h.onLoad?.(h.value);
  }
  return backend.kind;
}

export const storageKind = () => backend.kind;
